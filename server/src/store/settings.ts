import fs from 'fs';
import path from 'path';
import { DATA_DIR, moveFile } from '../paths';
import crypto from 'crypto';
import os from 'os';
import { ModerationCategory, Platform } from './types';
import type { Rule } from '../services/ruleEngine';

export type { Rule } from '../services/ruleEngine';

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ALGORITHM = 'aes-256-gcm';

export type Sensitivity = 'lenient' | 'balanced' | 'strict';
export type LinkPolicy = 'allow' | 'suppress' | 'ban'; // suppress = delete message + timeout; ban = delete message + ban

/** Bump when the on-disk shape changes in a way `migrate()` has to handle. */
export const SETTINGS_SCHEMA_VERSION = 4;

export interface TwitchSettings {
    enabled: boolean;
    username: string;
    channel: string;
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
}

export interface YouTubeSettings {
    enabled: boolean;
    channel: string; // @handle or UC... channel id
    videoIdOverride?: string; // watch a specific live video instead of auto-detecting
    clientId: string; // Google Cloud OAuth client (YouTube Data API v3)
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
}

export interface TikTokSettings {
    enabled: boolean;
    username: string;
    signApiKey?: string; // optional Euler Stream key for higher rate limits
}

export interface PlatformSettingsMap {
    twitch: TwitchSettings;
    youtube: YouTubeSettings;
    tiktok: TikTokSettings;
}

export interface ModerationSettings {
    sensitivity: Sensitivity;
    categories: Record<ModerationCategory, boolean>;
    skipTrustedRoles: boolean; // don't analyze broadcaster / platform moderators
    links: LinkPolicy; // every non-allowlisted link becomes a card the streamer must approve
    linkAllowlist: string[]; // domains that never get flagged (parent domains match subdomains)
    linksAuto: boolean; // execute link cards automatically after the grace period (needs autoEnabled)
    rules: Rule[]; // deterministic rules, evaluated in order before the AI
    autoEnabled: boolean; // master switch for automatic execution (rules/links only, never AI verdicts)
    autoGraceSeconds: number; // countdown during which a card can be held or dismissed
}

export interface AppSettings {
    schemaVersion: number;

    // General
    isSetupComplete: boolean;
    checkForUpdates: boolean; // ask GitHub Releases for a newer version

    // Preferences
    aiLanguage: string;
    defaultTimeoutDuration: number;
    retentionDays: number; // purge users inactive for this long (0 = never); banned users are kept

    moderation: ModerationSettings;

    platforms: PlatformSettingsMap;

    // AI
    ai: {
        provider: 'ollama' | 'google';
        model: string;
        apiKey?: string; // Optional for Ollama
    };
}

export const DEFAULT_SETTINGS: AppSettings = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    isSetupComplete: false,
    checkForUpdates: true,
    aiLanguage: 'English',
    defaultTimeoutDuration: 600,
    retentionDays: 90,
    moderation: {
        sensitivity: 'balanced',
        categories: { hate: true, harassment: true, threat: true, spam: true, vulgarity: true, other: true },
        skipTrustedRoles: true,
        links: 'allow',
        linkAllowlist: [],
        linksAuto: false,
        rules: [],
        autoEnabled: false,
        autoGraceSeconds: 10,
    },
    platforms: {
        twitch: { enabled: false, username: '', channel: '', clientId: '', clientSecret: '' },
        youtube: { enabled: false, channel: '', clientId: '', clientSecret: '' },
        tiktok: { enabled: false, username: '' },
    },
    ai: {
        provider: 'ollama',
        model: 'gemma3:4b',
    },
};

interface EncryptedData {
    iv: string;
    authTag: string;
    content: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Recursively fills missing keys from `defaults`; values in `value` win. */
export function withDefaults<T>(defaults: T, value: unknown): T {
    if (!isObject(defaults) || !isObject(value)) return (value === undefined ? defaults : value) as T;
    const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
    for (const [k, v] of Object.entries(value)) {
        out[k] = k in (defaults as object) ? withDefaults((defaults as Record<string, unknown>)[k], v) : v;
    }
    return out as T;
}

/**
 * Upgrades a settings object written by an older version to the current schema.
 * Returns the (possibly new) object and whether anything changed.
 */
export function migrate(parsed: Record<string, unknown>): { settings: Record<string, unknown>; changed: boolean } {
    let out = parsed;
    let changed = false;
    const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;

    // v1 -> v2: single-platform layout `{ twitch: {...} }` becomes `platforms.twitch`.
    if (version < 2 && isObject(out.twitch) && !out.platforms) {
        const twitch = out.twitch as Partial<TwitchSettings>;
        const { twitch: _drop, ...rest } = out;
        out = {
            ...rest,
            platforms: {
                twitch: { ...twitch, enabled: !!twitch.username && !!twitch.channel },
            },
        };
        changed = true;
    }

    // v2 -> v3: link policy 'flag' / 'block' collapsed into 'suppress' (delete + timeout).
    if (version < 3 && isObject(out.moderation)) {
        const links = (out.moderation as Record<string, unknown>).links;
        if (links === 'flag' || links === 'block') {
            out = { ...out, moderation: { ...(out.moderation as Record<string, unknown>), links: 'suppress' } };
            changed = true;
        }
    }

    // v3 -> v4: rules / auto mode / retention — new keys only, filled by withDefaults().

    if (version < SETTINGS_SCHEMA_VERSION) {
        out = { ...out, schemaVersion: SETTINGS_SCHEMA_VERSION };
        changed = true;
    }
    return { settings: out, changed };
}

/** Moves an unreadable settings file aside so a fresh setup never destroys it. */
function setAside(file: string, why: string): string | null {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = `${file}.unreadable-${stamp}`;
    try {
        moveFile(file, target);
        console.error(`[Settings] ${why}. The file was kept as ${target}; starting with default settings.`);
        return target;
    } catch (err) {
        console.error(`[Settings] ${why}, and the file could not be moved aside:`, err);
        return null;
    }
}

export class SettingsStore {
    private settings: AppSettings;
    private encryptionKey: Buffer;

    constructor() {
        this.encryptionKey = this.deriveMachineKey();
        this.settings = this.load();
    }

    private deriveMachineKey(): Buffer {
        // Machine-bound key derivation: specific to Hostname + Username
        const machineId = `${os.hostname()}-${os.userInfo().username}`;
        const salt = 'TwitchWatcher-Secure-Salt'; // Static salt is fine here as we rely on machine uniqueness
        return crypto.pbkdf2Sync(machineId, salt, 100000, 32, 'sha256');
    }

    private encrypt(text: string): EncryptedData {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            iv: iv.toString('hex'),
            content: encrypted,
            authTag: cipher.getAuthTag().toString('hex'),
        };
    }

    private decrypt(data: EncryptedData): string {
        const iv = Buffer.from(data.iv, 'hex');
        const authTag = Buffer.from(data.authTag, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(data.content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    public get(): AppSettings {
        return JSON.parse(JSON.stringify(this.settings));
    }

    public update(partial: Partial<AppSettings> | ((current: AppSettings) => Partial<AppSettings>)) {
        const updates = typeof partial === 'function' ? partial(this.get()) : partial;
        this.settings = withDefaults(this.settings, { ...this.settings, ...updates });
        this.save();
    }

    /** Replaces everything (backup import). */
    public replace(settings: AppSettings) {
        this.settings = withDefaults(DEFAULT_SETTINGS, settings);
        this.save();
    }

    // Specific updaters for nested objects to make usage easier
    public updatePlatform<P extends Platform>(platform: P, updates: Partial<PlatformSettingsMap[P]>) {
        this.settings.platforms[platform] = { ...this.settings.platforms[platform], ...updates };
        this.save();
    }

    public updateAI(updates: Partial<AppSettings['ai']>) {
        this.settings.ai = { ...this.settings.ai, ...updates };
        this.save();
    }

    public updateModeration(updates: Partial<ModerationSettings>) {
        this.settings.moderation = withDefaults(this.settings.moderation, updates);
        this.save();
    }

    private load(): AppSettings {
        if (!fs.existsSync(SETTINGS_FILE)) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

        let parsed: any;
        try {
            parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        } catch {
            setAside(SETTINGS_FILE, 'settings.json is not valid JSON');
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }

        let plain: Record<string, unknown>;
        let wasEncrypted = false;
        if (parsed && parsed.iv && parsed.content && parsed.authTag) {
            try {
                plain = JSON.parse(this.decrypt(parsed as EncryptedData));
                wasEncrypted = true;
            } catch {
                setAside(SETTINGS_FILE, 'Failed to decrypt settings.json (machine signature mismatch?)');
                return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            }
        } else if (isObject(parsed)) {
            plain = parsed; // plain JSON written by a very old version
        } else {
            setAside(SETTINGS_FILE, 'settings.json has an unexpected shape');
            return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }

        const { settings: migrated, changed } = migrate(plain);
        const result = withDefaults(DEFAULT_SETTINGS, migrated);

        if (changed || !wasEncrypted) {
            // Keep a copy of the pre-migration file, then persist the upgraded (encrypted) shape.
            try {
                fs.copyFileSync(SETTINGS_FILE, `${SETTINGS_FILE}.bak`);
            } catch (err) {
                console.warn('[Settings] Could not write settings.json.bak:', err);
            }
            this.settings = result;
            this.save();
            console.log(`[Settings] Migrated settings.json to schema v${SETTINGS_SCHEMA_VERSION} (backup: settings.json.bak)`);
        }
        return result;
    }

    private save() {
        try {
            const jsonStr = JSON.stringify(this.settings);
            const encrypted = this.encrypt(jsonStr);
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(encrypted, null, 2));
        } catch (e) {
            console.error('Failed to save settings.json', e);
        }
    }
}

export const settingsStore = new SettingsStore();

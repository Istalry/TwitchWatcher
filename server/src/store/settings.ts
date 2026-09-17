import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../paths';
import crypto from 'crypto';
import os from 'os';
import { ModerationCategory, Platform } from './types';

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ALGORITHM = 'aes-256-gcm';

export type Sensitivity = 'lenient' | 'balanced' | 'strict';

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
}

export interface AppSettings {
    // General
    isSetupComplete: boolean;

    // Preferences
    aiLanguage: string;
    defaultTimeoutDuration: number;

    moderation: ModerationSettings;

    platforms: PlatformSettingsMap;

    // AI
    ai: {
        provider: 'ollama' | 'google';
        model: string;
        apiKey?: string; // Optional for Ollama
    };
}

const DEFAULT_SETTINGS: AppSettings = {
    isSetupComplete: false,
    aiLanguage: 'English',
    defaultTimeoutDuration: 600,
    moderation: {
        sensitivity: 'balanced',
        categories: { hate: true, harassment: true, threat: true, spam: true, vulgarity: true, other: true },
        skipTrustedRoles: true,
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
function withDefaults<T>(defaults: T, value: unknown): T {
    if (!isObject(defaults) || !isObject(value)) return (value === undefined ? defaults : value) as T;
    const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
    for (const [k, v] of Object.entries(value)) {
        out[k] = k in (defaults as object) ? withDefaults((defaults as Record<string, unknown>)[k], v) : v;
    }
    return out as T;
}

/** Upgrades a settings object from the single-platform (Twitch-only) layout. */
function migrate(parsed: Record<string, unknown>): Record<string, unknown> {
    if (isObject(parsed.twitch) && !parsed.platforms) {
        const twitch = parsed.twitch as Partial<TwitchSettings>;
        const { twitch: _drop, ...rest } = parsed;
        return {
            ...rest,
            platforms: {
                twitch: { ...twitch, enabled: !!twitch.username && !!twitch.channel },
            },
        };
    }
    return parsed;
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
        if (fs.existsSync(SETTINGS_FILE)) {
            try {
                const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
                const parsed = JSON.parse(raw);

                // Check if file is encrypted (has encryption fields)
                if (parsed.iv && parsed.content && parsed.authTag) {
                    try {
                        const decryptedJson = this.decrypt(parsed as EncryptedData);
                        return withDefaults(DEFAULT_SETTINGS, migrate(JSON.parse(decryptedJson)));
                    } catch (e) {
                        console.error('Failed to decrypt settings.json. Machine signature mismatch?');
                        // Return default, forcing re-setup if key implies different machine
                        return { ...DEFAULT_SETTINGS };
                    }
                } else {
                    // Migration: Handle plain JSON if it exists from previous version
                    // We will save it encrypted immediately after loading
                    const migrated = withDefaults(DEFAULT_SETTINGS, migrate(parsed));
                    this.settings = migrated; // Set temporarily so save works
                    this.save();
                    return migrated;
                }
            } catch (e) {
                console.error('Failed to load settings.json', e);
            }
        }
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
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

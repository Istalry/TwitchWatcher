import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// Check if running inside pkg (compiled executable)
const isPkg = (process as any).pkg;
const ROOT_DIR = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '../../');
const SETTINGS_FILE = path.join(ROOT_DIR, 'settings.json');
const ALGORITHM = 'aes-256-gcm';

export interface AppSettings {
    // General
    isSetupComplete: boolean;

    // Preferences
    aiLanguage: string;
    defaultTimeoutDuration: number;

    // Twitch
    twitch: {
        username: string;
        channel: string;
        clientId: string;
        clientSecret: string;
        accessToken?: string;
        refreshToken?: string;
    };

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
    twitch: {
        username: '',
        channel: '',
        clientId: '',
        clientSecret: '',
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
        if (typeof partial === 'function') {
            const updates = partial(this.settings);
            this.settings = { ...this.settings, ...updates };
        } else {
            this.settings = { ...this.settings, ...partial };
        }
        this.save();
    }

    // Specific updaters for nested objects to make usage easier
    public updateTwitch(updates: Partial<AppSettings['twitch']>) {
        this.settings.twitch = { ...this.settings.twitch, ...updates };
        this.save();
    }

    public updateAI(updates: Partial<AppSettings['ai']>) {
        this.settings.ai = { ...this.settings.ai, ...updates };
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
                        return { ...DEFAULT_SETTINGS, ...JSON.parse(decryptedJson) };
                    } catch (e) {
                        console.error('Failed to decrypt settings.json. Machine signature mismatch?');
                        // Return default, forcing re-setup if key implies different machine
                        return { ...DEFAULT_SETTINGS };
                    }
                } else {
                    // Migration: Handle plain JSON if it exists from previous version
                    // We will save it encrypted immediately after loading
                    const migrated = { ...DEFAULT_SETTINGS, ...parsed };
                    this.settings = migrated; // Set temporarily so save works
                    this.save();
                    return migrated;
                }
            } catch (e) {
                console.error('Failed to load settings.json', e);
            }
        }
        return { ...DEFAULT_SETTINGS };
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

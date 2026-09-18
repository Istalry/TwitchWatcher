/**
 * Password-protected settings backup (.twbackup). Unlike settings.json, which is bound to the
 * machine, a backup can be restored anywhere by whoever knows the password.
 */
import crypto from 'crypto';
import { AppSettings, DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION, migrate, withDefaults } from '../store/settings';

const FORMAT = 'twbackup';
const VERSION = 1;
const KDF_ITERATIONS = 200_000;
export const MIN_PASSWORD_LENGTH = 8;

interface BackupFile {
    format: typeof FORMAT;
    version: number;
    schemaVersion: number;
    exportedAt: string;
    kdf: { salt: string; iterations: number };
    iv: string;
    authTag: string;
    content: string;
}

const deriveKey = (password: string, salt: Buffer, iterations: number) =>
    crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

export function exportSettings(settings: AppSettings, password: string): string {
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = deriveKey(password, salt, KDF_ITERATIONS);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const content = Buffer.concat([cipher.update(JSON.stringify(settings), 'utf8'), cipher.final()]);

    const file: BackupFile = {
        format: FORMAT,
        version: VERSION,
        schemaVersion: settings.schemaVersion ?? SETTINGS_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        kdf: { salt: salt.toString('base64'), iterations: KDF_ITERATIONS },
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        content: content.toString('base64'),
    };
    return JSON.stringify(file, null, 2);
}

/** Decrypts and upgrades a backup; throws with a user-facing message on any problem. */
export function importSettings(text: string, password: string): AppSettings {
    let file: Partial<BackupFile>;
    try {
        file = JSON.parse(text);
    } catch {
        throw new Error('This is not a TwitchWatcher backup file');
    }
    if (!file || file.format !== FORMAT || !file.kdf || !file.iv || !file.authTag || !file.content) {
        throw new Error('This is not a TwitchWatcher backup file');
    }
    if ((file.version ?? 0) > VERSION) throw new Error('This backup was made by a newer version of TwitchWatcher');

    let plain: string;
    try {
        const key = deriveKey(password, Buffer.from(file.kdf.salt, 'base64'), file.kdf.iterations || KDF_ITERATIONS);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(file.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(file.authTag, 'base64'));
        plain = Buffer.concat([decipher.update(Buffer.from(file.content, 'base64')), decipher.final()]).toString('utf8');
    } catch {
        throw new Error('Wrong password, or the backup file is damaged');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(plain);
    } catch {
        throw new Error('The backup content is damaged');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The backup content is damaged');

    const { settings } = migrate(parsed as Record<string, unknown>);
    return withDefaults(DEFAULT_SETTINGS, settings);
}

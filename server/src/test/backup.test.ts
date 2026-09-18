import { describe, expect, it } from 'vitest';
import { exportSettings, importSettings } from '../services/backup';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION, withDefaults, type AppSettings } from '../store/settings';

const settings: AppSettings = withDefaults(DEFAULT_SETTINGS, {
    isSetupComplete: true,
    aiLanguage: 'Français',
    moderation: { sensitivity: 'strict', linkAllowlist: ['twitch.tv'] },
    platforms: { twitch: { enabled: true, username: 'bot', channel: 'chan', clientId: 'id', clientSecret: 'secret', accessToken: 'tok' } },
    ai: { provider: 'google', model: 'gemini', apiKey: 'AIza-test' },
});

describe('backup', () => {
    it('round-trips settings, including secrets, with the right password', () => {
        const file = exportSettings(settings, 'correct horse');
        const parsed = JSON.parse(file);
        expect(parsed.format).toBe('twbackup');
        expect(file).not.toContain('secret');
        expect(file).not.toContain('AIza-test');

        const restored = importSettings(file, 'correct horse');
        expect(restored).toEqual(settings);
    });

    it('rejects a short password on export', () => {
        expect(() => exportSettings(settings, 'short')).toThrow(/at least 8 characters/);
    });

    it('rejects a wrong password, a tampered file and non-backup input', () => {
        const file = exportSettings(settings, 'correct horse');
        expect(() => importSettings(file, 'wrong password')).toThrow(/Wrong password/);

        const tampered = JSON.parse(file);
        tampered.content = tampered.content.slice(0, -8) + 'AAAAAAAA';
        expect(() => importSettings(JSON.stringify(tampered), 'correct horse')).toThrow(/Wrong password, or the backup file is damaged/);

        expect(() => importSettings('{"hello":"world"}', 'correct horse')).toThrow(/not a TwitchWatcher backup/);
        expect(() => importSettings('not json', 'correct horse')).toThrow(/not a TwitchWatcher backup/);
    });

    it('upgrades an old-schema backup on import', () => {
        const old = { isSetupComplete: true, twitch: { username: 'bot', channel: 'chan', clientId: 'a', clientSecret: 'b' } } as unknown as AppSettings;
        const restored = importSettings(exportSettings(old, 'correct horse'), 'correct horse');
        expect(restored.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
        expect(restored.platforms.twitch).toMatchObject({ enabled: true, username: 'bot' });
        expect(restored.moderation.rules).toEqual([]);
    });
});

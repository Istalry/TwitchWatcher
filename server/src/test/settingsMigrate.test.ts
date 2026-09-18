import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION, migrate, withDefaults } from '../store/settings';

describe('migrate', () => {
    it('moves the v1 twitch block under platforms and stamps the schema version', () => {
        const v1 = {
            isSetupComplete: true,
            aiLanguage: 'Français',
            twitch: { username: 'bot', channel: 'chan', clientId: 'id', clientSecret: 'sec', accessToken: 'tok' },
            ai: { provider: 'ollama', model: 'gemma3:4b' },
        };

        const { settings, changed } = migrate(v1);

        expect(changed).toBe(true);
        expect(settings.twitch).toBeUndefined();
        expect(settings.platforms).toEqual({
            twitch: { username: 'bot', channel: 'chan', clientId: 'id', clientSecret: 'sec', accessToken: 'tok', enabled: true },
        });
        expect(settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
        expect(settings.aiLanguage).toBe('Français');
    });

    it('leaves a current file untouched', () => {
        const current = { schemaVersion: SETTINGS_SCHEMA_VERSION, platforms: { twitch: { enabled: false } } };
        expect(migrate(current)).toEqual({ settings: current, changed: false });
    });

    it('only stamps the version when a v2-shaped file lacks it', () => {
        const { settings, changed } = migrate({ platforms: { tiktok: { enabled: true, username: 'x' } } });
        expect(changed).toBe(true);
        expect(settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
        expect(settings.platforms).toEqual({ tiktok: { enabled: true, username: 'x' } });
    });
});

describe('withDefaults', () => {
    it('fills missing nested keys and keeps arrays from the value', () => {
        const merged = withDefaults(DEFAULT_SETTINGS, {
            moderation: { sensitivity: 'strict', linkAllowlist: ['twitch.tv'] },
            platforms: { twitch: { enabled: true, username: 'bot' } },
        });

        expect(merged.moderation.sensitivity).toBe('strict');
        expect(merged.moderation.links).toBe('allow');
        expect(merged.moderation.linkAllowlist).toEqual(['twitch.tv']);
        expect(merged.moderation.categories.hate).toBe(true);
        expect(merged.platforms.twitch.channel).toBe('');
        expect(merged.platforms.youtube.enabled).toBe(false);
        expect(merged.checkForUpdates).toBe(true);
    });
});

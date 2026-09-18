import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from '../components/Settings';
import { DEFAULT_PLATFORM_SETTINGS, type AppSettings } from '../types';

const baseSettings: AppSettings = {
    schemaVersion: 2,
    isSetupComplete: true,
    checkForUpdates: true,
    aiLanguage: 'English',
    defaultTimeoutDuration: 600,
    retentionDays: 90,
    moderation: {
        sensitivity: 'balanced',
        categories: { hate: true, harassment: true, threat: true, spam: true, vulgarity: true, other: true },
        skipTrustedRoles: true,
        links: 'suppress',
        linkAllowlist: ['youtube.com'],
        linksAuto: false,
        rules: [],
        autoEnabled: false,
        autoGraceSeconds: 10,
    },
    platforms: DEFAULT_PLATFORM_SETTINGS,
    ai: { provider: 'ollama', model: 'gemma3:4b' },
};

const fetchMock = vi.fn();

beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/settings' && init?.method === 'PUT') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
        }
        if (url === '/api/settings') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(baseSettings) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', vi.fn());
});

describe('Settings — links and general', () => {
    it('loads the link policy and allowlist from the server', async () => {
        render(<Settings info={{ version: '2.0.0', dataDir: 'C:\\Users\\me\\AppData\\Roaming\\TwitchWatcher', update: null }} />);

        await waitFor(() => expect(screen.getByRole('radio', { name: /Suppress/ })).toHaveAttribute('aria-checked', 'true'));
        expect(screen.getByLabelText(/Allowed domains/)).toHaveValue('youtube.com');
        expect(screen.getByTestId('data-dir')).toHaveTextContent('AppData\\Roaming\\TwitchWatcher');
        expect(screen.getByLabelText(/Check GitHub for new releases/)).toBeChecked();
    });

    it('hides the allowlist when links are allowed and sends a normalized list on save', async () => {
        render(<Settings />);
        await waitFor(() => expect(screen.getByLabelText(/Allowed domains/)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/Allowed domains/), { target: { value: 'https://www.Twitch.tv/foo\nDiscord.gg\n\ntwitch.tv' } });
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({ method: 'PUT' })));
        const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')!;
        const body = JSON.parse((putCall[1] as RequestInit).body as string) as AppSettings;
        expect(body.moderation.linkAllowlist).toEqual(['twitch.tv', 'discord.gg']);

        fireEvent.click(screen.getByRole('radio', { name: /Allow/ }));
        expect(screen.queryByLabelText(/Allowed domains/)).not.toBeInTheDocument();
    });
});

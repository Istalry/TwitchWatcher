import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import open from 'open';

import { historyStore } from './store/history';
import { banRegistry } from './store/banRegistry';
import { actionQueue, ActionEvent } from './store/actionQueue';
import { settingsStore, AppSettings, PlatformSettingsMap } from './store/settings';
import { ChatMessage, PLATFORMS, Platform, userKey } from './store/types';
import { authService } from './services/authService';
import { googleAuth } from './services/googleAuth';
import { aiService } from './services/ai/aiService';
import { analysisQueue } from './services/analysisQueue';
import { chatHub } from './services/chatHub';
import { platformRegistry, isPlatform } from './platforms/registry';
import { updateChecker } from './services/updateCheck';
import { APP_VERSION } from './version';
import { DATA_DIR } from './paths';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from 'public' directory (Client Build)
app.use(express.static(path.join(__dirname, '../public')));

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Lowercases, trims, strips schemes/paths and de-duplicates a list of domains. */
const normalizeAllowlist = (list: unknown[]): string[] => Array.from(new Set(
    list
        .map(v => String(v).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
        .filter(Boolean),
));

/** First enabled platform that still needs an OAuth round-trip, if any. */
function nextAuthUrl(): string | null {
    const p = settingsStore.get().platforms;
    if (p.twitch.enabled && p.twitch.clientId && !p.twitch.accessToken) return '/auth/twitch';
    if (p.youtube.enabled && p.youtube.clientId && !p.youtube.accessToken) return '/auth/youtube';
    return null;
}

// --- SETUP ROUTES ---

app.get('/api/setup/status', (req, res) => {
    res.json({ isSetupComplete: settingsStore.get().isSetupComplete });
});

app.post('/api/setup', (req, res) => {
    const { platforms = {}, ai } = req.body as { platforms?: Partial<PlatformSettingsMap>; ai?: AppSettings['ai'] };

    // Validate only the platforms the user chose to enable. Enabling none is allowed.
    if (platforms.twitch?.enabled) {
        const t = platforms.twitch;
        if (!t.username || !t.channel || !t.clientId || !t.clientSecret) {
            return res.status(400).json({ error: 'Twitch: username, channel, Client ID and Client Secret are required' });
        }
    }
    if (platforms.youtube?.enabled) {
        const y = platforms.youtube;
        if (!y.channel && !y.videoIdOverride) {
            return res.status(400).json({ error: 'YouTube: channel handle is required' });
        }
    }
    if (platforms.tiktok?.enabled && !platforms.tiktok.username) {
        return res.status(400).json({ error: 'TikTok: username is required' });
    }

    settingsStore.update(s => ({
        ...s,
        platforms: {
            twitch: { ...s.platforms.twitch, ...(platforms.twitch || {}) },
            youtube: { ...s.platforms.youtube, ...(platforms.youtube || {}) },
            tiktok: { ...s.platforms.tiktok, ...(platforms.tiktok || {}) },
        },
        ai: { ...s.ai, ...(ai || {}) },
        isSetupComplete: true,
    }));

    console.log('Setup configuration received via UI.');
    platformRegistry.connectAll().catch(e => console.error('Connection attempt after setup failed:', e));

    res.json({ success: true, nextAuthUrl: nextAuthUrl() });
});

app.get('/api/status', async (req, res) => {
    const settings = settingsStore.get();
    const aiHealth = await aiService.healthCheck();

    res.json({
        ai: {
            online: aiHealth,
            provider: settings.ai.provider,
            model: settings.ai.model,
            lastError: aiService.lastError,
            ...analysisQueue.stats(),
        },
        platforms: platformRegistry.statuses(),
    });
});

// --- AUTH ROUTES ---

app.get('/auth/twitch', (req, res) => {
    const settings = settingsStore.get().platforms.twitch;
    if (!settings.clientId) {
        return res.status(400).send('Setup incomplete: Missing Twitch Client ID.');
    }
    res.redirect(authService.getAuthUrl());
});

app.get('/auth/twitch/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Authentication failed: ${error}`);
    }
    if (!code || typeof code !== 'string') {
        return res.status(400).send('Invalid code returned from Twitch');
    }

    try {
        await authService.exchangeCodeForToken(code);
        await platformRegistry.get('twitch').connect(); // Re-connect bot with new token
        res.redirect(nextAuthUrl() || '/');
    } catch (err) {
        res.status(500).send('Failed to exchange code for token. Check server logs.');
    }
});

app.get('/auth/youtube', (req, res) => {
    const settings = settingsStore.get().platforms.youtube;
    if (!settings.clientId) {
        return res.status(400).send('Setup incomplete: Missing Google OAuth Client ID.');
    }
    res.redirect(googleAuth.getAuthUrl());
});

app.get('/auth/youtube/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Authentication failed: ${error}`);
    }
    if (!code || typeof code !== 'string') {
        return res.status(400).send('Invalid code returned from Google');
    }

    try {
        await googleAuth.exchangeCodeForToken(code);
        res.redirect(nextAuthUrl() || '/');
    } catch (err) {
        res.status(500).send('Failed to exchange code for token. Check server logs.');
    }
});

// --- USERS ---

app.get('/api/users', (req, res) => {
    res.json(historyStore.getAllUsers());
});

app.get('/api/users/:key', (req, res) => {
    const user = historyStore.getUser(req.params.key);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// Manual Moderation (from Live Users / Live Chat)
app.post('/api/users/:key/moderate', async (req, res) => {
    const { key } = req.params;
    const { action } = req.body as { action: 'ban' | 'timeout' | 'unban' };

    const user = historyStore.getUser(key);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const platform = platformRegistry.get(user.platform);
    if (!['ban', 'timeout', 'unban'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }
    if (!platform.capabilities[action]) {
        return res.status(400).json({ error: `${user.platform} has no moderation API for "${action}"` });
    }

    try {
        if (action === 'ban') {
            await platform.ban(user.userId, 'Manual Ban');
        } else if (action === 'timeout') {
            const duration = settingsStore.get().defaultTimeoutDuration || 600;
            await platform.timeout(user.userId, duration, 'Manual Timeout');
        } else {
            await platform.unban(user.userId);
        }
        res.json({ success: true, message: `User ${action}ed` });
    } catch (err) {
        console.error(`Manual ${action} failed for ${key}:`, errorMessage(err));
        res.status(500).json({ error: `Failed to ${action}: ${errorMessage(err)}` });
    }
});

app.delete('/api/users', (req, res) => {
    historyStore.clearAll();
    res.json({ success: true, message: 'All user data cleared' });
});

app.delete('/api/users/:key', (req, res) => {
    historyStore.deleteUser(req.params.key);
    res.json({ success: true, message: `User ${req.params.key} deleted` });
});

// --- ACTIONS ---

app.get('/api/actions', (req, res) => {
    res.json(actionQueue.getPending());
});

// Resolve Action (Approve/Discard)
app.post('/api/actions/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const { resolution, banDuration } = req.body; // resolution: 'approved' | 'discarded'

    const action = actionQueue.get(id);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    if (action.status !== 'pending') return res.status(409).json({ error: 'Action already resolved' });

    if (resolution === 'discarded') {
        actionQueue.resolve(id, 'discarded');
        return res.json({ success: true, executed: false, message: 'Action dismissed.' });
    }

    if (resolution !== 'approved') {
        return res.status(400).json({ error: 'Invalid resolution' });
    }

    const platform = platformRegistry.get(action.platform);
    const permanent = banDuration === 'permanent';
    const capability = permanent ? 'ban' : 'timeout';

    if (!platform.capabilities[capability]) {
        // e.g. TikTok: nothing we can execute, but the review is done.
        actionQueue.resolve(id, 'approved');
        return res.json({ success: true, executed: false, message: `${action.platform} has no moderation API — handle this user in the ${action.platform} app.` });
    }

    try {
        const reason = `Moderated: ${action.flaggedReason}`;
        if (permanent) {
            await platform.ban(action.userId, reason);
        } else {
            // Default to settings value if not specified or parsed
            const duration = parseInt(banDuration) || settingsStore.get().defaultTimeoutDuration || 600;
            await platform.timeout(action.userId, duration, reason);
        }

        // Link policy: also remove the message(s). Best effort — the sanction above is what matters,
        // and Twitch/YouTube already purge a timed-out/banned user's recent chat.
        let deleted = 0;
        const deleteFailures: string[] = [];
        if (action.deleteMessages && platform.capabilities.deleteMessage) {
            for (const messageId of action.messageIds) {
                try {
                    await platform.deleteMessage(messageId);
                    deleted++;
                } catch (err) {
                    deleteFailures.push(errorMessage(err));
                }
            }
            if (deleteFailures.length) console.warn(`[resolve] ${deleteFailures.length} message deletion(s) failed on ${action.platform}:`, deleteFailures[0]);
        }

        actionQueue.resolve(id, 'approved'); // only after the platform call succeeded, so a failure can be retried
        const summary = action.deleteMessages
            ? ` ${deleted} message(s) deleted${deleteFailures.length ? `, ${deleteFailures.length} could not be deleted (${deleteFailures[0]})` : ''}.`
            : '';
        res.json({ success: true, executed: true, message: `Action approved and executed.${summary}` });
    } catch (err) {
        console.error(`Failed to execute ${capability} on ${action.platform}:`, errorMessage(err));
        res.status(500).json({ error: `Failed to execute ${capability}: ${errorMessage(err)}` });
    }
});

// --- LIVE CHAT ---

app.get('/api/chat/recent', (req, res) => {
    const limit = Math.min(500, parseInt(String(req.query.limit)) || 200);
    res.json(chatHub.recent(limit));
});

// Server-Sent Events: pushes chat messages and action-queue changes as they happen.
app.get('/api/chat/stream', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const onMessage = (msg: ChatMessage) => send('message', msg);
    const onAction = (evt: ActionEvent) => send('action', evt);

    chatHub.on('message', onMessage);
    actionQueue.on('change', onAction);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    send('ready', { pending: actionQueue.getPending().length });

    req.on('close', () => {
        clearInterval(ping);
        chatHub.off('message', onMessage);
        actionQueue.off('change', onAction);
    });
});

// --- SHUTDOWN ---

app.post('/api/shutdown', (req, res) => {
    console.log('Shutdown requested...');
    res.json({ message: 'Server shutting down...' });
    setTimeout(async () => {
        historyStore.flush();
        banRegistry.flush();
        await platformRegistry.disconnectAll();
        process.exit(0);
    }, 1000);
});

// --- DEBUG ---

app.post('/api/debug/message', (req, res) => {
    const { username, message, platform } = req.body;
    const p: Platform = isPlatform(platform) ? platform : 'twitch';
    const name = String(username || 'DebugUser');
    chatHub.publish({
        platform: p,
        userId: name.toLowerCase(),
        username: name.toLowerCase(),
        displayName: name,
        content: String(message || ''),
        timestamp: Date.now(),
        messageId: crypto.randomUUID(),
        role: 'viewer',
    });
    res.json({ success: true, message: 'Message simulated' });
});

app.post('/api/debug/flag', (req, res) => {
    const { username, message, reason, platform } = req.body;
    const p: Platform = isPlatform(platform) ? platform : 'twitch';
    const name = String(username || 'DebugUser');
    const userId = name.toLowerCase();
    // Put the message in the feed too so the card has something to highlight.
    const stored = chatHub.publish({
        platform: p,
        userId,
        username: userId,
        displayName: name,
        content: String(message || ''),
        timestamp: Date.now(),
        messageId: crypto.randomUUID(),
        role: 'broadcaster', // skipped by the analyzer so the AI doesn't double-flag it
    });
    actionQueue.addOrAppend({
        id: crypto.randomUUID(),
        platform: p,
        userId,
        userKey: userKey(p, userId),
        username: userId,
        displayName: name,
        messageContent: stored.content,
        messageIds: [stored.id],
        flaggedReason: reason || 'Manual Debug Flag',
        category: 'other',
        severity: 3,
        suggestedAction: 'timeout',
        timestamp: Date.now(),
        status: 'pending',
    });
    res.json({ success: true, message: 'Debug action created' });
});

// --- SYSTEM ---

app.get('/api/system/info', (req, res) => {
    res.json({ version: APP_VERSION, dataDir: DATA_DIR, update: updateChecker.available() });
});

app.get('/api/system/network', (req, res) => {
    const nets = os.networkInterfaces();
    let localIp = 'localhost';

    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
            if (net.family === familyV4Value && !net.internal) {
                localIp = net.address;
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }
    res.json({ ip: localIp });
});

// Google Model Listing
app.get('/api/ai/models/google', async (req, res) => {
    // API KEY source: Query param OR settings
    const apiKey = (req.query.key as string) || settingsStore.get().ai.apiKey;

    if (!apiKey) {
        return res.status(400).json({ error: 'Missing API Key' });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url);

        // Filter for "generateContent" capable models
        const models = response.data.models
            .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''));

        res.json(models);
    } catch (err: any) {
        console.error('Failed to fetch Google models:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to fetch models from Google.' });
    }
});

// --- SETTINGS ---

app.get('/api/settings', (req, res) => {
    res.json(settingsStore.get());
});

app.put('/api/settings', async (req, res) => {
    const { aiLanguage, defaultTimeoutDuration, checkForUpdates, moderation, platforms, ai } = req.body as Partial<AppSettings>;
    const before = settingsStore.get().platforms;

    settingsStore.update(current => {
        const next = { ...current };
        if (aiLanguage) next.aiLanguage = aiLanguage;
        if (defaultTimeoutDuration) next.defaultTimeoutDuration = Number(defaultTimeoutDuration);
        if (typeof checkForUpdates === 'boolean') next.checkForUpdates = checkForUpdates;
        if (moderation) {
            next.moderation = {
                ...next.moderation,
                ...moderation,
                categories: { ...next.moderation.categories, ...(moderation.categories || {}) },
                linkAllowlist: Array.isArray(moderation.linkAllowlist)
                    ? normalizeAllowlist(moderation.linkAllowlist)
                    : next.moderation.linkAllowlist,
            };
        }
        if (platforms) {
            for (const id of PLATFORMS) {
                const incoming = (platforms as Partial<PlatformSettingsMap>)[id];
                if (!incoming) continue;
                const merged = { ...next.platforms[id], ...incoming } as PlatformSettingsMap[typeof id];
                // New OAuth client → old tokens are useless.
                if ('clientId' in merged && 'clientId' in before[id]) {
                    const prev = before[id] as { clientId: string; clientSecret: string };
                    if (merged.clientId !== prev.clientId || merged.clientSecret !== prev.clientSecret) {
                        delete (merged as { accessToken?: string }).accessToken;
                        delete (merged as { refreshToken?: string }).refreshToken;
                    }
                }
                (next.platforms as unknown as Record<string, unknown>)[id] = merged;
            }
        }
        if (ai) {
            next.ai = { ...next.ai, ...ai };
        }
        return next;
    });

    // (Re)connect platforms whose configuration changed so Settings takes effect without a restart.
    const after = settingsStore.get().platforms;
    for (const id of PLATFORMS) {
        if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) {
            platformRegistry.get(id).connect().catch(e => console.error(`[${id}] reconnect failed:`, e));
        }
    }

    res.json({ success: true, settings: settingsStore.get(), nextAuthUrl: nextAuthUrl() });
});

// Fallback for SPA routing
app.get('*', (req, res) => {
    // Check if request is for API, return 404
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
        return res.status(404).json({ error: 'Not Found' });
    }
    const indexPath = path.join(__dirname, '../public/index.html');
    if (!fs.existsSync(indexPath)) {
        // Dev mode: the client is served by Vite, not from server/public.
        return res.status(404).type('text/plain').send(
            'No built client found in server/public. In development open the Vite dev server (http://localhost:5173); for a packaged build run build_exe.bat.'
        );
    }
    res.sendFile(indexPath);
});

const start = async () => {
    try {
        const PORT = process.env.PORT || 3000;
        // Start Server first so Setup/Auth routes work
        app.listen(PORT, async () => {
            const url = `http://localhost:${PORT}`;
            console.log(`TwitchWatcher v${APP_VERSION} running on ${url} (data: ${DATA_DIR})`);
            updateChecker.start();

            // Auto-open browser (set NO_BROWSER=1 to skip, e.g. when a dev client is already open)
            if (!process.env.NO_BROWSER && !process.argv.includes('--no-browser')) {
                try {
                    await open(url);
                } catch (e) {
                    console.error('Failed to open browser:', e);
                }
            }

            if (settingsStore.get().isSetupComplete) {
                console.log('Setup complete, connecting enabled platforms...');
                await platformRegistry.connectAll();
            } else {
                console.log('Setup incomplete. Waiting for user configuration via UI.');
            }
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
};

start();


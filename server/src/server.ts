import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';

import { twitchBot } from './services/twitchClient';
import { historyStore } from './store/history';
import { actionQueue } from './store/actionQueue';
import { falsePositiveStore } from './store/falsePositives';
import { settingsStore } from './store/settings';
import { authService } from './services/authService';
import open from 'open';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from 'public' directory (Client Build)
app.use(express.static(path.join(__dirname, '../public')));

// --- SETUP ROUTES ---

app.get('/api/setup/status', (req, res) => {
    res.json({ isSetupComplete: settingsStore.get().isSetupComplete });
});

app.post('/api/setup', (req, res) => {
    const { twitch, ai } = req.body;

    // Validate basics
    if (!twitch || !twitch.username || !twitch.channel || !twitch.clientId || !twitch.clientSecret) {
        return res.status(400).json({ error: 'Missing required Twitch settings' });
    }

    settingsStore.update(s => ({
        ...s,
        twitch: {
            ...s.twitch,
            ...twitch
        },
        ai: {
            ...s.ai,
            ...ai
        },
        isSetupComplete: true
    }));

    console.log('Setup configuration received via UI.');

    // Attempt connection immediately if credentials look okay
    if (twitch.username && twitch.channel) {
        console.log('Setup complete. Attempting to connect to Twitch...');
        twitchBot.connect().catch(e => console.error('Immediate connection attempt failed:', e));
    } else {
        console.log('Setup saved, but missing critical Twitch info. Waiting for auth.');
    }

    res.json({ success: true });
});

app.get('/api/twitch/status', (req, res) => {
    res.json({
        connected: twitchBot.isConnected,
        setupComplete: settingsStore.get().isSetupComplete
    });
});

// --- ROUTES ---

// 0. Auth Routes
app.get('/auth/twitch', (req, res) => {
    const settings = settingsStore.get().twitch;
    if (!settings.clientId) {
        return res.status(400).send('Setup incomplete: Missing Client ID.');
    }
    const authUrl = authService.getAuthUrl();
    res.redirect(authUrl);
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
        // Re-connect bot with new token
        await twitchBot.connect();

        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #09090b; color: #f4f4f5;">
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to the app.</p>
                    <script>window.close();</script>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Failed to exchange code for token. Check server logs.');
    }
});

// 1. Get All Users
app.get('/api/users', (req, res) => {
    const users = historyStore.getAllUsers();
    res.json(users);
});

// 2. Get Specific User Messages
app.get('/api/users/:username', (req, res) => {
    const user = historyStore.getUser(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// 3. Get Pending Actions
app.get('/api/actions', (req, res) => {
    res.json(actionQueue.getPending());
});

// 4. Resolve Action (Approve/Discard)
app.post('/api/actions/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const { resolution, banDuration } = req.body; // resolution: 'approved' | 'discarded'

    const action = actionQueue.get(id);
    if (!action) return res.status(404).json({ error: 'Action not found' });

    actionQueue.resolve(id, resolution);

    if (resolution === 'discarded') {
        // Add to false positives
        falsePositiveStore.add(action.messageContent);
        return res.json({ success: true, message: 'Action discarded, learned as false positive.' });
    }

    if (resolution === 'approved') {
        // Execute Ban/Timeout
        if (banDuration === 'permanent') {
            await twitchBot.banUser(action.username, `Moderated: ${action.flaggedReason}`);
        } else {
            // Default to settings value if not specified or parsed
            const duration = parseInt(banDuration) || settingsStore.get().defaultTimeoutDuration || 600;
            await twitchBot.timeoutUser(action.username, duration, `Moderated: ${action.flaggedReason}`);
        }
        return res.json({ success: true, message: 'Action approved and executed.' });
    }

    res.status(400).json({ error: 'Invalid resolution' });
});

// 5. Manual Moderation (from Live Users)
app.post('/api/users/:username/moderate', async (req, res) => {
    const { username } = req.params;
    const { action } = req.body; // 'ban' | 'timeout'

    try {
        if (action === 'ban') {
            await twitchBot.banUser(username, 'Manual Ban');
        } else if (action === 'timeout') {
            const duration = settingsStore.get().defaultTimeoutDuration || 600;
            await twitchBot.timeoutUser(username, duration, 'Manual Timeout');
        } else if (action === 'unban') {
            await twitchBot.unbanUser(username);
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true, message: `User ${action}ed` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to execute moderation' });
    }
});

// 6. Shutdown
app.post('/api/shutdown', (req, res) => {
    console.log('Shutdown requested...');
    res.json({ message: 'Server shutting down...' });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// 7. Debug Endpoints
app.post('/api/debug/message', async (req, res) => {
    const { username, message } = req.body;
    await twitchBot.simulateMessage(username, message);
    res.json({ success: true, message: 'Message simulated' });
});

// 10. System Network Info
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

app.post('/api/debug/flag', (req, res) => {
    const { username, message, reason } = req.body;
    actionQueue.add({
        id: crypto.randomUUID(),
        username,
        messageContent: message,
        flaggedReason: reason || 'Manual Debug Flag',
        suggestedAction: 'timeout',
        timestamp: Date.now(),
        status: 'pending'
    });
    res.json({ success: true, message: 'Debug action created' });
});

// 11. Google Model Listing
import axios from 'axios';
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

// 8. Settings
app.get('/api/settings', (req, res) => {
    res.json(settingsStore.get());
});

app.put('/api/settings', (req, res) => {
    const { aiLanguage, defaultTimeoutDuration, twitch, ai } = req.body;

    // Using a function updater to merge deeply if needed, but here simple spread is ok-ish 
    // provided we handle the nested objects carefully.
    // The previous implementation was shallow. Let's make it robust.

    settingsStore.update(current => {
        const next = { ...current };
        if (aiLanguage) next.aiLanguage = aiLanguage;
        if (defaultTimeoutDuration) next.defaultTimeoutDuration = Number(defaultTimeoutDuration);

        if (twitch) {
            next.twitch = { ...next.twitch, ...twitch };
        }
        if (ai) {
            next.ai = { ...next.ai, ...ai };
        }
        return next;
    });

    res.json({ success: true, settings: settingsStore.get() });
});

// 9. User Management
app.delete('/api/users', (req, res) => {
    historyStore.clearAll();
    res.json({ success: true, message: 'All user data cleared' });
});

app.delete('/api/users/:username', (req, res) => {
    const { username } = req.params;
    historyStore.deleteUser(username);
    res.json({ success: true, message: `User ${username} deleted` });
});

// Fallback for SPA routing
app.get('*', (req, res) => {
    // Check if request is for API, return 404
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
        return res.status(404).json({ error: 'Not Found' });
    }
    // Otherwise serve index.html
    const indexPath = path.join(__dirname, '../public/index.html');
    if (os.platform() === 'win32' || true) { // Always try to serve if exists
        res.sendFile(indexPath);
    }
});


const start = async () => {
    try {
        const PORT = process.env.PORT || 3000;
        // Start Server first so Setup/Auth routes work
        app.listen(PORT, async () => {
            const url = `http://localhost:${PORT}`;
            console.log(`Server running on ${url}`);

            // Auto-open browser
            try {
                await open(url);
            } catch (e) {
                console.error('Failed to open browser:', e);
            }

            // Try to connect Bot if setup is complete
            if (settingsStore.get().isSetupComplete) {
                console.log('Setup complete, connecting to Twitch...');
                await twitchBot.connect();
            } else {
                console.log('Setup incomplete. Waiting for user configuration via UI.');
            }
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
};

start();

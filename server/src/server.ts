import express from 'express';
import cors from 'cors';
import os from 'os';
import { config } from './config';
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

// --- ROUTES ---

// 0. Auth Routes
app.get('/auth/twitch', (req, res) => {
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
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to the app.</p>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Failed to exchange code for token. Check server logs.');
    }
});

// 1. Get All Users
app.get('/users', (req, res) => {
    const users = historyStore.getAllUsers();
    // Sort by recent activity or name? Let's just return list for now.
    res.json(users);
});

// 2. Get Specific User Messages
app.get('/users/:username', (req, res) => {
    const user = historyStore.getUser(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// 3. Get Pending Actions
app.get('/actions', (req, res) => {
    res.json(actionQueue.getPending());
});

// 4. Resolve Action (Approve/Discard)
app.post('/actions/:id/resolve', async (req, res) => {
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
            historyStore.updateUserStatus(action.username, 'banned');
        } else {
            // Default to settings value if not specified or parsed
            const duration = parseInt(banDuration) || settingsStore.get().defaultTimeoutDuration || 600;
            await twitchBot.timeoutUser(action.username, duration, `Moderated: ${action.flaggedReason}`);
            historyStore.updateUserStatus(action.username, 'timed_out');
        }
        return res.json({ success: true, message: 'Action approved and executed.' });
    }

    res.status(400).json({ error: 'Invalid resolution' });
});

// 5. Manual Moderation (from Live Users)
app.post('/users/:username/moderate', async (req, res) => {
    const { username } = req.params;
    const { action } = req.body; // 'ban' | 'timeout'

    // We should probably allow duration for timeout, skipping for brevity/default 10m
    try {
        if (action === 'ban') {
            await twitchBot.banUser(username, 'Manual Ban');
            // historyStore.updateUserStatus is called inside twitchBot.banUser now, but we'll keep it consistent
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
app.post('/shutdown', (req, res) => {
    console.log('Shutdown requested...');
    res.json({ message: 'Server shutting down...' });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// 7. Debug Endpoints
app.post('/debug/message', async (req, res) => {
    const { username, message } = req.body;
    // Simulate Twitch message (bypass tmi event usually, or call handler directly)
    // We need to access the handler. Since it's private in TwitchBot, let's expose a public method for debug.
    await twitchBot.simulateMessage(username, message);
    res.json({ success: true, message: 'Message simulated' });
});

// 10. System Network Info
app.get('/system/network', (req, res) => {
    const nets = os.networkInterfaces();
    let localIp = 'localhost';

    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or string FamilyV4
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
            if (net.family === familyV4Value && !net.internal) {
                localIp = net.address;
                // Prefer the first one found, typically WiFi or Ethernet
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }

    // Fallback if no specific IP found (should rare on a connected machine)
    res.json({ ip: localIp });
});

app.post('/debug/flag', (req, res) => {
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

// 8. Settings
app.get('/settings', (req, res) => {
    res.json(settingsStore.get());
});

app.post('/settings', (req, res) => {
    const { aiLanguage, defaultTimeoutDuration } = req.body;
    const update: Partial<any> = {};
    if (aiLanguage) update.aiLanguage = aiLanguage;
    if (defaultTimeoutDuration) update.defaultTimeoutDuration = Number(defaultTimeoutDuration);

    if (Object.keys(update).length > 0) {
        settingsStore.update(update);
    }
    res.json({ success: true, settings: settingsStore.get() });
});

// 9. User Management
app.delete('/users', (req, res) => {
    historyStore.clearAll();
    res.json({ success: true, message: 'All user data cleared' });
});

app.delete('/users/:username', (req, res) => {
    const { username } = req.params;
    historyStore.deleteUser(username);
    res.json({ success: true, message: `User ${username} deleted` });
});

// Sub-function wrapper to allow async await in top-level if needed, but not strictly required here
const start = async () => {
    try {
        // Start Twitch Bot
        await twitchBot.connect();

        // Start Server
        app.listen(config.server.port, () => {
            console.log(`Server running on http://localhost:${config.server.port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
};

start();

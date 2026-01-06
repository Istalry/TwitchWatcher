import tmi from 'tmi.js';
import { config } from '../config';
import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { ollamaService } from './ollamaService';
import { authService } from './authService';
import crypto from 'crypto';

export class TwitchBot {
    private client: tmi.Client | null = null;

    constructor() {
        // Client is initialized in connect()
    }

    private setupListeners() {
        if (!this.client) return;

        this.client.on('connected', (address, port) => {
            console.log(`Connected to ${address}:${port}`);
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;
            this.handleMessage(tags, message);
        });
    }

    private async handleMessage(tags: tmi.ChatUserstate, message: string) {
        const username = tags['display-name'] || tags.username || 'Unknown';
        console.log(`[${username}]: ${message}`);

        // store in history
        historyStore.addMessage(username, message);

        // get user history for context
        const user = historyStore.getUser(username);
        const historyContext = user ? user.messages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.content}`) : [];

        // analyze with history
        const analysis = await ollamaService.analyzeMessage(message, historyContext);

        if (analysis.flagged) {
            console.log(`FLAGGED [${username}]: ${message} (${analysis.reason})`);
            actionQueue.add({
                id: crypto.randomUUID(),
                username,
                messageContent: message,
                flaggedReason: analysis.reason || 'Unknown',
                suggestedAction: analysis.suggestedAction === 'ban' ? 'ban' : 'timeout',
                timestamp: Date.now(),
                status: 'pending'
            });
        }
    }

    public async connect() {
        try {
            const token = await authService.getToken();
            if (!token) {
                console.log('No valid Twitch token found. Waiting for authentication...');
                console.log('Please visit http://localhost:3000/auth/twitch to login.');
                return;
            }

            // Disconnect existing client if any (e.g. on re-auth)
            if (this.client) {
                try { await this.client.disconnect(); } catch (e) { /* ignore */ }
            }

            this.client = new tmi.Client({
                options: { debug: true },
                identity: {
                    username: config.twitch.username,
                    password: `oauth:${token}`,
                },
                channels: [config.twitch.channel],
            });

            this.setupListeners();
            await this.client.connect();
        } catch (err) {
            console.error('Failed to connect to Twitch:', err);
        }
    }

    public async simulateMessage(username: string, message: string) {
        // Mock tmi tags
        const tags: tmi.ChatUserstate = {
            'display-name': username,
            username: username.toLowerCase(),
        };
        await this.handleMessage(tags, message);
    }

    public async banUser(username: string, reason: string) {
        if (!this.client) { console.error('Cannot ban user: Twitch client not connected'); return; }
        try {
            await this.client.ban(config.twitch.channel, username, reason);
            historyStore.updateUserStatus(username, 'banned');
            console.log(`Banned ${username} for: ${reason}`);
        } catch (err) {
            console.error(`Failed to ban ${username}:`, err);
        }
    }

    public async timeoutUser(username: string, duration: number, reason: string) {
        if (!this.client) { console.error('Cannot timeout user: Twitch client not connected'); return; }
        try {
            await this.client.timeout(config.twitch.channel, username, duration, reason);
            historyStore.updateUserStatus(username, 'timed_out');
            console.log(`Timed out ${username} for ${duration}s: ${reason}`);
        } catch (err) {
            console.error(`Failed to timeout ${username}:`, err);
        }
    }

    public async unbanUser(username: string) {
        if (!this.client) { console.error('Cannot unban user: Twitch client not connected'); return; }
        try {
            await this.client.unban(config.twitch.channel, username);
            historyStore.updateUserStatus(username, 'active');
            console.log(`Unbanned ${username}`);
        } catch (err) {
            console.error(`Failed to unban ${username}:`, err);
        }
    }
}

export const twitchBot = new TwitchBot();

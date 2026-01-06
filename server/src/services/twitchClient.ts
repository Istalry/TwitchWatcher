import tmi from 'tmi.js';
import axios from 'axios';
import { config } from '../config';
import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { ollamaService } from './ollamaService';
import { authService } from './authService';
import crypto from 'crypto';

export class TwitchBot {
    private client: tmi.Client | null = null;
    private broadcasterId: string | null = null;

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

            // Fetch our own ID (Broadcaster ID)
            const selfData = await this.getHelixUser(config.twitch.username);
            if (selfData) {
                this.broadcasterId = selfData.id;
                console.log(`Authenticated as ${selfData.display_name} (ID: ${this.broadcasterId})`);
            }
        } catch (err) {
            console.error('Failed to connect to Twitch:', err);
        }
    }

    private async getHelixUser(username: string) {
        try {
            const token = await authService.getToken();
            if (!token) return null;

            const res = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
                headers: {
                    'Client-ID': config.twitch.clientId,
                    'Authorization': `Bearer ${token}`
                }
            });

            return res.data.data[0] || null;
        } catch (err) {
            console.error(`Failed to lookup user ${username}:`, err);
            return null;
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
        if (!this.broadcasterId) { console.error('Cannot ban: Broadcaster ID unknown'); return; }

        try {
            const targetUser = await this.getHelixUser(username);
            if (!targetUser) { console.error(`Cannot ban: User ${username} not found`); return; }

            const token = await authService.getToken();
            await axios.post(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.broadcasterId}`,
                {
                    data: {
                        user_id: targetUser.id,
                        reason: reason
                    }
                },
                {
                    headers: {
                        'Client-ID': config.twitch.clientId,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            historyStore.updateUserStatus(username, 'banned');
            console.log(`Banned ${username} for: ${reason}`);
        } catch (err: any) {
            console.error(`Failed to ban ${username}:`, err.response?.data || err.message);
        }
    }

    public async timeoutUser(username: string, duration: number, reason: string) {
        if (!this.broadcasterId) { console.error('Cannot timeout: Broadcaster ID unknown'); return; }

        try {
            const targetUser = await this.getHelixUser(username);
            if (!targetUser) { console.error(`Cannot timeout: User ${username} not found`); return; }

            const token = await authService.getToken();
            await axios.post(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.broadcasterId}`,
                {
                    data: {
                        user_id: targetUser.id,
                        duration: duration,
                        reason: reason
                    }
                },
                {
                    headers: {
                        'Client-ID': config.twitch.clientId,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            historyStore.updateUserStatus(username, 'timed_out');
            console.log(`Timed out ${username} for ${duration}s: ${reason}`);
        } catch (err: any) {
            console.error(`Failed to timeout ${username}:`, err.response?.data || err.message);
        }
    }

    public async unbanUser(username: string) {
        if (!this.broadcasterId) { console.error('Cannot unban: Broadcaster ID unknown'); return; }

        try {
            const targetUser = await this.getHelixUser(username);
            if (!targetUser) { console.error(`Cannot unban: User ${username} not found`); return; }

            const token = await authService.getToken();
            await axios.delete(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.broadcasterId}&user_id=${targetUser.id}`,
                {
                    headers: {
                        'Client-ID': config.twitch.clientId,
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            historyStore.updateUserStatus(username, 'active');
            console.log(`Unbanned ${username}`);
        } catch (err: any) {
            console.error(`Failed to unban ${username}:`, err.response?.data || err.message);
        }
    }
}

export const twitchBot = new TwitchBot();

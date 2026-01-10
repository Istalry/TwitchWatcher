import tmi from 'tmi.js';
import axios from 'axios';
import { settingsStore } from '../store/settings';
import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { analysisQueue } from './analysisQueue';
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

        // Add to analysis queue (async)
        analysisQueue.add(username, message);
    }

    public async connect() {
        try {
            const settings = settingsStore.get().twitch;

            // If setup not complete or missing credentials, don't crash, just log and wait
            if (!settings.username || !settings.channel) {
                console.log('Twitch settings missing. Waiting for setup...');
                return;
            }

            const token = await authService.getToken();
            if (!token) {
                console.log('No valid Twitch token found. Waiting for authentication...');
                // We rely on the Frontend Setup/Auth flow now.
                return;
            }

            // Disconnect existing client if any (e.g. on re-auth)
            if (this.client) {
                try { await this.client.disconnect(); } catch (e) { /* ignore */ }
            }

            this.client = new tmi.Client({
                options: { debug: true },
                identity: {
                    username: settings.username,
                    password: `oauth:${token}`,
                },
                channels: [settings.channel],
            });

            this.setupListeners();
            await this.client.connect();

            // Fetch our own ID (Broadcaster ID)
            const selfData = await this.getHelixUser(settings.username);
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
            const settings = settingsStore.get().twitch;

            const res = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
                headers: {
                    'Client-ID': settings.clientId,
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
            const settings = settingsStore.get().twitch;

            await axios.post(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.broadcasterId}`,
                {
                    data: {
                        user_id: targetUser.id,
                        reason: reason
                    }
                },
                {
                    headers: {
                        'Client-ID': settings.clientId,
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
            const settings = settingsStore.get().twitch;

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
                        'Client-ID': settings.clientId,
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
            const settings = settingsStore.get().twitch;

            await axios.delete(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.broadcasterId}&user_id=${targetUser.id}`,
                {
                    headers: {
                        'Client-ID': settings.clientId,
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
    public get isConnected(): boolean {
        return this.client?.readyState() === 'OPEN';
    }
}

export const twitchBot = new TwitchBot();

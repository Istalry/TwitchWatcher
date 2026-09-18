import tmi from 'tmi.js';
import axios from 'axios';
import crypto from 'crypto';
import { settingsStore } from '../store/settings';
import { historyStore } from '../store/history';
import { userKey, UserRole } from '../store/types';
import { authService } from '../services/authService';
import { chatHub } from '../services/chatHub';
import { ChatPlatform, PlatformCapabilities, PlatformStatus } from './types';

const HELIX = 'https://api.twitch.tv/helix';

export class TwitchPlatform implements ChatPlatform {
    public readonly id = 'twitch' as const;
    public readonly capabilities: PlatformCapabilities = { ban: true, timeout: true, unban: true, deleteMessage: true };

    private client: tmi.Client | null = null;
    private broadcasterId: string | null = null; // Channel Owner
    private moderatorId: string | null = null;   // Bot Account (Token Owner)
    private lastError: string | undefined;

    private setupListeners() {
        if (!this.client) return;

        this.client.on('connected', (address, port) => {
            console.log(`[twitch] Connected to ${address}:${port}`);
            this.lastError = undefined;
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;
            this.handleMessage(tags, message);
        });
    }

    private handleMessage(tags: tmi.ChatUserstate, message: string) {
        const username = tags.username || (tags['display-name'] || 'unknown').toLowerCase();
        const displayName = tags['display-name'] || username;
        const userId = tags['user-id'] || username;

        let role: UserRole = 'viewer';
        if (tags.badges?.broadcaster) role = 'broadcaster';
        else if (tags.mod) role = 'moderator';

        console.log(`[twitch][${displayName}]: ${message}`);

        chatHub.publish({
            platform: 'twitch',
            userId,
            username,
            displayName,
            content: message,
            timestamp: Date.now(),
            messageId: tags.id || crypto.randomUUID(),
            role,
        });
    }

    public async connect() {
        const settings = settingsStore.get().platforms.twitch;

        if (!settings.enabled) {
            await this.disconnect();
            return;
        }

        try {
            // If setup not complete or missing credentials, don't crash, just log and wait
            if (!settings.username || !settings.channel) {
                this.lastError = 'Username or channel missing';
                console.log('[twitch] Settings missing. Waiting for setup...');
                return;
            }

            const token = await authService.getToken();
            if (!token) {
                this.lastError = 'Not authenticated';
                console.log('[twitch] No valid token found. Waiting for authentication...');
                return;
            }

            // Disconnect existing client if any (e.g. on re-auth)
            await this.disconnect();

            this.client = new tmi.Client({
                options: { debug: false },
                identity: {
                    username: settings.username,
                    password: `oauth:${token}`,
                },
                channels: [settings.channel],
            });

            this.setupListeners();
            await this.client.connect();

            // 1. Fetch "Me" (Token Owner => Moderator ID)
            const meData = await this.getHelixUser(); // No params = get self
            if (meData) {
                this.moderatorId = meData.id;
                console.log(`[twitch] Authenticated as ${meData.display_name} (Moderator ID: ${this.moderatorId})`);
            }

            // 2. Fetch "Channel" (Broadcaster ID)
            const channelName = settings.channel.replace('#', '');
            const channelData = await this.getHelixUser(channelName);
            if (channelData) {
                this.broadcasterId = channelData.id;
                console.log(`[twitch] Serving channel ${channelData.display_name} (Broadcaster ID: ${this.broadcasterId})`);
            }
            this.lastError = undefined;
        } catch (err) {
            this.lastError = err instanceof Error ? err.message : String(err);
            console.error('[twitch] Failed to connect:', err);
        }
    }

    public async disconnect() {
        if (this.client) {
            try { await this.client.disconnect(); } catch (e) { /* ignore */ }
            this.client = null;
        }
    }

    public status(): PlatformStatus {
        const settings = settingsStore.get().platforms.twitch;
        return {
            enabled: settings.enabled,
            connected: this.isConnected,
            target: settings.channel || '',
            error: settings.enabled ? this.lastError : undefined,
            capabilities: this.capabilities,
        };
    }

    public get isConnected(): boolean {
        return this.client?.readyState() === 'OPEN';
    }

    private async helixHeaders() {
        const token = await authService.getToken();
        const settings = settingsStore.get().platforms.twitch;
        return {
            'Client-ID': settings.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }

    // Pass nothing to get "Me", pass username to lookup someone else
    private async getHelixUser(username?: string) {
        try {
            const token = await authService.getToken();
            if (!token) return null;

            let url = `${HELIX}/users`;
            if (username) {
                url += `?login=${encodeURIComponent(username)}`;
            }

            const res = await axios.get(url, { headers: await this.helixHeaders() });
            return res.data.data[0] || null;
        } catch (err) {
            console.error(`[twitch] Failed to lookup user ${username || 'self'}:`, err);
            return null;
        }
    }

    /** Users migrated from the pre-platform users.json carry their login as id; resolve those via Helix. */
    private async resolveUserId(userId: string): Promise<string | null> {
        if (/^\d+$/.test(userId)) return userId;
        const user = await this.getHelixUser(userId);
        return user?.id || null;
    }

    private async postBan(userId: string, body: Record<string, unknown>) {
        if (!this.broadcasterId || !this.moderatorId) throw new Error('Not connected to Twitch (IDs unknown)');
        const targetId = await this.resolveUserId(userId);
        if (!targetId) throw new Error(`User ${userId} not found`);

        const url = `${HELIX}/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}`;
        try {
            await axios.post(url, { data: { user_id: targetId, ...body } }, { headers: await this.helixHeaders() });
        } catch (err: any) {
            if (err.response?.status === 401) {
                // Cached validation was stale; refresh and retry once.
                authService.invalidate();
                await axios.post(url, { data: { user_id: targetId, ...body } }, { headers: await this.helixHeaders() });
            } else {
                throw new Error(err.response?.data?.message || err.message);
            }
        }
    }

    public async ban(userId: string, reason: string) {
        await this.postBan(userId, { reason });
        historyStore.updateUserStatus(userKey('twitch', userId), 'banned');
        console.log(`[twitch] Banned ${userId} for: ${reason}`);
    }

    public async timeout(userId: string, duration: number, reason: string) {
        await this.postBan(userId, { duration, reason });
        historyStore.updateUserStatus(userKey('twitch', userId), 'timed_out');
        console.log(`[twitch] Timed out ${userId} for ${duration}s: ${reason}`);
    }

    public async unban(userId: string) {
        if (!this.broadcasterId || !this.moderatorId) throw new Error('Not connected to Twitch (IDs unknown)');
        const targetId = await this.resolveUserId(userId);
        if (!targetId) throw new Error(`User ${userId} not found`);

        try {
            await axios.delete(
                `${HELIX}/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}&user_id=${targetId}`,
                { headers: await this.helixHeaders() }
            );
        } catch (err: any) {
            throw new Error(err.response?.data?.message || err.message);
        }

        historyStore.updateUserStatus(userKey('twitch', userId), 'active');
        console.log(`[twitch] Unbanned ${userId}`);
    }

    public async deleteMessage(messageId: string) {
        if (!this.broadcasterId || !this.moderatorId) throw new Error('Not connected to Twitch (IDs unknown)');
        try {
            await axios.delete(
                `${HELIX}/moderation/chat?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}&message_id=${encodeURIComponent(messageId)}`,
                { headers: await this.helixHeaders() }
            );
        } catch (err: any) {
            throw new Error(err.response?.data?.message || err.message);
        }
        console.log(`[twitch] Deleted message ${messageId}`);
    }
}

export const twitchPlatform = new TwitchPlatform();

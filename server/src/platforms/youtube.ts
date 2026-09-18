import axios from 'axios';
import crypto from 'crypto';
import { settingsStore } from '../store/settings';
import { historyStore } from '../store/history';
import { banRegistry } from '../store/banRegistry';
import { userKey } from '../store/types';
import { googleAuth } from '../services/googleAuth';
import { chatHub } from '../services/chatHub';
import { ChatPlatform, PlatformCapabilities, PlatformStatus } from './types';

// youtubei.js is ESM-only; load it lazily with a real dynamic import so the
// CommonJS server still starts when the package can't be loaded.
type YouTubeModule = typeof import('youtubei.js', { with: { 'resolution-mode': 'import' } });
type Innertube = import('youtubei.js', { with: { 'resolution-mode': 'import' } }).Innertube;
type LiveChat = import('youtubei.js', { with: { 'resolution-mode': 'import' } }).YT.LiveChat;

const DATA_API = 'https://www.googleapis.com/youtube/v3';

/** Renders a chat Text node; custom emoji runs become their `:shortcut:` instead of a raw emoji id. */
function messageText(message: any): string {
    const runs: any[] | undefined = message?.runs;
    if (!Array.isArray(runs)) return message?.toString?.() ?? String(message ?? '');
    return runs.map(run => {
        if (run?.emoji) {
            if (!run.emoji.is_custom && run.text) return run.text; // unicode emoji
            return run.emoji.shortcuts?.[0] || run.emoji.search_terms?.[0] || ':emoji:';
        }
        return run?.text ?? '';
    }).join('');
}
const RETRY_MS = 60 * 1000;

/**
 * Reads chat through InnerTube (no quota, no key) and moderates through the
 * YouTube Data API (OAuth, `liveChatBans`). Data-API polling of chat would
 * exhaust the daily quota within a couple of hours, hence the split.
 */
export class YouTubePlatform implements ChatPlatform {
    public readonly id = 'youtube' as const;
    public readonly capabilities: PlatformCapabilities = { ban: true, timeout: true, unban: true };

    private yt: Innertube | null = null;
    private chat: LiveChat | null = null;
    private videoId: string | null = null;
    private liveChatId: string | null = null;
    private connected = false;
    private lastError: string | undefined;
    private retryTimer: NodeJS.Timeout | null = null;
    private connecting = false;

    private async loadModule(): Promise<YouTubeModule> {
        return import('youtubei.js');
    }

    public async connect() {
        const settings = settingsStore.get().platforms.youtube;
        if (!settings.enabled) {
            await this.disconnect();
            return;
        }
        if (this.connecting) return;
        this.clearRetry();
        this.connecting = true;

        try {
            if (!settings.channel && !settings.videoIdOverride) {
                this.lastError = 'Channel handle missing';
                return;
            }

            await this.disconnect(true);

            const { Innertube, Log } = await this.loadModule();
            Log.setLevel(Log.Level.ERROR); // parser "X not found" warnings are noise; unknown nodes are JIT-generated
            this.yt = this.yt || await Innertube.create();

            const videoId = settings.videoIdOverride?.trim() || await this.findLiveVideoId(settings.channel);
            if (!videoId) {
                this.lastError = 'Channel is not live';
                console.log(`[youtube] ${settings.channel} is not live. Retrying in ${RETRY_MS / 1000}s.`);
                this.scheduleRetry();
                return;
            }

            const info = await this.yt.getInfo(videoId);
            if (!info.basic_info.is_live) {
                this.lastError = 'Video is not live';
                this.scheduleRetry();
                return;
            }

            this.videoId = videoId;
            this.liveChatId = null;
            this.chat = info.getLiveChat();
            this.attachChatListeners(this.chat);
            this.chat.start();
            this.connected = true;
            this.lastError = undefined;
            console.log(`[youtube] Watching live chat of video ${videoId} (${info.basic_info.title})`);
        } catch (err) {
            this.lastError = err instanceof Error ? err.message : String(err);
            console.error('[youtube] Failed to connect:', this.lastError);
            this.scheduleRetry();
        } finally {
            this.connecting = false;
        }
    }

    private attachChatListeners(chat: LiveChat) {
        chat.on('chat-update', (action: any) => {
            if (action?.type !== 'AddChatItemAction') return;
            const item = action.item;
            if (!item || item.type !== 'LiveChatTextMessage') return;

            const author = item.author;
            const name: string = author?.name || 'Unknown';
            const userId: string = author?.id || name;

            chatHub.publish({
                platform: 'youtube',
                userId,
                username: name,
                displayName: name,
                content: messageText(item.message),
                timestamp: Date.now(),
                messageId: item.id || crypto.randomUUID(),
                role: author?.is_creator ? 'broadcaster' : author?.is_moderator ? 'moderator' : 'viewer',
            });
        });

        chat.on('error', (err: Error) => {
            console.error('[youtube] Live chat error:', err.message);
            this.lastError = err.message;
        });

        chat.on('end', () => {
            console.log('[youtube] Live chat ended.');
            this.connected = false;
            this.chat = null;
            this.scheduleRetry();
        });
    }

    /** Resolves the channel's current live video via its /live URL, falling back to the Live tab. */
    private async findLiveVideoId(channel: string): Promise<string | null> {
        if (!this.yt) return null;
        const handle = channel.trim();
        const base = handle.startsWith('UC') && !handle.startsWith('@')
            ? `https://www.youtube.com/channel/${handle}`
            : `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`;

        try {
            const endpoint = await this.yt.resolveURL(`${base}/live`);
            const videoId = endpoint?.payload?.videoId;
            if (typeof videoId === 'string' && videoId) return videoId;
        } catch (e) {
            console.log('[youtube] /live resolution failed, trying channel Live tab.');
        }

        try {
            const resolved = await this.yt.resolveURL(base);
            const browseId: string | undefined = resolved?.payload?.browseId;
            if (!browseId) return null;
            const channelPage = await this.yt.getChannel(browseId);
            const liveTab = await channelPage.getLiveStreams();
            const live = liveTab.videos.find((v: any) => v.is_live);
            return (live as any)?.video_id || (live as any)?.content_id || null;
        } catch (e) {
            console.log('[youtube] Live tab lookup failed:', e instanceof Error ? e.message : e);
            return null;
        }
    }

    private scheduleRetry() {
        this.clearRetry();
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.connect().catch(() => { /* logged in connect */ });
        }, RETRY_MS);
    }

    private clearRetry() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }

    public async disconnect(keepRetry = false) {
        if (!keepRetry) this.clearRetry();
        if (this.chat) {
            try { this.chat.stop(); } catch { /* ignore */ }
            this.chat = null;
        }
        this.connected = false;
        this.videoId = null;
        this.liveChatId = null;
    }

    public status(): PlatformStatus {
        const settings = settingsStore.get().platforms.youtube;
        return {
            enabled: settings.enabled,
            connected: this.connected,
            target: settings.videoIdOverride || settings.channel || '',
            error: settings.enabled ? (this.lastError ?? (googleAuth.hasToken() ? undefined : 'Google account not connected (bans disabled)')) : undefined,
            capabilities: this.capabilities,
        };
    }

    // --- Moderation (YouTube Data API v3) ---

    private async apiHeaders() {
        const token = await googleAuth.getToken();
        if (!token) throw new Error('Google account not connected');
        return { Authorization: `Bearer ${token}` };
    }

    private async getLiveChatId(): Promise<string> {
        if (this.liveChatId) return this.liveChatId;
        if (!this.videoId) throw new Error('Not watching a live video');
        try {
            const res = await axios.get(`${DATA_API}/videos`, {
                params: { part: 'liveStreamingDetails', id: this.videoId },
                headers: await this.apiHeaders(),
            });
            const id = res.data?.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
            if (!id) throw new Error('Video has no active live chat');
            this.liveChatId = id;
            return id;
        } catch (err: any) {
            throw new Error(err.response?.data?.error?.message || err.message);
        }
    }

    private async insertBan(userId: string, type: 'permanent' | 'temporary', banDurationSeconds?: number) {
        const liveChatId = await this.getLiveChatId();
        try {
            const res = await axios.post(`${DATA_API}/liveChatBans`,
                { snippet: { liveChatId, type, ...(banDurationSeconds ? { banDurationSeconds } : {}), bannedUserDetails: { channelId: userId } } },
                { params: { part: 'snippet' }, headers: await this.apiHeaders() }
            );
            if (res.data?.id) banRegistry.setYouTubeBanId(userId, res.data.id);
        } catch (err: any) {
            throw new Error(err.response?.data?.error?.message || err.message);
        }
    }

    public async ban(userId: string, reason: string) {
        await this.insertBan(userId, 'permanent');
        historyStore.updateUserStatus(userKey('youtube', userId), 'banned');
        console.log(`[youtube] Banned ${userId} for: ${reason}`);
    }

    public async timeout(userId: string, seconds: number, reason: string) {
        await this.insertBan(userId, 'temporary', seconds);
        historyStore.updateUserStatus(userKey('youtube', userId), 'timed_out');
        console.log(`[youtube] Timed out ${userId} for ${seconds}s: ${reason}`);
    }

    public async unban(userId: string) {
        const banId = banRegistry.getYouTubeBanId(userId);
        if (!banId) throw new Error('This ban was not issued from TwitchWatcher, so its id is unknown; lift it in YouTube Studio.');
        try {
            await axios.delete(`${DATA_API}/liveChatBans`, { params: { id: banId }, headers: await this.apiHeaders() });
        } catch (err: any) {
            throw new Error(err.response?.data?.error?.message || err.message);
        }
        banRegistry.clearYouTubeBan(userId);
        historyStore.updateUserStatus(userKey('youtube', userId), 'active');
        console.log(`[youtube] Unbanned ${userId}`);
    }
}

export const youtubePlatform = new YouTubePlatform();

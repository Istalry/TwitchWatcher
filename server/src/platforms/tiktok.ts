import crypto from 'crypto';
import { settingsStore } from '../store/settings';
import { chatHub } from '../services/chatHub';
import { ChatPlatform, PlatformCapabilities, PlatformCapabilityError, PlatformStatus } from './types';

// tiktok-live-connector is ESM-only (Node >= 20); loaded lazily via dynamic import.
type TikTokModule = typeof import('tiktok-live-connector', { with: { 'resolution-mode': 'import' } });
// The connector's emitter typings depend on `typed-emitter`, which it doesn't ship; keep our own minimal view.
interface TikTokConnection {
    on(event: string, listener: (...args: any[]) => void): unknown;
    connect(): Promise<unknown>;
    disconnect(): Promise<unknown> | void;
}

const RETRY_MS = 60 * 1000;

/**
 * Read-only: TikTok exposes no public moderation API, so flagged users can only
 * be reviewed here and handled in the TikTok LIVE app.
 */
export class TikTokPlatform implements ChatPlatform {
    public readonly id = 'tiktok' as const;
    public readonly capabilities: PlatformCapabilities = { ban: false, timeout: false, unban: false };

    private connection: TikTokConnection | null = null;
    private connected = false;
    private connecting = false;
    private lastError: string | undefined;
    private retryTimer: NodeJS.Timeout | null = null;

    private async loadModule(): Promise<TikTokModule> {
        return import('tiktok-live-connector');
    }

    public async connect() {
        const settings = settingsStore.get().platforms.tiktok;
        if (!settings.enabled) {
            await this.disconnect();
            return;
        }
        if (this.connecting) return;
        this.clearRetry();
        this.connecting = true;

        try {
            if (!settings.username) {
                this.lastError = 'Username missing';
                return;
            }

            await this.disconnect(true);

            const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await this.loadModule();
            const connection = new TikTokLiveConnection(settings.username, {
                ...(settings.signApiKey ? { signApiKey: settings.signApiKey } : {}),
            }) as unknown as TikTokConnection;

            connection.on(WebcastEvent.CHAT, (msg: any) => {
                const user = msg.user || {};
                const username: string = user.displayId || user.uniqueId || user.nickname || 'unknown';
                const displayName: string = user.nickname || username;
                const userId: string = user.id || user.userId || username;
                chatHub.publish({
                    platform: 'tiktok',
                    userId: String(userId),
                    username,
                    displayName,
                    content: msg.content ?? msg.comment ?? '',
                    timestamp: Date.now(),
                    messageId: msg.common?.msgId || crypto.randomUUID(),
                    role: 'viewer',
                });
            });

            connection.on(ControlEvent.DISCONNECTED, () => {
                console.log('[tiktok] Disconnected.');
                this.connected = false;
                this.scheduleRetry();
            });

            connection.on(ControlEvent.ERROR, (err: any) => {
                const message = err?.info || err?.message || String(err);
                console.error('[tiktok] Error:', message);
                this.lastError = message;
            });

            await connection.connect();
            this.connection = connection;
            this.connected = true;
            this.lastError = undefined;
            console.log(`[tiktok] Connected to @${settings.username}'s LIVE.`);
        } catch (err: any) {
            const message: string = err?.message || String(err);
            this.lastError = err?.name === 'UserOfflineError' || /isn'?t online|not online|offline|not live/i.test(message)
                ? 'User is not live'
                : message;
            console.log(`[tiktok] Could not connect (${this.lastError}). Retrying in ${RETRY_MS / 1000}s.`);
            this.scheduleRetry();
        } finally {
            this.connecting = false;
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
        if (this.connection) {
            try { await this.connection.disconnect(); } catch { /* ignore */ }
            this.connection = null;
        }
        this.connected = false;
    }

    public status(): PlatformStatus {
        const settings = settingsStore.get().platforms.tiktok;
        return {
            enabled: settings.enabled,
            connected: this.connected,
            target: settings.username ? `@${settings.username.replace(/^@/, '')}` : '',
            error: settings.enabled ? this.lastError : undefined,
            capabilities: this.capabilities,
        };
    }

    public async ban(): Promise<void> {
        throw new PlatformCapabilityError('tiktok', 'ban');
    }

    public async timeout(): Promise<void> {
        throw new PlatformCapabilityError('tiktok', 'timeout');
    }

    public async unban(): Promise<void> {
        throw new PlatformCapabilityError('tiktok', 'unban');
    }
}

export const tiktokPlatform = new TikTokPlatform();

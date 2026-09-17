import { Platform, PLATFORMS } from '../store/types';
import { ChatPlatform, PlatformStatus } from './types';
import { twitchPlatform } from './twitch';
import { youtubePlatform } from './youtube';
import { tiktokPlatform } from './tiktok';

const platforms: Record<Platform, ChatPlatform> = {
    twitch: twitchPlatform,
    youtube: youtubePlatform,
    tiktok: tiktokPlatform,
};

export const isPlatform = (value: unknown): value is Platform =>
    typeof value === 'string' && (PLATFORMS as string[]).includes(value);

export const platformRegistry = {
    get(id: Platform): ChatPlatform {
        return platforms[id];
    },

    all(): ChatPlatform[] {
        return PLATFORMS.map(id => platforms[id]);
    },

    /** Connects every platform; each one no-ops (and disconnects) when disabled in settings. */
    async connectAll() {
        await Promise.all(this.all().map(p => p.connect().catch(err => console.error(`[${p.id}] connect failed:`, err))));
    },

    async disconnectAll() {
        await Promise.all(this.all().map(p => p.disconnect().catch(() => { /* ignore */ })));
    },

    statuses(): Record<Platform, PlatformStatus> {
        return Object.fromEntries(PLATFORMS.map(id => [id, platforms[id].status()])) as Record<Platform, PlatformStatus>;
    },
};

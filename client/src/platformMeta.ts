import { type Platform } from './types';

export const PLATFORM_META: Record<Platform, { label: string; short: string; color: string; bg: string; border: string }> = {
    twitch: { label: 'Twitch', short: 'TW', color: 'text-[#bf94ff]', bg: 'bg-[#9146FF]/15', border: 'border-[#9146FF]/40' },
    youtube: { label: 'YouTube', short: 'YT', color: 'text-[#ff6b6b]', bg: 'bg-[#FF0000]/15', border: 'border-[#FF0000]/40' },
    tiktok: { label: 'TikTok', short: 'TT', color: 'text-[#25F4EE]', bg: 'bg-[#25F4EE]/10', border: 'border-[#25F4EE]/40' },
};

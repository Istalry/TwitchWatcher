// Hand-synced with server/src/store/types.ts and server/src/store/settings.ts.

export type Platform = 'twitch' | 'youtube' | 'tiktok';
export const PLATFORMS: Platform[] = ['twitch', 'youtube', 'tiktok'];

export type ModerationCategory = 'hate' | 'harassment' | 'threat' | 'spam' | 'vulgarity' | 'other';
export const MODERATION_CATEGORIES: ModerationCategory[] = ['hate', 'harassment', 'threat', 'spam', 'vulgarity', 'other'];

export type Sensitivity = 'lenient' | 'balanced' | 'strict';

export interface ChatMessage {
    id: string;
    platform: Platform;
    userKey: string;
    username: string;
    displayName: string;
    content: string;
    timestamp: number;
}

export interface UserNote {
    id: string;
    timestamp: number;
    severity: number;
    category: ModerationCategory;
    reason: string;
    messageIds: string[];
}

export interface ChatUser {
    key: string;
    platform: Platform;
    userId: string;
    username: string;
    displayName: string;
    messages: ChatMessage[];
    notes: UserNote[];
    status: 'active' | 'timed_out' | 'banned';
}

export interface PendingAction {
    id: string;
    platform: Platform;
    userId: string;
    userKey: string;
    username: string;
    displayName: string;
    messageContent: string;
    messageIds: string[];
    flaggedReason: string;
    category: ModerationCategory;
    severity: number;
    suggestedAction: 'none' | 'timeout' | 'ban';
    timestamp: number;
    status: 'pending' | 'approved' | 'discarded';
}

export type ActionEvent =
    | { type: 'added'; action: PendingAction }
    | { type: 'updated'; action: PendingAction }
    | { type: 'resolved'; action: PendingAction };

export interface PlatformCapabilities {
    ban: boolean;
    timeout: boolean;
    unban: boolean;
}

export interface PlatformStatus {
    enabled: boolean;
    connected: boolean;
    target: string;
    error?: string;
    capabilities: PlatformCapabilities;
}

export interface SystemStatus {
    ai: {
        online: boolean;
        provider: string;
        model: string;
        lastError: { message: string; at: number } | null;
        analyzed: number;
        flagged: number;
        flagRate: number | null;
        floodActive: boolean;
        effectiveMinSeverity: number;
    };
    platforms: Record<Platform, PlatformStatus>;
}

export interface TwitchSettings {
    enabled: boolean;
    username: string;
    channel: string;
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
}

export interface YouTubeSettings {
    enabled: boolean;
    channel: string;
    videoIdOverride?: string;
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
}

export interface TikTokSettings {
    enabled: boolean;
    username: string;
    signApiKey?: string;
}

export interface PlatformSettingsMap {
    twitch: TwitchSettings;
    youtube: YouTubeSettings;
    tiktok: TikTokSettings;
}

export type LinkPolicy = 'allow' | 'flag' | 'block';

export interface ModerationSettings {
    sensitivity: Sensitivity;
    categories: Record<ModerationCategory, boolean>;
    skipTrustedRoles: boolean;
    links: LinkPolicy;
    linkAllowlist: string[];
}

export interface AppSettings {
    schemaVersion: number;
    isSetupComplete: boolean;
    checkForUpdates: boolean;
    aiLanguage: string;
    defaultTimeoutDuration: number;
    moderation: ModerationSettings;
    platforms: PlatformSettingsMap;
    ai: {
        provider: 'ollama' | 'google';
        model: string;
        apiKey?: string;
    };
}

export interface UpdateInfo {
    latestVersion: string;
    url: string;
}

export interface SystemInfo {
    version: string;
    dataDir: string;
    update: UpdateInfo | null;
}

export const EMPTY_STATUS: SystemStatus = {
    ai: { online: false, provider: 'unknown', model: '', lastError: null, analyzed: 0, flagged: 0, flagRate: null, floodActive: false, effectiveMinSeverity: 3 },
    platforms: {
        twitch: { enabled: false, connected: false, target: '', capabilities: { ban: true, timeout: true, unban: true } },
        youtube: { enabled: false, connected: false, target: '', capabilities: { ban: true, timeout: true, unban: true } },
        tiktok: { enabled: false, connected: false, target: '', capabilities: { ban: false, timeout: false, unban: false } },
    },
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsMap = {
    twitch: { enabled: false, username: '', channel: '', clientId: '', clientSecret: '' },
    youtube: { enabled: false, channel: '', clientId: '', clientSecret: '' },
    tiktok: { enabled: false, username: '' },
};

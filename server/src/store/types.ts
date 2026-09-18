export type Platform = 'twitch' | 'youtube' | 'tiktok';
export const PLATFORMS: Platform[] = ['twitch', 'youtube', 'tiktok'];

export type UserRole = 'broadcaster' | 'moderator' | 'viewer';

export type ModerationCategory = 'hate' | 'harassment' | 'threat' | 'spam' | 'vulgarity' | 'other';
export const MODERATION_CATEGORIES: ModerationCategory[] = ['hate', 'harassment', 'threat', 'spam', 'vulgarity', 'other'];

/** Users are keyed per platform so the same name on two platforms never collides. */
export const userKey = (platform: Platform, userId: string) => `${platform}:${userId}`;

export interface ChatMessage {
    id: string; // platform message id when available, else uuid
    platform: Platform;
    userKey: string;
    username: string;
    displayName: string;
    content: string;
    timestamp: number;
}

/** A below-threshold AI flag: kept on the user instead of the action queue. */
export interface UserNote {
    id: string;
    timestamp: number;
    severity: number;
    category: ModerationCategory;
    reason: string;
    messageIds: string[];
}

export interface ChatUser {
    key: string; // `${platform}:${userId}`
    platform: Platform;
    userId: string;
    username: string;
    displayName: string;
    messages: ChatMessage[]; // Limit 50
    notes: UserNote[]; // Limit 20
    status: 'active' | 'timed_out' | 'banned';
}

export interface ModerationResult {
    flagged: boolean;
    reason?: string;
    suggestedAction?: 'none' | 'timeout' | 'ban';
    category?: ModerationCategory;
    severity?: number; // 1-5
}

export type ActionSource = 'ai' | 'link' | 'rule';

export interface PendingAction {
    id: string; // uuid
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
    /** What produced the card. */
    source: ActionSource;
    ruleName?: string; // when source === 'rule'
    /** Link/rule cards: approving also deletes the offending message(s) where the platform allows it. */
    deleteMessages?: boolean;
    /** Auto mode: the card executes itself at this time unless held or dismissed. */
    autoExecuteAt?: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'discarded';
}

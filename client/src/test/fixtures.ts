import { type ChatMessage, type ChatUser, type PendingAction, type Platform, type PlatformStatus } from '../types';

export const capsFull = { ban: true, timeout: true, unban: true, deleteMessage: true };
export const capsNone = { ban: false, timeout: false, unban: false, deleteMessage: false };

export const platformsAllEnabled: Record<Platform, PlatformStatus> = {
    twitch: { enabled: true, connected: true, target: 'chan', capabilities: capsFull },
    youtube: { enabled: true, connected: true, target: '@chan', capabilities: capsFull },
    tiktok: { enabled: true, connected: false, target: '@chan', capabilities: capsNone },
};

export const makeMessage = (over: Partial<ChatMessage> = {}): ChatMessage => ({
    id: over.id ?? Math.random().toString(36).slice(2),
    platform: 'twitch',
    userKey: 'twitch:user1',
    username: 'user1',
    displayName: 'User1',
    content: 'hello',
    timestamp: Date.now(),
    ...over,
});

export const makeAction = (over: Partial<PendingAction> = {}): PendingAction => ({
    id: '123',
    platform: 'twitch',
    userId: 'baduser',
    userKey: 'twitch:baduser',
    username: 'baduser',
    displayName: 'baduser',
    messageContent: 'offensive message',
    messageIds: ['m1'],
    flaggedReason: 'Hate Speech',
    category: 'hate',
    severity: 4,
    suggestedAction: 'ban',
    source: 'ai',
    timestamp: Date.now(),
    status: 'pending',
    ...over,
});

export const makeUser = (over: Partial<ChatUser> = {}): ChatUser => ({
    key: 'twitch:testuser1',
    platform: 'twitch',
    userId: 'testuser1',
    username: 'testuser1',
    displayName: 'testuser1',
    messages: [],
    notes: [],
    status: 'active',
    ...over,
});

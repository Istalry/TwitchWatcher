export interface ChatMessage {
    id: string; // uuid
    username: string;
    content: string;
    timestamp: number;
}

export interface ChatUser {
    username: string;
    messages: ChatMessage[]; // Limit 50
    notes?: string;
    status: 'active' | 'timed_out' | 'banned';
}

export interface ModerationResult {
    flagged: boolean;
    reason?: string;
    suggestedAction?: 'none' | 'timeout' | 'ban';
}

export interface PendingAction {
    id: string; // uuid
    username: string;
    messageContent: string;
    flaggedReason: string;
    suggestedAction: 'timeout' | 'ban';
    timestamp: number;
    status: 'pending' | 'approved' | 'discarded';
}

export interface ChatUser {
    username: string;
    messages: {
        id: string;
        username: string;
        content: string;
        timestamp: number;
    }[];
    notes?: string;
    status: 'active' | 'timed_out' | 'banned';
}

export interface PendingAction {
    id: string;
    username: string;
    messageContent: string;
    flaggedReason: string;
    suggestedAction: 'timeout' | 'ban';
    timestamp: number;
    status: 'pending' | 'approved' | 'discarded';
}

export interface AppSettings {
    aiLanguage: string;
}

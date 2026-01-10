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
    isSetupComplete: boolean;
    aiLanguage: string;
    defaultTimeoutDuration: number;
    twitch: {
        username: string;
        channel: string;
        clientId: string;
        clientSecret: string;
        accessToken?: string;
        refreshToken?: string;
    };
    ai: {
        provider: 'ollama' | 'google';
        model: string;
        apiKey?: string;
    };
}

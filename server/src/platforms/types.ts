import { Platform, UserRole } from '../store/types';

export interface PlatformCapabilities {
    ban: boolean;
    timeout: boolean;
    unban: boolean;
}

/** Normalized chat message emitted by every platform adapter. */
export interface IncomingMessage {
    platform: Platform;
    userId: string;
    username: string;
    displayName: string;
    content: string;
    timestamp: number;
    messageId: string;
    role?: UserRole;
}

export interface PlatformStatus {
    enabled: boolean;
    connected: boolean;
    target: string; // channel / handle being watched
    error?: string;
    capabilities: PlatformCapabilities;
}

export interface ChatPlatform {
    readonly id: Platform;
    readonly capabilities: PlatformCapabilities;
    /** Safe to call repeatedly; no-op (after disconnecting) when the platform is disabled in settings. */
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    status(): PlatformStatus;
    ban(userId: string, reason: string): Promise<void>;
    timeout(userId: string, seconds: number, reason: string): Promise<void>;
    unban(userId: string): Promise<void>;
}

export class PlatformCapabilityError extends Error {
    constructor(platform: Platform, action: string) {
        super(`${platform} has no API for "${action}"`);
        this.name = 'PlatformCapabilityError';
    }
}

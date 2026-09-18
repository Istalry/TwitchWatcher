import { ChatUser, ChatMessage, UserNote, userKey } from './types';
import { IncomingMessage } from '../platforms/types';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../paths';
import { banRegistry } from './banRegistry';
import { sanctionLog } from './sanctionLog';
import crypto from 'crypto';

const DATA_FILE = path.join(DATA_DIR, 'users.json');

const MAX_MESSAGES = 50;
const MAX_NOTES = 20;
const SAVE_DEBOUNCE_MS = 1000;

/** Upgrades a user record from the Twitch-only layout (no platform / key / notes). */
function migrateUser(raw: any): ChatUser {
    if (raw.key && raw.platform) {
        return { notes: [], ...raw };
    }
    const username: string = raw.username || 'Unknown';
    const userId = username.toLowerCase();
    const key = userKey('twitch', userId);
    return {
        key,
        platform: 'twitch',
        userId,
        username: userId,
        displayName: username,
        status: raw.status || 'active',
        notes: [],
        messages: (raw.messages || []).map((m: any): ChatMessage => ({
            id: m.id,
            platform: 'twitch',
            userKey: key,
            username: userId,
            displayName: username,
            content: m.content,
            timestamp: m.timestamp,
        })),
    };
}

/** Keys of users with no activity for `days` days (0 = never prune). Banned users are always kept. */
export function staleUserKeys(users: Iterable<ChatUser>, days: number, now = Date.now()): string[] {
    if (!days || days <= 0) return [];
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const stale: string[] = [];
    for (const user of users) {
        if (user.status === 'banned') continue;
        const last = Math.max(
            0,
            ...user.messages.map(m => m.timestamp),
            ...user.notes.map(n => n.timestamp),
        );
        if (last < cutoff) stale.push(user.key);
    }
    return stale;
}

export class HistoryStore {
    private users: Map<string, ChatUser> = new Map();
    private saveTimer: NodeJS.Timeout | null = null;
    private dirty = false;

    constructor() {
        this.load();
    }

    /** Adds the message to the user's history and returns the stored record. */
    public addMessage(msg: IncomingMessage): ChatMessage {
        const key = userKey(msg.platform, msg.userId);
        let user = this.users.get(key);
        if (!user) {
            user = {
                key,
                platform: msg.platform,
                userId: msg.userId,
                username: msg.username,
                displayName: msg.displayName,
                messages: [],
                notes: [],
                status: 'active',
            };
            this.users.set(key, user);
        }
        // Names can change between sessions; keep the latest.
        user.username = msg.username;
        user.displayName = msg.displayName;

        const stored: ChatMessage = {
            id: msg.messageId,
            platform: msg.platform,
            userKey: key,
            username: msg.username,
            displayName: msg.displayName,
            content: msg.content,
            timestamp: msg.timestamp,
        };

        user.messages.push(stored);
        if (user.messages.length > MAX_MESSAGES) {
            user.messages.shift(); // Keep last 50
        }

        this.scheduleSave();
        return stored;
    }

    public addNote(key: string, note: Omit<UserNote, 'id' | 'timestamp'>): UserNote | undefined {
        const user = this.users.get(key);
        if (!user) return undefined;
        const stored: UserNote = { id: crypto.randomUUID(), timestamp: Date.now(), ...note };
        user.notes.push(stored);
        if (user.notes.length > MAX_NOTES) user.notes.shift();
        this.scheduleSave();
        return stored;
    }

    /** Number of notes for the user within the last `windowMs` (all time if omitted), optionally only those at or above `minSeverity`. */
    public noteCount(key: string, windowMs?: number, minSeverity = 1): number {
        const user = this.users.get(key);
        if (!user) return 0;
        const since = windowMs === undefined ? 0 : Date.now() - windowMs;
        return user.notes.filter(n => n.timestamp >= since && n.severity >= minSeverity).length;
    }

    public getUser(key: string): ChatUser | undefined {
        return this.users.get(key);
    }

    public getAllUsers(): ChatUser[] {
        return Array.from(this.users.values());
    }

    private load() {
        if (fs.existsSync(DATA_FILE)) {
            try {
                const raw = fs.readFileSync(DATA_FILE, 'utf-8');
                const data: any[] = JSON.parse(raw);
                data.forEach(u => {
                    const user = migrateUser(u);
                    this.users.set(user.key, user);
                });
            } catch (e) {
                console.error('Failed to load users.json', e);
            }
        }
    }

    public updateUserStatus(key: string, status: ChatUser['status']) {
        const user = this.users.get(key);
        if (user) {
            user.status = status;
            this.scheduleSave();
        }
    }

    public deleteUser(key: string) {
        if (this.users.delete(key)) {
            this.scheduleSave();
        }
    }

    public clearAll() {
        this.users.clear();
        this.scheduleSave();
    }

    /** Removes users inactive for `days` days; returns how many were dropped. */
    public prune(days: number, now = Date.now()): number {
        const keys = staleUserKeys(this.users.values(), days, now);
        for (const key of keys) this.users.delete(key);
        if (keys.length) this.scheduleSave();
        return keys.length;
    }

    private scheduleSave() {
        this.dirty = true;
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.flush();
        }, SAVE_DEBOUNCE_MS);
    }

    /** Writes pending changes immediately (used on shutdown). */
    public flush() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        if (!this.dirty) return;
        try {
            const data = Array.from(this.users.values());
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            this.dirty = false;
        } catch (e) {
            console.error('Failed to save users.json', e);
        }
    }
}

export const historyStore = new HistoryStore();

// Make sure a debounced write isn't lost on Ctrl+C / normal exit.
process.on('SIGINT', () => { historyStore.flush(); banRegistry.flush(); sanctionLog.flush(); process.exit(0); });
process.on('beforeExit', () => historyStore.flush());

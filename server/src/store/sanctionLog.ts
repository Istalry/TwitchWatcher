import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR } from '../paths';
import { Platform } from './types';

const LOG_FILE = path.join(DATA_DIR, 'sanctions.json');
const SAVE_DELAY_MS = 1000;
export const MAX_ENTRIES = 1000;

export type SanctionKind = 'timeout' | 'ban' | 'unban' | 'delete';
export type SanctionSource = 'ai' | 'link' | 'rule' | 'manual';

export interface SanctionEntry {
    id: string;
    at: number;
    platform: Platform;
    userId: string;
    userKey: string;
    displayName: string;
    action: SanctionKind;
    duration?: number; // seconds, timeouts only
    reason: string;
    source: SanctionSource;
    ruleName?: string;
    by: 'streamer' | 'auto';
    messageIds: string[];
    messages: string[]; // up to 3 snippets
    deletedMessages?: number;
    reverted?: { at: number };
}

/**
 * Append-only journal of what the app did on the platforms (sanctions.json), so a
 * sanction can be reviewed and undone later. Kept in memory, newest last, capped.
 */
export class SanctionLog {
    private entries: SanctionEntry[] = [];
    private saveTimer: NodeJS.Timeout | null = null;
    private readonly file: string | null;

    /** Pass `null` for an in-memory log (tests). */
    constructor(file: string | null = LOG_FILE) {
        this.file = file;
        this.load();
    }

    public add(entry: Omit<SanctionEntry, 'id' | 'at'>): SanctionEntry {
        const stored: SanctionEntry = { id: crypto.randomUUID(), at: Date.now(), ...entry, messages: entry.messages.slice(0, 3) };
        this.entries.push(stored);
        if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
        this.scheduleSave();
        return stored;
    }

    public get(id: string): SanctionEntry | undefined {
        return this.entries.find(e => e.id === id);
    }

    /** Newest first. */
    public list(limit = 200): SanctionEntry[] {
        return this.entries.slice(-limit).reverse();
    }

    public markReverted(id: string): SanctionEntry | undefined {
        const entry = this.get(id);
        if (!entry) return undefined;
        entry.reverted = { at: Date.now() };
        this.scheduleSave();
        return entry;
    }

    public countSince(since: number): number {
        return this.entries.filter(e => e.at >= since && e.action !== 'unban').length;
    }

    private load() {
        if (!this.file || !fs.existsSync(this.file)) return;
        try {
            const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
            if (Array.isArray(parsed)) this.entries = parsed;
        } catch (err) {
            console.error('[Sanctions] Failed to load sanctions.json:', err);
        }
    }

    private scheduleSave() {
        if (!this.file || this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.flush();
        }, SAVE_DELAY_MS);
    }

    public flush() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        if (!this.file) return;
        try {
            fs.writeFileSync(this.file, JSON.stringify(this.entries, null, 2));
        } catch (err) {
            console.error('[Sanctions] Failed to save sanctions.json:', err);
        }
    }
}

export const sanctionLog = new SanctionLog();
process.on('beforeExit', () => sanctionLog.flush());

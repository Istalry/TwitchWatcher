import { ChatUser, ChatMessage } from './types';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(__dirname, '../../users.json');

export class HistoryStore {
    private users: Map<string, ChatUser> = new Map();

    constructor() {
        this.load();
    }

    public addMessage(username: string, content: string) {
        if (!this.users.has(username)) {
            this.users.set(username, { username, messages: [], status: 'active' });
        }

        const user = this.users.get(username)!;
        const msg: ChatMessage = {
            id: crypto.randomUUID(),
            username,
            content,
            timestamp: Date.now()
        };

        user.messages.push(msg);
        if (user.messages.length > 50) {
            user.messages.shift(); // Keep last 50
        }

        // Auto-save periodically or on significant change? 
        // For now, let's keep it in memory mostly, maybe save on exit or periodic interval
        // But for the sake of simplicity, we can just strictly keep it in memory and only dump optionally.
        // The requirement says "JSON sync", so let's save.
        this.save();
    }

    public getUser(username: string): ChatUser | undefined {
        return this.users.get(username);
    }

    public getAllUsers(): ChatUser[] {
        return Array.from(this.users.values());
    }

    private load() {
        if (fs.existsSync(DATA_FILE)) {
            try {
                const raw = fs.readFileSync(DATA_FILE, 'utf-8');
                const data: ChatUser[] = JSON.parse(raw);
                data.forEach(u => this.users.set(u.username, u));
            } catch (e) {
                console.error('Failed to load users.json', e);
            }
        }
    }

    public updateUserStatus(username: string, status: 'active' | 'timed_out' | 'banned') {
        const user = this.users.get(username);
        if (user) {
            user.status = status;
            this.save();
        }
    }

    public deleteUser(username: string) {
        if (this.users.has(username)) {
            this.users.delete(username);
            this.save();
        }
    }

    public clearAll() {
        this.users.clear();
        this.save();
    }

    private save() {
        // Debounce this potentially if high traffic
        try {
            const data = Array.from(this.users.values());
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Failed to save users.json', e);
        }
    }
}

export const historyStore = new HistoryStore();

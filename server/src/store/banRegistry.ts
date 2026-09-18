import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../paths';

const BANS_FILE = path.join(DATA_DIR, 'bans.json');
const SAVE_DELAY_MS = 1000;

interface BanRecord {
    banId: string;
    at: number;
}

interface BansFile {
    youtube: Record<string, BanRecord>; // channelId -> ban
}

/**
 * Remembers platform-side ban ids so they can be lifted from the dashboard after a restart.
 * Today only YouTube needs it: the Data API can delete a ban only by the id it returned on insert.
 */
class BanRegistry {
    private data: BansFile = { youtube: {} };
    private saveTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.load();
    }

    public getYouTubeBanId(channelId: string): string | undefined {
        return this.data.youtube[channelId]?.banId;
    }

    public setYouTubeBanId(channelId: string, banId: string) {
        this.data.youtube[channelId] = { banId, at: Date.now() };
        this.scheduleSave();
    }

    public clearYouTubeBan(channelId: string) {
        if (!(channelId in this.data.youtube)) return;
        delete this.data.youtube[channelId];
        this.scheduleSave();
    }

    private load() {
        if (!fs.existsSync(BANS_FILE)) return;
        try {
            const parsed = JSON.parse(fs.readFileSync(BANS_FILE, 'utf-8'));
            if (parsed && typeof parsed.youtube === 'object') this.data.youtube = parsed.youtube;
        } catch (err) {
            console.error('[Bans] Failed to load bans.json:', err);
        }
    }

    private scheduleSave() {
        if (this.saveTimer) return;
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
        try {
            fs.writeFileSync(BANS_FILE, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('[Bans] Failed to save bans.json:', err);
        }
    }
}

export const banRegistry = new BanRegistry();
process.on('beforeExit', () => banRegistry.flush());

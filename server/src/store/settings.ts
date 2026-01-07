import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(__dirname, '../../settings.json');

export interface AppSettings {
    aiLanguage: string;
    defaultTimeoutDuration: number;
}

const DEFAULT_SETTINGS: AppSettings = {
    aiLanguage: 'English',
    defaultTimeoutDuration: 600
};

export class SettingsStore {
    private settings: AppSettings;

    constructor() {
        this.settings = this.load();
    }

    public get(): AppSettings {
        return { ...this.settings };
    }

    public update(partial: Partial<AppSettings>) {
        this.settings = { ...this.settings, ...partial };
        this.save();
    }

    private load(): AppSettings {
        if (fs.existsSync(SETTINGS_FILE)) {
            try {
                const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
                return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            } catch (e) {
                console.error('Failed to load settings.json', e);
            }
        }
        return { ...DEFAULT_SETTINGS };
    }

    private save() {
        try {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('Failed to save settings.json', e);
        }
    }
}

export const settingsStore = new SettingsStore();

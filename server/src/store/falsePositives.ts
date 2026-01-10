import fs from 'fs';
import path from 'path';

// Determine root directory (handle pkg vs dev)
const isPkg = (process as any).pkg;
const ROOT_DIR = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '../../');
const FP_FILE = path.join(ROOT_DIR, 'falsePositives.json');

export class FalsePositiveStore {
    private examples: string[] = [];

    constructor() {
        this.load();
    }

    public add(message: string) {
        if (!this.examples.includes(message)) {
            this.examples.push(message);
            this.save();
        }
    }

    public getAll(): string[] {
        return this.examples;
    }

    private load() {
        if (fs.existsSync(FP_FILE)) {
            try {
                const raw = fs.readFileSync(FP_FILE, 'utf-8');
                this.examples = JSON.parse(raw);
            } catch (e) {
                console.error('Failed to load falsePositives.json', e);
            }
        }
    }

    private save() {
        try {
            fs.writeFileSync(FP_FILE, JSON.stringify(this.examples, null, 2));
        } catch (e) {
            console.error('Failed to save falsePositives.json', e);
        }
    }
}

export const falsePositiveStore = new FalsePositiveStore();


import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { aiService } from './ai/aiService';
import crypto from 'crypto';

class AnalysisQueue {
    private queue: Map<string, string[]> = new Map();
    private queueOrder: string[] = []; // Maintain order of users
    private processing: boolean = false;
    private lastProcessTime: number = 0;
    private interval: NodeJS.Timeout | null = null;

    constructor() {
        console.log('AnalysisQueue initialized using aiService.');
        this.start();
    }

    public add(username: string, message: string) {
        if (this.queue.has(username)) {
            // User already in queue, append message
            this.queue.get(username)?.push(message);
        } else {
            // New user in queue
            this.queue.set(username, [message]);
            this.queueOrder.push(username);
        }
    }

    private start() {
        if (this.interval) clearInterval(this.interval);
        // Check queue every 100ms, but enforce 2s generic rate limit in process()
        // actually checking every 500ms is probably fine
        this.interval = setInterval(() => this.process(), 500);
    }

    private async process() {
        if (this.processing) return;
        if (this.queueOrder.length === 0) return;

        const now = Date.now();
        if (now - this.lastProcessTime < 2000) {
            return; // Rate limit: 1 request per 2 seconds
        }

        this.processing = true;
        const username = this.queueOrder.shift(); // Get first user
        if (!username) {
            this.processing = false;
            return;
        }

        const messages = this.queue.get(username);
        this.queue.delete(username); // Remove from batched map

        if (!messages || messages.length === 0) {
            this.processing = false;
            return;
        }

        try {
            // Batch messages
            // If multiple messages, maybe join them with newlines or periods?
            // "Hello world. Another message."
            const textToAnalyze = messages.join(' . ');

            // Get user history
            const user = historyStore.getUser(username);

            // Note: The history might NOT include current messages yet if we strictly added them to history BEFORE queueing.
            // But we passed them to queue. 
            // The historyStore is just context. The messages being analyzed are `textToAnalyze`.

            const historyContext = user ? user.messages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.content}`) : [];

            // Run analysis
            const analysis = await aiService.analyzeMessage(textToAnalyze, historyContext);

            if (analysis.flagged) {
                console.log(`FLAGGED [${username}]: ${textToAnalyze} (${analysis.reason})`);
                actionQueue.add({
                    id: crypto.randomUUID(),
                    username,
                    messageContent: textToAnalyze,
                    flaggedReason: analysis.reason || 'Unknown',
                    suggestedAction: analysis.suggestedAction === 'ban' ? 'ban' : 'timeout',
                    timestamp: Date.now(),
                    status: 'pending'
                });
            } else {
                console.log(`SAFE [${username}]: ${textToAnalyze}`);
            }

        } catch (err) {
            console.error(`Error processing queue for ${username}:`, err);
        } finally {
            this.lastProcessTime = Date.now();
            this.processing = false;
        }
    }
}

export const analysisQueue = new AnalysisQueue();

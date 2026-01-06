import tmi from 'tmi.js';
import { config } from '../config';
import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { ollamaService } from './ollamaService';
import crypto from 'crypto';

export class TwitchBot {
    private client: tmi.Client;

    constructor() {
        this.client = new tmi.Client({
            options: { debug: true },
            identity: {
                username: config.twitch.username,
                password: config.twitch.oauthToken,
            },
            channels: [config.twitch.channel],
        });

        this.setupListeners();
    }

    private setupListeners() {
        this.client.on('connected', (address, port) => {
            console.log(`Connected to ${address}:${port}`);
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;
            this.handleMessage(tags, message);
        });
    }

    private async handleMessage(tags: tmi.ChatUserstate, message: string) {
        const username = tags['display-name'] || tags.username || 'Unknown';
        console.log(`[${username}]: ${message}`);

        // store in history
        historyStore.addMessage(username, message);

        // analyze
        const analysis = await ollamaService.analyzeMessage(message);

        if (analysis.flagged) {
            console.log(`FLAGGED [${username}]: ${message} (${analysis.reason})`);
            actionQueue.add({
                id: crypto.randomUUID(),
                username,
                messageContent: message,
                flaggedReason: analysis.reason || 'Unknown',
                suggestedAction: analysis.suggestedAction === 'ban' ? 'ban' : 'timeout',
                timestamp: Date.now(),
                status: 'pending'
            });
        }
    }

    public async connect() {
        try {
            await this.client.connect();
        } catch (err) {
            console.error('Failed to connect to Twitch:', err);
        }
    }

    public async simulateMessage(username: string, message: string) {
        // Mock tmi tags
        const tags: tmi.ChatUserstate = {
            'display-name': username,
            username: username.toLowerCase(),
        };
        await this.handleMessage(tags, message);
    }

    public async banUser(username: string, reason: string) {
        try {
            await this.client.ban(config.twitch.channel, username, reason);
            console.log(`Banned ${username} for: ${reason}`);
        } catch (err) {
            console.error(`Failed to ban ${username}:`, err);
        }
    }

    public async timeoutUser(username: string, duration: number, reason: string) {
        try {
            await this.client.timeout(config.twitch.channel, username, duration, reason);
            console.log(`Timed out ${username} for ${duration}s: ${reason}`);
        } catch (err) {
            console.error(`Failed to timeout ${username}:`, err);
        }
    }
}

export const twitchBot = new TwitchBot();

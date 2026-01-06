import { Ollama } from 'ollama';
import { config } from '../config';
import { falsePositiveStore } from '../store/falsePositives';
import { ModerationResult } from '../store/types';

export class OllamaService {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama();
    }

    private buildPrompt(message: string, history: string[] = []): string {
        const falsePositives = falsePositiveStore.getAll();
        const safelistContext = falsePositives.length > 0
            ? `\nHere are examples of BENIGN messages that should NOT be flagged (False Positives):\n${falsePositives.map(m => `- "${m}"`).join('\n')}\n`
            : '';

        const historyContext = history.length > 0
            ? `\nRecent Chat History for this user (context only, do not moderate these):\n${history.map(m => `- ${m}`).join('\n')}\n`
            : '';

        return `You are a Twitch Chat Moderator. Your job is to analyze messages for Hateful content, Harassment, Excessive Vulgarity, or Spam.
    
    ${safelistContext}

    ${historyContext}

    Analyze the following message: "${message}"

    Respond ONLY with a JSON object in this format:
    {
      "flagged": boolean,
      "reason": "short explanation",
      "suggestedAction": "none" | "timeout" | "ban"
    }
    
    If the message is safe, set "flagged": false and "suggestedAction": "none".
    If unsure, lean towards "flagged": false to avoid over-moderation.`;
    }

    public async analyzeMessage(message: string, history: string[] = []): Promise<ModerationResult> {
        try {
            const prompt = this.buildPrompt(message, history);
            console.log('--- Sending to Ollama ---');
            console.log(`Prompt Preview: ${prompt.slice(0, 200)}...`);

            const response = await this.ollama.chat({
                model: config.ollama.model,
                messages: [{ role: 'user', content: prompt }],
                format: 'json',
            });

            console.log('--- Ollama Response ---');
            console.log(response.message.content);

            const result = JSON.parse(response.message.content);
            console.log('--- Parsed Result ---', result);

            return {
                flagged: result.flagged,
                reason: result.reason,
                suggestedAction: result.suggestedAction,
            };
        } catch (err) {
            console.error('Ollama Analysis Failed:', err);
            // Fail open (don't flag if analysis fails)
            return { flagged: false, reason: 'Analysis Failed', suggestedAction: 'none' };
        }
    }
}

export const ollamaService = new OllamaService();

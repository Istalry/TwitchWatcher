import { Ollama } from 'ollama';
import { config } from '../config';
import { falsePositiveStore } from '../store/falsePositives';
import { ModerationResult } from '../store/types';

export class OllamaService {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama();
    }

    private buildPrompt(message: string): string {
        const falsePositives = falsePositiveStore.getAll();
        const safelistContext = falsePositives.length > 0
            ? `\nHere are examples of BENIGN messages that should NOT be flagged (False Positives):\n${falsePositives.map(m => `- "${m}"`).join('\n')}\n`
            : '';

        return `You are a Twitch Chat Moderator. Your job is to analyze messages for Hateful content, Harassment, Excessive Vulgarity, or Spam.
    
    ${safelistContext}

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

    public async analyzeMessage(message: string): Promise<ModerationResult> {
        try {
            const response = await this.ollama.chat({
                model: config.ollama.model,
                messages: [{ role: 'user', content: this.buildPrompt(message) }],
                format: 'json',
            });

            const result = JSON.parse(response.message.content);
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

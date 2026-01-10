import { Ollama } from 'ollama';
import { config } from '../../config';
import { ModerationResult } from '../../store/types';
import { AIProvider } from './aiProvider';
import { buildModerationPrompt } from './promptBuilder';

export class OllamaProvider implements AIProvider {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama();
    }

    public async analyzeMessage(message: string, history: string[] = []): Promise<ModerationResult> {
        try {
            const prompt = buildModerationPrompt(message, history);
            console.log('--- Sending to Ollama ---');
            console.log(prompt);

            const response = await this.ollama.chat({
                model: config.ai.model,
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

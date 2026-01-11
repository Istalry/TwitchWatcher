import { Ollama } from 'ollama';
import { settingsStore } from '../../store/settings';
import { ModerationResult } from '../../store/types';
import { AIProvider } from './aiProvider';
import { buildModerationPrompt } from './promptBuilder';

export class OllamaProvider implements AIProvider {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama();
    }

    public async analyzeMessage(message: string, history: string[] = []): Promise<ModerationResult> {
        const settings = settingsStore.get();
        try {
            const prompt = buildModerationPrompt(message, history);
            console.log('--- Sending to Ollama ---');
            console.log(prompt);

            const response = await this.ollama.chat({
                model: settings.ai.model,
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
            return { flagged: false, reason: 'Analysis Failed', suggestedAction: 'none' };
        }
    }

    public async healthCheck(): Promise<boolean> {
        try {
            await this.ollama.list();
            return true;
        } catch (e) {
            console.error('Ollama Health Check Failed:', e);
            return false;
        }
    }
}

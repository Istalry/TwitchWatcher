import { Ollama } from 'ollama';
import { settingsStore } from '../../store/settings';
import { ModerationResult, Platform } from '../../store/types';
import { AIProvider, parseVerdict } from './aiProvider';
import { buildModerationPrompt } from './promptBuilder';

export class OllamaProvider implements AIProvider {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama();
    }

    public async analyzeMessage(message: string, history: string[] = [], platform?: Platform): Promise<ModerationResult> {
        const settings = settingsStore.get();
        const prompt = buildModerationPrompt(message, history, platform);
        if (process.env.DEBUG_AI) console.log('--- Sending to Ollama ---\n' + prompt);

        const response = await this.ollama.chat({
            model: settings.ai.model,
            messages: [{ role: 'user', content: prompt }],
            format: 'json',
        });

        if (process.env.DEBUG_AI) console.log('--- Ollama Response ---\n' + response.message.content);

        return parseVerdict(response.message.content);
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

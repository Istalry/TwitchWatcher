import { GoogleGenerativeAI } from '@google/generative-ai';
import { settingsStore } from '../../store/settings';
import { ModerationResult, Platform } from '../../store/types';
import { AIProvider, ProviderOverrides, parseVerdict } from './aiProvider';
import { buildModerationPrompt } from './promptBuilder';

export class GoogleProvider implements AIProvider {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any;

    constructor(private overrides: ProviderOverrides = {}) {
        const settings = settingsStore.get().ai;
        const apiKey = overrides.apiKey ?? settings.apiKey;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: overrides.model ?? settings.model,
                // NOTE: gemma-2/3 models may not support JSON mode natively via valid API
            });
        } else {
            console.warn('GoogleProvider used but no API Key provided in settings.');
        }
    }

    public async analyzeMessage(message: string, history: string[] = [], platform?: Platform): Promise<ModerationResult> {
        if (!this.model) {
            throw new Error('Google AI not initialized: missing API key');
        }

        const prompt = buildModerationPrompt(message, history, platform, this.overrides.prompt);
        if (process.env.DEBUG_AI) console.log('--- Sending to Google AI ---\n' + prompt);

        const result = await this.model.generateContent(prompt);
        const responseText = result.response.text();

        if (process.env.DEBUG_AI) console.log('--- Google AI Response ---\n' + responseText);

        return parseVerdict(responseText);
    }

    public async healthCheck(): Promise<boolean> {
        // For Google, we can't easily "ping" without cost or complexity.
        // We assume healthy if API Key is present and model initialized.
        // A more robust check might be a dummy generation, but that costs quota.
        return !!this.model && !!this.genAI;
    }
}

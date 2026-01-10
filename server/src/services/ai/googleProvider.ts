import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { ModerationResult } from '../../store/types';
import { AIProvider } from './aiProvider';
import { buildModerationPrompt } from './promptBuilder';

export class GoogleProvider implements AIProvider {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any;

    constructor() {
        if (config.ai.apiKey) {
            this.genAI = new GoogleGenerativeAI(config.ai.apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: config.ai.model,
                // NOTE: We do not enforce responseMimeType: "application/json" here because some models 
                // (like gemma-2/3) do not support it and return 400 Bad Request.
                // We rely on the prompt to request JSON and manual parsing below.
            });
        } else {
            console.warn('GoogleProvider specificed but no API Key provided.');
        }
    }

    public async analyzeMessage(message: string, history: string[] = []): Promise<ModerationResult> {
        if (!this.model) {
            console.error('Google AI Model not initialized (missing API Key?)');
            return { flagged: false, reason: 'AI Config Error', suggestedAction: 'none' };
        }

        try {
            const prompt = buildModerationPrompt(message, history);
            console.log('--- Sending to Google AI ---');
            console.log(prompt);

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();

            console.log('--- Google AI Response ---');
            console.log(responseText);

            // Clean up Markdown code blocks if present (e.g. ```json ... ```)
            const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();

            const parsed = JSON.parse(cleanJson);

            return {
                flagged: parsed.flagged,
                reason: parsed.reason,
                suggestedAction: parsed.suggestedAction,
            };

        } catch (err) {
            console.error('Google AI Analysis Failed:', err);
            // Fail open
            return { flagged: false, reason: 'Analysis Failed', suggestedAction: 'none' };
        }
    }
}

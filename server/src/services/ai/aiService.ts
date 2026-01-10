import { settingsStore } from '../../store/settings';
import { ModerationResult } from '../../store/types';
import { AIProvider } from './aiProvider';
import { GoogleProvider } from './googleProvider';
import { OllamaProvider } from './ollamaProvider';

export class AIService implements AIProvider {
    private currentProvider: AIProvider | null = null;
    private lastConfigSignature: string = '';

    private getProvider(): AIProvider {
        const settings = settingsStore.get().ai;
        const signature = `${settings.provider}-${settings.model}-${settings.apiKey}`;

        // Re-initialize if config changed or first run
        if (!this.currentProvider || this.lastConfigSignature !== signature) {
            console.log(`[AIService] Switching AI Provider to ${settings.provider} (${settings.model})`);

            if (settings.provider === 'google') {
                this.currentProvider = new GoogleProvider();
                // GoogleProvider reads from config currently, we need to update it to read from settings
                // But since I haven't updated GoogleProvider yet, this might fail unless I fix GoogleProvider too.
                // Plan: Update providers to take config in constructor OR read from settingsStore directly.
                // Best approach: Read from settingsStore inside the providers.
            } else {
                this.currentProvider = new OllamaProvider();
            }
            this.lastConfigSignature = signature;
        }

        return this.currentProvider;
    }

    public async analyzeMessage(message: string, history: string[] = []): Promise<ModerationResult> {
        const provider = this.getProvider();
        return provider.analyzeMessage(message, history);
    }
}

export const aiService = new AIService();

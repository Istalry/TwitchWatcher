import { settingsStore } from '../../store/settings';
import { MODERATION_CATEGORIES, ModerationCategory, ModerationResult, Platform } from '../../store/types';
import { AIProvider } from './aiProvider';
import { GoogleProvider } from './googleProvider';
import { OllamaProvider } from './ollamaProvider';

export interface AIError {
    message: string;
    at: number;
}

/** Normalized verdict: category and severity are always present. */
export interface Verdict extends ModerationResult {
    category: ModerationCategory;
    severity: number;
}

export class AIService {
    private currentProvider: AIProvider | null = null;
    private lastConfigSignature: string = '';
    private _lastError: AIError | null = null;

    public get lastError(): AIError | null {
        return this._lastError;
    }

    private getProvider(): AIProvider {
        const settings = settingsStore.get().ai;
        const signature = `${settings.provider}-${settings.model}-${settings.apiKey}`;

        // Re-initialize if config changed or first run
        if (!this.currentProvider || this.lastConfigSignature !== signature) {
            console.log(`[AIService] Switching AI Provider to ${settings.provider} (${settings.model})`);
            this.currentProvider = settings.provider === 'google' ? new GoogleProvider() : new OllamaProvider();
            this.lastConfigSignature = signature;
            this._lastError = null;
        }

        return this.currentProvider;
    }

    /**
     * Runs the provider and normalizes the verdict. Any provider failure is
     * recorded in `lastError` (surfaced in /api/status) and fails open as "not flagged".
     */
    public async analyzeMessage(message: string, history: string[] = [], platform?: Platform): Promise<Verdict> {
        const provider = this.getProvider();
        try {
            const raw = await provider.analyzeMessage(message, history, platform);
            this._lastError = null;
            return normalizeVerdict(raw);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = { message: msg, at: Date.now() };
            console.error('[AIService] Analysis failed (failing open):', msg);
            return { flagged: false, reason: 'Analysis failed', suggestedAction: 'none', category: 'other', severity: 1 };
        }
    }

    public async healthCheck(): Promise<boolean> {
        const provider = this.getProvider();
        return provider.healthCheck();
    }
}

/** Clamps a raw provider verdict into a valid category and a 1-5 severity. */
export function normalizeVerdict(raw: ModerationResult): Verdict {
    const category = MODERATION_CATEGORIES.includes(raw.category as ModerationCategory)
        ? (raw.category as ModerationCategory)
        : 'other';
    let severity = Number(raw.severity);
    if (!Number.isFinite(severity)) severity = raw.flagged ? 3 : 1; // older models / prompts without a scale
    severity = Math.min(5, Math.max(1, Math.round(severity)));
    return {
        flagged: !!raw.flagged,
        reason: raw.reason,
        suggestedAction: raw.suggestedAction,
        category,
        severity,
    };
}

export const aiService = new AIService();

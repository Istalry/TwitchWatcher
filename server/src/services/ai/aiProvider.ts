import { ModerationResult, Platform } from '../../store/types';
import type { PromptOptions } from './promptBuilder';

/**
 * Optional constructor overrides so a provider can be pointed at another model / key / prompt
 * without touching the saved settings (used by the bench script). Anything omitted comes from settings.
 */
export interface ProviderOverrides {
    model?: string;
    apiKey?: string;
    prompt?: PromptOptions;
}

export interface AIProvider {
    /** Must throw on any failure; AIService decides how to fail open. */
    analyzeMessage(message: string, history: string[], platform?: Platform): Promise<ModerationResult>;
    healthCheck(): Promise<boolean>;
}

/** Strips ```json fences and parses the model's JSON verdict. */
export function parseVerdict(responseText: string): ModerationResult {
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
        flagged: !!parsed.flagged,
        reason: parsed.reason,
        suggestedAction: parsed.suggestedAction,
        category: parsed.category,
        severity: typeof parsed.severity === 'number' ? parsed.severity : parseInt(parsed.severity, 10) || undefined,
    };
}

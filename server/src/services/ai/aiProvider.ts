import { ModerationResult, Platform } from '../../store/types';

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

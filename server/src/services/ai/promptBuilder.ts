import { settingsStore } from '../../store/settings';

export const buildModerationPrompt = (message: string, history: string[] = []): string => {
    // Note: False positive/safelist injection removed as per user request.

    const historyContext = history.length > 0
        ? `\nRecent Chat History (CONSIDER THIS FOR CONTEXT AND PATTERN DETECTION):\n${history.map(m => `- ${m}`).join('\n')}\n`
        : '';

    const language = settingsStore.get().aiLanguage;

    return `You are a Twitch Chat Moderator. Your job is to analyze messages for Hateful content, Harassment, Excessive Vulgarity, or Spam.

    ${historyContext}

    Analyze the LATEST message(s) below from this user. 
    New Message: "${message}"

    CRITICAL INSTRUCTION:
    - Look at the "Recent Chat History" above.
    - Determine if the new message is harassment *in context* of previous messages (e.g. repeated badgering, circumventing blocks, multi-message insults).
    - SPECIFICALLY CHECK FOR FRAGMENTED INSULTS: If the user is sending single letters or short segments (like "p", "u", "t", "e") that spell out a slur when combined with recent history, FLAG IT.
    - If the history shows a pattern of abuse, FLAG the new message.

    Respond ONLY with a JSON object in this format:
    {
      "flagged": boolean,
      "reason": "short explanation in ${language} (max 1 sentence)",
      "suggestedAction": "none" | "timeout" | "ban"
    }
    
    If the message is safe, set "flagged": false and "suggestedAction": "none".
    If unsure, lean towards "flagged": false to avoid over-moderation.
    
    IMPORTANT: Provide ONLY the JSON. Do not wrap in markdown code blocks if possible.`;
};

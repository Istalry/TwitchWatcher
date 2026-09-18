import { LinkPolicy, Sensitivity, settingsStore } from '../../store/settings';
import { MODERATION_CATEGORIES, ModerationCategory, Platform } from '../../store/types';

const CATEGORY_DESCRIPTIONS: Record<ModerationCategory, string> = {
    hate: 'slurs or dehumanizing statements about a protected group (race, religion, gender, sexuality, disability, nationality)',
    harassment: 'clear, targeted insults or bullying aimed at a specific person',
    threat: 'threats of violence, doxxing (sharing private info), or encouraging self-harm',
    spam: 'scam links, repeated unsolicited promotion, obvious bot spam',
    vulgarity: 'graphic sexual content or extreme profanity aimed at someone',
    other: 'anything else a moderator would clearly have to act on',
};

const SENSITIVITY_PREAMBLE: Record<'lenient' | 'balanced' | 'strict', string> = {
    lenient: 'Only flag unambiguous, clear-cut violations. Banter, sarcasm and mild rudeness are NOT violations.',
    balanced: 'Flag content a reasonable, experienced moderator would act on. Give the benefit of the doubt: most chat is harmless.',
    strict: 'Flag anything a cautious moderator would want to review, including borderline cases — but still never flag harmless chatter.',
};

/** Parts of the settings the prompt depends on; anything omitted falls back to the saved settings. */
export interface PromptOptions {
    language?: string;
    sensitivity?: Sensitivity;
    categories?: Partial<Record<ModerationCategory, boolean>>;
    links?: LinkPolicy;
}

export const buildModerationPrompt = (message: string, history: string[] = [], platform?: Platform, options: PromptOptions = {}): string => {
    const settings = settingsStore.get();
    const language = options.language ?? settings.aiLanguage;
    const sensitivity = options.sensitivity ?? settings.moderation.sensitivity;
    const categories = options.categories ?? settings.moderation.categories;
    const links = options.links ?? settings.moderation.links;
    const moderateLinks = links !== 'allow' && categories.spam !== false; // plain URLs never reach the AI; disguised ones do

    const enabledCategories = MODERATION_CATEGORIES.filter(c => categories[c] !== false);
    const categoryList = enabledCategories.map(c => `- "${c}": ${CATEGORY_DESCRIPTIONS[c]}`).join('\n');

    const historyContext = history.length > 0
        ? `\nEarlier messages from this same user (context only — posting often is NOT a violation):\n${history.map(m => `- ${m}`).join('\n')}\n`
        : '';

    return `You are a live-stream chat moderator${platform ? ` on ${platform}` : ''}. Decide whether the new message requires moderator action.

Categories you moderate:
${categoryList}

Moderation policy: ${SENSITIVITY_PREAMBLE[sensitivity]}
${historyContext}
New message from this user: "${message}"
(Several short messages may be joined with " . ".)

These ARE violations and must be flagged:
- insults aimed at a person ("shut up you worthless idiot", "nobody wants you here", "kys") → harassment, severity 3-4
- scam or phishing bait ("free v-bucks at bit.ly/…", "click here to claim"), selling followers/viewers ("cheap followers, dm me") → spam, severity 3
- slurs, dehumanizing statements about a group → hate, severity 4-5
- threats of violence, sharing someone's address/phone → threat, severity 5
${moderateLinks ? '- a link deliberately broken up or disguised to evade filters ("bit(dot)ly/x", "discord . gg / abc", "y o u t u b e . c o m", "example[.]com", "hxxp://") → spam, severity 3, even if the destination looks harmless\n' : ''}
These are NOT violations and must be answered with "flagged": false:
- greetings, small talk, questions (including personal ones like "where are you from" or "do you have a wife"), jokes, opinions, disagreement
- swearing that is not aimed at anyone ("putain le clutch", "holy shit that play")
- talking about other viewers, saying someone blocked them, complaining, drama between viewers without insults
- emojis, single letters, dots, repeated characters, song requests, non-English chatter you cannot read
- the words "hate"/"kill"/"die" used casually, in any language (e.g. "I hate Mondays", "this beat kills", "ce son il tue", "je suis mort de rire")
${moderateLinks ? '- version numbers, prices or abbreviations that merely contain dots ("v1 . 2", "la maj 1 . 3", "1.5x", "e.g.")\n' : ''}Only treat a series of fragments as abuse if the fragments, joined together, clearly spell a slur or explicit insult.
Never flag a message only because the user posts a lot or repeats themselves; repetition never raises the severity of a harmless message.
The word "hate" by itself is not hate speech ("Hate from Ireland" is a pun on "hi from"): "hate" requires an actual slur or dehumanizing statement about a group.

Severity scale (1-5):
1 = harmless or mildly edgy
2 = rude toward someone, low impact
3 = clear targeted insult, obvious scam/spam
4 = severe harassment, hateful language, graphic sexual content
5 = explicit slur, explicit threat of violence, doxxing — use 5 ONLY for these

Respond ONLY with a JSON object in this format:
{
  "flagged": boolean,
  "category": ${enabledCategories.map(c => `"${c}"`).join(' | ')},
  "severity": 1 | 2 | 3 | 4 | 5,
  "reason": "short explanation in ${language} (max 1 sentence)",
  "suggestedAction": "none" | "timeout" | "ban"
}

If the message is safe, set "flagged": false, "severity": 1 and "suggestedAction": "none".
If unsure, answer "flagged": false — a missed borderline message costs less than a wrong punishment.

IMPORTANT: Provide ONLY the JSON. Do not wrap in markdown code blocks if possible.`;
};

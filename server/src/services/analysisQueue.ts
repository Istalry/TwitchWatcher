import { historyStore } from '../store/history';
import { actionQueue } from '../store/actionQueue';
import { settingsStore } from '../store/settings';
import { aiService } from './ai/aiService';
import { AnalysisQueue } from './analysisEngine';

export type { AnalysisStats } from './analysisEngine';

/** The app's analysis queue, wired to the singletons. Importing this starts the 500 ms tick. */
export const analysisQueue = new AnalysisQueue({
    settings: () => settingsStore.get().moderation,
    history: historyStore,
    actions: actionQueue,
    ai: aiService,
});

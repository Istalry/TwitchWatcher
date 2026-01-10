import { ModerationResult } from '../../store/types';

export interface AIProvider {
    analyzeMessage(message: string, history: string[]): Promise<ModerationResult>;
}

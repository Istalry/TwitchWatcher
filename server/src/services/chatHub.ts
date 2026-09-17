import { EventEmitter } from 'events';
import { historyStore } from '../store/history';
import { analysisQueue } from './analysisQueue';
import { ChatMessage } from '../store/types';
import { IncomingMessage } from '../platforms/types';

const RECENT_LIMIT = 500;

/**
 * Single entry point for chat messages from every platform.
 * Stores → analyzes → fans out to SSE listeners (`'message'` event).
 */
class ChatHub extends EventEmitter {
    private recentMessages: ChatMessage[] = [];

    public publish(msg: IncomingMessage): ChatMessage {
        const stored = historyStore.addMessage(msg);
        analysisQueue.add(msg, stored.id);

        this.recentMessages.push(stored);
        if (this.recentMessages.length > RECENT_LIMIT) this.recentMessages.shift();

        this.emit('message', stored);
        return stored;
    }

    public recent(limit = 200): ChatMessage[] {
        return this.recentMessages.slice(-limit);
    }
}

export const chatHub = new ChatHub();
chatHub.setMaxListeners(100); // one listener per open dashboard tab

import { useEffect, useRef, useState } from 'react';
import { type ActionEvent, type ChatMessage } from '../types';

const MAX_MESSAGES = 500;

interface Options {
    enabled: boolean;
    onAction?: (event: ActionEvent) => void;
}

/**
 * Subscribes to the server's SSE feed (`/api/chat/stream`): live chat messages from
 * every platform plus action-queue changes. Backfills from `/api/chat/recent` on connect.
 */
export function useChatStream({ enabled, onAction }: Options) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const onActionRef = useRef(onAction);
    useEffect(() => {
        onActionRef.current = onAction;
    });

    useEffect(() => {
        if (!enabled || typeof EventSource === 'undefined') return;

        let cancelled = false;

        fetch('/api/chat/recent?limit=200')
            .then(res => (res.ok ? res.json() : []))
            .then((recent: ChatMessage[]) => {
                if (cancelled) return;
                setMessages(prev => mergeMessages(recent, prev));
            })
            .catch(() => { /* stream will still deliver new messages */ });

        const source = new EventSource('/api/chat/stream');
        source.addEventListener('ready', () => setConnected(true));
        source.addEventListener('message', (evt: MessageEvent) => {
            const msg = JSON.parse(evt.data) as ChatMessage;
            setMessages(prev => mergeMessages(prev, [msg]));
        });
        source.addEventListener('action', (evt: MessageEvent) => {
            onActionRef.current?.(JSON.parse(evt.data) as ActionEvent);
        });
        source.onerror = () => setConnected(false); // EventSource reconnects on its own

        return () => {
            cancelled = true;
            source.close();
            setConnected(false);
        };
    }, [enabled]);

    return { messages, connected };
}

/** Appends `incoming` to `base`, de-duplicating by id and keeping the newest MAX_MESSAGES. */
function mergeMessages(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    if (incoming.length === 0) return base;
    const seen = new Set(base.map(m => m.id));
    const merged = [...base];
    for (const m of incoming) {
        if (!seen.has(m.id)) {
            seen.add(m.id);
            merged.push(m);
        }
    }
    merged.sort((a, b) => a.timestamp - b.timestamp);
    return merged.length > MAX_MESSAGES ? merged.slice(-MAX_MESSAGES) : merged;
}

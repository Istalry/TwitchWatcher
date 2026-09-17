import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Ban, Clock, MessageSquare, Radio } from 'lucide-react';
import { PLATFORMS, type ChatMessage, type PendingAction, type Platform, type PlatformStatus } from '../types';
import { PlatformBadge } from './PlatformBadge';
import { PLATFORM_META } from '../platformMeta';

interface Props {
    messages: ChatMessage[];
    actions: PendingAction[];
    platforms: Record<Platform, PlatformStatus>;
    connected: boolean;
    onModerate?: (userKey: string, action: 'ban' | 'timeout') => void;
}

type Filter = 'all' | Platform;

export function LiveChat({ messages, actions, platforms, connected, onModerate }: Props) {
    const [filter, setFilter] = useState<Filter>('all');
    const [followBottom, setFollowBottom] = useState(true);
    const [seenCount, setSeenCount] = useState(0); // messages visible when the user last was at the bottom
    const listRef = useRef<HTMLDivElement>(null);

    const enabledPlatforms = PLATFORMS.filter(p => platforms[p]?.enabled);

    // messageId -> reason, for inline highlighting of what the AI queued.
    const flaggedIds = useMemo(() => {
        const map = new Map<string, PendingAction>();
        for (const a of actions) for (const id of a.messageIds) map.set(id, a);
        return map;
    }, [actions]);

    const visible = useMemo(
        () => (filter === 'all' ? messages : messages.filter(m => m.platform === filter)),
        [messages, filter]
    );

    const unseen = followBottom ? 0 : Math.max(0, visible.length - seenCount);

    // Auto-follow the newest message unless the user scrolled up.
    useEffect(() => {
        const el = listRef.current;
        if (el && followBottom) el.scrollTop = el.scrollHeight;
    }, [visible, followBottom]);

    const handleScroll = () => {
        const el = listRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        if (atBottom !== followBottom) {
            setFollowBottom(atBottom);
            setSeenCount(visible.length);
        }
    };

    const jumpToLatest = () => {
        setFollowBottom(true);
        setSeenCount(visible.length);
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    };

    return (
        <div className="bg-[#18181b] rounded-2xl border border-white/5 shadow-xl flex flex-col h-full overflow-hidden relative">
            <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Radio size={16} className={connected ? 'text-green-500' : 'text-zinc-600'} />
                    Live Chat
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 font-mono text-zinc-400">{visible.length}</span>
                </h3>
                <div className="flex gap-1" role="tablist" aria-label="Platform filter">
                    <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
                    {enabledPlatforms.map(p => (
                        <FilterChip key={p} active={filter === p} onClick={() => setFilter(p)} color={PLATFORM_META[p].color}>
                            {PLATFORM_META[p].label}
                        </FilterChip>
                    ))}
                </div>
            </div>

            <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                {visible.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                        <MessageSquare size={40} className="mb-3 opacity-20" />
                        <p className="font-mono text-sm">
                            {enabledPlatforms.length === 0 ? 'No platform enabled' : 'Waiting for messages…'}
                        </p>
                    </div>
                ) : (
                    visible.map(msg => {
                        const flag = flaggedIds.get(msg.id);
                        const caps = platforms[msg.platform]?.capabilities;
                        return (
                            <div
                                key={msg.id}
                                data-testid="chat-row"
                                data-flagged={flag ? 'true' : undefined}
                                className={`group relative flex items-start gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${flag ? 'bg-red-500/5 border-l-2 border-red-500' : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                                    }`}
                            >
                                <span className="text-[10px] text-zinc-600 font-mono pt-1 w-14 shrink-0">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <PlatformBadge platform={msg.platform} className="mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <span className="font-bold text-zinc-200 mr-2">{msg.displayName}</span>
                                    <span className="text-zinc-300 break-words">{msg.content}</span>
                                    {flag && (
                                        <span
                                            title={flag.flaggedReason}
                                            className="ml-2 inline-block max-w-[16rem] truncate align-middle text-red-400 text-[10px] uppercase tracking-wider font-bold bg-red-500/10 px-1.5 py-0.5 rounded"
                                        >
                                            {flag.flaggedReason.split(' | ').pop()}
                                        </span>
                                    )}
                                </div>
                                {onModerate && caps && (caps.timeout || caps.ban) && (
                                    <div className="absolute right-2 top-1 hidden group-hover:flex gap-1 bg-[#18181b] rounded-md p-0.5 border border-white/10">
                                        {caps.timeout && (
                                            <button
                                                title="Timeout"
                                                onClick={() => onModerate(msg.userKey, 'timeout')}
                                                className="p-1 rounded text-zinc-500 hover:text-orange-500 hover:bg-orange-500/20"
                                            >
                                                <Clock size={14} />
                                            </button>
                                        )}
                                        {caps.ban && (
                                            <button
                                                title="Ban"
                                                onClick={() => onModerate(msg.userKey, 'ban')}
                                                className="p-1 rounded text-zinc-500 hover:text-red-500 hover:bg-red-500/20"
                                            >
                                                <Ban size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {!followBottom && unseen > 0 && (
                <button
                    onClick={jumpToLatest}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-all"
                >
                    <ArrowDown size={14} /> {unseen} new
                </button>
            )}
        </div>
    );
}

function FilterChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
    return (
        <button
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${active
                ? 'bg-blue-600 border-blue-500 text-white'
                : `bg-transparent border-white/10 hover:bg-white/5 ${color ?? 'text-zinc-400'}`
                }`}
        >
            {children}
        </button>
    );
}

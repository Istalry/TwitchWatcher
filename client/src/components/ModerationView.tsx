import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageSquare, Settings as SettingsIcon, Zap } from 'lucide-react';
import { ActionCard } from './ActionCard';
import { LiveChat } from './LiveChat';
import { PLATFORMS, type ChatMessage, type PendingAction, type Platform, type PlatformStatus } from '../types';

interface Props {
    messages: ChatMessage[];
    actions: PendingAction[];
    platforms: Record<Platform, PlatformStatus>;
    streamConnected: boolean;
    onResolve: (ids: string[], resolution: 'approved' | 'discarded', banDuration?: string) => void;
    onHold?: (ids: string[]) => void;
    onModerate: (userKey: string, action: 'ban' | 'timeout') => void;
    onOpenSettings: () => void;
}

type Pane = 'chat' | 'queue';

/** Split view: merged live chat on the left, the AI's pending-action queue on the right. */
export function ModerationView({ messages, actions, platforms, streamConnected, onResolve, onHold, onModerate, onOpenSettings }: Props) {
    const [pane, setPane] = useState<Pane>('chat'); // only used below the lg breakpoint

    const noPlatform = PLATFORMS.every(p => !platforms[p]?.enabled);

    // Group actions by user so one troll = one card.
    const actionGroups = useMemo(() => {
        const grouped: Record<string, PendingAction[]> = {};
        for (const a of actions) (grouped[a.userKey] ??= []).push(a);
        return Object.values(grouped);
    }, [actions]);

    if (noPlatform) {
        return (
            <div className="bg-[#18181b] rounded-3xl p-16 border border-white/5 h-80 flex flex-col justify-center items-center text-center shadow-2xl">
                <h3 className="text-3xl font-black mb-4 text-white uppercase tracking-tight">No platform connected</h3>
                <p className="text-zinc-500 text-lg font-medium mb-8">Enable Twitch, YouTube or TikTok in Settings to start watching a chat.</p>
                <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wide transition-all shadow-lg"
                >
                    <SettingsIcon size={18} /> Open Settings
                </button>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            {/* Mobile / narrow: toggle between the two panes */}
            <div className="lg:hidden flex gap-2 mb-4" role="tablist" aria-label="Moderation panes">
                <PaneButton active={pane === 'chat'} onClick={() => setPane('chat')} icon={<MessageSquare size={16} />}>Chat</PaneButton>
                <PaneButton active={pane === 'queue'} onClick={() => setPane('queue')} icon={<Zap size={16} />}>
                    Queue{actions.length > 0 && <span className="ml-2 bg-red-500 text-white px-2 rounded-full text-[10px]">{actions.length}</span>}
                </PaneButton>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-12 gap-6">
                <div className={`col-span-12 lg:col-span-7 min-h-0 ${pane === 'chat' ? 'block' : 'hidden'} lg:block`}>
                    <LiveChat messages={messages} actions={actions} platforms={platforms} connected={streamConnected} onModerate={onModerate} />
                </div>

                <div className={`col-span-12 lg:col-span-5 min-h-0 flex flex-col ${pane === 'queue' ? 'flex' : 'hidden'} lg:flex`}>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                            Action Required
                        </h2>
                        {actions.length > 0 && (
                            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                                {actions.length} Pending · {actionGroups.length} {actionGroups.length === 1 ? 'User' : 'Users'}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                        {actions.length === 0 ? (
                            <div className="bg-[#18181b] rounded-2xl p-10 border border-white/5 h-full min-h-[16rem] flex flex-col justify-center text-center shadow-xl">
                                <h3 className="text-2xl font-black mb-3 text-white uppercase tracking-tight">All quiet in chat</h3>
                                <p className="text-zinc-500 font-medium tracking-wide">No flagged messages to review.</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {actionGroups.map(group => (
                                    <ActionCard
                                        key={group[0].userKey}
                                        actions={group}
                                        capabilities={platforms[group[0].platform]?.capabilities}
                                        onResolve={onResolve}
                                        onHold={onHold}
                                    />
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PaneButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <button
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm tracking-wide transition-all ${active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-[#18181b] text-zinc-400 hover:text-white border border-white/5'
                }`}
        >
            {icon}
            {children}
        </button>
    );
}

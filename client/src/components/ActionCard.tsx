import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Hand, Zap } from 'lucide-react';
import { type PendingAction, type PlatformCapabilities } from '../types';
import { PlatformBadge } from './PlatformBadge';
import { PLATFORM_META } from '../platformMeta';

interface ActionCardProps {
    actions: PendingAction[];
    capabilities?: PlatformCapabilities;
    onResolve: (ids: string[], resolution: 'approved' | 'discarded', banDuration?: string) => void;
    /** Cancels a pending auto countdown (card stays for manual review). */
    onHold?: (ids: string[]) => void;
}

/** Seconds left before `at`, re-rendered every second; null when there is no countdown. */
function useCountdown(at: number | undefined): number | null {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!at) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [at]);
    if (!at) return null;
    return Math.max(0, Math.ceil((at - now) / 1000));
}

const FULL_CAPABILITIES: PlatformCapabilities = { ban: true, timeout: true, unban: true, deleteMessage: true };

export function ActionCard({ actions, capabilities = FULL_CAPABILITIES, onResolve, onHold }: ActionCardProps) {
    const autoAt = actions.reduce<number | undefined>((min, a) => (a.autoExecuteAt && (!min || a.autoExecuteAt < min) ? a.autoExecuteAt : min), undefined);
    const secondsLeft = useCountdown(autoAt);
    if (actions.length === 0) return null;

    // Use the first action for common details (username, etc.)
    const mainAction = actions[0];
    const actionIds = actions.map(a => a.id);
    const canModerate = capabilities.ban || capabilities.timeout;
    const maxSeverity = Math.max(...actions.map(a => a.severity ?? 0));
    // Highlight the strongest suggestion across the coalesced actions (none < timeout < ban).
    const suggested = actions.some(a => a.suggestedAction === 'ban') ? 'ban'
        : actions.some(a => a.suggestedAction === 'timeout') ? 'timeout' : 'none';
    const deletesMessages = actions.some(a => a.deleteMessages);
    const rule = actions.find(a => a.source === 'rule')?.ruleName;
    const policyLabel = rule ? `Rule «${rule}»` : 'Link policy';

    // Aggregate reasons (a coalesced action carries several, joined with " | ")
    const distinctReasons = Array.from(new Set(actions.flatMap(a => a.flaggedReason.split(' | '))));

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-[#18181b] rounded-2xl border border-red-500/20 p-6 shadow-lg relative overflow-hidden group hover:border-red-500/40 transition-colors"
        >
            <div className="absolute top-0 right-0 p-4 opacity-50 text-red-500">
                <div className="w-20 h-20 bg-red-500/5 rounded-full blur-2xl absolute -top-10 -right-10 pointer-events-none" />
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20">
                                {(mainAction.displayName || mainAction.username)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-white font-bold text-lg leading-tight flex items-center gap-2 flex-wrap">
                                    <span className="truncate">{mainAction.displayName || mainAction.username}</span>
                                    <PlatformBadge platform={mainAction.platform} />
                                </h3>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {maxSeverity > 0 && (
                                        <div
                                            title="AI severity (1-5)"
                                            className={`text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded ${maxSeverity >= 5 ? 'bg-red-500 text-white' : maxSeverity >= 4 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/10 text-orange-400'}`}
                                        >
                                            Sev {maxSeverity}
                                        </div>
                                    )}
                                    {distinctReasons.map((reason, i) => (
                                        <div key={i} className="text-red-400 text-xs uppercase tracking-wider font-bold bg-red-500/5 px-2 py-0.5 rounded">
                                            {reason}
                                        </div>
                                    ))}
                                    {actions.length > 1 && (
                                        <div className="text-zinc-500 text-xs uppercase tracking-wider font-bold bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                                            {actions.length} Messages
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-xs font-mono text-zinc-600 border border-zinc-800 px-2 py-1 rounded shrink-0">
                            {actions.length > 1 ? `${actions.length} ITEMS` : `ID: ${mainAction.id.slice(0, 6)}`}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {actions.map((action) => (
                            <div key={action.id} className="bg-[#09090b] p-4 rounded-xl border border-white/5 relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500/20 rounded-l-xl" />
                                <div className="flex justify-between items-start gap-4">
                                    <p className="text-zinc-300 text-base leading-relaxed pl-3 font-medium break-words min-w-0">"{action.messageContent}"</p>
                                    <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap pt-1">
                                        {new Date(action.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {secondsLeft !== null && canModerate && (
                    <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2" data-testid="auto-countdown" role="timer">
                        <Zap size={14} className="text-amber-300 shrink-0" />
                        <span className="text-xs font-bold text-amber-200 flex-1">
                            Auto: {suggested === 'ban' ? 'ban' : 'timeout'} in {secondsLeft} s
                        </span>
                        {onHold && (
                            <button
                                onClick={() => onHold(actionIds)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-200 text-xs font-bold border border-amber-500/40"
                            >
                                <Hand size={12} /> Hold
                            </button>
                        )}
                    </div>
                )}

                {deletesMessages && canModerate && (
                    <p className="text-[11px] text-amber-300/90 font-bold mb-3 flex items-center gap-2" data-testid="link-policy-note">
                        <span aria-hidden>⚠</span>
                        {policyLabel}: approving deletes the message{actions.length > 1 || mainAction.messageIds.length > 1 ? 's' : ''} and {suggested === 'ban' ? 'bans' : 'times out'} the user.{secondsLeft === null ? ' Nothing happens until you confirm.' : ''}
                    </p>
                )}

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => onResolve(actionIds, 'discarded')}
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold text-sm transition-all border border-transparent hover:border-zinc-600"
                    >
                        Dismiss All
                    </button>

                    {capabilities.timeout && (
                        <button
                            onClick={() => onResolve(actionIds, 'approved', '')}
                            title={suggested === 'timeout' ? 'Suggested action' : undefined}
                            className={`flex-1 px-4 py-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 font-bold text-sm transition-all border hover:border-orange-500/50 ${suggested === 'timeout' ? 'border-orange-500/60 ring-1 ring-orange-500/40' : 'border-orange-500/20'}`}
                        >
                            Timeout
                        </button>
                    )}

                    {capabilities.ban && (
                        <button
                            onClick={() => onResolve(actionIds, 'approved', 'permanent')}
                            title={suggested === 'ban' ? 'Suggested action' : undefined}
                            className={`flex-1 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-sm transition-all border hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] ${suggested === 'ban' ? 'border-red-500/60 ring-1 ring-red-500/40' : 'border-red-500/20'}`}
                        >
                            BAN USER
                        </button>
                    )}

                    {!canModerate && (
                        <p className="w-full text-[10px] text-zinc-500 font-medium leading-snug">
                            {PLATFORM_META[mainAction.platform].label} has no moderation API — handle this user in the {PLATFORM_META[mainAction.platform].label} app.
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

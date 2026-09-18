import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Zap } from 'lucide-react';
import type { Platform, PlatformStatus, SanctionEntry } from '../types';
import { PlatformBadge } from './PlatformBadge';

interface Props {
    platforms: Record<Platform, PlatformStatus>;
    /** Injected for tests; defaults to the API. */
    fetchEntries?: () => Promise<SanctionEntry[]>;
    onReverted?: () => void;
}

const REFRESH_MS = 5000;

const ACTION_STYLE: Record<SanctionEntry['action'], string> = {
    timeout: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    ban: 'bg-red-500/10 text-red-400 border-red-500/30',
    unban: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    delete: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
};

const sourceLabel = (e: SanctionEntry) =>
    e.source === 'rule' ? `Rule: ${e.ruleName ?? '?'}` : e.source === 'link' ? 'Link' : e.source === 'manual' ? 'Manual' : 'AI';

const formatDuration = (s?: number) => {
    if (!s) return '';
    if (s % 3600 === 0) return `${s / 3600} h`;
    if (s % 60 === 0) return `${s / 60} min`;
    return `${s} s`;
};

const defaultFetch = async (): Promise<SanctionEntry[]> => {
    const res = await fetch('/api/sanctions?limit=300');
    if (!res.ok) throw new Error('Failed to load the sanction log');
    return res.json();
};

export function SanctionLog({ platforms, fetchEntries = defaultFetch, onReverted }: Props) {
    const [entries, setEntries] = useState<SanctionEntry[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        fetchEntries().then(setEntries).catch(err => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, [fetchEntries]);

    useEffect(() => {
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    }, [load]);

    const revert = async (entry: SanctionEntry) => {
        if (!confirm(`Undo the ${entry.action} of ${entry.displayName}? This lifts the sanction on ${entry.platform}.`)) return;
        setBusy(entry.id);
        setError(null);
        try {
            const res = await fetch(`/api/sanctions/${entry.id}/revert`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Undo failed');
            onReverted?.();
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Undo failed');
        } finally {
            setBusy(null);
        }
    };

    const canUndo = (e: SanctionEntry) =>
        (e.action === 'timeout' || e.action === 'ban') && !e.reverted && platforms[e.platform]?.capabilities.unban;

    return (
        <div className="bg-[#18181b] rounded-3xl border border-white/10 h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    <History size={20} className="text-zinc-400" />
                    Sanction log
                    {entries && <span className="text-xs font-mono text-zinc-500 normal-case tracking-normal">{entries.length} entries</span>}
                </h2>
                <p className="text-[11px] text-zinc-500 hidden sm:block">Everything the app did on your channels. Undo lifts a timeout or ban.</p>
            </div>

            {error && <div className="mx-6 mt-4 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</div>}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {entries === null && <p className="p-8 text-zinc-500 text-sm">Loading…</p>}
                {entries && entries.length === 0 && (
                    <div className="p-12 text-center text-zinc-500">
                        <p className="font-bold text-white mb-1">Nothing yet</p>
                        <p className="text-sm">Approved cards, quick actions and automatic rules will show up here.</p>
                    </div>
                )}
                <ul className="divide-y divide-white/5">
                    {entries?.map(e => (
                        <li key={e.id} data-testid="sanction-row" className={`px-6 py-4 flex flex-wrap items-start gap-3 ${e.reverted ? 'opacity-50' : ''}`}>
                            <div className="w-16 shrink-0 text-[10px] font-mono text-zinc-500 pt-1">
                                {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <div className="text-zinc-600">{new Date(e.at).toLocaleDateString()}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${ACTION_STYLE[e.action]}`}>
                                        {e.action}{e.action === 'timeout' && e.duration ? ` ${formatDuration(e.duration)}` : ''}
                                    </span>
                                    <span className="font-bold text-white">{e.displayName}</span>
                                    <PlatformBadge platform={e.platform} />
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">{sourceLabel(e)}</span>
                                    {e.by === 'auto' && (
                                        <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1" title="Executed automatically after the grace period">
                                            <Zap size={10} /> Auto
                                        </span>
                                    )}
                                    {e.reverted && <span className="text-[10px] font-bold uppercase text-emerald-400">Undone</span>}
                                    {e.deletedMessages ? <span className="text-[10px] text-zinc-500">{e.deletedMessages} msg deleted</span> : null}
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">{e.reason}</p>
                                {e.messages.length > 0 && (
                                    <p className="text-xs text-zinc-500 mt-1 truncate italic">"{e.messages.join(' · ')}"</p>
                                )}
                            </div>
                            {canUndo(e) && (
                                <button
                                    onClick={() => revert(e)}
                                    disabled={busy === e.id}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 text-xs font-bold border border-transparent hover:border-emerald-500/40 transition-all disabled:opacity-50"
                                >
                                    <RotateCcw size={14} /> {busy === e.id ? 'Undoing…' : 'Undo'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

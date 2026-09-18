import { AlertTriangle, Download, Power, X } from 'lucide-react';
import { PLATFORMS, type SystemStatus, type UpdateInfo } from '../types';
import { PLATFORM_META } from '../platformMeta';

interface TopbarProps {
    onShutdown: () => void;
    status: SystemStatus;
    /** Newer release to advertise; the parent hides it once dismissed. */
    update?: UpdateInfo | null;
    onDismissUpdate?: () => void;
}

export function Topbar({ onShutdown, status, update = null, onDismissUpdate }: TopbarProps) {
    const { ai, platforms } = status;
    const enabled = PLATFORMS.filter(p => platforms[p]?.enabled);
    const showUpdate = !!update;

    // Online but the last analysis failed → amber, with the error as tooltip.
    const aiState: 'ok' | 'warn' | 'off' = !ai.online ? 'off' : ai.lastError || ai.floodActive ? 'warn' : 'ok';
    const aiClasses = {
        ok: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        warn: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        off: 'bg-red-500/10 border-red-500/20 text-red-500',
    }[aiState];
    const aiDot = { ok: 'bg-blue-500 animate-pulse', warn: 'bg-amber-500 animate-pulse', off: 'bg-red-500' }[aiState];
    const aiTitle = ai.lastError
        ? `Last analysis failed: ${ai.lastError.message}`
        : ai.floodActive
            ? 'Flood breaker active: the AI is flagging most messages, threshold raised by 1'
            : ai.flagRate !== null
                ? `Flag rate over the last ${ai.analyzed} messages: ${Math.round(ai.flagRate * 100)}%`
                : `${ai.model}`;
    const aiLabel = aiState === 'off' ? 'Offline' : ai.lastError ? 'Error' : ai.floodActive ? 'Flooding' : 'Online';

    return (
        <>
            <header className="h-16 fixed top-0 right-0 left-0 md:left-64 bg-[#09090b]/80 backdrop-blur-xl border-b border-[#27272a] z-20 flex items-center justify-between gap-2 px-4 md:px-8">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black italic tracking-tighter text-purple-500">
                        Twitch<span className="text-white">Watcher</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {/* AI Status (text collapses to the dot on phones) */}
                    <div title={aiTitle} className={`flex items-center gap-2 px-2 md:px-3 py-1 rounded-full border ${aiClasses}`}>
                        <div className={`w-2 h-2 rounded-full ${aiDot}`} />
                        <div className="hidden sm:flex flex-col leading-none">
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">AI: {ai.provider}</span>
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {aiLabel}
                                {ai.flagRate !== null && aiState !== 'off' && (
                                    <span className="ml-1 opacity-70 font-mono normal-case">{Math.round(ai.flagRate * 100)}%</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* One pill per enabled platform */}
                    {enabled.map(p => {
                        const s = platforms[p];
                        // Enabled but the channel simply isn't streaming → amber "Not live", not a red failure.
                        const notLive = !s.connected && /not (live|online)|isn'?t online|offline/i.test(s.error || '');
                        const state: 'ok' | 'idle' | 'off' = s.connected ? 'ok' : notLive ? 'idle' : 'off';
                        const classes = {
                            ok: 'bg-green-500/10 border-green-500/20 text-green-500',
                            idle: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                            off: 'bg-red-500/10 border-red-500/20 text-red-500',
                        }[state];
                        const dot = { ok: 'bg-green-500 animate-pulse', idle: 'bg-amber-500', off: 'bg-red-500' }[state];
                        const label = { ok: 'Connected', idle: 'Not live', off: 'Disconnected' }[state];
                        return (
                            <div
                                key={p}
                                title={s.error || s.target}
                                className={`flex items-center gap-2 px-2 md:px-3 py-1 rounded-full border ${classes}`}
                            >
                                <div className={`w-2 h-2 rounded-full ${dot}`} />
                                <div className="hidden sm:flex flex-col leading-none">
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{PLATFORM_META[p].label}</span>
                                    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                                </div>
                            </div>
                        );
                    })}

                    <div className="h-8 w-[1px] bg-white/10 mx-1 md:mx-2" />

                    <button
                        onClick={onShutdown}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-red-500"
                        title="Stop Application"
                    >
                        <Power size={18} className="group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Shutdown</span>
                    </button>
                </div>
            </header>

            {(ai.floodActive || showUpdate) && (
                <div className="fixed top-16 right-0 left-0 md:left-64 z-20 flex flex-col">
                    {ai.floodActive && (
                        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs font-bold px-8 py-2 flex items-center gap-2">
                            <AlertTriangle size={14} />
                            The AI is flagging {ai.flagRate !== null ? Math.round(ai.flagRate * 100) : '50+'}% of chat — the threshold was raised temporarily. Consider a lower sensitivity or a different model in Settings.
                        </div>
                    )}
                    {showUpdate && update && (
                        <div role="status" className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-xs font-bold px-8 py-2 flex items-center gap-3">
                            <Download size={14} />
                            <span>Update available: v{update.latestVersion}. Your settings and history are kept when you replace the exe.</span>
                            <a href={update.url} target="_blank" rel="noreferrer" className="underline hover:text-white">Download</a>
                            <button onClick={onDismissUpdate} aria-label="Dismiss update notice" className="ml-auto text-emerald-300/70 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

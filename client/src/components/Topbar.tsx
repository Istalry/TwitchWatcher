import { Power } from 'lucide-react';

interface TopbarProps {
    onShutdown: () => void;
    status: {
        twitch: { connected: boolean; channel: string };
        ai: { online: boolean; provider: string; model: string };
    };
}

export function Topbar({ onShutdown, status }: TopbarProps) {
    return (
        <header className="h-16 fixed top-0 right-0 left-0 md:left-64 bg-[#09090b]/80 backdrop-blur-xl border-b border-[#27272a] z-20 flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-black italic tracking-tighter text-purple-500">
                    Twitch<span className="text-white">Watcher</span>
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {/* AI Status */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${status.ai.online ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${status.ai.online ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">AI: {status.ai.provider}</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{status.ai.online ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                {/* Twitch Status */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${status.twitch.connected ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${status.twitch.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Twitch</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{status.twitch.connected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>

                <div className="h-8 w-[1px] bg-white/10 mx-2" />

                <button
                    onClick={onShutdown}
                    className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-red-500"
                    title="Stop Application"
                >
                    <Power size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Shutdown</span>
                </button>
            </div>
        </header>
    );
}

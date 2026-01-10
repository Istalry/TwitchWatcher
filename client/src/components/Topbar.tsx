import { Power } from 'lucide-react';

interface TopbarProps {
    onShutdown: () => void;
    isConnected: boolean;
}

export function Topbar({ onShutdown, isConnected }: TopbarProps) {
    return (
        <header className="h-16 fixed top-0 right-0 left-0 md:left-64 bg-[#09090b]/80 backdrop-blur-xl border-b border-[#27272a] z-20 flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-black italic tracking-tighter text-purple-500">
                    Twitch<span className="text-white">Watcher</span>
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {isConnected ? (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold text-green-500 uppercase tracking-wider">System Online</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Disconnected</span>
                    </div>
                )}

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

import { motion } from 'framer-motion';
import { type PendingAction } from '../types';

interface ActionCardProps {
    action: PendingAction;
    onResolve: (id: string, resolution: 'approved' | 'discarded', banDuration?: string) => void;
}

export function ActionCard({ action, onResolve }: ActionCardProps) {
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

            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 font-bold border border-red-500/20">
                                {action.username[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg leading-tight">{action.username}</h3>
                                <div className="text-red-400 text-xs uppercase tracking-wider font-bold">{action.flaggedReason}</div>
                            </div>
                        </div>
                        <div className="text-xs font-mono text-zinc-600 border border-zinc-800 px-2 py-1 rounded">
                            ID: {action.id.slice(0, 6)}
                        </div>
                    </div>

                    <div className="bg-[#09090b] p-4 rounded-xl border border-white/5 relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500/20 rounded-l-xl" />
                        <p className="text-zinc-300 text-base leading-relaxed pl-3 font-medium">"{action.messageContent}"</p>
                    </div>
                </div>

                <div className="flex md:flex-col gap-3 justify-center min-w-[140px]">
                    <button
                        onClick={() => onResolve(action.id, 'discarded')}
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold text-sm transition-all border border-transparent hover:border-zinc-600"
                    >
                        Dismiss
                    </button>

                    <button
                        onClick={() => onResolve(action.id, 'approved', '')}
                        className="flex-1 px-4 py-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 font-bold text-sm transition-all border border-orange-500/20 hover:border-orange-500/50"
                    >
                        Timeout
                    </button>

                    <button
                        onClick={() => onResolve(action.id, 'approved', 'permanent')}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-sm transition-all border border-red-500/20 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    >
                        BAN
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

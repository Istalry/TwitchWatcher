import React, { useState, useMemo } from 'react';
import { EMPTY_STATUS, type ChatUser, type Platform, type PlatformStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Ban, User, Users, MessageSquare, Search, RotateCcw, Trash2, StickyNote } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import { PLATFORM_META } from '../platformMeta';

interface Props {
    users: ChatUser[];
    platforms?: Record<Platform, PlatformStatus>;
    onDeleteUser?: (key: string) => void;
}

export const UserList: React.FC<Props> = ({ users, platforms = EMPTY_STATUS.platforms, onDeleteUser }) => {
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const activeUser = users.find(u => u.key === selectedUser);
    const activeCaps = activeUser ? platforms[activeUser.platform]?.capabilities : undefined;

    const sortedAndFilteredUsers = useMemo(() => {
        let result = users;

        // Search
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(u => u.username.toLowerCase().includes(lowerQuery) || u.displayName?.toLowerCase().includes(lowerQuery));
        }

        // Sort by last message timestamp (descending)
        result.sort((a, b) => {
            const lastA = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : 0;
            const lastB = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : 0;
            return lastB - lastA;
        });

        return result;
    }, [users, searchQuery]);

    const handleModerate = async (e: React.MouseEvent, user: ChatUser, action: 'ban' | 'timeout' | 'unban') => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to ${action} ${user.displayName} (${PLATFORM_META[user.platform].label})?`)) return;
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(user.key)}/moderate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || `Failed to ${action}`);
            }
        } catch (err) {
            console.error('Failed to moderate', err);
        }
    };

    const handleDelete = (user: ChatUser) => {
        if (!confirm(`Are you sure you want to delete data for ${user.displayName}?`)) return;
        if (onDeleteUser) {
            onDeleteUser(user.key);
            setSelectedUser(null);
        }
    }

    return (
        <div className="grid grid-cols-12 gap-6 h-full">
            {/* Master List - 4 Cols */}
            <div className="col-span-12 lg:col-span-4 bg-[#18181b] rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-xl h-full">
                <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Users size={16} className="text-blue-500" />
                            Live Users
                        </h3>
                        <span className="text-xs px-2 py-1 rounded bg-white/10 font-mono text-zinc-400">{users.length}</span>
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                    {sortedAndFilteredUsers.length === 0 ? (
                        <div className="text-center p-4 text-zinc-600 text-xs italic">
                            No users found
                        </div>
                    ) : (
                        sortedAndFilteredUsers.map((u) => {
                            const caps = platforms[u.platform]?.capabilities;
                            return (
                            <div
                                key={u.key}
                                onClick={() => setSelectedUser(u.key)}
                                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all group border ${selectedUser === u.key
                                    ? 'bg-blue-600/10 border-blue-500/50 shadow-[inset_0_0_10px_rgba(37,99,235,0.2)]'
                                    : 'border-transparent hover:bg-white/5'
                                    }`}
                            >
                                <div className="relative">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-lg ${u.status === 'banned' ? 'bg-red-500' : u.status === 'timed_out' ? 'bg-orange-500' : 'bg-zinc-700'
                                        }`}>
                                        {(u.displayName || u.username)[0].toUpperCase()}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#18181b] ${u.status === 'banned' ? 'bg-red-500' : u.status === 'timed_out' ? 'bg-orange-500' : 'bg-green-500'
                                        }`} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className={`font-bold text-sm truncate flex items-center gap-2 ${selectedUser === u.key ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                                        <span className="truncate">{u.displayName || u.username}</span>
                                        <PlatformBadge platform={u.platform} />
                                        {u.notes?.length > 0 && (
                                            <span title={`${u.notes.length} AI note(s) below threshold`} className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                        )}
                                    </div>
                                    <div className="text-[10px] text-zinc-600 font-mono truncate">
                                        {u.messages.length} messages
                                        {u.messages.length > 0 && ` • ${new Date(u.messages[u.messages.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </div>
                                </div>

                                {/* Actions (only what the platform can actually do) */}
                                <div className="flex gap-1">
                                    {u.status === 'banned' ? (
                                        caps?.unban && (
                                            <button
                                                className="p-1.5 rounded hover:bg-green-500/20 text-zinc-600 hover:text-green-500 transition-colors"
                                                title="Unban"
                                                onClick={(e) => handleModerate(e, u, 'unban')}
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        )
                                    ) : (
                                        <>
                                            {caps?.timeout && (
                                                <button
                                                    className="p-1.5 rounded hover:bg-orange-500/20 text-zinc-600 hover:text-orange-500 transition-colors"
                                                    title="Timeout"
                                                    onClick={(e) => handleModerate(e, u, 'timeout')}
                                                >
                                                    <Clock size={14} />
                                                </button>
                                            )}
                                            {caps?.ban && (
                                                <button
                                                    className="p-1.5 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-500 transition-colors"
                                                    title="Ban"
                                                    onClick={(e) => handleModerate(e, u, 'ban')}
                                                >
                                                    <Ban size={14} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Detail View - 8 Cols */}
            <div className="col-span-12 lg:col-span-8 bg-[#18181b] rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-xl h-full relative">
                <AnimatePresence mode="wait">
                    {activeUser ? (
                        <motion.div
                            key={activeUser.key}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col h-full"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-gradient-to-r from-blue-900/10 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-3xl font-black text-zinc-500 shadow-inner">
                                        {(activeUser.displayName || activeUser.username)[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                            {activeUser.displayName || activeUser.username}
                                            <PlatformBadge platform={activeUser.platform} size="sm" full />
                                        </h2>
                                        <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${activeUser.status === 'banned' ? 'bg-red-500/20 text-red-500' : activeUser.status === 'timed_out' ? 'bg-orange-500/20 text-orange-500' : 'bg-green-500/20 text-green-500'
                                            }`}>
                                            {activeUser.status?.replace('_', ' ') || 'ACTIVE'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDelete(activeUser)}
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Delete Data
                                    </button>
                                    {activeUser.status === 'banned' && activeCaps?.unban && (
                                        <button
                                            onClick={(e) => handleModerate(e, activeUser, 'unban')}
                                            className="bg-green-500/10 hover:bg-green-500/20 text-green-500 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                                        >
                                            <RotateCcw size={14} /> Unban
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* AI notes: flags that stayed below the sensitivity threshold */}
                            {activeUser.notes?.length > 0 && (
                                <div className="px-6 py-3 border-b border-white/5 bg-amber-500/5">
                                    <div className="text-[10px] uppercase tracking-widest font-black text-amber-400 flex items-center gap-2 mb-2">
                                        <StickyNote size={12} /> Recent AI notes ({activeUser.notes.length})
                                    </div>
                                    <ul className="space-y-1">
                                        {activeUser.notes.slice(-5).reverse().map(n => (
                                            <li key={n.id} className="text-xs text-zinc-400 flex gap-2">
                                                <span className="font-mono text-zinc-600 shrink-0">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="text-amber-500 font-bold uppercase shrink-0">sev {n.severity} · {n.category}</span>
                                                <span className="truncate">{n.reason}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Chat History */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/20">
                                {activeUser.messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                                        <MessageSquare size={48} className="mb-4 opacity-20" />
                                        <p className="font-mono text-sm">No recent messages</p>
                                    </div>
                                ) : (
                                    activeUser.messages.map((msg, i) => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            key={msg.id}
                                            className="flex gap-4 group"
                                        >
                                            <div className="w-12 text-[10px] text-zinc-600 font-mono pt-1 text-right flex-shrink-0">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="bg-[#27272a] p-3 rounded-lg rounded-tl-none border border-transparent group-hover:border-white/10 transition-colors max-w-[80%]">
                                                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
                            <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center mb-6">
                                <User size={48} className="opacity-50" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-500 mb-2">No User Selected</h3>
                            <p className="text-sm text-zinc-600">Select a user from the list to view their history</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

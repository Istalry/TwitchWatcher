import { Bug, Users, Zap, Settings as SettingsIcon } from 'lucide-react';
import { NetworkQRCode } from './NetworkQRCode';

interface SidebarProps {
    activeTab: 'actions' | 'users' | 'debug' | 'settings';
    setActiveTab: (tab: 'actions' | 'users' | 'debug' | 'settings') => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
    const tabs = [
        { id: 'actions', label: 'Actions', icon: Zap },
        { id: 'users', label: 'Live Users', icon: Users },
        { id: 'debug', label: 'Debug', icon: Bug },
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ] as const;

    return (
        <aside className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col h-full fixed left-0 top-0 pt-24 z-10 hidden md:flex">
            <nav className="flex-1 px-4 space-y-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            // @ts-ignore
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm tracking-wide ${isActive
                                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <Icon size={20} className={isActive ? 'text-white' : 'text-zinc-500'} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            <NetworkQRCode />

            <div className="p-4 text-xs text-zinc-600 font-mono text-center mb-4">
                v1.0.0-beta
            </div>
        </aside>
    );
}


import { Bug, Users, Zap, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import { NetworkQRCode } from './NetworkQRCode';

export type TabId = 'moderation' | 'users' | 'debug' | 'settings';

interface SidebarProps {
    activeTab: TabId;
    setActiveTab: (tab: TabId) => void;
    version?: string;
}

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'moderation', label: 'Moderation', icon: Zap },
    { id: 'users', label: 'Live Users', icon: Users },
    { id: 'debug', label: 'Debug', icon: Bug },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

/** Bottom tab bar for phones/tablets, where the sidebar is hidden. */
export function MobileNav({ activeTab, setActiveTab }: SidebarProps) {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#18181b]/95 backdrop-blur border-t border-[#27272a] flex" aria-label="Main">
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-400' : 'text-zinc-500'}`}
                    >
                        <Icon size={20} />
                        {tab.label}
                    </button>
                );
            })}
        </nav>
    );
}

export function Sidebar({ activeTab, setActiveTab, version }: SidebarProps) {

    return (
        <aside className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col h-full fixed left-0 top-0 pt-24 z-10 hidden md:flex">
            <nav className="flex-1 px-4 space-y-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
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

            <div className="p-4 text-xs text-zinc-600 font-mono text-center mb-4" data-testid="app-version">
                {version ? `v${version}` : '…'}
            </div>
        </aside>
    );
}


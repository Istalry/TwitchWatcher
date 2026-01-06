import { useState, useEffect } from 'react';
import { Save, Trash2, Globe } from 'lucide-react';
import { type AppSettings } from '../types';

export function Settings() {
    const [settings, setSettings] = useState<AppSettings>({ aiLanguage: 'English' });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            setSettings(data);
        } catch (err) {
            console.error('Failed to fetch settings', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            // Show success feedback?
        } catch (err) {
            console.error('Failed to save settings', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to delete ALL user data? This cannot be undone.')) return;

        try {
            const res = await fetch('/api/users', { method: 'DELETE' });
            if (res.ok) {
                alert('All data cleared.');
            }
        } catch (err) {
            console.error('Failed to clear data', err);
        }
    };

    if (isLoading) return <div className="text-white">Loading...</div>;

    return (
        <div className="bg-[#18181b] rounded-3xl border border-white/10 p-12 max-w-3xl mx-auto shadow-2xl mt-8 space-y-12">
            <div>
                <h2 className="text-3xl font-black mb-2 flex items-center gap-5 text-white uppercase tracking-tight">
                    <div className="bg-zinc-800 p-4 rounded-xl">
                        <Globe className="text-zinc-400" size={32} />
                    </div>
                    AI Settings
                </h2>
                <p className="text-zinc-500 ml-20">Configure how the AI moderates and assumes context.</p>

                <div className="mt-8 ml-20 space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-3 font-black tracking-widest ml-1">AI Language</label>
                        <div className="flex gap-4">
                            <input
                                className="flex-1 bg-zinc-800 border-2 border-transparent rounded-xl p-5 text-white font-bold focus:border-zinc-600 focus:outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                                value={settings.aiLanguage}
                                onChange={e => setSettings({ ...settings, aiLanguage: e.target.value })}
                                placeholder="e.g. English, Spanish, French..."
                            />
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-bold uppercase tracking-wide transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={20} />
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                        <p className="text-xs text-zinc-600 mt-3 font-medium">The AI will use this language for providing moderation reasons.</p>
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            <div>
                <h2 className="text-3xl font-black mb-2 flex items-center gap-5 text-white uppercase tracking-tight">
                    <div className="bg-zinc-800 p-4 rounded-xl">
                        <Trash2 className="text-red-500" size={32} />
                    </div>
                    Danger Zone
                </h2>
                <p className="text-zinc-500 ml-20">Irreversible actions for data management.</p>

                <div className="mt-8 ml-20">
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                            <h4 className="text-red-500 font-bold text-lg mb-1">Clear All User Data</h4>
                            <p className="text-zinc-500 text-sm">Permanently remove all tracked users and chat history.</p>
                        </div>
                        <button
                            onClick={handleClearAll}
                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-3 rounded-xl font-bold uppercase tracking-wide transition-all"
                        >
                            Execute
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

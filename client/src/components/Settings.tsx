import { useState, useEffect } from 'react';
import { Save, Trash2, Globe, Twitch as TwitchIcon, ChevronDown } from 'lucide-react';
import { type AppSettings } from '../types';
import { SecureInput } from './SecureInput';

export function Settings() {
    const [settings, setSettings] = useState<AppSettings>({
        isSetupComplete: true,
        aiLanguage: 'English',
        defaultTimeoutDuration: 600,
        twitch: { username: '', channel: '', clientId: '', clientSecret: '' },
        ai: { provider: 'ollama', model: 'gemma-3-27b-it' }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Dynamic Model Lists
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']);
    const [fetchingModels, setFetchingModels] = useState(false);

    const fetchGoogleModels = async (key: string) => {
        if (!key || key.length < 10) return;
        setFetchingModels(true);
        try {
            const res = await fetch(`/api/ai/models/google?key=${key}`);
            if (res.ok) {
                const models = await res.json();
                if (models && models.length > 0) {
                    setAvailableModels(models);
                }
            }
        } catch (e) {
            console.error('Failed to fetch models', e);
        } finally {
            setFetchingModels(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            setSettings(data);

            // Auto-fetch models if using Google
            if (data.ai?.provider === 'google' && data.ai?.apiKey) {
                fetchGoogleModels(data.ai.apiKey);
            }
        } catch (err) {
            console.error('Failed to fetch settings', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Use PUT for updates as defined in server
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            alert('Settings saved successfully!');
        } catch (err) {
            console.error('Failed to save settings', err);
            alert('Failed to save settings.');
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

    const updateTwitch = (key: keyof AppSettings['twitch'], val: string) => {
        setSettings(prev => ({ ...prev, twitch: { ...prev.twitch, [key]: val } }));
    };

    const updateAi = (key: keyof AppSettings['ai'], val: string) => {
        setSettings(prev => ({ ...prev, ai: { ...prev.ai, [key]: val } }));
    };

    if (isLoading) return <div className="text-white text-center mt-20">Loading Settings...</div>;

    return (
        <div className="bg-[#18181b] rounded-3xl border border-white/10 p-12 max-w-3xl mx-auto shadow-2xl mt-8 space-y-12 mb-20">
            {/* AI Config */}
            <div>
                <h2 className="text-3xl font-black mb-2 flex items-center gap-5 text-white uppercase tracking-tight">
                    <div className="bg-zinc-800 p-4 rounded-xl">
                        <Globe className="text-zinc-400" size={32} />
                    </div>
                    AI & Moderation
                </h2>

                <div className="mt-8 ml-20 space-y-6">
                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">AI Language</label>
                        <input
                            className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none"
                            value={settings.aiLanguage}
                            onChange={e => setSettings({ ...settings, aiLanguage: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Default Timeout (Seconds)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none"
                            value={settings.defaultTimeoutDuration}
                            onChange={e => setSettings({ ...settings, defaultTimeoutDuration: parseInt(e.target.value) || 0 })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Provider</label>
                            <select
                                className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none appearance-none"
                                value={settings.ai.provider}
                                onChange={e => updateAi('provider', e.target.value)}
                            >
                                <option value="ollama">Ollama (Local)</option>
                                <option value="google">Google AI (Cloud)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Model</label>
                            {settings.ai.provider === 'google' ? (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none appearance-none"
                                            value={settings.ai.model}
                                            onChange={e => updateAi('model', e.target.value)}
                                        >
                                            {availableModels.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={20} />
                                    </div>
                                    <button
                                        onClick={() => fetchGoogleModels(settings.ai.apiKey || '')}
                                        disabled={fetchingModels || !settings.ai.apiKey}
                                        className="px-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 disabled:opacity-50 text-white font-bold transition-all"
                                        title="Refresh Models"
                                    >
                                        {fetchingModels ? '...' : '↻'}
                                    </button>
                                </div>
                            ) : (
                                <input
                                    className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none"
                                    value={settings.ai.model}
                                    onChange={e => updateAi('model', e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    {settings.ai.provider === 'google' && (
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">API Key</label>
                            <SecureInput
                                value={settings.ai.apiKey || ''}
                                onChange={val => updateAi('apiKey', val)}
                                placeholder="AIza..."
                                onBlur={() => fetchGoogleModels(settings.ai.apiKey || '')}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Twitch Config */}
            <div>
                <h2 className="text-3xl font-black mb-2 flex items-center gap-5 text-white uppercase tracking-tight">
                    <div className="bg-zinc-800 p-4 rounded-xl">
                        <TwitchIcon className="text-zinc-400" size={32} />
                    </div>
                    Twitch Details
                </h2>

                <div className="mt-8 ml-20 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Bot Username</label>
                            <input
                                className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none"
                                value={settings.twitch.username}
                                onChange={e => updateTwitch('username', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Channel</label>
                            <input
                                className="w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none"
                                value={settings.twitch.channel}
                                onChange={e => updateTwitch('channel', e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Client ID</label>
                        <SecureInput
                            value={settings.twitch.clientId}
                            onChange={val => updateTwitch('clientId', val)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest">Client Secret</label>
                        <SecureInput
                            value={settings.twitch.clientSecret}
                            onChange={val => updateTwitch('clientSecret', val)}
                        />
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Actions */}
            <div className="flex justify-end gap-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wide transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={20} />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex items-center justify-between mt-12">
                <div>
                    <h4 className="text-red-500 font-bold text-lg mb-1">Clear All User Data</h4>
                    <p className="text-zinc-500 text-sm">Permanently remove all tracked users and chat history.</p>
                </div>
                <button
                    onClick={handleClearAll}
                    className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-6 py-3 rounded-xl font-bold uppercase tracking-wide transition-all"
                >
                    <Trash2 size={20} />
                </button>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Server, ShieldCheck, Key, ChevronDown, ExternalLink } from 'lucide-react';
import { SecureInput } from './SecureInput';
import { TwitchCard, YouTubeCard, TikTokCard } from './platforms/PlatformCards';
import { DEFAULT_PLATFORM_SETTINGS, PLATFORMS, type PlatformSettingsMap } from '../types';

export function SetupPage() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [platforms, setPlatforms] = useState<PlatformSettingsMap>(DEFAULT_PLATFORM_SETTINGS);

    const [aiConfig, setAiConfig] = useState({
        provider: 'ollama' as 'ollama' | 'google',
        model: 'gemma3:4b',
        apiKey: ''
    });

    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemma-3-27b-it']);
    const [fetchingModels, setFetchingModels] = useState(false);

    const enabledCount = PLATFORMS.filter(p => platforms[p].enabled).length;

    const fetchGoogleModels = async (key: string) => {
        if (!key || key.length < 10) return;
        setFetchingModels(true);
        try {
            const res = await fetch(`/api/ai/models/google?key=${encodeURIComponent(key)}`);
            if (res.ok) {
                const models = await res.json();
                if (models && models.length > 0) {
                    setAvailableModels(models);
                    // Select first if current is invalid
                    if (!models.includes(aiConfig.model)) {
                        handleAiChange('model', models[0]);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch models', e);
        } finally {
            setFetchingModels(false);
        }
    };

    const handleAiChange = (key: string, val: string) => {
        setAiConfig(prev => ({ ...prev, [key]: val }));

        // Set default model if provider switches
        if (key === 'provider') {
            if (val === 'google') {
                setAiConfig(prev => ({ ...prev, model: 'gemini-1.5-flash' }));
            } else {
                setAiConfig(prev => ({ ...prev, model: 'gemma3:4b' }));
            }
        }
    };

    /** Client-side check mirroring the server's: only enabled platforms need their fields. */
    const platformsValid = () => {
        const t = platforms.twitch, y = platforms.youtube, k = platforms.tiktok;
        if (t.enabled && (!t.username || !t.channel || !t.clientId || !t.clientSecret)) return false;
        if (y.enabled && !y.channel && !y.videoIdOverride) return false;
        if (k.enabled && !k.username) return false;
        return true;
    };

    const submitSetup = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platforms, ai: aiConfig })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Setup failed to save');

            // Server chains the OAuth flows (Twitch → YouTube) and lands on the dashboard.
            window.location.href = data.nextAuthUrl || '/';
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Setup failed');
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto text-blue-500 mb-4">
                    <ShieldCheck size={32} />
                </div>
                <h1 className="text-3xl font-black text-white">Welcome to TwitchWatcher</h1>
                <p className="text-zinc-400">Your local, AI-powered auto-moderator for Twitch, YouTube and TikTok.</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-blue-400"><Key size={20} /></div>
                    <div>
                        <h3 className="font-bold text-white">Secure & Private</h3>
                        <p className="text-sm text-zinc-400">Your keys are encrypted on your device. Nothing leaves your local network except what you send to the platforms.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-purple-400"><Server size={20} /></div>
                    <div>
                        <h3 className="font-bold text-white">Local AI Support</h3>
                        <p className="text-sm text-zinc-400">Use Ollama for free local inference, or connect to Google AI for cloud power.</p>
                    </div>
                </div>
            </div>

            <button onClick={() => setStep(2)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                Get Started <ChevronRight size={20} />
            </button>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Platforms</h2>
                <p className="text-zinc-400 text-sm">Pick the chats to watch. You can add or change platforms later in Settings.</p>
            </div>

            <div className="space-y-3">
                <TwitchCard mode="setup" value={platforms.twitch} onChange={twitch => setPlatforms(p => ({ ...p, twitch }))} />
                <YouTubeCard mode="setup" value={platforms.youtube} onChange={youtube => setPlatforms(p => ({ ...p, youtube }))} />
                <TikTokCard mode="setup" value={platforms.tiktok} onChange={tiktok => setPlatforms(p => ({ ...p, tiktok }))} />
            </div>

            <div className="flex gap-3 items-center">
                <button onClick={() => setStep(1)} className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white font-medium">Back</button>
                <button
                    disabled={!platformsValid()}
                    onClick={() => setStep(3)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    {enabledCount === 0 ? 'Skip for now' : 'Next Step'} <ChevronRight size={20} />
                </button>
            </div>
            {enabledCount === 0 && (
                <p className="text-center text-xs text-zinc-500">No platform selected — the dashboard will stay empty until you enable one in Settings.</p>
            )}
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white">AI Configuration</h2>
                <p className="text-zinc-400 text-sm">Choose who powers the moderation brain.</p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleAiChange('provider', 'ollama')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${aiConfig.provider === 'ollama' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        <Server size={24} />
                        <span className="font-bold">Ollama (Local)</span>
                    </button>
                    <button
                        onClick={() => handleAiChange('provider', 'google')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${aiConfig.provider === 'google' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        <ShieldCheck size={24} />
                        <span className="font-bold">Google (Cloud)</span>
                    </button>
                </div>

                <div>
                    <label className="block text-zinc-400 text-sm mb-1">Model Name</label>
                    {aiConfig.provider === 'google' ? (
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none appearance-none"
                                    value={aiConfig.model}
                                    onChange={e => handleAiChange('model', e.target.value)}
                                >
                                    {availableModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={20} />
                            </div>
                            <button
                                onClick={() => fetchGoogleModels(aiConfig.apiKey)}
                                disabled={fetchingModels || !aiConfig.apiKey}
                                className="px-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-50 text-white transition-all"
                                title="Refresh Models"
                            >
                                {fetchingModels ? '...' : '↻'}
                            </button>
                        </div>
                    ) : (
                        <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                            value={aiConfig.model} onChange={e => handleAiChange('model', e.target.value)} />
                    )}
                    <p className="text-xs text-zinc-500 mt-1">
                        {aiConfig.provider === 'google' ? 'Select a Google Gemini model.' : 'Example: gemma3:4b (Check your Ollama library)'}
                    </p>
                </div>

                {aiConfig.provider === 'google' && (
                    <SecureInput
                        label="Google API Key"
                        value={aiConfig.apiKey}
                        onChange={val => handleAiChange('apiKey', val)}
                        placeholder="AIza..."
                        onBlur={() => fetchGoogleModels(aiConfig.apiKey)}
                    />
                )}
            </div>

            {/* Helper Instructions depending on Provider */}
            <div className={`mt-4 rounded-xl p-4 border border-opacity-20 ${aiConfig.provider === 'ollama' ? 'bg-zinc-900 border-zinc-700' : 'bg-blue-500/10 border-blue-500/20'}`}>
                {aiConfig.provider === 'ollama' ? (
                    <div className="text-xs text-zinc-400 space-y-2">
                        <h3 className="text-white font-bold uppercase tracking-wide mb-1 flex items-center gap-2">
                            <Server size={14} /> Ollama Setup
                        </h3>
                        <p>1. Download Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 inline-flex">ollama.com <ExternalLink size={10} /></a></p>
                        <p>2. Run command: <code className="bg-black/50 px-1 py-0.5 rounded text-zinc-300">ollama pull gemma3:4b</code></p>
                        <p>3. Ensure Ollama is running in background.</p>
                    </div>
                ) : (
                    <div className="text-xs text-zinc-400 space-y-2">
                        <h3 className="text-blue-400 font-bold uppercase tracking-wide mb-1 flex items-center gap-2">
                            <ShieldCheck size={14} /> Google AI Setup
                        </h3>
                        <p>1. Go to <a href="https://aistudio.google.com/app/api-keys" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 inline-flex">Google AI Studio <ExternalLink size={10} /></a></p>
                        <p>2. Create a free API Key.</p>
                        <p>3. Paste it above.</p>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                    {error}
                </div>
            )}

            <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white font-medium">Back</button>
                <button
                    onClick={submitSetup}
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    {loading ? 'Saving...' : enabledCount > 0 ? 'Save & Connect' : 'Save & Finish'} <Check size={20} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-100">
            <div className={`w-full ${step === 2 ? 'max-w-xl' : 'max-w-md'} transition-all`}>
                {/* Progress Dots */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i <= step ? 'w-8 bg-blue-500' : 'w-2 bg-zinc-800'}`} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

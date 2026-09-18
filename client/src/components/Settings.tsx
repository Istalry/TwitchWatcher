import { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, Globe, ChevronDown, Radio, Shield, FolderOpen } from 'lucide-react';
import {
    DEFAULT_PLATFORM_SETTINGS, EMPTY_STATUS, MODERATION_CATEGORIES,
    type AppSettings, type LinkPolicy, type ModerationCategory, type Sensitivity, type SystemInfo, type SystemStatus,
} from '../types';
import { SecureInput } from './SecureInput';
import { TwitchCard, YouTubeCard, TikTokCard } from './platforms/PlatformCards';

interface Props {
    status?: SystemStatus;
    info?: SystemInfo | null;
    onSaved?: () => void;
}

const LINK_OPTIONS: { id: LinkPolicy; label: string; hint: string }[] = [
    { id: 'allow', label: 'Allow', hint: 'Links are ignored; only scam bait is judged by the AI.' },
    { id: 'flag', label: 'Flag', hint: 'Any link outside the allowlist becomes a card to review.' },
    { id: 'block', label: 'Block', hint: 'Same, with a timeout pre-selected on the card.' },
];

const SENSITIVITY_OPTIONS: { id: Sensitivity; label: string; hint: string }[] = [
    { id: 'lenient', label: 'Lenient', hint: 'Only clear-cut violations reach the queue (severity 4+).' },
    { id: 'balanced', label: 'Balanced', hint: 'What a reasonable moderator would act on (severity 3+).' },
    { id: 'strict', label: 'Strict', hint: 'Borderline cases too (severity 2+). Expect more cards.' },
];

const CATEGORY_LABELS: Record<ModerationCategory, string> = {
    hate: 'Hate speech',
    harassment: 'Harassment',
    threat: 'Threats / doxxing',
    spam: 'Spam & scams',
    vulgarity: 'Vulgarity / sexual',
    other: 'Other',
};

const ALWAYS_ON: ModerationCategory[] = ['hate', 'threat'];

const parseAllowlist = (text: string): string[] => Array.from(new Set(
    text.split(/[\n,;\s]+/).map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]).filter(Boolean),
));

export function Settings({ status = EMPTY_STATUS, info = null, onSaved }: Props) {
    const [settings, setSettings] = useState<AppSettings>({
        schemaVersion: 2,
        isSetupComplete: true,
        checkForUpdates: true,
        aiLanguage: 'English',
        defaultTimeoutDuration: 600,
        moderation: {
            sensitivity: 'balanced',
            categories: { hate: true, harassment: true, threat: true, spam: true, vulgarity: true, other: true },
            skipTrustedRoles: true,
            links: 'allow',
            linkAllowlist: [],
        },
        platforms: DEFAULT_PLATFORM_SETTINGS,
        ai: { provider: 'ollama', model: 'gemma3:4b' }
    });
    const [allowlistText, setAllowlistText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Dynamic Model Lists
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']);
    const [fetchingModels, setFetchingModels] = useState(false);

    const fetchGoogleModels = useCallback(async (key: string) => {
        if (!key || key.length < 10) return;
        setFetchingModels(true);
        try {
            const res = await fetch(`/api/ai/models/google?key=${encodeURIComponent(key)}`);
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
    }, []);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/settings');
            const data: AppSettings = await res.json();
            setSettings(data);
            setAllowlistText((data.moderation?.linkAllowlist ?? []).join('\n'));

            // Auto-fetch models if using Google
            if (data.ai?.provider === 'google' && data.ai?.apiKey) {
                fetchGoogleModels(data.ai.apiKey);
            }
        } catch (err) {
            console.error('Failed to fetch settings', err);
        } finally {
            setIsLoading(false);
        }
    }, [fetchGoogleModels]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...settings,
                    moderation: { ...settings.moderation, linkAllowlist: parseAllowlist(allowlistText) },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            onSaved?.();
            if (data.nextAuthUrl && confirm('Settings saved. A platform still needs to be connected to your account — do it now?')) {
                window.location.href = data.nextAuthUrl;
                return;
            }
            alert('Settings saved successfully!');
            fetchSettings();
        } catch (err) {
            console.error('Failed to save settings', err);
            alert(err instanceof Error ? err.message : 'Failed to save settings.');
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
                onSaved?.();
            }
        } catch (err) {
            console.error('Failed to clear data', err);
        }
    };

    const updateAi = (key: keyof AppSettings['ai'], val: string) => {
        setSettings(prev => ({ ...prev, ai: { ...prev.ai, [key]: val } }));
    };

    const updateModeration = (patch: Partial<AppSettings['moderation']>) => {
        setSettings(prev => ({ ...prev, moderation: { ...prev.moderation, ...patch } }));
    };

    const toggleCategory = (c: ModerationCategory, on: boolean) => {
        updateModeration({ categories: { ...settings.moderation.categories, [c]: on } });
    };

    if (isLoading) return <div className="text-white text-center mt-20">Loading Settings...</div>;

    const inputClass = 'w-full bg-zinc-800 border-2 border-transparent rounded-xl p-4 text-white font-bold focus:border-zinc-600 outline-none';
    const labelClass = 'block text-xs uppercase text-zinc-500 mb-2 font-black tracking-widest';

    return (
        <div className="bg-[#18181b] rounded-3xl border border-white/10 p-12 max-w-3xl mx-auto shadow-2xl mt-8 space-y-12 mb-20">
            {/* Moderation policy */}
            <div>
                <SectionTitle icon={<Shield className="text-zinc-400" size={32} />}>Moderation</SectionTitle>

                <div className="mt-8 ml-20 space-y-6">
                    <div>
                        <label className={labelClass}>Sensitivity</label>
                        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sensitivity">
                            {SENSITIVITY_OPTIONS.map(opt => {
                                const active = settings.moderation.sensitivity === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => updateModeration({ sensitivity: opt.id })}
                                        className={`p-3 rounded-xl border text-left transition-all ${active ? 'bg-blue-500/10 border-blue-500 text-white' : 'bg-zinc-800 border-transparent text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        <div className="font-bold text-sm">{opt.label}</div>
                                        <div className="text-[11px] text-zinc-500 mt-1 leading-snug">{opt.hint}</div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-2">
                            Flags below the threshold are kept as notes on the user instead of cards. Slurs and threats always reach the queue.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Categories to moderate</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {MODERATION_CATEGORIES.map(c => {
                                const locked = ALWAYS_ON.includes(c);
                                const on = locked || settings.moderation.categories[c] !== false;
                                return (
                                    <label
                                        key={c}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-bold cursor-pointer transition-all ${on ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-900 border-transparent text-zinc-500'} ${locked ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        title={locked ? 'Always moderated' : undefined}
                                    >
                                        <input
                                            type="checkbox"
                                            className="accent-blue-500"
                                            checked={on}
                                            disabled={locked}
                                            onChange={e => toggleCategory(c, e.target.checked)}
                                        />
                                        {CATEGORY_LABELS[c]}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <label className="flex items-center gap-3 text-sm font-bold text-zinc-300 cursor-pointer">
                        <input
                            type="checkbox"
                            className="accent-blue-500"
                            checked={settings.moderation.skipTrustedRoles}
                            onChange={e => updateModeration({ skipTrustedRoles: e.target.checked })}
                        />
                        Don't analyze messages from the broadcaster and platform moderators
                    </label>

                    <div>
                        <label className={labelClass}>Links</label>
                        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Links">
                            {LINK_OPTIONS.map(opt => {
                                const active = (settings.moderation.links ?? 'allow') === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => updateModeration({ links: opt.id })}
                                        className={`p-3 rounded-xl border text-left transition-all ${active ? 'bg-blue-500/10 border-blue-500 text-white' : 'bg-zinc-800 border-transparent text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        <div className="font-bold text-sm">{opt.label}</div>
                                        <div className="text-[11px] text-zinc-500 mt-1 leading-snug">{opt.hint}</div>
                                    </button>
                                );
                            })}
                        </div>
                        {settings.moderation.links !== 'allow' && (
                            <div className="mt-3">
                                <label className={labelClass} htmlFor="link-allowlist">Allowed domains (one per line)</label>
                                <textarea
                                    id="link-allowlist"
                                    className={`${inputClass} font-mono text-sm min-h-24`}
                                    placeholder={'youtube.com\ntwitch.tv\ndiscord.gg'}
                                    value={allowlistText}
                                    onChange={e => setAllowlistText(e.target.value)}
                                    onBlur={() => updateModeration({ linkAllowlist: parseAllowlist(allowlistText) })}
                                />
                                <p className="text-[11px] text-zinc-500 mt-2">
                                    Subdomains are covered (<code>twitch.tv</code> also allows <code>clips.twitch.tv</code>). Plain links are caught instantly without the AI; disguised ones ("bit(dot)ly") are left to the AI.
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>Default Timeout (Seconds)</label>
                        <input
                            type="number"
                            className={inputClass}
                            value={settings.defaultTimeoutDuration}
                            onChange={e => setSettings({ ...settings, defaultTimeoutDuration: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </div>
            </div>

            <Divider />

            {/* AI Config */}
            <div>
                <SectionTitle icon={<Globe className="text-zinc-400" size={32} />}>AI Engine</SectionTitle>

                <div className="mt-8 ml-20 space-y-6">
                    <div>
                        <label className={labelClass}>AI Language</label>
                        <input
                            className={inputClass}
                            value={settings.aiLanguage}
                            onChange={e => setSettings({ ...settings, aiLanguage: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Provider</label>
                            <select
                                className={`${inputClass} appearance-none`}
                                value={settings.ai.provider}
                                onChange={e => updateAi('provider', e.target.value)}
                            >
                                <option value="ollama">Ollama (Local)</option>
                                <option value="google">Google AI (Cloud)</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Model</label>
                            {settings.ai.provider === 'google' ? (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            className={`${inputClass} appearance-none`}
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
                                    className={inputClass}
                                    value={settings.ai.model}
                                    onChange={e => updateAi('model', e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    {settings.ai.provider === 'google' && (
                        <div>
                            <label className={labelClass}>API Key</label>
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

            <Divider />

            {/* Platforms */}
            <div>
                <SectionTitle icon={<Radio className="text-zinc-400" size={32} />}>Platforms</SectionTitle>
                <p className="mt-2 ml-20 text-sm text-zinc-500">Enable any combination. Changes connect or disconnect immediately after saving.</p>

                <div className="mt-8 ml-20 space-y-4">
                    <TwitchCard
                        mode="settings"
                        value={settings.platforms.twitch}
                        status={status.platforms.twitch}
                        onChange={twitch => setSettings(prev => ({ ...prev, platforms: { ...prev.platforms, twitch } }))}
                    />
                    <YouTubeCard
                        mode="settings"
                        value={settings.platforms.youtube}
                        status={status.platforms.youtube}
                        onChange={youtube => setSettings(prev => ({ ...prev, platforms: { ...prev.platforms, youtube } }))}
                    />
                    <TikTokCard
                        mode="settings"
                        value={settings.platforms.tiktok}
                        status={status.platforms.tiktok}
                        onChange={tiktok => setSettings(prev => ({ ...prev, platforms: { ...prev.platforms, tiktok } }))}
                    />
                </div>
            </div>

            <Divider />

            {/* General */}
            <div>
                <SectionTitle icon={<FolderOpen className="text-zinc-400" size={32} />}>General</SectionTitle>

                <div className="mt-8 ml-20 space-y-6">
                    <label className="flex items-center gap-3 text-sm font-bold text-zinc-300 cursor-pointer">
                        <input
                            type="checkbox"
                            className="accent-blue-500"
                            checked={settings.checkForUpdates !== false}
                            onChange={e => setSettings({ ...settings, checkForUpdates: e.target.checked })}
                        />
                        Check GitHub for new releases (once a day, a banner appears when one is available)
                    </label>

                    <div>
                        <label className={labelClass}>Data folder</label>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-xs text-zinc-400 break-all" data-testid="data-dir">
                            {info?.dataDir ?? '…'}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-2">
                            Holds <code>settings.json</code> (encrypted), <code>users.json</code> and <code>bans.json</code>. It survives updates: just replace the exe.
                            {info?.version ? ` Running v${info.version}.` : ''}
                        </p>
                    </div>
                </div>
            </div>

            <Divider />

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
                    <p className="text-zinc-500 text-sm">Permanently remove all tracked users, notes and chat history.</p>
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

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <h2 className="text-3xl font-black mb-2 flex items-center gap-5 text-white uppercase tracking-tight">
            <div className="bg-zinc-800 p-4 rounded-xl">{icon}</div>
            {children}
        </h2>
    );
}

function Divider() {
    return <div className="h-px bg-white/5 w-full" />;
}

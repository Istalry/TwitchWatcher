import { type ReactNode } from 'react';
import { ExternalLink, Key, Link2, Server, ShieldCheck, Tv } from 'lucide-react';
import { SecureInput } from '../SecureInput';
import { PLATFORM_META } from '../../platformMeta';
import { type Platform, type PlatformStatus, type TikTokSettings, type TwitchSettings, type YouTubeSettings } from '../../types';

export type CardMode = 'setup' | 'settings';

interface ShellProps {
    platform: Platform;
    icon: ReactNode;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    status?: PlatformStatus;
    subtitle: string;
    children: ReactNode;
}

const fieldClass = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none';
const labelClass = 'block text-zinc-400 text-sm mb-1';

/** Card frame with the enable toggle; fields render only while enabled. */
function CardShell({ platform, icon, enabled, onToggle, status, subtitle, children }: ShellProps) {
    const meta = PLATFORM_META[platform];
    return (
        <div className={`rounded-2xl border transition-all ${enabled ? `bg-zinc-900 ${meta.border}` : 'bg-zinc-900/50 border-zinc-800'}`}>
            <button
                type="button"
                onClick={() => onToggle(!enabled)}
                aria-pressed={enabled}
                className="w-full flex items-center gap-4 p-4 text-left"
            >
                <div className={`p-2 rounded-lg ${enabled ? `${meta.bg} ${meta.color}` : 'bg-zinc-800 text-zinc-500'}`}>{icon}</div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-white flex items-center gap-2">
                        {meta.label}
                        {status && enabled && (
                            <span
                                title={status.error || status.target}
                                className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded ${status.connected ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
                            >
                                {status.connected ? 'Connected' : status.error || 'Disconnected'}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-zinc-500">{subtitle}</div>
                </div>
                <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </div>
            </button>
            {enabled && <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">{children}</div>}
        </div>
    );
}

// ---------------------------------------------------------------- Twitch

interface TwitchCardProps {
    value: TwitchSettings;
    onChange: (next: TwitchSettings) => void;
    mode: CardMode;
    status?: PlatformStatus;
}

export function TwitchCard({ value, onChange, mode, status }: TwitchCardProps) {
    const set = (patch: Partial<TwitchSettings>) => onChange({ ...value, ...patch });
    return (
        <CardShell
            platform="twitch"
            icon={<Tv size={20} />}
            enabled={value.enabled}
            onToggle={enabled => set({ enabled })}
            status={status}
            subtitle="Full moderation: timeouts, bans and unbans."
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Bot Username</label>
                    <input className={fieldClass} value={value.username} onChange={e => set({ username: e.target.value })} placeholder="JustB0t..." />
                </div>
                <div>
                    <label className={labelClass}>Channel to Watch</label>
                    <input className={fieldClass} value={value.channel} onChange={e => set({ channel: e.target.value })} placeholder="TheBroadcaster" />
                </div>
            </div>

            <HelpBox title="How to get keys" color="blue">
                <li>Go to <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Twitch Console</a></li>
                <li>Register a new Application (Category: Chat Bot)</li>
                <li>Set <strong>OAuth Redirect URL</strong> to:<br />
                    <code className="bg-black/50 px-1 py-0.5 rounded text-blue-200">http://localhost:3000/auth/twitch/callback</code>
                </li>
                <li>Copy <strong>Client ID</strong> &amp; <strong>Secret</strong> below</li>
            </HelpBox>

            <SecureInput label="Client ID" value={value.clientId} onChange={clientId => set({ clientId })} />
            <SecureInput label="Client Secret" value={value.clientSecret} onChange={clientSecret => set({ clientSecret })} />

            {mode === 'settings' && (
                <AuthRow connected={!!value.accessToken} href="/auth/twitch" label="Twitch account" />
            )}
        </CardShell>
    );
}

// ---------------------------------------------------------------- YouTube

interface YouTubeCardProps {
    value: YouTubeSettings;
    onChange: (next: YouTubeSettings) => void;
    mode: CardMode;
    status?: PlatformStatus;
}

export function YouTubeCard({ value, onChange, mode, status }: YouTubeCardProps) {
    const set = (patch: Partial<YouTubeSettings>) => onChange({ ...value, ...patch });
    return (
        <CardShell
            platform="youtube"
            icon={<ShieldCheck size={20} />}
            enabled={value.enabled}
            onToggle={enabled => set({ enabled })}
            status={status}
            subtitle="Chat is read without a key. Timeouts/bans need a Google OAuth client."
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Channel handle</label>
                    <input className={fieldClass} value={value.channel} onChange={e => set({ channel: e.target.value })} placeholder="@yourchannel" />
                    <p className="text-[11px] text-zinc-500 mt-1">The current live stream is detected automatically.</p>
                </div>
                <div>
                    <label className={labelClass}>Video ID override <span className="text-zinc-600">(optional)</span></label>
                    <input className={fieldClass} value={value.videoIdOverride || ''} onChange={e => set({ videoIdOverride: e.target.value })} placeholder="dQw4w9WgXcQ" />
                    <p className="text-[11px] text-zinc-500 mt-1">Watch a specific live video instead.</p>
                </div>
            </div>

            <HelpBox title="Google OAuth client (for bans & timeouts)" color="red">
                <li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">Google Cloud Console → Credentials <ExternalLink size={10} /></a> and create a project</li>
                <li>Enable the <strong>YouTube Data API v3</strong> for it</li>
                <li>Create an <strong>OAuth client ID</strong> (Web application) with redirect URI:<br />
                    <code className="bg-black/50 px-1 py-0.5 rounded text-blue-200">http://localhost:3000/auth/youtube/callback</code>
                </li>
                <li>Paste the Client ID &amp; Secret below. Leave them empty to watch chat only.</li>
            </HelpBox>

            <SecureInput label="OAuth Client ID" value={value.clientId} onChange={clientId => set({ clientId })} />
            <SecureInput label="OAuth Client Secret" value={value.clientSecret} onChange={clientSecret => set({ clientSecret })} />

            {mode === 'settings' && value.clientId && (
                <AuthRow connected={!!value.accessToken} href="/auth/youtube" label="Google account" />
            )}
        </CardShell>
    );
}

// ---------------------------------------------------------------- TikTok

interface TikTokCardProps {
    value: TikTokSettings;
    onChange: (next: TikTokSettings) => void;
    mode: CardMode;
    status?: PlatformStatus;
}

export function TikTokCard({ value, onChange, status }: TikTokCardProps) {
    const set = (patch: Partial<TikTokSettings>) => onChange({ ...value, ...patch });
    return (
        <CardShell
            platform="tiktok"
            icon={<Server size={20} />}
            enabled={value.enabled}
            onToggle={enabled => set({ enabled })}
            status={status}
            subtitle="Read-only: TikTok has no moderation API. Flags are for review only."
        >
            <div>
                <label className={labelClass}>TikTok username</label>
                <input className={fieldClass} value={value.username} onChange={e => set({ username: e.target.value })} placeholder="@yourname" />
                <p className="text-[11px] text-zinc-500 mt-1">Connects whenever this account is LIVE. No login required.</p>
            </div>
            <div>
                <label className={labelClass}>Euler Stream API key <span className="text-zinc-600">(optional)</span></label>
                <SecureInput value={value.signApiKey || ''} onChange={signApiKey => set({ signApiKey })} placeholder="Raises the free connection rate limit" />
            </div>
        </CardShell>
    );
}

// ---------------------------------------------------------------- shared bits

function HelpBox({ title, color, children }: { title: string; color: 'blue' | 'red'; children: ReactNode }) {
    const classes = color === 'blue'
        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400';
    return (
        <div className={`border rounded-xl p-4 space-y-3 ${classes}`}>
            <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <Key size={16} />
                {title}
            </h3>
            <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside marker:text-current font-medium">{children}</ol>
        </div>
    );
}

function AuthRow({ connected, href, label }: { connected: boolean; href: string; label: string }) {
    return (
        <div className="flex items-center justify-between gap-3 bg-black/30 rounded-lg p-3">
            <span className="text-xs text-zinc-400 flex items-center gap-2">
                <Link2 size={14} className={connected ? 'text-green-500' : 'text-zinc-500'} />
                {label}: <strong className={connected ? 'text-green-500' : 'text-zinc-300'}>{connected ? 'connected' : 'not connected'}</strong>
            </span>
            <a href={href} className="text-xs font-bold uppercase tracking-wide bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                {connected ? 'Re-authenticate' : 'Connect'}
            </a>
        </div>
    );
}

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';

interface Props {
    /** Called after a successful import so the parent reloads settings / follows `nextAuthUrl`. */
    onImported?: (nextAuthUrl: string | null) => void;
}

const MIN_PASSWORD = 8;

/** Export / import of an encrypted settings backup (.twbackup). */
export function BackupPanel({ onImported }: Props) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<'export' | 'import' | null>(null);
    const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const askPassword = (purpose: string): string | null => {
        const pwd = prompt(`${purpose}\nThe file holds your API keys and tokens, so choose a password of at least ${MIN_PASSWORD} characters.`);
        if (pwd === null) return null;
        if (pwd.length < MIN_PASSWORD) {
            setMessage({ kind: 'error', text: `Password must be at least ${MIN_PASSWORD} characters.` });
            return null;
        }
        return pwd;
    };

    const exportBackup = async () => {
        const password = askPassword('Password for this backup:');
        if (!password) return;
        setBusy('export');
        setMessage(null);
        try {
            const res = await fetch('/api/settings/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
            const blob = await res.blob();
            const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'twitchwatcher.twbackup';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setMessage({ kind: 'ok', text: `Saved ${name}. Keep it somewhere safe.` });
        } catch (err) {
            setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Export failed' });
        } finally {
            setBusy(null);
        }
    };

    const importBackup = async (file: File) => {
        const password = askPassword(`Password of ${file.name}:`);
        if (!password) return;
        if (!confirm('Importing replaces ALL current settings (platforms, keys, moderation rules). Continue?')) return;
        setBusy('import');
        setMessage(null);
        try {
            const data = await file.text();
            const res = await fetch('/api/settings/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, data }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Import failed');
            setMessage({ kind: 'ok', text: 'Settings restored. Platforms are reconnecting.' });
            onImported?.(body.nextAuthUrl ?? null);
        } catch (err) {
            setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Import failed' });
        } finally {
            setBusy(null);
            if (fileInput.current) fileInput.current.value = '';
        }
    };

    return (
        <div data-testid="backup-panel">
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={exportBackup}
                    disabled={busy !== null}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-200 disabled:opacity-50"
                >
                    <Download size={16} /> {busy === 'export' ? 'Exporting…' : 'Export settings…'}
                </button>
                <button
                    onClick={() => fileInput.current?.click()}
                    disabled={busy !== null}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-200 disabled:opacity-50"
                >
                    <Upload size={16} /> {busy === 'import' ? 'Importing…' : 'Import settings…'}
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".twbackup,application/json"
                    className="hidden"
                    aria-label="Backup file"
                    onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) void importBackup(file);
                    }}
                />
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
                The backup is encrypted with your password and includes API keys and OAuth tokens, so it can be restored on another computer. Chat history is not included.
            </p>
            {message && (
                <p className={`text-xs font-bold mt-2 ${message.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`} role="status">{message.text}</p>
            )}
        </div>
    );
}

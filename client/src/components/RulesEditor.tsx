import { useState } from 'react';
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { MODERATION_CATEGORIES, type ModerationCategory, type Rule, type RuleType } from '../types';

interface Props {
    rules: Rule[];
    onChange: (rules: Rule[]) => void;
    /** Whether the auto master switch is on (shows the per-rule auto toggle). */
    autoEnabled: boolean;
}

const TYPE_LABEL: Record<RuleType, string> = {
    words: 'Words',
    regex: 'Regex',
    caps: 'Caps lock',
    repeat: 'Repeated message',
};

const TYPE_HINT: Record<RuleType, string> = {
    words: 'Whole words or phrases, one per line. Case and accents are ignored.',
    regex: 'JavaScript regular expression (flags i, u). Keep it simple; max 200 characters.',
    caps: 'Messages that are mostly upper case.',
    repeat: 'The same message posted several times in a short window.',
};

const CATEGORY_LABELS: Record<ModerationCategory, string> = {
    hate: 'Hate speech', harassment: 'Harassment', threat: 'Threats', spam: 'Spam', vulgarity: 'Vulgarity', other: 'Other',
};

const newRule = (): Rule => ({
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    type: 'words',
    words: [],
    category: 'other',
    action: 'timeout',
    deleteMessage: true,
    auto: false,
});

const summary = (r: Rule): string => {
    switch (r.type) {
        case 'words': return (r.words ?? []).slice(0, 4).join(', ') + ((r.words?.length ?? 0) > 4 ? '…' : '');
        case 'regex': return `/${r.pattern ?? ''}/iu`;
        case 'caps': return `≥ ${r.minLength ?? 12} letters, ≥ ${Math.round((r.ratio ?? 0.7) * 100)}% caps`;
        case 'repeat': return `${r.count ?? 3}× within ${r.windowSeconds ?? 60} s`;
    }
};

const validate = (r: Rule): string | null => {
    if (!r.name.trim()) return 'Give the rule a name.';
    if (r.type === 'words' && !(r.words ?? []).some(w => w.trim())) return 'Add at least one word.';
    if (r.type === 'regex') {
        if (!r.pattern?.trim()) return 'The pattern is empty.';
        if (r.pattern.length > 200) return 'The pattern is too long (max 200 characters).';
        try { new RegExp(r.pattern, 'iu'); } catch (err) { return err instanceof Error ? err.message : 'Invalid pattern'; }
    }
    return null;
};

export function RulesEditor({ rules, onChange, autoEnabled }: Props) {
    const [draft, setDraft] = useState<Rule | null>(null);
    const [wordsText, setWordsText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const inputClass = 'w-full bg-zinc-800 border-2 border-transparent rounded-xl p-3 text-white font-bold focus:border-zinc-600 outline-none text-sm';
    const labelClass = 'block text-[10px] uppercase text-zinc-500 mb-1 font-black tracking-widest';

    const startEdit = (r: Rule) => {
        setDraft({ ...r });
        setWordsText((r.words ?? []).join('\n'));
        setError(null);
    };

    const save = () => {
        if (!draft) return;
        const rule: Rule = { ...draft, name: draft.name.trim() };
        if (rule.type === 'words') rule.words = wordsText.split(/\n|,/).map(w => w.trim()).filter(Boolean);
        const problem = validate(rule);
        if (problem) {
            setError(problem);
            return;
        }
        const exists = rules.some(r => r.id === rule.id);
        onChange(exists ? rules.map(r => (r.id === rule.id ? rule : r)) : [...rules, rule]);
        setDraft(null);
    };

    const remove = (id: string) => onChange(rules.filter(r => r.id !== id));
    const toggle = (id: string, enabled: boolean) => onChange(rules.map(r => (r.id === id ? { ...r, enabled } : r)));

    return (
        <div data-testid="rules-editor">
            {rules.length === 0 && !draft && (
                <p className="text-xs text-zinc-500 mb-3">No rules yet. Rules run before the AI and create a card instantly.</p>
            )}

            <ul className="space-y-2 mb-3">
                {rules.map(r => (
                    <li key={r.id} data-testid="rule-row" className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border ${r.enabled ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-transparent opacity-60'}`}>
                        <input
                            type="checkbox"
                            className="accent-blue-500"
                            checked={r.enabled}
                            onChange={e => toggle(r.id, e.target.checked)}
                            aria-label={`Enable rule ${r.name}`}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm">{r.name}</span>
                                <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-700/60 px-1.5 py-0.5 rounded">{TYPE_LABEL[r.type]}</span>
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${r.action === 'ban' ? 'text-red-400 bg-red-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                                    {r.deleteMessage ? 'delete + ' : ''}{r.action}
                                </span>
                                {autoEnabled && r.auto && (
                                    <span className="text-[10px] uppercase font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1"><Zap size={10} /> auto</span>
                                )}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono truncate">{summary(r)}</div>
                        </div>
                        <button onClick={() => startEdit(r)} aria-label={`Edit rule ${r.name}`} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700"><Pencil size={14} /></button>
                        <button onClick={() => remove(r.id)} aria-label={`Delete rule ${r.name}`} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-700"><Trash2 size={14} /></button>
                    </li>
                ))}
            </ul>

            {draft ? (
                <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-500/5 space-y-3" data-testid="rule-form">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="rule-name">Name</label>
                            <input id="rule-name" className={inputClass} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. No caps lock" />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="rule-type">Type</label>
                            <select id="rule-type" className={inputClass} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as RuleType })}>
                                {(Object.keys(TYPE_LABEL) as RuleType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                            </select>
                        </div>
                    </div>
                    <p className="text-[11px] text-zinc-500">{TYPE_HINT[draft.type]}</p>

                    {draft.type === 'words' && (
                        <div>
                            <label className={labelClass} htmlFor="rule-words">Words / phrases</label>
                            <textarea id="rule-words" className={`${inputClass} font-mono min-h-20`} value={wordsText} onChange={e => setWordsText(e.target.value)} placeholder={'free skins\nbuy followers'} />
                        </div>
                    )}
                    {draft.type === 'regex' && (
                        <div>
                            <label className={labelClass} htmlFor="rule-pattern">Pattern</label>
                            <input id="rule-pattern" className={`${inputClass} font-mono`} value={draft.pattern ?? ''} onChange={e => setDraft({ ...draft, pattern: e.target.value })} placeholder="b[u4]y\s+followers" />
                        </div>
                    )}
                    {draft.type === 'caps' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass} htmlFor="rule-minlength">Min letters</label>
                                <input id="rule-minlength" type="number" min={1} className={inputClass} value={draft.minLength ?? 12} onChange={e => setDraft({ ...draft, minLength: parseInt(e.target.value) || 12 })} />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="rule-ratio">Caps share (%)</label>
                                <input id="rule-ratio" type="number" min={1} max={100} className={inputClass} value={Math.round((draft.ratio ?? 0.7) * 100)} onChange={e => setDraft({ ...draft, ratio: Math.min(100, Math.max(1, parseInt(e.target.value) || 70)) / 100 })} />
                            </div>
                        </div>
                    )}
                    {draft.type === 'repeat' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass} htmlFor="rule-count">Times</label>
                                <input id="rule-count" type="number" min={2} className={inputClass} value={draft.count ?? 3} onChange={e => setDraft({ ...draft, count: Math.max(2, parseInt(e.target.value) || 3) })} />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="rule-window">Within (seconds)</label>
                                <input id="rule-window" type="number" min={1} className={inputClass} value={draft.windowSeconds ?? 60} onChange={e => setDraft({ ...draft, windowSeconds: Math.max(1, parseInt(e.target.value) || 60) })} />
                            </div>
                        </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="rule-category">Category</label>
                            <select id="rule-category" className={inputClass} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as ModerationCategory })}>
                                {MODERATION_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="rule-action">Sanction</label>
                            <select id="rule-action" className={inputClass} value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value as Rule['action'] })}>
                                <option value="timeout">Timeout</option>
                                <option value="ban">Ban</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm font-bold text-zinc-300">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="accent-blue-500" checked={draft.deleteMessage} onChange={e => setDraft({ ...draft, deleteMessage: e.target.checked })} />
                            Delete the message
                        </label>
                        {autoEnabled && (
                            <label className="flex items-center gap-2 cursor-pointer text-amber-300">
                                <input type="checkbox" className="accent-amber-500" checked={draft.auto} onChange={e => setDraft({ ...draft, auto: e.target.checked })} />
                                Execute automatically after the grace period
                            </label>
                        )}
                    </div>

                    {error && <p className="text-xs font-bold text-red-400">{error}</p>}

                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700">Cancel</button>
                        <button onClick={save} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500">Save rule</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => startEdit(newRule())} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-200">
                    <Plus size={16} /> Add rule
                </button>
            )}
        </div>
    );
}

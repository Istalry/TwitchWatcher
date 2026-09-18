/**
 * AI prompt bench: runs the labelled messages of bench/dataset.json through a provider and
 * reports how many would have produced a queue card (precision / recall / F1 for "flag").
 *
 *   npm run bench:ai -- [--provider ollama|google] [--model NAME] [--api-key KEY]
 *                       [--sensitivity lenient|balanced|strict] [--lang en|fr] [--limit N] [--quiet]
 *
 * Anything not given on the command line comes from the saved settings; nothing is written back.
 * Results land in bench/results/<model>-<timestamp>.json (gitignored). Exit code 1 on a provider error.
 */
import fs from 'fs';
import path from 'path';
import { GoogleProvider } from '../services/ai/googleProvider';
import { OllamaProvider } from '../services/ai/ollamaProvider';
import { normalizeVerdict, Verdict } from '../services/ai/aiService';
import { AIProvider } from '../services/ai/aiProvider';
import { MIN_SEVERITY, routeVerdict } from '../services/moderationPipeline';
import { Sensitivity, settingsStore } from '../store/settings';
import { ModerationCategory } from '../store/types';

interface BenchItem {
    id: string;
    lang: 'en' | 'fr';
    text: string;
    expect: 'safe' | 'flag';
    category?: ModerationCategory | ModerationCategory[];
    history?: string[];
    note?: string;
}

interface BenchResult {
    id: string;
    lang: string;
    text: string;
    expect: 'safe' | 'flag';
    predicted: 'safe' | 'flag';
    verdict: Verdict | null;
    categoryOk: boolean | null; // null when the item has no expected category or wasn't flagged
    latencyMs: number;
    error?: string;
}

const BENCH_DIR = path.resolve(__dirname, '../../bench');
const DATASET = path.join(BENCH_DIR, 'dataset.json');
const RESULTS_DIR = path.join(BENCH_DIR, 'results');

function parseArgs(argv: string[]) {
    const opts: Record<string, string | true> = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
            opts[key] = next;
            i++;
        } else {
            opts[key] = true;
        }
    }
    return opts;
}

const str = (v: string | true | undefined) => (typeof v === 'string' ? v : undefined);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const shorten = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
        return;
    }

    const saved = settingsStore.get();
    const providerName = str(args.provider) ?? saved.ai.provider;
    const model = str(args.model) ?? saved.ai.model;
    const apiKey = str(args['api-key']);
    const sensitivity = (str(args.sensitivity) ?? saved.moderation.sensitivity) as Sensitivity;
    const lang = str(args.lang);
    const limit = Number(str(args.limit)) || Infinity;
    const quiet = !!args.quiet;

    if (!(sensitivity in MIN_SEVERITY)) throw new Error(`Unknown sensitivity "${sensitivity}" (lenient | balanced | strict)`);
    if (providerName !== 'ollama' && providerName !== 'google') throw new Error(`Unknown provider "${providerName}" (ollama | google)`);
    if (lang && lang !== 'en' && lang !== 'fr') throw new Error(`Unknown lang "${lang}" (en | fr)`);

    const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8')) as { items: BenchItem[] };
    const items = dataset.items.filter(i => !lang || i.lang === lang).slice(0, limit);
    if (items.length === 0) throw new Error('No dataset items match the filters');

    // The bench mirrors the live pipeline: links policy on (disguised links are a violation), every category enabled.
    const overrides = { model, apiKey, prompt: { sensitivity, links: 'suppress' as const, categories: {} } };
    const provider: AIProvider = providerName === 'google' ? new GoogleProvider(overrides) : new OllamaProvider(overrides);
    const minSeverity = MIN_SEVERITY[sensitivity];

    console.log(`Bench: ${items.length} messages · provider ${providerName} · model ${model} · sensitivity ${sensitivity} (min severity ${minSeverity})${lang ? ` · lang ${lang}` : ''}`);
    console.log('');

    const results: BenchResult[] = [];
    let consecutiveErrors = 0;
    for (const item of items) {
        const t0 = Date.now();
        let verdict: Verdict | null = null;
        let error: string | undefined;
        try {
            verdict = normalizeVerdict(await provider.analyzeMessage(item.text, item.history ?? [], 'twitch'));
            consecutiveErrors = 0;
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            consecutiveErrors++;
        }
        const latencyMs = Date.now() - t0;

        // A verdict only becomes a card when routeVerdict says so (threshold, hard floor); notes don't count.
        const queued = !!verdict && verdict.flagged
            && routeVerdict(verdict, { minSeverity, categories: {}, recentNearMissNotes: 0, totalNearMissNotes: 0 }).target === 'queue';
        const predicted: 'safe' | 'flag' = queued ? 'flag' : 'safe';
        const expectedCategories = item.category ? ([] as ModerationCategory[]).concat(item.category) : [];
        const categoryOk = queued && verdict && expectedCategories.length > 0 ? expectedCategories.includes(verdict.category) : null;

        results.push({ id: item.id, lang: item.lang, text: item.text, expect: item.expect, predicted, verdict, categoryOk, latencyMs, error });

        if (!quiet) {
            const mark = error ? 'ERR' : predicted === item.expect ? ' ok' : predicted === 'flag' ? ' FP' : ' FN';
            const detail = error ? error : verdict ? `${verdict.flagged ? 'flag' : 'safe'} ${verdict.category}/${verdict.severity}` : '';
            console.log(`${mark}  ${item.id.padEnd(11)} ${String(latencyMs).padStart(5)} ms  ${shorten(item.text).padEnd(60)}  ${detail}`);
        }

        // A dead provider (model not found, no API key) fails every item the same way: stop early.
        if (consecutiveErrors >= 3 && results.every(r => r.error)) {
            console.error(`\nProvider failed on every message so far, aborting: ${error}`);
            process.exit(1);
        }
    }

    report(results, { providerName, model, sensitivity, lang });
}

function summarize(results: BenchResult[]) {
    const ok = results.filter(r => !r.error);
    const tp = ok.filter(r => r.expect === 'flag' && r.predicted === 'flag').length;
    const fp = ok.filter(r => r.expect === 'safe' && r.predicted === 'flag').length;
    const fn = ok.filter(r => r.expect === 'flag' && r.predicted === 'safe').length;
    const tn = ok.filter(r => r.expect === 'safe' && r.predicted === 'safe').length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = ok.length ? (tp + tn) / ok.length : 0;
    const withCategory = ok.filter(r => r.categoryOk !== null);
    const categoryAccuracy = withCategory.length ? withCategory.filter(r => r.categoryOk).length / withCategory.length : null;
    const latencies = ok.map(r => r.latencyMs).sort((a, b) => a - b);
    const meanLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const p95LatencyMs = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : 0;
    return { total: results.length, errors: results.length - ok.length, tp, fp, fn, tn, precision, recall, f1, accuracy, categoryAccuracy, meanLatencyMs, p95LatencyMs };
}

function report(results: BenchResult[], meta: { providerName: string; model: string; sensitivity: Sensitivity; lang?: string }) {
    const all = summarize(results);
    console.log('');
    console.log('=== Summary ===');
    console.log(`Messages: ${all.total} (${all.errors} errors)   TP ${all.tp}  FP ${all.fp}  FN ${all.fn}  TN ${all.tn}`);
    console.log(`Precision ${pct(all.precision)}   Recall ${pct(all.recall)}   F1 ${pct(all.f1)}   Accuracy ${pct(all.accuracy)}`);
    if (all.categoryAccuracy !== null) console.log(`Category correct on true positives: ${pct(all.categoryAccuracy)}`);
    console.log(`Latency: mean ${all.meanLatencyMs} ms, p95 ${all.p95LatencyMs} ms`);

    const langs = [...new Set(results.map(r => r.lang))];
    if (langs.length > 1) {
        for (const l of langs) {
            const s = summarize(results.filter(r => r.lang === l));
            console.log(`  ${l}: precision ${pct(s.precision)}  recall ${pct(s.recall)}  F1 ${pct(s.f1)}  (FP ${s.fp}, FN ${s.fn})`);
        }
    }

    const list = (title: string, rows: BenchResult[]) => {
        if (rows.length === 0) return;
        console.log('');
        console.log(`${title} (${rows.length}):`);
        for (const r of rows) {
            const v = r.verdict;
            console.log(`  ${r.id}  "${shorten(r.text, 70)}"`);
            if (v) console.log(`      → ${v.category}/${v.severity}: ${v.reason ?? ''}`);
        }
    };
    list('False positives (safe messages that would get a card)', results.filter(r => !r.error && r.expect === 'safe' && r.predicted === 'flag'));
    list('False negatives (violations that would slip through)', results.filter(r => !r.error && r.expect === 'flag' && r.predicted === 'safe'));
    list('Wrong category', results.filter(r => r.categoryOk === false));
    const errors = results.filter(r => r.error);
    if (errors.length) {
        console.log('');
        console.log(`Errors (${errors.length}):`);
        for (const r of errors) console.log(`  ${r.id}  ${r.error}`);
    }

    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(RESULTS_DIR, `${meta.model.replace(/[^a-z0-9.-]+/gi, '_')}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...meta, ranAt: new Date().toISOString(), summary: all, results }, null, 2));
    console.log('');
    console.log(`Results written to ${path.relative(process.cwd(), file)}`);
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});

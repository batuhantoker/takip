/**
 * AI in the browser: the visitor's engine settings and key, their history of
 * runs, and what each call to TI sends.
 *
 * The key is kept in this browser only: in localStorage if the visitor asks
 * to be remembered, otherwise in sessionStorage, which the tab forgets when it
 * closes. It travels to TAKIP in a header on each call that needs it.
 */
import type { ProviderId } from './providers/catalog';
import type { RunState } from './state';
import { directionWord, formatAmount } from './forecast';
import { ladderGaps, ladderSentence, readLadder } from './quant/ladder';
import { recordSentence } from './quant/backtest';
import { questionBlock } from './prompts/shared';
import { trajectoryLine } from './prompts/report';
import type { Citation, Depth, RunStatus } from './types';
import type { SeedScope } from './depths';
import { migrateStorage } from './storage-migration';

export interface Engine {
  provider: ProviderId;
  model: string;
  remember: boolean;
  /** Local models only: the address the reader typed (host:port); empty finds one. */
  base?: string;
}

export interface HistoryEntry {
  id: string;
  question: string;
  at: number;
  probability: number | null;
  /** The answer in words, whatever kind of question it was. */
  answer?: string;
  status: RunStatus;
  provider: string;
  model: string;
}

const ENGINE_KEY = 'takip.ai.engine';
const HISTORY_KEY = 'takip.ai.history';
const TOKENS_KEY = 'takip.ai.tokens';
const keySlot = (p: string) => `takip.ai.key.${p}`;
export const HISTORY_CAP = 25;

function store(kind: 'local' | 'session'): Storage | null {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function read(kind: 'local' | 'session', k: string): string | null {
  try { return store(kind)?.getItem(k) ?? null; } catch { return null; }
}
function write(kind: 'local' | 'session', k: string, v: string | null) {
  try {
    const s = store(kind);
    if (!s) return;
    if (v === null) s.removeItem(k);
    else s.setItem(k, v);
  } catch { /* storage full or blocked: settings just do not persist */ }
}

// TI's panel and page hooks load this module before they render, so the old takip.oi.* names move over first.
if (typeof window !== 'undefined') {
  try { migrateStorage([store('local'), store('session')]); } catch { /* storage blocked */ }
}

export function loadEngine(): Engine | null {
  try {
    const e = JSON.parse(read('local', ENGINE_KEY) || 'null');
    if (e && typeof e.provider === 'string' && typeof e.model === 'string') return { provider: e.provider, model: e.model, remember: Boolean(e.remember), ...(typeof e.base === 'string' && e.base ? { base: e.base } : {}) };
  } catch { /* corrupt: start over */ }
  return null;
}

export function saveEngine(e: Engine) {
  write('local', ENGINE_KEY, JSON.stringify(e));
}

export function loadKey(provider: string): string {
  return read('local', keySlot(provider)) || read('session', keySlot(provider)) || '';
}

/** Keeps the key where the visitor chose, and removes it from the other place. */
export function saveKey(provider: string, key: string, remember: boolean) {
  write(remember ? 'local' : 'session', keySlot(provider), key || null);
  write(remember ? 'session' : 'local', keySlot(provider), null);
}

export function forgetKey(provider: string) {
  write('local', keySlot(provider), null);
  write('session', keySlot(provider), null);
}

export function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(read('local', HISTORY_KEY) || '[]');
    return Array.isArray(h) ? h.filter(x => x && typeof x.id === 'string' && typeof x.question === 'string').slice(0, HISTORY_CAP) : [];
  } catch { return []; }
}

export function saveHistory(history: HistoryEntry[]) {
  write('local', HISTORY_KEY, JSON.stringify(history));
}

function tokens(): Record<string, string> {
  try { return JSON.parse(read('session', TOKENS_KEY) || '{}') || {}; } catch { return {}; }
}

/** The token that steers a run, held only by the tab that started it. */
export const runToken = (id: string): string | null => tokens()[id] ?? null;

export function saveRunToken(id: string, token: string) {
  write('session', TOKENS_KEY, JSON.stringify({ ...tokens(), [id]: token }));
}

/** Puts the run in the address (or takes it out), leaving the other parameters exactly as they were written. */
export function setUrlRun(id: string | null) {
  try {
    const { pathname, search, hash } = window.location;
    const rest = search.replace(/^\?/, '').split('&').filter(p => p && !/^(ai|oi)=/.test(p));
    if (id) rest.push(`ai=${id}`);
    window.history.replaceState(window.history.state, '', `${pathname}${rest.length ? `?${rest.join('&')}` : ''}${hash}`);
  } catch { /* not in a browser */ }
}

/** The headers that carry an engine and key on every AI request. */
export const headersFor = (engine: Engine, key: string): Record<string, string> => ({
  'content-type': 'application/json',
  'x-ai-provider': engine.provider,
  'x-ai-model': engine.model,
  ...(key ? { 'x-ai-key': key } : {}),
  ...(engine.provider === 'local' && engine.base ? { 'x-ai-base': engine.base } : {}),
});

/** What went wrong, in AI's words if it gave any. */
export async function errorOf(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' ? body.error : '') || `TI answered ${res.status}.`;
}

export interface StartInput {
  question: string;
  seed: string;
  seedScope?: SeedScope;
  depth: Depth;
  useFeeds: boolean;
}

/** Checks a key by listing the models it can use. */
export async function checkKey(provider: ProviderId, key: string, base = ''): Promise<{ models: { id: string; name: string }[]; preferred: string; listed: boolean; base?: string } | { error: string }> {
  const res = await fetch('/api/ai/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ai-provider': provider, ...(key ? { 'x-ai-key': key } : {}), ...(base ? { 'x-ai-base': base } : {}) },
    body: JSON.stringify({ provider }),
  }).catch(() => null);
  if (!res) return { error: 'Could not reach TI.' };
  if (!res.ok) return { error: await errorOf(res) };
  const body = await res.json();
  return { models: body.models ?? [], preferred: body.default ?? '', listed: body.listed !== false, ...(typeof body.base === 'string' ? { base: body.base } : {}) };
}

/** The prediction as Markdown, for export: the answer, the story, the worlds and the sources. */
export function toMarkdown(s: RunState, url: string): string {
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const r = s.report;
  const lines = [`# ${r?.headline || s.question}`, '', `**Question:** ${s.question}`];
  if (s.frame) lines.push('', '```', questionBlock(s.frame), '```');
  if (r) {
    lines.push('', `## Prediction: ${r.answer} (${r.confidence} confidence)`, r.deviation, '', r.summary);
    const actorName = (id: string) => s.actors.find(a => a.id === id)?.name ?? id;
    const anchors: string[] = [];
    const q = s.quant;
    if (q) {
      anchors.push(`- **${q.symbol}** at ${formatAmount(q.price)} ${q.currency} on ${q.asOf}, swinging ${Math.round(q.vol * 100)}% a year`);
      anchors.push(q.probability !== undefined ? `- **Statistical baseline**: ${pct(q.probability)}. ${q.method}` : `- **Statistical baseline**: 80% between ${formatAmount(q.p10)} and ${formatAmount(q.p90)}, the middle at ${formatAmount(q.p50)}. ${q.method}`);
      if (q.simulated) anchors.push(q.simulated.probability !== undefined ? `- **The simulation, priced** (each world's events across the market's own paths): ${pct(q.simulated.probability)}` : `- **The simulation, priced**: 80% between ${formatAmount(q.simulated.p10)} and ${formatAmount(q.simulated.p90)}, the middle at ${formatAmount(q.simulated.p50)}`);
    }
    for (const c of s.context.filter(x => x.kind === 'odds' && x.odds)) {
      anchors.push(`- **${c.odds!.platform}${c.id === s.frame?.market ? ' (this question)' : ' (related)'}**: [${c.title.replace(/[[\]]/g, '')}](${c.url}) ${pct(c.odds!.probability)}`);
    }
    if (q?.backtest) anchors.push(`- **The baseline's record**: ${recordSentence(q.backtest, q.symbol, q.probability)}`);
    const ladderOdds = (s.context.find(c => c.id === s.frame?.market) ?? s.context.find(c => c.odds?.ladder))?.odds;
    if (q?.curve && ladderOdds?.ladder) {
      const read = ladderSentence(readLadder(ladderGaps(q.curve, ladderOdds.ladder, q.price)), formatAmount, ladderOdds.platform);
      if (read) anchors.push(`- **Every level**: ${read}`);
    }
    if (anchors.length) lines.push('', '## What it rests on', ...anchors);
    if (r.path.length) lines.push('', '## How it unfolds', ...r.path.map(p => `- **${p.date || 'Later'}**: ${p.title}${p.detail ? `. ${p.detail}` : ''}${p.actors.length ? ` (${p.actors.map(actorName).join(', ')})` : ''}`));
    if (r.actorMoves.length) lines.push('', '## What each actor does', ...r.actorMoves.map(m => `- **${actorName(m.actor)}**: ${m.prediction}`));
    if (r.worlds.length) lines.push('', '## The simulated worlds', ...r.worlds.map(w => `- **World ${w.world}**: ${w.outcome}. ${w.summary}`));
    const refs = (ids: string[] | undefined) => (ids?.length ? ` ${ids.map(id => `[${id}]`).join('')}` : '');
    if (r.drivers.length) lines.push('', '## Drivers', ...r.drivers.map(d => `- ${d.text} (${directionWord(s.frame, d.push, d.favors)})${refs(d.sources)}`));
    if (r.scenarios.length) lines.push('', '## Scenarios', ...r.scenarios.map(x => `- **${x.name}** (${pct(x.probability)}): ${x.description}`));
    if (r.signposts.length) lines.push('', '## Signposts', ...r.signposts.map(x => `- ${x.text}${x.place ? ` (${x.place})` : ''}: points ${directionWord(s.frame, x.means, x.favors)}`));
    if (r.dissent) lines.push('', '## Dissent', r.dissent);
    if (r.caveats.length) lines.push('', '## Caveats', ...r.caveats.map(c => `- ${c}`));
  }
  if (s.rounds.length && s.frame) lines.push('', '## The worlds pooled, period by period', ...s.rounds.map(x => `- ${s.periods[x.round - 1]?.label ?? `Period ${x.round}`}: ${trajectoryLine(s.frame!, x)}`));
  // The thread back to the words: what the actors quoted to ground their first moves, then every source used.
  const names = new Map(s.actors.map(a => [a.id, a.name]));
  const way = (c: Citation) => (c.favors ? `for ${c.favors}` : c.push === 'neutral' || !c.push ? 'context' : directionWord(s.frame, c.push, ''));
  const quoted = s.moves.filter(m => m.cites?.length && m.world === s.worlds[0]);
  if (quoted.length) lines.push('', '## What the actors quoted', ...quoted.flatMap(m => m.cites!.map(c => `- **${names.get(m.actor) ?? m.actor}** (period ${m.period}): “${c.quote}” [${c.source}], ${way(c)}${c.why ? `: ${c.why}` : ''}${c.exact ? '' : ' (paraphrase)'}`)));
  const used = new Set(s.links.filter(l => l.kind === 'cite' || l.kind === 'evidence').flatMap(l => [l.from, l.to]).filter(k => k.startsWith('c:')).map(k => k.slice(2)));
  const sources = s.context.filter(c => used.has(c.id));
  if (sources.length) lines.push('', '## Sources', ...sources.map(c => `- [${c.id}] ${c.kind === 'data' && c.id !== 'data' ? `“${c.title}”` : c.url ? `[${c.title.replace(/[[\]]/g, '')}](${c.url})` : c.title} (${[c.source, c.place, c.published.slice(0, 10)].filter(Boolean).join(', ')})`));
  lines.push('', `Run on ${s.provider} / ${s.model}, ${s.usage.calls} model calls. Watch: ${url}`, '', '_TI (Takip AI): a prediction engine after MiroFish, rebuilt natively: the actors simulated in parallel worlds. A simulation, not a guarantee._');
  return lines.filter(l => l !== '').join('\n').replace(/\n(#+ )/g, '\n\n$1');
}

'use client';
/**
 * TAKIP TI: asking for a forecast. The question, a few to start from (what
 * prediction markets are pricing now, or examples of each kind), how deep to
 * go, whether to research live, and any material of the reader's own. Depth
 * and research are remembered; the draft survives switching tabs.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Switch } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { PanelFooter, PanelSection } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { DEPTHS, SEED_MAX, estimateCalls, seedCost, type SeedScope } from '@/lib/oi/depths';
import type { Depth, Frame } from '@/lib/oi/types';
import { KIND_LABEL } from '../theme';
import { ScrollBody } from '@/components/panels/ti-agent/parts/scroll-body';
import { TextArea } from '@/components/panels/ti-agent/parts/text-area';
import { assemble, fmtCount, YourData, type DataFile } from './your-data';

export interface RunInput { question: string; seed: string; seedScope: SeedScope; depth: Depth; useFeeds: boolean }

const EXAMPLES: { kind: Frame['kind']; text: string }[] = [
  { kind: 'binary', text: 'Will Russia and Ukraine agree a ceasefire before 1 July 2027?' },
  { kind: 'choice', text: 'Which way will the US Federal Reserve move rates at its next meeting: cut, hold or hike?' },
  { kind: 'number', text: 'Where will Brent crude settle on 31 December 2026, in USD a barrel?' },
];

const DRAFT = 'takip.oi.draft';
const PREFS = 'takip.oi.ask';

function readPrefs(): { depth: Depth; useFeeds: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p && p.depth in DEPTHS) return { depth: p.depth, useFeeds: p.useFeeds !== false };
  } catch { /* storage blocked */ }
  return { depth: 'standard', useFeeds: true };
}
function readDraft(): string {
  try { return sessionStorage.getItem(DRAFT) ?? ''; } catch { return ''; }
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** A question to start from: two lines of it, and the crowd's price where there is one. */
function QuestionRow({ text, meta, trailing, onPick }: { text: string; meta?: string; trailing?: ReactNode; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick}
      className={cx('-mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-body text-ink-1">{text}</span>
        {meta && <span className="mt-0.5 block text-meta text-ink-3">{meta}</span>}
      </span>
      {trailing}
    </button>
  );
}

export function AskForm({ ready, providerName, onRun, keyCard, below, notice }: {
  ready: boolean;
  /** Something that went wrong, above the form. */
  notice?: ReactNode;
  providerName: string;
  onRun: (input: RunInput) => Promise<boolean>;
  /** Shown in place of the Run button until there is a key. */
  keyCard: (note: string) => ReactNode;
  /** Under the form: the reader's past forecasts. */
  below?: ReactNode;
}) {
  const [question, setQuestion] = useState(readDraft);
  const [files, setFiles] = useState<DataFile[]>([]);
  const [paste, setPaste] = useState('');
  const [scope, setScope] = useState<SeedScope>('brief');
  const [showData, setShowData] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const [starting, setStarting] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const { depth, useFeeds } = prefs;
  const setPref = (next: Partial<typeof prefs>) => setPrefs(p => {
    const v = { ...p, ...next };
    try { localStorage.setItem(PREFS, JSON.stringify(v)); } catch { /* storage blocked */ }
    return v;
  });
  useEffect(() => { try { sessionStorage.setItem(DRAFT, question); } catch { /* storage blocked */ } }, [question]);

  // What the world is betting on: questions with the crowd's price on them.
  const [trending, setTrending] = useState<{ question: string; probability: number; event: string; url: string }[]>([]);
  useEffect(() => {
    const ctl = new AbortController();
    fetch('/api/oi/trending', { signal: ctl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (Array.isArray(j?.items)) setTrending(j.items); })
      .catch(() => { /* suggestions are a nicety: none is fine */ });
    return () => ctl.abort();
  }, []);

  const valid = question.trim().length >= 8;
  const seed = assemble(files, paste);
  const dataCost = seedCost(seed.length, depth, scope);
  const calls = estimateCalls(depth, useFeeds);
  const d = DEPTHS[depth];

  const run = async () => {
    if (!ready || !valid || starting) return;
    setStarting(true);
    const ok = await onRun({ question: question.trim(), seed: seed.slice(0, SEED_MAX), seedScope: scope, depth, useFeeds });
    setStarting(false);
    if (ok) { setQuestion(''); setFiles([]); setPaste(''); }
  };
  const pick = (t: string) => { setQuestion(t); input.current?.focus(); };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollBody>
        {notice && <div className="mb-4">{notice}</div>}
        <p className="text-body leading-5 text-ink-2">
          Ask what happens next. TI casts the people and institutions involved, plays it out in parallel worlds and gives you its estimate with the reasons.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <TextArea ref={input} value={question} onChange={e => setQuestion(e.target.value.slice(0, 500))} minRows={3} maxRows={8}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }}
            placeholder="Will … happen before …?" aria-label="Your question" />
          <p className="text-meta text-ink-3">
            {question && !valid ? 'Add a little more detail.' : 'A question with a date works best: yes or no, which outcome, or how much.'}
          </p>
        </div>

        {!question && (trending.length > 0 ? (
          <PanelSection title="On Polymarket now" hint="chance of yes" className="mt-6">
            {trending.slice(0, 3).map(x => (
              <QuestionRow key={x.url + x.question} text={x.question} onPick={() => pick(x.question)}
                trailing={<span className="mt-px shrink-0 font-mono text-small text-ink-2 tabular-nums" aria-label={`${Math.round(x.probability * 100)}% chance of yes`}>{Math.round(x.probability * 100)}%</span>} />
            ))}
          </PanelSection>
        ) : (
          <PanelSection title="Examples" className="mt-6">
            {EXAMPLES.map(x => <QuestionRow key={x.text} text={x.text} meta={KIND_LABEL[x.kind]} onPick={() => pick(x.text)} />)}
          </PanelSection>
        ))}

        <PanelSection title="How TI works it out" className="mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-small font-medium text-ink-2">Depth</span>
                <span className="truncate text-meta text-ink-3" title={`${d.actors} actors play ${d.periods} periods of simulated time in ${d.worlds} parallel worlds`}>
                  {d.actors} actors · {d.periods} periods · {d.worlds} worlds
                </span>
              </div>
              <Segmented size="sm" full label="Depth" value={depth} onChange={v => setPref({ depth: v })}
                options={(Object.keys(DEPTHS) as Depth[]).map(k => ({ value: k, label: DEPTHS[k].label }))} />
            </div>
            <Switch label="Live research" checked={useFeeds} onChange={on => setPref({ useFeeds: on })}
              description="News with links, market prices, prediction markets and the TAKIP feeds that bear on it" />
            <div>
              <button type="button" onClick={() => setShowData(v => !v)} aria-expanded={showData}
                className={cx('-mx-2 flex w-[calc(100%+16px)] items-center gap-2.5 rounded-control px-2 py-2 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                <Database aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                <span className="text-body text-ink-1">Your data</span>
                <span className="min-w-0 flex-1 truncate text-right text-meta text-ink-3">
                  {seed ? `${files.length ? `${files.length} file${files.length === 1 ? '' : 's'} · ` : ''}${fmtCount(Math.min(seed.length, SEED_MAX))} characters · +${fmtCount(dataCost.tokens)} tokens` : 'Optional'}
                </span>
                <ChevronDown aria-hidden className={cx('size-4 shrink-0 text-ink-3 transition-transform duration-150', showData && 'rotate-180')} strokeWidth={1.75} />
              </button>
              {showData && (
                <div className="pt-2">
                  <YourData files={files} setFiles={setFiles} paste={paste} setPaste={setPaste} scope={scope} setScope={setScope} depth={depth} providerName={providerName} />
                </div>
              )}
            </div>
          </div>
        </PanelSection>

        {below && <div className="mt-6">{below}</div>}

        <p className="mt-6 text-meta text-ink-3">
          The answer takes the shape of the question: a probability, a share for each outcome, or an estimate with a range, with how each world played out. A simulation, not a guarantee. The method follows{' '}
          <a href="https://github.com/666ghj/MiroFish" target="_blank" rel="noopener noreferrer" className="text-ink-2 underline decoration-ink-4 underline-offset-2 hover:text-ink-1">MiroFish</a>; forecasts are also on the{' '}
          <a href="/docs#oi" className="text-ink-2 underline decoration-ink-4 underline-offset-2 hover:text-ink-1">API and MCP</a>.
        </p>
      </ScrollBody>

      <PanelFooter className="gap-3">
        {ready ? (
          <>
            <Button variant="primary" onClick={run} disabled={!valid} loading={starting}>{starting ? 'Starting' : 'Run forecast'}</Button>
            <span className="ml-auto flex min-w-0 items-center gap-2 text-meta text-ink-3">
              <span className="truncate">About <span className="font-mono tabular-nums">{calls}</span> model calls</span>
              <span className="flex shrink-0 gap-0.5"><Kbd size="sm">{isMac() ? '⌘' : 'Ctrl'}</Kbd><Kbd size="sm">↵</Kbd></span>
            </span>
          </>
        ) : keyCard(`A forecast at this depth makes about ${calls} model calls.`)}
      </PanelFooter>
    </div>
  );
}

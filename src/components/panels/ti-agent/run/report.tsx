'use client';
/**
 * TAKIP TI: the prediction. The report agent's headline and the story under
 * it: how it most likely unfolds, date by date, what each actor does, how
 * each simulated world ended, the drivers and the evidence behind them,
 * scenarios, signposts and dissent. Every part is a way into the research.
 */
import { useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Download, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { toMarkdown } from '@/lib/ai/client';
import { evidenceLedger } from '@/lib/ai/engine/sources';
import { latestPoints, type RunState } from '@/lib/ai/state';
import { fmtDate, pct, toward } from '@/components/panels/ti-agent/theme';
import { Avatar, Mentions, PointTag, TypeIcon } from '@/components/panels/ti-agent/atoms';
import { PushTag, SourceLink, sourceLabel } from '@/components/panels/ti-agent/parts/quotes';
import { Anchors, hasAnchors } from './anchors';

/** How sure the report is: one to three bars, and the word. */
function Confidence({ level }: { level: 'low' | 'medium' | 'high' }) {
  const t = useT();
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2 text-meta font-medium text-ink-2">
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map(i => <span key={i} className={cx('w-[3px] rounded-[1px]', i < n ? 'bg-gold' : 'bg-surface-3')} style={{ height: 6 + i * 3 }} />)}
      </span>
      {level === 'high' ? t('High confidence') : level === 'medium' ? t('Medium confidence') : t('Low confidence')}
    </span>
  );
}

/** A small button naming another object: an actor in the path, a source under a driver. */
function Chip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={on}
      className={cx('inline-flex h-6 max-w-[220px] items-center gap-1 rounded-[4px] border px-1.5 text-meta', on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
      {children}
    </button>
  );
}

/** The engine's "YES" and "NO", as a person would write them in a sentence. */
const plainCase = (text: string) => text.replace(/\bYES\b/g, 'yes').replace(/\bNO\b/g, 'no');

/** A row that opens what it is about. */
const ROW = cx('-mx-2 flex w-[calc(100%+16px)] items-start gap-2.5 rounded-control px-2 py-2 text-left disabled:cursor-default', FOCUS_RING, TRANSITION);

export function ReportBody({ s, runId, selected, onSelect }: { s: RunState; runId: string | null; selected: string | null; onSelect: (k: string | null) => void }) {
  const t = useT();
  const r = s.report!;
  const frame = s.frame;
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ledger = evidenceLedger(s.moves);
  const standing = latestPoints(s);
  const name = (id: string) => s.actors.find(a => a.id === id)?.name ?? id;
  const toggle = (k: string) => onSelect(selected === k ? null : k);
  const url = typeof window !== 'undefined' && runId ? `${window.location.origin}/?ai=${runId}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const download = () => {
    const blob = new Blob([toMarkdown(s, url)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `takip-ti-${(runId ?? 'forecast').slice(0, 8)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <section className="flex flex-col" aria-label={t('Prediction')}>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Confidence level={r.confidence} />
          <div className="-mr-2 ml-auto flex items-center">
            <Button variant="ghost" size="sm" icon={copied ? Check : Link2} onClick={copy} title={t('Copy a link that replays this run')}>{copied ? t('Copied') : t('Copy link')}</Button>
            <Button variant="ghost" size="sm" icon={Download} onClick={download} title={t('Download the prediction as Markdown')}>{t('Export')}</Button>
          </div>
        </div>
        <h3 className="text-title font-semibold text-ink-1">{r.headline}</h3>
        {frame?.kind === 'binary' && !hasAnchors(s) && (
          <p className="mt-1 text-meta text-ink-3" title={t("The simulated worlds pooled, and the report's calibrated figure")}>
            {t.rich('Worlds pooled {pooled} · calibrated {calibrated}', {
              pooled: <span className="font-mono text-ink-2 tabular-nums">{pct(r.swarm)}</span>,
              calibrated: <span className="font-mono text-ink-1 tabular-nums">{pct(r.probability)}</span>,
            })}
          </p>
        )}
        {r.deviation && <p className="mt-2 text-small text-ink-3 italic">{r.deviation}</p>}
        <p className="mt-3 text-body leading-5 text-ink-2"><Mentions text={r.summary} s={s} onSelect={onSelect} /></p>
      </div>

      <div className="mt-6"><Anchors s={s} selected={selected} onSelect={onSelect} /></div>

      {r.path.length > 0 && (
        <PanelSection title={t('How it unfolds')} hint={r.path.length}>
          <ol className="relative flex flex-col gap-4 pl-5">
            <span aria-hidden className="absolute top-2 bottom-2 left-[3px] w-px bg-line-strong" />
            {r.path.map((p, i) => (
              <li key={i} className="relative">
                <span aria-hidden className={cx('absolute top-[5px] -left-5 size-[7px] rounded-full', i === r.path.length - 1 ? 'bg-gold' : 'bg-surface-1 ring-1 ring-ink-3')} />
                <span className="block font-mono text-meta text-ink-3 tabular-nums">{fmtDate(p.date, t)}</span>
                <span className="mt-0.5 block text-body font-medium text-ink-1"><Mentions text={p.title} s={s} onSelect={onSelect} /></span>
                {p.detail && <span className="mt-0.5 block text-small text-ink-2"><Mentions text={p.detail} s={s} onSelect={onSelect} /></span>}
                {p.actors.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {p.actors.map(id => <Chip key={id} on={selected === `a:${id}`} onClick={() => toggle(`a:${id}`)}>{name(id)}</Chip>)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </PanelSection>
      )}

      {r.actorMoves.length > 0 && (
        <PanelSection title={t('What each actor does')} hint={r.actorMoves.length}>
          {r.actorMoves.map(m => {
            const key = `a:${m.actor}`;
            return (
              <button key={m.actor} type="button" onClick={() => toggle(key)} className={cx(ROW, selected === key ? 'bg-surface-3' : 'hover:bg-surface-2')}>
                <Avatar name={name(m.actor)} size={24} ring={selected === key ? 'selected' : undefined} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-ink-1">{name(m.actor)}</span>
                  <span className="mt-0.5 block text-small text-ink-2">{m.prediction}</span>
                </span>
              </button>
            );
          })}
        </PanelSection>
      )}

      {r.worlds.length > 0 && (
        <PanelSection title={t('How each world ended')} hint={r.worlds.length}>
          <div className="flex flex-col gap-2">
            {r.worlds.map(w => {
              const key = `w:${w.world}`;
              const on = selected === key;
              const point = standing.get(w.world);
              return (
                <button key={w.world} type="button" onClick={() => toggle(key)}
                  className={cx('rounded-card border p-3 text-left', on ? 'border-line-strong bg-surface-3' : 'border-line hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  <span className="flex items-center gap-2">
                    <TypeIcon k={key} className="size-3.5 shrink-0 text-gold" />
                    <span className="text-small font-medium text-ink-2">{t('World {w}', { w: w.world })}</span>
                    {point && <span className="ml-auto"><PointTag point={point} frame={frame} /></span>}
                  </span>
                  <span className="mt-1.5 block text-body font-medium text-ink-1 first-letter:uppercase">{plainCase(w.outcome)}</span>
                  {w.summary && <span className="mt-1 block text-small text-ink-2">{w.summary}</span>}
                </button>
              );
            })}
          </div>
        </PanelSection>
      )}

      {r.drivers.length > 0 && (
        <PanelSection title={t('Drivers')} hint={r.drivers.length}>
          {r.drivers.map((d, i) => {
            const actorKey = d.actor ? `a:${d.actor}` : null;
            const Icon = d.push === 'yes' ? ArrowUpRight : ArrowDownRight;
            return (
              <div key={i} className="border-b border-line py-1 last:border-b-0">
                <button type="button" disabled={!actorKey} onClick={() => actorKey && toggle(actorKey)} className={cx(ROW, 'enabled:hover:bg-surface-2')}>
                  <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                  <span className="min-w-0 flex-1 text-small text-ink-1">{d.text}</span>
                  <span className="mt-px shrink-0 text-meta text-ink-3">{toward(t, frame, d.push, d.favors)}</span>
                </button>
                {(d.sources?.length ?? 0) > 0 && (
                  <div className="mb-1.5 ml-6 flex flex-wrap gap-1">
                    {d.sources!.map(id => {
                      const c = s.context.find(x => x.id === id);
                      const key = `c:${id}`;
                      return (
                        <Chip key={id} on={key === selected} onClick={() => toggle(key)} title={c?.title ?? id}>
                          <TypeIcon k={key} subtype={c?.kind} className="size-3 shrink-0" />
                          <span className="truncate">{sourceLabel(c, id, t)}</span>
                          <span className="font-mono text-ink-3">[{id}]</span>
                        </Chip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </PanelSection>
      )}

      {ledger.length > 0 && (
        <PanelSection title={t('Evidence that moved the actors')} hint={ledger.length}
          action={ledger.length > 6 ? <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)}>{showAll ? t('Show fewer') : t('Show all {n}', { n: ledger.length })}</Button> : undefined}>
          {ledger.slice(0, showAll ? undefined : 6).map(row => {
            const c = s.context.find(x => x.id === row.source);
            const key = `c:${row.source}`;
            // The way it pushed most of the actors who quoted it; context when it pushed none.
            const lead = row.yes >= row.no && row.yes > 0 ? 'yes' : row.no > 0 ? 'no' : 'neutral';
            const favors = Object.entries(row.favors).sort((a, b) => b[1] - a[1])[0]?.[0];
            return (
              <div key={row.source} className={cx('-mx-2 flex items-start gap-2 rounded-control px-2 py-2', selected === key ? 'bg-surface-3' : 'hover:bg-surface-2', TRANSITION)}>
                <button type="button" onClick={() => toggle(key)} className={cx('min-w-0 flex-1 rounded-control text-left', FOCUS_RING)}>
                  <span className="line-clamp-2 text-small text-ink-1">{c?.kind === 'data' && c.id !== 'data' ? `“${c.title}”` : c?.title ?? row.source}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-meta text-ink-3">
                    <TypeIcon k={key} subtype={c?.kind} className="size-3 shrink-0" />
                    <span className="truncate">{sourceLabel(c, row.source, t)}</span>
                    <span className="shrink-0 font-mono">[{row.source}]</span>
                    <span className="shrink-0">· {t.rich('quoted {times}× by {actors}', { times: <span className="font-mono tabular-nums">{row.quoted}</span>, actors: <span className="font-mono tabular-nums">{row.actors.length}</span> })}</span>
                  </span>
                </button>
                <span className="mt-0.5 flex shrink-0 items-center gap-2">
                  <PushTag c={{ push: lead, favors }} frame={frame} />
                  <SourceLink url={c?.url} />
                </span>
              </div>
            );
          })}
        </PanelSection>
      )}

      {r.scenarios.length > 0 && (
        <PanelSection title={t('Scenarios')} hint={r.scenarios.length}>
          <div className="flex flex-col gap-1">
            {r.scenarios.map((sc, i) => {
              const key = `s:${i}`;
              const on = selected === key;
              const top = sc.probability === Math.max(...r.scenarios.map(x => x.probability));
              return (
                <button key={i} type="button" onClick={() => toggle(key)}
                  className={cx('-mx-2 flex w-[calc(100%+16px)] flex-col rounded-control px-2 py-2 text-left', on ? 'bg-surface-3' : 'hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-1">{sc.name}</span>
                    <span className="font-mono text-small text-ink-1 tabular-nums">{pct(sc.probability)}</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
                    <span className={cx('block h-full rounded-full', top ? 'bg-gold' : 'bg-ink-3')} style={{ width: `${sc.probability * 100}%` }} />
                  </span>
                  <span className="mt-1 block text-small text-ink-2">{sc.description}</span>
                </button>
              );
            })}
          </div>
        </PanelSection>
      )}

      {r.signposts.length > 0 && (
        <PanelSection title={t('Signposts to watch')} hint={r.signposts.length}>
          {r.signposts.map((sp, i) => {
            const key = `p:${i}`;
            return (
              <button key={i} type="button" onClick={() => toggle(key)} className={cx(ROW, selected === key ? 'bg-surface-3' : 'hover:bg-surface-2')}>
                <span aria-hidden className="mt-[6px] size-1.5 shrink-0 rotate-45 bg-ink-3" />
                <span className="min-w-0 flex-1 text-small text-ink-1">{sp.text}{sp.place && <span className="text-ink-3"> · {sp.place}</span>}</span>
                <span className="mt-px shrink-0 text-meta text-ink-3">{toward(t, frame, sp.means, sp.favors)}</span>
              </button>
            );
          })}
        </PanelSection>
      )}

      {r.dissent && (
        <PanelSection title={t('Dissent')}>
          <blockquote className="border-l-2 border-line-strong pl-3 text-small text-ink-2"><Mentions text={r.dissent} s={s} onSelect={onSelect} /></blockquote>
        </PanelSection>
      )}
      {r.caveats.length > 0 && (
        <PanelSection title={t('Caveats')}>
          <ul className="flex flex-col gap-1.5">
            {r.caveats.map((c, i) => <li key={i} className="flex gap-2 text-small text-ink-2"><span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-4" />{c}</li>)}
          </ul>
        </PanelSection>
      )}
    </section>
  );
}

'use client';
/** TAKIP TI: what the research and the report show as objects: a source, a scenario, the report, a signpost. */
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { TYPE_LABEL } from '@/lib/ai/workspace/objects';
import { priceText } from '@/lib/ai/quant/series';
import { ago, leanWord, pct, sentence } from '../theme';
import { Mentions, TypeIcon } from '../atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';
import { SOURCE_KIND, SourceLink, sourceLabel } from '@/components/panels/ti-agent/parts/quotes';
import { Group, LinkRows, ObjectChip, QuoteRows } from './parts';
import type { Describer } from './describe';

const OPEN_LABEL: Partial<Record<string, string>> = { wiki: 'Read on Wikipedia', web: 'Read the article', social: 'Open the post', camera: 'Open the camera page', series: 'Open the quote on Yahoo Finance' };

export const describeSource: Describer<'context'> = (sel, { s, onSelect }) => {
  const c = sel.item;
  const bears = s.links.filter(l => l.kind === 'evidence' && l.from === sel.key);
  const quotedBy = s.links.filter(l => l.kind === 'cite' && l.to === sel.key && l.from.startsWith('a:')).sort((a, b) => a.round - b.round);
  const inReport = s.links.filter(l => l.kind === 'cite' && l.to === sel.key && l.from === 'r:report');
  const quoters = new Set(quotedBy.map(l => l.from)).size;
  const q = c.kind === 'series' && s.quant?.symbol === c.symbol ? s.quant : null;
  const mono = (v: string) => <span className="font-mono tabular-nums">{v}</span>;
  const openLabel = c.kind === 'odds' ? `Open the market on ${c.source}` : OPEN_LABEL[c.kind] ?? 'Open the source';
  const inGraph = bears.length + quotedBy.length + inReport.length > 0;
  return {
    type: TYPE_LABEL.source,
    subtype: SOURCE_KIND[c.kind] ?? c.kind,
    iconSub: c.kind,
    title: c.kind === 'data' && c.id !== 'data' ? `“${c.title}”` : c.title,
    inGraph,
    locate: c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng, zoom: 4 } : null,
    props: [
      ['Id', <span key="i" className="font-mono">[{c.id}]</span>],
      ['Price of yes', c.odds ? <span key="o">{mono(pct(c.odds.probability))}{s.frame?.market === c.id ? <span className="text-ink-3"> · the market on this question</span> : null}</span> : null],
      ['Traded', c.odds ? mono(c.odds.platform === 'Polymarket' ? `$${Math.round(c.odds.volume).toLocaleString('en-US')}` : `${Math.round(c.odds.volume).toLocaleString('en-US')} mana`) : null],
      ['Closes', c.odds?.closes ? new Date(c.odds.closes).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null],
      ['Swings', q ? <span key="v">{mono(`${Math.round(q.vol * 100)}%`)} a year</span> : null],
      ['Baseline', q ? (q.probability !== undefined ? <span key="b">{mono(pct(q.probability))} by the horizon</span> : <span key="b">{mono(`${priceText(q.p10, q.currency)}–${priceText(q.p90, q.currency)}`)} at the horizon (80%)</span>) : null],
      ['Simulation', q?.simulated ? (q.simulated.probability !== undefined ? mono(pct(q.simulated.probability)) : <span key="sp">{mono(`${priceText(q.simulated.p10, q.currency)}–${priceText(q.simulated.p90, q.currency)}`)} (80%)</span>) : null],
      [c.kind === 'data' ? 'From' : 'Source', <span key="s" className="inline-flex items-center gap-1.5">{sourceLabel(c, c.id)}<SourceLink url={c.url} /></span>],
      ['Location', c.place],
      ['Published', c.published ? `${new Date(c.published).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${ago(c.published)}` : ''],
      ['Quoted', quotedBy.length ? <span key="q">{mono(String(quotedBy.length))}× by {mono(String(quoters))} actor{quoters === 1 ? '' : 's'}</span> : null],
    ],
    body: (
      <>
        {c.excerpt && <Group label="What it says"><blockquote className="border-l-2 border-line-strong pl-3 text-small text-ink-2">{c.excerpt}</blockquote></Group>}
        {c.kind === 'social' && (
          <p className="rounded-card bg-surface-2 px-3 py-2 text-small text-ink-2">A post on a social network: an unverified claim, not reporting. The actors were told to weigh it as one.</p>
        )}
        {q && <p className="text-meta text-ink-3">{q.method}</p>}
        {c.url && /^https?:\/\//i.test(c.url) && (
          <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
            className={cx('inline-flex h-7 items-center gap-1.5 self-start rounded-control border border-line-strong bg-surface-2 px-2.5 text-small font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
            {openLabel}<ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </a>
        )}
        {inReport.length > 0 && (
          <Group label="The report rests on it" count={inReport.length}>
            <div className="flex flex-col">
              {inReport.map(l => (
                <button key={l.id} type="button" onClick={() => onSelect(`link:${l.id}`)}
                  className={cx('-mx-2 flex items-start gap-2 rounded-control px-2 py-1.5 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  <TypeIcon k="r:report" className="mt-0.5 size-3.5 shrink-0 text-gold" />
                  <span className="text-small text-ink-1">{l.label}</span>
                </button>
              ))}
            </div>
          </Group>
        )}
        {quotedBy.length > 0 && <Group label="Quoted by" count={quotedBy.length}><QuoteRows s={s} links={quotedBy} onSelect={onSelect} /></Group>}
        {bears.length > 0 && <Group label="Cited against" count={bears.length}><LinkRows s={s} links={bears} from={sel.key} onSelect={onSelect} /></Group>}
        {!inGraph && <p className="text-small text-ink-3">Read by the actors; nobody quoted it.</p>}
      </>
    ),
  };
};

export const describeScenario: Describer<'scenario'> = (sel, { s, onSelect }) => {
  const sc = sel.scenario;
  return {
    type: TYPE_LABEL.scenario,
    title: sc.name,
    inGraph: false,
    locate: sc.lat !== null && sc.lng !== null ? { lat: sc.lat, lng: sc.lng, zoom: 4 } : null,
    props: [['Probability', <span key="p" className="font-mono text-ink-1 tabular-nums">{pct(sc.probability)}</span>], ['Plays out in', sc.place]],
    body: <p className="text-small text-ink-2"><Mentions text={sc.description} s={s} onSelect={onSelect} /></p>,
  };
};

export const describeReport: Describer<'report'> = (sel, { s, onSelect }) => {
  const r = sel.report;
  const used = [...new Set(r.drivers.flatMap(d => d.sources ?? []))];
  return {
    type: TYPE_LABEL.report,
    subtype: `${r.confidence} confidence`,
    title: r.headline,
    inGraph: s.links.some(l => l.from === sel.key),
    locate: null,
    props: [
      ['Answer', <span key="a" className="text-gold"><Figures text={sentence(r.answer)} /></span>],
      ['Sources', used.length ? <span key="s" className="font-mono tabular-nums">{used.length}</span> : null],
    ],
    body: (
      <>
        <p className="text-small text-ink-2"><Mentions text={r.summary} s={s} onSelect={onSelect} /></p>
        {r.drivers.length > 0 && (
          <Group label="Drivers, and what they rest on" count={r.drivers.length}>
            <div className="flex flex-col gap-3">
              {r.drivers.map((d, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <span className="text-small text-ink-1">{d.text}</span>
                  {(d.sources?.length ?? 0) > 0
                    ? <div className="flex flex-wrap gap-1.5">{d.sources!.map(id => <ObjectChip key={id} s={s} k={`c:${id}`} onSelect={onSelect} />)}</div>
                    : <span className="text-meta text-ink-3">No source given</span>}
                </div>
              ))}
            </div>
          </Group>
        )}
      </>
    ),
  };
};

export const describeSignpost: Describer<'signpost'> = (sel, { s }) => {
  const sp = sel.signpost;
  return {
    type: TYPE_LABEL.signpost,
    title: sp.text,
    inGraph: false,
    locate: sp.lat !== null && sp.lng !== null ? { lat: sp.lat, lng: sp.lng, zoom: 4.5 } : null,
    props: [['If it happens', `Toward ${leanWord(s.frame, sp.means, sp.favors)}`], ['Where', sp.place]],
    body: null,
  };
};

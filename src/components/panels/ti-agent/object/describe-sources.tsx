'use client';
/** TAKIP TI: what the research and the report show as objects: a source, a scenario, the report, a signpost. */
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { msg } from '@/lib/core/i18n/translator';
import { TYPE_LABEL } from '@/lib/ai/workspace/objects';
import { priceText } from '@/lib/ai/quant/series';
import { ago, pct, sentence, toward } from '../theme';
import { Mentions, TypeIcon } from '../atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';
import { SOURCE_KIND, SourceLink, sourceLabel } from '@/components/panels/ti-agent/parts/quotes';
import { Group, LinkRows, ObjectChip, QuoteRows } from './parts';
import type { Describer } from './describe';

const OPEN_LABEL: Partial<Record<string, string>> = { wiki: msg('Read on Wikipedia'), web: msg('Read the article'), social: msg('Open the post'), camera: msg('Open the camera page'), series: msg('Open the quote on Yahoo Finance') };

export const describeSource: Describer<'context'> = (sel, { s, t, onSelect }) => {
  const c = sel.item;
  const bears = s.links.filter(l => l.kind === 'evidence' && l.from === sel.key);
  const quotedBy = s.links.filter(l => l.kind === 'cite' && l.to === sel.key && l.from.startsWith('a:')).sort((a, b) => a.round - b.round);
  const inReport = s.links.filter(l => l.kind === 'cite' && l.to === sel.key && l.from === 'r:report');
  const quoters = new Set(quotedBy.map(l => l.from)).size;
  const q = c.kind === 'series' && s.quant?.symbol === c.symbol ? s.quant : null;
  const mono = (v: string) => <span className="font-mono tabular-nums">{v}</span>;
  const open = OPEN_LABEL[c.kind];
  const openLabel = c.kind === 'odds' ? t('Open the market on {platform}', { platform: c.source }) : open ? t(open) : t('Open the source');
  const inGraph = bears.length + quotedBy.length + inReport.length > 0;
  return {
    type: t(TYPE_LABEL.source),
    subtype: SOURCE_KIND[c.kind] ? t(SOURCE_KIND[c.kind]) : c.kind,
    iconSub: c.kind,
    title: c.kind === 'data' && c.id !== 'data' ? `“${c.title}”` : c.title,
    inGraph,
    locate: c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng, zoom: 4 } : null,
    props: [
      [t('Id'), <span key="i" className="font-mono">[{c.id}]</span>],
      [t('Price of yes'), c.odds ? <span key="o">{mono(pct(c.odds.probability))}{s.frame?.market === c.id ? <span className="text-ink-3"> · {t('the market on this question')}</span> : null}</span> : null],
      [t('Traded'), c.odds ? mono(c.odds.platform === 'Polymarket' ? `$${Math.round(c.odds.volume).toLocaleString(t.intl)}` : t('{n} mana', { n: Math.round(c.odds.volume) })) : null],
      [t('Closes'), c.odds?.closes ? new Date(c.odds.closes).toLocaleDateString(t.intl, { day: 'numeric', month: 'short', year: 'numeric' }) : null],
      [t('Swings'), q ? <span key="v">{t.rich('{pct} a year', { pct: mono(`${Math.round(q.vol * 100)}%`) })}</span> : null],
      [t('Baseline'), q ? (q.probability !== undefined
        ? <span key="b">{t.rich('{pct} by the horizon', { pct: mono(pct(q.probability)) })}</span>
        : <span key="b">{t.rich('{range} at the horizon (80%)', { range: mono(`${priceText(q.p10, q.currency)}–${priceText(q.p90, q.currency)}`) })}</span>) : null],
      [t('Simulation'), q?.simulated ? (q.simulated.probability !== undefined ? mono(pct(q.simulated.probability)) : <span key="sp">{mono(`${priceText(q.simulated.p10, q.currency)}–${priceText(q.simulated.p90, q.currency)}`)} (80%)</span>) : null],
      [c.kind === 'data' ? t('From') : t('Source'), <span key="s" className="inline-flex items-center gap-1.5">{sourceLabel(c, c.id, t)}<SourceLink url={c.url} /></span>],
      [t('Location'), c.place],
      [t('Published'), c.published ? `${new Date(c.published).toLocaleString(t.intl, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${ago(c.published, t)}` : ''],
      [t('Quoted'), quotedBy.length ? <span key="q">{t.rich('{times}× by {n, plural, one {# actor} other {# actors}}', { times: mono(String(quotedBy.length)), n: quoters })}</span> : null],
    ],
    body: (
      <>
        {c.excerpt && <Group label={t('What it says')}><blockquote className="border-l-2 border-line-strong pl-3 text-small text-ink-2">{c.excerpt}</blockquote></Group>}
        {c.kind === 'social' && (
          <p className="rounded-card bg-surface-2 px-3 py-2 text-small text-ink-2">{t('A post on a social network: an unverified claim, not reporting. The actors were told to weigh it as one.')}</p>
        )}
        {q && <p className="text-meta text-ink-3">{q.method}</p>}
        {c.url && /^https?:\/\//i.test(c.url) && (
          <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
            className={cx('inline-flex h-7 items-center gap-1.5 self-start rounded-control border border-line-strong bg-surface-2 px-2.5 text-small font-medium text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
            {openLabel}<ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </a>
        )}
        {inReport.length > 0 && (
          <Group label={t('The report rests on it')} count={inReport.length}>
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
        {quotedBy.length > 0 && <Group label={t('Quoted by')} count={quotedBy.length}><QuoteRows s={s} links={quotedBy} onSelect={onSelect} /></Group>}
        {bears.length > 0 && <Group label={t('Cited against')} count={bears.length}><LinkRows s={s} links={bears} from={sel.key} onSelect={onSelect} /></Group>}
        {!inGraph && <p className="text-small text-ink-3">{t('Read by the actors; nobody quoted it.')}</p>}
      </>
    ),
  };
};

export const describeScenario: Describer<'scenario'> = (sel, { s, t, onSelect }) => {
  const sc = sel.scenario;
  return {
    type: t(TYPE_LABEL.scenario),
    title: sc.name,
    inGraph: false,
    locate: sc.lat !== null && sc.lng !== null ? { lat: sc.lat, lng: sc.lng, zoom: 4 } : null,
    props: [[t('Probability'), <span key="p" className="font-mono text-ink-1 tabular-nums">{pct(sc.probability)}</span>], [t('Plays out in'), sc.place]],
    body: <p className="text-small text-ink-2"><Mentions text={sc.description} s={s} onSelect={onSelect} /></p>,
  };
};

export const describeReport: Describer<'report'> = (sel, { s, t, onSelect }) => {
  const r = sel.report;
  const used = [...new Set(r.drivers.flatMap(d => d.sources ?? []))];
  return {
    type: t(TYPE_LABEL.report),
    subtype: { low: t('low confidence'), medium: t('medium confidence'), high: t('high confidence') }[r.confidence],
    title: r.headline,
    inGraph: s.links.some(l => l.from === sel.key),
    locate: null,
    props: [
      [t('Answer'), <span key="a" className="text-gold"><Figures text={sentence(r.answer, t)} /></span>],
      [t('Sources'), used.length ? <span key="s" className="font-mono tabular-nums">{used.length}</span> : null],
    ],
    body: (
      <>
        <p className="text-small text-ink-2"><Mentions text={r.summary} s={s} onSelect={onSelect} /></p>
        {r.drivers.length > 0 && (
          <Group label={t('Drivers, and what they rest on')} count={r.drivers.length}>
            <div className="flex flex-col gap-3">
              {r.drivers.map((d, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <span className="text-small text-ink-1">{d.text}</span>
                  {(d.sources?.length ?? 0) > 0
                    ? <div className="flex flex-wrap gap-1.5">{d.sources!.map(id => <ObjectChip key={id} s={s} k={`c:${id}`} onSelect={onSelect} />)}</div>
                    : <span className="text-meta text-ink-3">{t('No source given')}</span>}
                </div>
              ))}
            </div>
          </Group>
        )}
      </>
    ),
  };
};

export const describeSignpost: Describer<'signpost'> = (sel, { s, t }) => {
  const sp = sel.signpost;
  return {
    type: t(TYPE_LABEL.signpost),
    title: sp.text,
    inGraph: false,
    locate: sp.lat !== null && sp.lng !== null ? { lat: sp.lat, lng: sp.lng, zoom: 4.5 } : null,
    props: [[t('If it happens'), toward(t, s.frame, sp.means, sp.favors)], [t('Where'), sp.place]],
    body: null,
  };
};

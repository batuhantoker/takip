'use client';

import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { FlowChart, type FlowLink } from '@/components/site/admin/charts/flow-chart';
import type { PageJourneys, VisitFilter } from '../analytics-types';
import { count } from '../lib/format';
import { CHANNEL_LABEL, NEXT_LABEL, NEXT_ORDER, originLabel, outcomesBy, pathLabel, STEP_INK } from '../lib/journeys';
import { OutcomeList } from './outcome-list';
import { Pair } from './section-frame';
import { TabbedCard } from './tabbed-card';

const TOP_ORIGINS = 7;
const TOP_LANDINGS = 8;
const OTHER = '*';

export const pathText = (s: string) => <span className="font-mono text-[12px]">{pathLabel(s)}</span>;

/** The top `n` keys, unless only one more would be folded away. */
const keep = (keys: string[], n: number) => new Set(keys.length > n + 1 ? keys.slice(0, n) : keys);

/** How visits arrived and where they went: the flow chart, then sources and landing pages with what each led to. */
export function JourneyFlow({ j, onPick }: { j: PageJourneys; onPick: (filter: VisitFilter) => void }) {
  const origins = outcomesBy(j.flow, 'origin');
  const landings = outcomesBy(j.flow, 'landing');
  const keptOrigins = keep(origins.map(r => r.key), TOP_ORIGINS);
  const keptLandings = keep(landings.map(r => r.key), TOP_LANDINGS);
  const originId = (o: string | null) => `o:${keptOrigins.has(o ?? '') ? o ?? '' : OTHER}`;
  const landingId = (l: string) => `l:${keptLandings.has(l) ? l : OTHER}`;
  const hosts = new Map(j.sources.map(s => [s.source, s.hosts]));

  const sums = new Map<string, FlowLink>();
  const add = (source: string, target: string, value: number, color?: string) => {
    const link = sums.get(`${source}>${target}`) ?? { source, target, value: 0, color };
    link.value += value;
    sums.set(`${source}>${target}`, link);
  };
  for (const f of j.flow) {
    add(originId(f.origin), landingId(f.landing), f.visits);
    add(landingId(f.landing), `n:${f.next}`, f.visits, STEP_INK[f.next]);
  }
  const columns = [
    { title: 'Came from', nodes: [...origins.filter(r => keptOrigins.has(r.key)).map(r => ({ id: `o:${r.key}`, label: originLabel(r.key || null) })), { id: `o:${OTHER}`, label: 'Other sources' }] },
    { title: 'Landed on', nodes: [...landings.filter(r => keptLandings.has(r.key)).map(r => ({ id: `l:${r.key}`, label: pathLabel(r.key) })), { id: `l:${OTHER}`, label: 'Other pages' }] },
    { title: 'Then', nodes: NEXT_ORDER.map(n => ({ id: `n:${n}`, label: NEXT_LABEL[n], color: STEP_INK[n] })) },
  ];
  const pick = (column: number, id: string) => {
    const key = id.slice(2);
    if (key === OTHER) return;
    onPick(column === 0 ? { origin: key || 'direct' } : column === 1 ? { page: key } : { next: key as VisitFilter['next'] });
  };

  const channelTab = (
    <BarList format={count} empty="No visits in this range."
      rows={j.channels.map(c => ({
        key: c.channel, value: c.visits,
        label: <button type="button" onClick={() => onPick({ channel: c.channel })} className="hover:underline">{CHANNEL_LABEL[c.channel]}</button>,
        detail: j.sources.filter(s => s.channel === c.channel).slice(0, 4).map(s => `${s.source} ${count(s.visits)}`).join(' · ') || undefined,
      }))} />
  );

  return (
    <>
      <ChartCard title="Where visits came from and where they went"
        note={`Source, then the page or map it landed on, then what it did next; the top ${TOP_ORIGINS} sources and ${TOP_LANDINGS} landings are drawn.`}
        table={j.flow.length ? { columns: ['Came from', 'Landed on', 'Then', 'Visits'], rows: j.flow.map(f => [originLabel(f.origin), pathLabel(f.landing), NEXT_LABEL[f.next], f.visits]) } : null}>
        {j.flow.length
          ? <FlowChart columns={columns} links={[...sums.values()]} label="Visits from each source to their landing page and next step" format={count} onPick={pick} />
          : <p className="text-[12px] text-ink-3">No visits in this range.</p>}
      </ChartCard>

      <Pair>
        <TabbedCard title="Sources" tabs={[
          { id: 'sources', label: 'Sources', note: 'What each one\'s visits did next; click to list them', body: (
            <OutcomeList rows={origins} onPick={k => onPick({ origin: k || 'direct' })}
              label={k => <span title={hosts.get(k)?.join(', ')}>{originLabel(k || null)}</span>} />
          ) },
          { id: 'channels', label: 'Channels', note: 'Search, AI assistants, social and other sites', body: channelTab },
          { id: 'campaigns', label: 'Campaigns', note: 'utm_source, ref or source on the link', body: (
            <BarList format={count} rows={j.campaigns.map(c => ({ key: c.campaign, label: c.campaign, value: c.visits }))} empty="No tagged links in this range." />
          ) },
          { id: 'links', label: 'Links', note: 'The page on the other site, when it shares it', body: (
            <BarList format={count} limit={10} empty="No other site has shared its page yet."
              rows={j.links.map(l => ({
                key: l.url, value: l.visits,
                label: <a href={`https://${l.url}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] hover:underline">{l.url}</a>,
              }))} />
          ) },
        ]} />
        <ChartCard title="Landing pages" note="Where each visit began, and what it did next; click one for the page">
          <OutcomeList rows={landings} label={pathText} onPick={k => onPick({ page: k })} />
        </ChartCard>
      </Pair>
    </>
  );
}

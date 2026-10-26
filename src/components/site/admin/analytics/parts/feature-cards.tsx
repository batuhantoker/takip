'use client';

import { useId } from 'react';
import { BarList, type BarRow } from '@/components/site/admin/charts/bar-list';
import { ChartCard, type TableView } from '@/components/site/admin/charts/chart-card';
import { Segmented, segmentId } from '@/components/ui/segmented';
import type { AnalyticsEngagement, FeatureUse } from '../analytics-types';
import type { UseTab } from '../lib/engagement-findings';
import { featureLabel, onByDefault, sectionOnByDefault, splitFeature, type FeatureKind } from '../lib/features';
import { count, minutes, pct, sum } from '../lib/format';
import { ACTIONS_NOTE, actionRows, actionTable } from './action-cards';

/** Sections and actions arrived in a later release than map minutes, so their history starts later. */
export const SECTIONS_NOTE = 'The Layers panel’s sections (Air, Sea, Weather…), counted from the release that added them.';

const DIM = 'var(--ink-4)';

type Group = { id: string; label?: string; note?: string; rows: BarRow[] };

/** Bars on one scale, the share of people on the map; a group's heading says why its rows sit apart. */
function ReachGroups({ groups, total, empty }: { groups: Group[]; total: number; empty: string }) {
  const shown = groups.filter(g => g.rows.length);
  if (!shown.length) return <p className="text-[12px] text-ink-3">{empty}</p>;
  return (
    <div className="flex flex-col gap-4">
      {shown.map(g => (
        <div key={g.id} className="flex flex-col gap-2">
          {g.label && (
            <div className="border-b border-line pb-1 text-[11px] text-ink-3">
              <span className="font-medium">{g.label}</span>{g.note && ` · ${g.note}`}
            </div>
          )}
          <BarList format={count} total={total} max={total} limit={8} rows={g.rows} />
        </div>
      ))}
    </div>
  );
}

/** `whole`: the minutes of a kind that takes turns (views, panels), so each one's minutes are a share of the map's. */
const featureRow = (f: FeatureUse, { whole, color, extra }: { whole?: number; color?: string; extra?: string } = {}): BarRow => ({
  key: f.feature,
  label: featureLabel(f.feature),
  value: f.people,
  color,
  detail: [`median ${minutes(f.medianMinutes)} each`, whole ? `${pct(f.minutes, whole)} of map minutes` : null, extra].filter(Boolean).join(' · '),
});

const featureTable = (features: FeatureUse[]): TableView => ({
  columns: ['Feature', 'People', 'Median minutes', 'Minutes', 'Browsers', 'Accounts'],
  rows: features.map(f => [featureLabel(f.feature), f.people, f.medianMinutes ?? '—', f.minutes, f.visitors, f.users]),
});

const TABS: { value: UseTab; label: string }[] = [
  { value: 'actions', label: 'Actions' },
  { value: 'panels', label: 'Panels' },
  { value: 'layers', label: 'Layers' },
  { value: 'sections', label: 'Sections' },
  { value: 'views', label: 'Views' },
];

/**
 * What people did on the map, each by the people who did it (the bar, a share of everyone on the map) and the median
 * a person. The tab is the section's, so a finding can open the one that backs it.
 */
export function UseCard({ e, tab, onTab }: { e: AnalyticsEngagement; tab: UseTab; onTab: (tab: UseTab) => void }) {
  const id = useId();
  const total = e.totals.people;
  const of = (kind: FeatureKind) => e.features.filter(f => splitFeature(f.feature).kind === kind);
  const views = of('view').filter(f => f.feature !== 'view:wall');
  const windows = of('window');
  const panels = of('panel');
  const layers = of('layer');
  const sections = of('section');
  const optIn = layers.filter(f => !onByDefault(f.feature));
  const cameOn = (f: FeatureUse) => (f.arrivedOn ?? 0) * 2 >= f.people;

  const body: Record<UseTab, { note: string; table: TableView; groups: Group[]; empty: string }> = {
    actions: {
      note: ACTIONS_NOTE,
      table: actionTable(e.actions),
      groups: [{ id: 'all', rows: actionRows(e.actions) }],
      empty: 'No actions counted in this range yet.',
    },
    panels: {
      note: 'Time with each sidebar panel open. One is open at a time, so their minutes add up to the map’s.',
      table: featureTable(panels),
      groups: [{ id: 'all', rows: panels.map(f => featureRow(f, { whole: sum(panels.map(p => p.minutes)) })) }],
      empty: 'No panel time in this range yet.',
    },
    layers: {
      note: 'Data layers people had on. Every layer on in a minute gets all of it, so their minutes overlap.',
      table: featureTable(layers),
      groups: [
        { id: 'chose', label: 'Switched on', rows: optIn.filter(f => !cameOn(f)).map(f => featureRow(f)) },
        {
          id: 'came', label: 'Came on with a link or a saved map', note: 'most switched no layer on that day',
          rows: optIn.filter(cameOn).map(f => featureRow(f, { extra: `${count(f.arrivedOn)} of ${count(f.people)} switched none on` })),
        },
        { id: 'default', label: 'On when the map opens', rows: layers.filter(f => onByDefault(f.feature)).map(f => featureRow(f, { color: DIM })) },
      ],
      empty: 'No layer time in this range yet.',
    },
    sections: {
      note: `${SECTIONS_NOTE} A section counts while any of its layers is on.`,
      table: featureTable(sections),
      groups: [
        { id: 'chose', label: 'Followed by choice', rows: sections.filter(f => !sectionOnByDefault(f.feature)).map(f => featureRow(f)) },
        { id: 'default', label: 'Holding a layer the map opens with', rows: sections.filter(f => sectionOnByDefault(f.feature)).map(f => featureRow(f, { color: DIM })) },
      ],
      empty: 'No section time in this range yet.',
    },
    views: {
      note: 'Map, space view, History and Replay take turns, so their minutes add up; windows open over them. The time-limit wall is in the funnel.',
      table: featureTable([...views, ...windows]),
      groups: [
        { id: 'views', label: 'Views', rows: views.map(f => featureRow(f, { whole: sum(views.map(v => v.minutes)) })) },
        { id: 'windows', label: 'Windows over the map', rows: windows.map(f => featureRow(f)) },
      ],
      empty: 'No map time in this range yet.',
    },
  };
  const shown = body[tab];

  return (
    <ChartCard
      title="What people use"
      note={shown.note}
      table={shown.table}
      actions={<Segmented size="sm" semantics="tabs" id={id} label="What people use" value={tab} onChange={onTab} options={TABS} />}
    >
      <div role="tabpanel" aria-labelledby={segmentId(id, tab)}>
        <ReachGroups key={tab} groups={shown.groups} total={total} empty={shown.empty} />
      </div>
    </ChartCard>
  );
}

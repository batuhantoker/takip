'use client';

import { useState } from 'react';
import { BellRing, Crosshair, MoreHorizontal, Radio, RotateCcw, Ship, SlidersHorizontal } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Panel, PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Stat } from '@/components/ui/stat';
import { Dot, Tag } from '@/components/ui/tag';
import { KitSection } from '../kit-layout';

type Tab = 'all' | 'severe' | 'nearby';

const ALERTS = [
  { id: '1', tone: 'red' as const, title: 'M6.1 · Kermadec Islands region', sub: 'USGS · 2 h ago', sev: true },
  { id: '2', tone: 'amber' as const, title: 'Tropical storm watch · Leeward Islands', sub: 'NHC · ends in 16 h', sev: true },
  { id: '3', tone: 'neutral' as const, title: 'M4.7 · 9 km SSE of La Mesa', sub: 'USGS · 4 min ago', sev: false },
  { id: '4', tone: 'neutral' as const, title: 'Airspace closed · Tallinn FIR', sub: 'NOTAM · 1 h ago', sev: false },
  { id: '5', tone: 'neutral' as const, title: 'GPS interference · eastern Baltic', sub: 'GPSJam · 3 h ago', sev: false },
];

function AlertsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [picked, setPicked] = useState('1');
  const rows = tab === 'severe' ? ALERTS.filter(a => a.sev) : tab === 'nearby' ? [] : ALERTS;
  return (
    <Panel title="Alerts" subtitle="136 in the last day · updated just now" onClose={onClose}
      actions={<IconButton label="Alert settings" icon={SlidersHorizontal} />}
      tabs={{ value: tab, onChange: setTab, options: [
        { value: 'all', label: 'All', count: 136 },
        { value: 'severe', label: 'Severe', count: 4 },
        { value: 'nearby', label: 'Nearby', count: 0 },
      ] }}
      footer={<><Dot tone="green" /><span>19 of 20 sources reporting</span></>}>
      {rows.length === 0 ? (
        <EmptyState icon={Crosshair} title="Nothing near you" body="Alerts within 250 km of the map centre show up here." />
      ) : (
        <>
          <PanelSection title="Severe" hint={tab === 'all' ? 2 : undefined} action={<Button variant="ghost" size="sm">Pin all</Button>}>
            {rows.filter(a => a.sev).map(a => (
              <ListRow key={a.id} leading={<Dot tone={a.tone} />} title={a.title} subtitle={a.sub} selected={picked === a.id} onClick={() => setPicked(a.id)} />
            ))}
          </PanelSection>
          {rows.some(a => !a.sev) && (
            <PanelSection title="Everything else">
              {rows.filter(a => !a.sev).map(a => (
                <ListRow key={a.id} leading={<Dot tone="muted" />} title={a.title} subtitle={a.sub} selected={picked === a.id} onClick={() => setPicked(a.id)} />
              ))}
            </PanelSection>
          )}
        </>
      )}
    </Panel>
  );
}

function InspectCard({ onClose }: { onClose: () => void }) {
  return (
    <Panel docked={false} title="ZIM Asia" subtitle="Container ship · Liberia" icon={Ship} onClose={onClose} closeOnEscape={false}
      actions={<><IconButton label="Follow" icon={Radio} active /><IconButton label="More" icon={MoreHorizontal} /></>}
      footer={<><Button variant="primary" size="sm" icon={BellRing}>Watch this ship</Button><span className="ml-auto">AIS · 40 s ago</span></>}>
      <div className="mb-5 flex flex-wrap gap-1.5">
        <Tag tone="green">Underway</Tag>
        <Tag>IMO 9302891</Tag>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat size="sm" label="Speed" value="14.2" unit="kn" />
        <Stat size="sm" label="Course" value="074°" />
        <Stat size="sm" label="Draught" value="12.4" unit="m" />
      </div>
      <PanelSection title="Voyage" className="mt-6">
        <PropertyList>
          <Property label="From" value="Haifa" />
          <Property label="To" value="New York" />
          <Property label="Arrives" value="14 Oct, 06:00" />
          <Property label="Position" value="40.48° N 73.82° W" />
        </PropertyList>
      </PanelSection>
    </Panel>
  );
}

export function Panels() {
  const [alerts, setAlerts] = useState(true);
  const [card, setCard] = useState(true);
  return (
    <KitSection id="panels" title="Panels" source="@/components/ui/panel"
      lead="Every panel has the same anatomy: a 52 px header with the title and a line of context, tabs when it has them, a scrolling body of labelled sections, and an optional footer. Docked panels are part of the frame; floating ones are cards over the map.">
      <div className="flex flex-wrap items-start gap-6">
        <figure className="m-0 flex h-[600px] max-w-full overflow-hidden rounded-float border border-line bg-surface-0">
          <div aria-hidden className="w-[72px] shrink-0 border-r border-line bg-surface-1 max-sm:hidden" />
          <div className="w-[360px] max-w-full">
            {alerts ? <AlertsPanel onClose={() => setAlerts(false)} /> : (
              <div className="flex h-full items-center justify-center border-r border-line bg-surface-1">
                <Button size="sm" icon={RotateCcw} onClick={() => setAlerts(true)}>Open the panel again</Button>
              </div>
            )}
          </div>
        </figure>
        <div className="flex max-w-full flex-col gap-4">
          <div className="w-[340px] max-w-full">
            {card ? <InspectCard onClose={() => setCard(false)} /> : (
              <Button size="sm" icon={RotateCcw} onClick={() => setCard(true)}>Show the card again</Button>
            )}
          </div>
          <ul className="flex max-w-[340px] flex-col gap-2 text-small text-ink-3">
            <li>Left: docked, beside the 72 px sidebar. Flush, full height, a hairline on the right, no radius. A hairline appears under the header once the body scrolls.</li>
            <li>Right: floating, as the inspect card. Radius 12, one shadow, a hairline.</li>
            <li>Escape closes the newest open panel. Try it on the left one.</li>
          </ul>
        </div>
      </div>
    </KitSection>
  );
}

'use client';

import { useState } from 'react';
import { Activity, Camera, Flame, MapPin, MoreHorizontal, PenLine, Ship } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Stat } from '@/components/ui/stat';
import { Dot, Tag } from '@/components/ui/tag';
import { Group, KitSection, Specimen } from '../kit-layout';

const QUAKES = [
  { id: 'a', mag: 'M4.7', place: '9 km SSE of La Mesa, Mexico', when: '4 min ago', tone: 'amber' as const },
  { id: 'b', mag: 'M4.0', place: '62 km NW of Tomé, Chile', when: '38 min ago', tone: 'neutral' as const },
  { id: 'c', mag: 'M6.1', place: 'Kermadec Islands region', when: '2 h ago', tone: 'red' as const },
];

export function Content() {
  const [picked, setPicked] = useState('a');
  const [layers, setLayers] = useState({ ships: true, fires: false, cameras: true });

  return (
    <>
      <KitSection id="rows" title="List rows" source="@/components/ui/list-row"
        lead="One thing per row: a leading dot or icon, a title, a second line, and a value on the right in mono. The whole row is the target; controls in the trailing slot stay clickable on their own.">
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Specimen flow={false} stage="p-4" caption="Selected is surface-3; hover is surface-2. Rows bleed 8 px so their text lines up with the section label.">
            <PanelSection title="Earthquakes" hint="last 24 h" action={<Button variant="ghost" size="sm">See all</Button>}>
              {QUAKES.map(q => (
                <ListRow key={q.id} leading={<Dot tone={q.tone} />} title={q.mag + ' · ' + q.place} subtitle={'USGS · ' + q.when}
                  selected={picked === q.id} onClick={() => setPicked(q.id)} />
              ))}
            </PanelSection>
          </Specimen>
          <Specimen flow={false} stage="p-4" caption="Trailing values are mono. A switch or icon button in the trailing slot is its own target.">
            <PanelSection title="On the map" hint="2 on">
              <ListRow leading={<Ship className="size-4" strokeWidth={1.75} />} title="Maritime and naval" trailing={
                <><span className="font-mono text-small text-ink-2 tabular-nums">17,707</span>
                  <Switch label="Maritime and naval" hideLabel size="sm" checked={layers.ships} onChange={v => setLayers(l => ({ ...l, ships: v }))} /></>
              } />
              <ListRow leading={<Flame className="size-4" strokeWidth={1.75} />} title="Active fires" subtitle="NASA FIRMS · updated 12 min ago" trailing={
                <Switch label="Active fires" hideLabel size="sm" checked={layers.fires} onChange={v => setLayers(l => ({ ...l, fires: v }))} />
              } />
              <ListRow leading={<Camera className="size-4" strokeWidth={1.75} />} title="Traffic cameras" trailing={
                <Switch label="Traffic cameras" hideLabel size="sm" checked={layers.cameras} onChange={v => setLayers(l => ({ ...l, cameras: v }))} />
              } />
            </PanelSection>
            <PanelSection title="Compact">
              <ListRow compact leading={<Dot tone="green" pulse label="Live" />} title="ISS" meta="408 km" trailing="27,580 km/h" onClick={() => {}} />
              <ListRow compact leading={<MapPin className="size-4" strokeWidth={1.75} />} title="Strait of Hormuz" trailing={
                <IconButton size="sm" label="More for Strait of Hormuz" icon={MoreHorizontal} tooltipSide="left" />
              } onClick={() => {}} />
            </PanelSection>
          </Specimen>
        </div>
      </KitSection>

      <KitSection id="tags" title="Tags and dots" source="@/components/ui/tag"
        lead="Tags name an attribute quietly, outlined, never as a filled chip. Dots carry status in a list; a pulse means live right now and nothing else.">
        <Specimen caption="Use a tone only when the attribute is a severity or a state. Most tags are neutral.">
          <Group label="Tag tones">
            <Tag>Container ship</Tag>
            <Tag tone="accent">Watching</Tag>
            <Tag tone="red">Severe</Tag>
            <Tag tone="amber">Ends in 16 h</Tag>
            <Tag tone="green">Underway</Tag>
            <Tag tone="blue">Advisory</Tag>
          </Group>
          <Group label="Dots">
            <span className="flex items-center gap-2 text-small text-ink-2"><Dot tone="green" pulse /> Live</span>
            <span className="flex items-center gap-2 text-small text-ink-2"><Dot tone="amber" /> Delayed</span>
            <span className="flex items-center gap-2 text-small text-ink-2"><Dot tone="red" /> Down</span>
            <span className="flex items-center gap-2 text-small text-ink-2"><Dot tone="muted" /> Off</span>
            <span className="flex items-center gap-2 text-small text-ink-2"><Dot tone="gold" /> TI</span>
          </Group>
        </Specimen>
      </KitSection>

      <KitSection id="stats" title="Stats" source="@/components/ui/stat"
        lead="A number worth reading at a glance. The value is mono; the label above it is the same 11 px as a section label.">
        <Specimen caption="Colour the value only when the number is itself a severity.">
          <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Tracked now" value="139,452" />
            <Stat label="Ships underway" value="17,707" delta="+312" deltaTone="green" />
            <Stat label="Strongest quake" value="M6.1" tone="red" />
            <Stat label="Speed" value="14.2" unit="kn" />
          </div>
          <div className="grid w-full grid-cols-3 gap-6 border-t border-line pt-5 sm:grid-cols-6">
            <Stat size="sm" label="Altitude" value="37,000" unit="ft" />
            <Stat size="sm" label="Heading" value="274°" />
            <Stat size="sm" label="Squawk" value="7700" tone="red" />
          </div>
        </Specimen>
      </KitSection>

      <KitSection id="empty" title="Empty states" source="@/components/ui/empty-state"
        lead="Say what goes here and how to put it there, in two lines. One button at most.">
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen flow={false} stage="p-0">
            <EmptyState icon={PenLine} title="No areas yet" body="Draw a shape on the map to see what is inside it and get told when it changes."
              action={<Button variant="primary" size="sm">Draw an area</Button>} />
          </Specimen>
          <Specimen flow={false} stage="p-0">
            <EmptyState icon={Activity} title="Nothing severe in the last day" body="Quieter alerts are under All." />
          </Specimen>
        </div>
      </KitSection>
    </>
  );
}

'use client';

import { useState } from 'react';
import { Crosshair, Layers, Locate, Minus, Pin, Plus, Radio, Share2, Ship, Trash2, Plane, Satellite } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Group, KitSection, Specimen } from '../kit-layout';

export function Actions() {
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [kind, setKind] = useState<'all' | 'severe' | 'nearby'>('all');
  const [mode, setMode] = useState<'air' | 'sea' | 'space'>('sea');

  const run = () => {
    setBusy(true);
    window.setTimeout(() => setBusy(false), 1600);
  };

  return (
    <>
      <KitSection id="buttons" title="Buttons" source="@/components/ui/button"
        lead="Buttons are verbs. One primary per view; most actions are secondary or ghost. Icon buttons always carry a label, which becomes their tooltip and what a screen reader says.">
        <Specimen caption="Primary for the one thing the view is for, secondary for the rest, ghost inside dense chrome, danger for what cannot be undone.">
          <Group label="Medium · 32">
            <Button variant="primary">Add to map</Button>
            <Button>Export GeoJSON</Button>
            <Button variant="ghost">Turn all off</Button>
            <Button variant="danger" icon={Trash2}>Delete area</Button>
          </Group>
          <Group label="Small · 28">
            <Button variant="primary" size="sm">Play 1938–1945</Button>
            <Button size="sm" icon={Share2}>Share</Button>
            <Button variant="ghost" size="sm">Back to live</Button>
          </Group>
        </Specimen>
        <Specimen caption="Loading keeps the label and disables the button; disabled fades to 40%.">
          <Group label="With an icon">
            <Button variant="primary" icon={Locate}>Locate me</Button>
            <Button icon={Crosshair}>Scan this area</Button>
          </Group>
          <Group label="Loading">
            <Button variant="primary" loading={busy} onClick={run}>{busy ? 'Looking up' : 'Look up'}</Button>
            <Button loading>Refreshing</Button>
          </Group>
          <Group label="Disabled">
            <Button variant="primary" disabled>Add to map</Button>
            <Button disabled>Export</Button>
          </Group>
        </Specimen>
        <Specimen caption="Hover or tab to one: the tooltip says the label and its key. A pressed toggle is neutral, never accent.">
          <Group label="Medium · 32">
            <IconButton label="Zoom in" kbd="+" icon={Plus} tooltipSide="top" />
            <IconButton label="Zoom out" kbd="−" icon={Minus} tooltipSide="top" />
            <IconButton label="Layers" kbd="L" icon={Layers} tooltipSide="top" />
            <IconButton label="Pin to the map" icon={Pin} active={pinned} onClick={() => setPinned(p => !p)} tooltipSide="top" />
          </Group>
          <Group label="Small · 28">
            <IconButton size="sm" label="Follow" icon={Radio} tooltipSide="top" />
            <IconButton size="sm" label="Share" icon={Share2} tooltipSide="top" />
            <IconButton size="sm" label="Disabled" icon={Trash2} disabled tooltipSide="top" />
          </Group>
        </Specimen>
      </KitSection>

      <KitSection id="segmented" title="Segmented" source="@/components/ui/segmented"
        lead="Two to five choices that replace each other, like panel tabs or a time range. The selected one is neutral. Arrow keys move between them.">
        <Specimen caption="Counts are mono and quiet. Inside a panel, Panel draws this for you from its tabs prop.">
          <Group label="With counts">
            <Segmented label="Alerts to show" value={kind} onChange={setKind} options={[
              { value: 'all', label: 'All', count: 136 },
              { value: 'severe', label: 'Severe', count: 4 },
              { value: 'nearby', label: 'Nearby', count: 12 },
            ]} />
          </Group>
          <Group label="Small">
            <Segmented size="sm" label="Time range" value={range} onChange={setRange} options={[
              { value: '1h', label: '1 h' }, { value: '24h', label: '24 h' }, { value: '7d', label: '7 days' },
            ]} />
          </Group>
          <Group label="Full width, with icons" className="w-full max-w-[360px]">
            <Segmented full label="Traffic" value={mode} onChange={setMode} options={[
              { value: 'air', label: 'Air', icon: Plane },
              { value: 'sea', label: 'Sea', icon: Ship },
              { value: 'space', label: 'Space', icon: Satellite },
            ]} />
          </Group>
        </Specimen>
      </KitSection>
    </>
  );
}

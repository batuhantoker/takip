'use client';

import { useState } from 'react';
import { Checkbox, SearchField, Select, Switch, TextField } from '@/components/ui/field';
import { Group, KitSection, Specimen } from '../kit-layout';

export function Inputs() {
  const [query, setQuery] = useState('');
  const [filled, setFilled] = useState('tanker');
  const [name, setName] = useState('Strait of Hormuz');
  const [underway, setUnderway] = useState(true);
  const [pins, setPins] = useState(false);
  const [labels, setLabels] = useState(true);
  const [types, setTypes] = useState({ cargo: true, tankers: true, fishing: false });
  const all = Object.values(types).every(Boolean);
  const some = Object.values(types).some(Boolean);

  return (
    <>
      <KitSection id="fields" title="Fields" source="@/components/ui/field"
        lead="Inputs sit on surface-2 with a firm hairline and turn accent while focused. Labels sit above, help and errors below, all tied together for screen readers.">
        <Specimen caption="Search shows its key while empty. Escape clears it; a second Escape leaves the field.">
          <Group label="Search" className="w-full max-w-[300px]">
            <SearchField value={query} onChange={setQuery} placeholder="Search layers" kbd="/" />
          </Group>
          <Group label="Search, with a query" className="w-full max-w-[300px]">
            <SearchField value={filled} onChange={setFilled} placeholder="Search ships" />
          </Group>
          <Group label="Small" className="w-full max-w-[220px]">
            <SearchField size="sm" value={query} onChange={setQuery} placeholder="Filter" />
          </Group>
        </Specimen>
        <Specimen caption="Text and select share one box. The select is the native one, dressed: keyboard and phones come free.">
          <TextField className="w-full max-w-[260px]" label="Area name" value={name} onChange={e => setName(e.target.value)} hint="Shown on the map and in alerts." />
          <TextField className="w-full max-w-[260px]" label="Callsign" defaultValue="THY4" error="No aircraft with that callsign in the last hour." />
          <Select className="w-full max-w-[200px]" label="Base map" defaultValue="dark" options={[
            { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'satellite', label: 'Satellite' },
          ]} />
          <TextField className="w-full max-w-[200px]" label="Radius" defaultValue="25 km" disabled />
        </Specimen>
      </KitSection>

      <KitSection id="toggles" title="Switch and checkbox" source="@/components/ui/field"
        lead="A switch takes effect at once, like a layer going on the map. A checkbox picks things to act on later. Both are accent when on.">
        <Specimen caption="Every switch has a label, visible or not. In a list, put it in a ListRow's trailing slot instead.">
          <Group label="States" className="w-[260px]">
            <div className="flex flex-col gap-4">
              <Switch label="Underway only" description="Hide anchored and moored ships" checked={underway} onChange={setUnderway} />
              <Switch label="Pin alerts to the map" checked={pins} onChange={setPins} />
              <Switch label="Place labels" checked disabled onChange={() => {}} />
            </div>
          </Group>
          <Group label="Bare and small">
            <Switch label="Labels" hideLabel checked={labels} onChange={setLabels} />
            <Switch label="Labels" hideLabel size="sm" checked={labels} onChange={setLabels} />
            <Switch label="Off" hideLabel size="sm" checked={false} onChange={() => {}} />
          </Group>
          <Group label="Checkbox" className="w-[240px]">
            <div className="flex flex-col gap-3">
              <Checkbox label="All ship types" checked={all} indeterminate={some && !all}
                onChange={() => setTypes(all ? { cargo: false, tankers: false, fishing: false } : { cargo: true, tankers: true, fishing: true })} />
              <div className="flex flex-col gap-3 pl-6">
                <Checkbox label="Cargo" checked={types.cargo} onChange={e => setTypes(t => ({ ...t, cargo: e.target.checked }))} />
                <Checkbox label="Tankers" checked={types.tankers} onChange={e => setTypes(t => ({ ...t, tankers: e.target.checked }))} />
                <Checkbox label="Fishing" description="Often switches its transponder off" checked={types.fishing} onChange={e => setTypes(t => ({ ...t, fishing: e.target.checked }))} />
              </div>
              <Checkbox label="Not available here" disabled />
            </div>
          </Group>
        </Specimen>
      </KitSection>
    </>
  );
}

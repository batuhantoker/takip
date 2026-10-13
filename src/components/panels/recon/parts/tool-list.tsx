'use client';

import { LocateFixed, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { SearchField } from '@/components/ui/search-field';
import { GROUPS, matchTools, toolById, type ToolDef } from '@/components/panels/recon/recon-tools';

const icon = (t: ToolDef) => <t.icon aria-hidden className="size-4" strokeWidth={1.75} />;
// ink-3 so the names carry the list and the descriptions recede.
const blurb = (text: string) => <span className="text-ink-3">{text}</span>;

/** Every recon tool as grouped rows. The expanded rail adds its own filter; the docked panel's search field does that job there. */
export function ToolList({ filter = '', setFilter, activeTool, onPick, onSelfTrack, selfTracking }: {
  filter?: string;
  setFilter?: (v: string) => void;
  activeTool: string | null;
  onPick: (id: string) => void;
  onSelfTrack: () => void;
  selfTracking: boolean;
}) {
  const matched = matchTools(filter);
  const sweep = toolById('sweep')!;
  const q = filter.trim().toLowerCase();
  const showSweep = !q || matchTools(filter, [sweep]).length > 0;
  const showSelfTrack = !q || ['location', 'ip', 'self', 'track', 'me', 'my', 'own'].some(w => w.includes(q) || q.includes(w));
  const showOnMap = showSweep || showSelfTrack;

  return (
    <div className="flex flex-col">
      {setFilter && <SearchField value={filter} onChange={setFilter} placeholder="Filter tools" label="Filter recon tools" />}

      {matched.length === 0 && !showOnMap ? (
        <EmptyState icon={SearchX} title="No tool matches" className="py-8"
          body={<>Nothing matches “{filter}”. Try a plainer word, like “domain” or “email”.</>} />
      ) : (
        GROUPS.map(group => {
          const tools = matched.filter(t => t.group === group.id && t.id !== 'sweep');
          if (!tools.length) return null;
          return (
            <PanelSection key={group.id} title={group.label}>
              {tools.map(t => (
                <ListRow key={t.id} leading={icon(t)} title={t.label} subtitle={blurb(t.blurb)}
                  selected={activeTool === t.id} onClick={() => onPick(t.id)} />
              ))}
            </PanelSection>
          );
        })
      )}

      {showOnMap && (
        <PanelSection title="On the map">
          {showSweep && (
            <ListRow leading={icon(sweep)} title={sweep.label} subtitle={blurb(sweep.blurb)}
              selected={activeTool === 'sweep'} onClick={() => onPick('sweep')} />
          )}
          {showSelfTrack && (
            <ListRow
              leading={<LocateFixed aria-hidden className={selfTracking ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'} strokeWidth={1.75} />}
              title="Find my own location" subtitle={blurb('Your public IP’s rough location, placed on the map')}
              trailing={selfTracking ? 'Locating…' : undefined} onClick={onSelfTrack} />
          )}
        </PanelSection>
      )}
    </div>
  );
}

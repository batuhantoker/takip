'use client';

import { LocateFixed, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { SearchField } from '@/components/ui/search-field';
import { useT } from '@/components/ui/use-t';
import { GROUPS, matchTools, toolById, type ToolDef } from '@/components/panels/recon/recon-tools';

const icon = (tool: ToolDef) => <tool.icon aria-hidden className="size-4" strokeWidth={1.75} />;
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
  const t = useT();
  const matched = matchTools(filter, undefined, t);
  const sweep = toolById('sweep')!;
  const q = filter.trim().toLowerCase();
  const showSweep = !q || matchTools(filter, [sweep], t).length > 0;
  const selfWords = ['location', 'ip', 'self', 'track', 'me', 'my', 'own', ...t('Find my own location').toLowerCase().split(/\s+/)];
  const showSelfTrack = !q || selfWords.some(w => w.includes(q) || q.includes(w));
  const showOnMap = showSweep || showSelfTrack;

  return (
    <div className="flex flex-col">
      {setFilter && <SearchField value={filter} onChange={setFilter} placeholder={t('Filter tools')} label={t('Filter recon tools')} />}

      {matched.length === 0 && !showOnMap ? (
        <EmptyState icon={SearchX} title={t('No tool matches')} className="py-8"
          body={t('Nothing matches “{filter}”. Try a plainer word, like “domain” or “email”.', { filter })} />
      ) : (
        GROUPS.map(group => {
          const tools = matched.filter(tool => tool.group === group.id && tool.id !== 'sweep');
          if (!tools.length) return null;
          return (
            <PanelSection key={group.id} title={t(group.label)}>
              {tools.map(tool => (
                <ListRow key={tool.id} leading={icon(tool)} title={t(tool.label)} subtitle={blurb(t(tool.blurb))}
                  selected={activeTool === tool.id} onClick={() => onPick(tool.id)} />
              ))}
            </PanelSection>
          );
        })
      )}

      {showOnMap && (
        <PanelSection title={t('On the map')}>
          {showSweep && (
            <ListRow leading={icon(sweep)} title={t(sweep.label)} subtitle={blurb(t(sweep.blurb))}
              selected={activeTool === 'sweep'} onClick={() => onPick('sweep')} />
          )}
          {showSelfTrack && (
            <ListRow
              leading={<LocateFixed aria-hidden className={selfTracking ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'} strokeWidth={1.75} />}
              title={t('Find my own location')} subtitle={blurb(t('Your public IP’s rough location, placed on the map'))}
              trailing={selfTracking ? t('Locating…') : undefined} onClick={onSelfTrack} />
          )}
        </PanelSection>
      )}
    </div>
  );
}

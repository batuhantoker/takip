'use client';

import { useState, type ComponentProps } from 'react';
import { Bell, BellRing, Check, Copy, Crosshair, MoreHorizontal, PenLine, Satellite, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ListRow } from '@/components/ui/list-row';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { queryArea, type DrawnShape } from '@/lib/places/areas/draw';
import { measures } from '@/components/panels/areas/area-view';
import { Figure } from '@/components/ui/figure';

/** One drawn shape: its colour on the map, name, size, a bell to watch it, a bin to delete it and a menu for the rest. */
export default function AreaRow({ shape, selected, watched, onSelect, onToggleWatch, onRename, onDelete, onShow, onImagery }: {
  shape: DrawnShape;
  selected: boolean;
  watched: boolean;
  onSelect: () => void;
  onToggleWatch?: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onShow: () => void;
  onImagery?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shape.name);
  const [copied, setCopied] = useState(false);
  const { primary, secondary } = measures(shape);
  const watchable = !!onToggleWatch && !!queryArea(shape);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== shape.name) onRename(name);
    setEditing(false);
  };

  const copy = () => {
    navigator.clipboard?.writeText(JSON.stringify(shape.geojson, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  if (editing) {
    return (
      <div className="-mx-2 flex min-h-10 items-center gap-3 rounded-control bg-surface-2 px-2 py-1">
        <Swatch color={shape.color} />
        <TextField
          aria-label="Name"
          size="sm"
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={e => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            // Claim Escape so it cancels the rename rather than closing the panel.
            if (e.key === 'Escape') { e.preventDefault(); setDraft(shape.name); setEditing(false); }
          }}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <ListRow
      leading={<Swatch color={shape.color} />}
      title={shape.name}
      subtitle={
        <>
          <Figure>{primary}</Figure>
          {secondary ? <> · <Figure>{secondary}</Figure> perimeter</> : ' long'}
        </>
      }
      selected={selected}
      onClick={onSelect}
      trailing={<>
        {watchable && (
          <IconButton size="sm" icon={watched ? WatchingBell : Bell} active={watched} onClick={onToggleWatch}
            label={watched ? 'Stop watching' : 'Watch for things entering or leaving'} />
        )}
        <IconButton size="sm" icon={Trash2} label={`Delete ${shape.name}`} onClick={onDelete} />
        <Popover role="menu" label={`${shape.name} options`} placement="bottom" align="end" className="w-52 p-1"
          trigger={<IconButton size="sm" icon={MoreHorizontal} label="More" />}>
          {close => (
            <>
              <MenuItem icon={Crosshair} onSelect={() => { onShow(); close(); }}>Show on map</MenuItem>
              {onImagery && queryArea(shape) && <MenuItem icon={Satellite} onSelect={() => { onImagery(); close(); }}>Satellite images</MenuItem>}
              <MenuItem icon={PenLine} onSelect={() => { setDraft(shape.name); setEditing(true); close(); }}>Rename</MenuItem>
              <MenuItem icon={copied ? Check : Copy} onSelect={copy} hint={copied ? 'Copied' : undefined}>Copy as GeoJSON</MenuItem>
            </>
          )}
        </Popover>
      </>}
    />
  );
}

// Accent says "this is on"; the pressed fill alone vanishes on a selected row.
function WatchingBell({ className, ...rest }: ComponentProps<typeof BellRing>) {
  return <BellRing {...rest} className={`${className ?? ''} text-accent`} />;
}

/** The shape's own colour on the map, so a row and its outline are easy to pair up. */
function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

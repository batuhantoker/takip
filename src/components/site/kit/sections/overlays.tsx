'use client';

import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, ChevronDown, Map as MapIcon, Moon, Mountain, Satellite, SlidersHorizontal, Sun } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { Group, KitSection, Specimen } from '../kit-layout';

const BASE_MAPS = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'terrain', label: 'Terrain', icon: Mountain },
];

export function Overlays() {
  const [base, setBase] = useState('dark');
  const [view, setView] = useState('Morning check');

  return (
    <>
      <KitSection id="popover" title="Popover and menu" source="@/components/ui/popover · menu-item"
        lead="A floating surface tied to the button that opened it. Escape or a press anywhere else closes it, and focus goes back to the button. Menus move with the arrow keys.">
        <Specimen caption="Menus are a Popover with role menu and MenuItems. The current choice is neutral, not accent.">
          <Group label="Menu">
            <Popover role="menu" label="Base map" className="w-56 p-1"
              trigger={<Button icon={MapIcon}>Base map<ChevronDown aria-hidden className="-mr-1 size-3.5 text-ink-3" /></Button>}>
              {close => (
                <>
                  {BASE_MAPS.map(m => (
                    <MenuItem key={m.id} icon={m.icon} selected={base === m.id} onSelect={() => { setBase(m.id); close(); }}>{m.label}</MenuItem>
                  ))}
                  <MenuDivider />
                  <MenuItem icon={SlidersHorizontal} onSelect={close}>Map options</MenuItem>
                </>
              )}
            </Popover>
          </Group>
          <Group label="Small form">
            <Popover label="Save this view" placement="bottom" align="start" className="w-72 p-4"
              trigger={<IconButton label="Save this view" icon={Bookmark} tooltipSide="top" />}>
              {close => (
                <form onSubmit={e => { e.preventDefault(); close(); }} className="flex flex-col gap-3">
                  <p className="text-body font-medium text-ink-1">Save this view</p>
                  <TextField label="Name" value={view} onChange={e => setView(e.target.value)} data-autofocus
                    hint="Keeps the map position, layers and time." />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
                    <Button variant="primary" size="sm" type="submit">Save view</Button>
                  </div>
                </form>
              )}
            </Popover>
          </Group>
        </Specimen>
      </KitSection>

      <KitSection id="tooltip" title="Tooltip and keys" source="@/components/ui/tooltip · kbd"
        lead="Tooltips name a control and its key after a short pause, or at once on keyboard focus. They never block a click. Nothing important lives only in a tooltip.">
        <Specimen caption="Tooltips flip when there is no room on the side asked for. Moving along a toolbar shows the next one without waiting again.">
          <Group label="Sides">
            <Tooltip label="Above" kbd="↑" side="top"><Button size="sm" icon={ArrowUp}>Top</Button></Tooltip>
            <Tooltip label="Below" kbd="↓" side="bottom"><Button size="sm" icon={ArrowDown}>Bottom</Button></Tooltip>
            <Tooltip label="To the left" side="left"><Button size="sm" icon={ArrowLeft}>Left</Button></Tooltip>
            <Tooltip label="To the right" side="right"><Button size="sm" icon={ArrowRight}>Right</Button></Tooltip>
          </Group>
          <Group label="Keys">
            <Kbd>/</Kbd>
            <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
            <Kbd>Esc</Kbd>
            <Kbd size="sm">L</Kbd>
          </Group>
        </Specimen>
      </KitSection>
    </>
  );
}

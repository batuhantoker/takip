'use client';

import { Fragment, useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Orbit, Sparkles, type LucideIcon } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { useT } from '@/components/ui/use-t';
import { Tooltip } from '@/components/ui/tooltip';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { towardMiddle, type Corner } from '@/components/shell/layout/lib/model';
import { msg } from '@/lib/core/i18n/translator';
import type { SpaceFocus } from '@/lib/space/worlds';

/** Map, or out into space and centred on one of these; the camera flies between them. */
interface FocusOption {
  id: SpaceFocus;
  label: string;
  /** The tooltip on the inline stop, in full. */
  title: string;
  /** One line for the menu. */
  blurb: string;
  /** A picture of the body itself, so its colours are the body's, not the interface's. */
  swatch?: string;
  icon?: LucideIcon;
}

export const FOCUS_OPTIONS: FocusOption[] = [
  { id: 'earth', label: msg('Earth'), blurb: msg('Our planet from orbit, with its satellites'), title: msg('Leave the map and see Earth from space, with its satellites'), swatch: 'radial-gradient(circle at 35% 35%, #7cc4ff, #1d5fae 70%)' },
  { id: 'moon', label: msg('Moon'), blurb: msg('LRO imagery, landing sites and orbiters'), title: msg('Fly to the Moon: NASA LRO imagery, landing sites and orbiters'), swatch: 'radial-gradient(circle at 35% 35%, #f2f2f2, #8a8a8a 70%)' },
  { id: 'mars', label: msg('Mars'), blurb: msg('Viking imagery, the rovers and orbiters'), title: msg('Fly to Mars: Viking imagery, the rovers and the orbiters'), swatch: 'radial-gradient(circle at 35% 35%, #ffad84, #b8401f 70%)' },
  { id: 'sun', label: msg('Sun'), blurb: msg('The latest frame from NASA SDO'), title: msg('Fly to the Sun: the latest frame from NASA SDO'), swatch: 'radial-gradient(circle at 40% 40%, #fff3b0, #ffb72a 60%, #ff7a00)' },
  { id: 'solar', label: msg('System'), blurb: msg('The planets and every spacecraft JPL tracks'), title: msg('Pull back to the planets and every spacecraft JPL tracks'), icon: Orbit },
  { id: 'stars', label: msg('Stars'), blurb: msg('The nearest stars, at their real distances'), title: msg('Out past the heliopause to the nearest stars, each at its real distance (Gaia, Hipparcos), with the ones known to have planets'), icon: Sparkles },
  { id: 'galaxy', label: msg('Galaxy'), blurb: msg('The Milky Way from outside, illustrated'), title: msg('The Milky Way from outside (illustration), with the Sun and Sagittarius A* where they really are'), swatch: 'radial-gradient(ellipse at 50% 50%, #fff3d6 0%, #d8c2ff 28%, rgba(120,110,200,0.35) 55%, transparent 72%)' },
  { id: 'universe', label: msg('Universe'), blurb: msg('Out to the edge of the observable universe'), title: msg('Out to the edge of the observable universe: 2MASS and SDSS galaxies and quasars, and the cosmic microwave background (NASA WMAP)'), swatch: 'radial-gradient(circle at 35% 35%, #ffb36b 0%, #e8564a 30%, #3a6fd8 65%, #1b2f7a 100%)' },
];

function Glyph({ o, dim }: { o: FocusOption; dim?: boolean }) {
  if (o.swatch) return <span aria-hidden className={cx('size-3 shrink-0 rounded-full', dim && 'opacity-80')} style={{ background: o.swatch }} />;
  const Icon = o.icon!;
  return <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />;
}

const SEGMENT = cx('flex h-full items-center gap-1.5 rounded-card px-2.5 text-small font-medium whitespace-nowrap', FOCUS_RING, TRANSITION);
const tone = (on: boolean) => (on ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1');
const PILL = 'pointer-events-auto flex h-[38px] items-center gap-0.5 rounded-float border border-line bg-surface-1 p-[3px] shadow-float outline-none';

function Stops({ focus, onSpace }: { focus: SpaceFocus; onSpace: (f: SpaceFocus) => void }) {
  const t = useT();
  return FOCUS_OPTIONS.map(o => {
    const on = focus === o.id;
    return (
      <Tooltip key={o.id} label={t(o.title)} side="top">
        <button type="button" role="radio" aria-checked={on} aria-label={t(o.label)} onClick={() => onSpace(o.id)} className={cx(SEGMENT, tone(on))}>
          <Glyph o={o} dim={!on} />
          <span className={on ? undefined : 'hidden 2xl:inline'}>{t(o.label)}</span>
        </button>
      </Tooltip>
    );
  });
}

/**
 * The whole control as the menu's trigger, so the menu lines up with its left
 * edge; Popover's props go to the Space button alone. Focus handed back to the
 * control (Escape) goes on to that button.
 */
function MapSpaceControl({ map, down, ...trigger }: Omit<ComponentProps<'button'>, 'children'> & { map: ReactNode; down: boolean }) {
  const t = useT();
  const Chevron = down ? ChevronDown : ChevronUp;
  return (
    <div role="radiogroup" aria-label={t('View')} tabIndex={-1} className={PILL}
      onFocus={e => { if (e.target === e.currentTarget) e.currentTarget.querySelector<HTMLElement>('[aria-haspopup]')?.focus(); }}>
      {map}
      <button type="button" {...trigger} className={cx(SEGMENT, tone(!!trigger['aria-expanded']), 'pr-2')}>
        {t('Space')}
        <Chevron aria-hidden className="size-3.5 text-ink-3" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** The bodies first, then each step further out. */
const NEAR = 4;

/** Map | Space. On the map, Space opens the list of stops; out in space the stops sit inline. */
export default function WorldSwitcher({ inSpace, focus, onMap, onSpace, corner = 'bottom-left' }: {
  inSpace: boolean;
  focus: SpaceFocus;
  onMap: () => void;
  onSpace: (focus: SpaceFocus) => void;
  /** Where it sits, so its menu opens toward the middle of the map. */
  corner?: Corner;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const menu = towardMiddle(corner);
  const map = (
    <button type="button" role="radio" aria-checked={!inSpace} onClick={() => { setOpen(false); onMap(); }} className={cx(SEGMENT, tone(!inSpace))}>
      {t('Map')}
    </button>
  );

  if (inSpace) {
    return (
      <div role="radiogroup" aria-label={t('View')} className={PILL}>
        {map}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
        <Stops focus={focus} onSpace={onSpace} />
      </div>
    );
  }

  return (
    <Popover role="menu" label={t('Go to space')} placement={menu.vertical} align={menu.alongSide} open={open} onOpenChange={setOpen} className="w-[320px] p-1"
      trigger={<MapSpaceControl map={map} down={menu.vertical === 'bottom'} />}>
      {close => FOCUS_OPTIONS.map((o, i) => (
        <Fragment key={o.id}>
          {i === NEAR && <div role="separator" className="-mx-1 my-1 h-px bg-line" />}
          <button type="button" role="menuitem" onClick={() => { close(); onSpace(o.id); }}
            className={cx('flex w-full items-start gap-3 rounded-control px-2.5 py-2 text-left text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
            <span className="flex h-[18px] w-4 shrink-0 items-center justify-center"><Glyph o={o} /></span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-medium text-ink-1">{t(o.label)}</span>
              <span className="truncate text-small text-ink-3">{t(o.blurb)}</span>
            </span>
          </button>
        </Fragment>
      ))}
    </Popover>
  );
}

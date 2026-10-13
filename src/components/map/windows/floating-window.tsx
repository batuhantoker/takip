'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { clampRect, GAP, type Edge } from '@/components/map/windows/lib/geometry';
import type { WindowKind } from './kinds';
import { useMapArea } from './map-area';
import { onHeader, useWindowDrag, windowEl } from './use-window-drag';
import { useWindowResize } from './use-window-resize';
import { columnSlots, frontWindow, useWindows, windowStore } from './window-store';
import './floating.css';

interface WindowControls { collapsed: boolean; big: boolean; toggleFold: () => void; toggleBig: () => void }
const WindowContext = createContext<WindowControls | null>(null);
/** Fold and size controls for whatever is inside a window; null outside one (a phone sheet). */
export const useWindowControls = () => useContext(WindowContext);

const ALL_EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
// A docked window is held by its top and right; it sizes from the other two.
const DOCKED_EDGES: Edge[] = ['w', 's', 'sw'];
const NUDGE: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * A window over the map. It docks in the right-hand column by default; its header drags it
 * free, snaps it to neighbours and back into the column, double-click makes it large, and
 * its edges resize it. The content brings its own frame and a <header>.
 */
export function FloatingWindow({ id, kind, label, onClose, closable = true, children }: {
  id: string;
  kind: WindowKind;
  label: string;
  onClose: () => void;
  closable?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const snap = useWindows();
  const { list } = snap;
  const area = useMapArea();
  const me = list.find(w => w.id === id);

  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    windowStore.register(id, kind, closable, () => close.current());
    const el = root.current;
    return () => {
      const hadFocus = document.activeElement === document.body || !!el?.contains(document.activeElement);
      windowStore.unregister(id);
      const next = frontWindow(windowStore.get().list);
      if (hadFocus && next) windowEl(next)?.querySelector<HTMLElement>('header')?.focus({ preventScroll: true });
    };
  }, [id, kind, closable]);

  const slot = me?.docked ? columnSlots(snap, area).find(s => s.id === id) : undefined;
  const collapsed = !!me && (me.folded || !!slot?.collapsed);

  // What it would take without a limit: its height plus whatever its scroller is hiding.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    let scroller: HTMLElement | null = null;
    const measure = () => {
      if (!scroller || !el.contains(scroller)) {
        scroller = [...el.querySelectorAll<HTMLElement>('*')].find(n => /auto|scroll/.test(getComputedStyle(n).overflowY)) ?? null;
      }
      const header = el.querySelector('header');
      const top = el.getBoundingClientRect().top;
      const head = header ? Math.ceil(header.getBoundingClientRect().bottom - top) + 1 : 44;
      // A frame without a scroller (a picture) clips instead; its own scroll height is its natural one.
      const frame = el.firstElementChild as HTMLElement | null;
      const want = Math.ceil(Math.max(el.offsetHeight + (scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : 0), frame?.scrollHeight ?? 0));
      // Folded, its height says nothing about its content.
      windowStore.measure(id, el.hasAttribute('data-collapsed') ? windowStore.find(id)?.want ?? want : want, head);
    };
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    const content = new MutationObserver(measure);
    content.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { sizes.disconnect(); content.disconnect(); };
  }, [id]);

  // Give the header to the keyboard: arrows move the window, Enter opens a folded one.
  useEffect(() => {
    const h = root.current?.querySelector<HTMLElement>('header');
    if (!h) return;
    h.tabIndex = 0;
    h.setAttribute('aria-label', `${label}: arrow keys move it, Enter folds it`);
  }, [label]);

  useEffect(() => { windowStore.clampAll(area); }, [area]);

  const toggleFold = useCallback(() => {
    if (collapsed) windowStore.expand(id); else windowStore.fold(id, true);
  }, [collapsed, id]);
  const onClick = useCallback(() => { if (collapsed) windowStore.expand(id); }, [collapsed, id]);
  const drag = useWindowDrag(id, root, onClick);
  const resize = useWindowResize(id, root);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const header = root.current?.querySelector('header');
    if (e.target !== header) return;
    if (e.key === 'Enter') { e.preventDefault(); toggleFold(); return; }
    const dir = NUDGE[e.key];
    if (!dir || !root.current) return;
    e.preventDefault();
    const b = root.current.getBoundingClientRect();
    const step = e.shiftKey ? 40 : 8;
    const r = clampRect({ x: b.left + dir[0] * step, y: b.top + dir[1] * step, w: b.width, h: b.height }, area);
    windowStore.moveGroup(id, r.x, r.y, [], null);
  };

  const rank = me ? list.filter(w => w.z < me.z).length : 0;
  // A docked window wider than the map leaves room is held right of the sidebar.
  const width = me ? (me.docked ? Math.min(me.w, area.colRight - area.left - GAP) : me.w) : 340;
  const x = me ? (me.docked ? area.colRight - width : me.x) : 0;
  const y = me ? (me.docked ? slot?.y ?? area.colTop : me.y) : 0;
  const room = me?.docked ? slot?.h ?? area.colBottom - area.colTop : area.bottom - y - GAP;
  const height = !me ? null : collapsed ? me.head : me.h != null ? Math.min(me.h, room) : null;
  const style = {
    '--wx': `${x}px`,
    '--wy': `${y}px`,
    '--ww': `${width}px`,
    '--wh': height != null ? `${height}px` : 'auto',
    '--wmax': collapsed ? 'none' : `${Math.max(me?.head ?? 44, room)}px`,
    zIndex: 350 + rank,
    visibility: me ? undefined : 'hidden',
  } as CSSProperties;

  return (
    <WindowContext.Provider value={{ collapsed, big: !!me?.big, toggleFold, toggleBig: () => windowStore.toggleBig(id) }}>
      <div
        ref={root}
        data-window={id}
        data-collapsed={collapsed || undefined}
        role="group"
        aria-roledescription="window"
        aria-label={label}
        className="tk-window pointer-events-auto"
        style={style}
        onPointerDownCapture={() => windowStore.focus(id)}
        onPointerDown={drag}
        onDoubleClick={e => { if (onHeader(e.target)) windowStore.toggleBig(id); }}
        onKeyDown={onKeyDown}
      >
        {children}
        {me && !collapsed && (me.docked ? DOCKED_EDGES : ALL_EDGES).map(edge => (
          <div key={edge} data-edge={edge} aria-hidden className="tk-window-edge" onPointerDown={resize(edge)} />
        ))}
      </div>
    </WindowContext.Provider>
  );
}

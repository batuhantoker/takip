import type { Stop } from './stops';

export type Box = { x: number; y: number; w: number; h: number };

/** A section inside the stop's panel. `own` text came translated from the panel; the stop table's is still a key. */
export type Part = { el: Element; title: string; body: string; own: boolean };

export type Shot = { boxes: Box[]; anchor: Element | null; parts: Part[] };

const PAD = 4;

const padded = (r: { left: number; top: number; right: number; bottom: number }): Box =>
  ({ x: r.left - PAD, y: r.top - PAD, w: r.right - r.left + PAD * 2, h: r.bottom - r.top + PAD * 2 });

function onScreen(el: Element): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
  if (getComputedStyle(el).visibility === 'hidden') return null;
  return padded(r);
}

/** What draws a box: a Popover's trigger sits in a display: contents wrapper, which has none. */
function drawn(el: Element): Element[] {
  return getComputedStyle(el).display === 'contents' ? [...el.children].flatMap(drawn) : [el];
}

const scrolls = (el: Element) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY);

/** A part's ring, cut to the scrollers around it, so a long open group rings only what shows. */
function partBox(el: Element): Box | null {
  const r = el.getBoundingClientRect();
  let { left, top, right, bottom } = r;
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (!scrolls(p)) continue;
    const c = p.getBoundingClientRect();
    left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
  }
  return right - left < 2 || bottom - top < 2 ? null : padded({ left, top, right, bottom });
}

/** The sections a stop shows from inside, in the order they sit on screen. */
export function partsOf(stop: Stop): Part[] {
  if (!stop.inside) return [];
  const own = [...document.querySelectorAll(`[data-tour-part="${stop.id}"]`)].map(el => ({
    el, title: el.getAttribute('data-tour-title') ?? '', body: el.getAttribute('data-tour-body') ?? '', own: true,
  }));
  const fixed = stop.inside.flatMap(p => {
    const el = document.querySelector(p.selector);
    return el ? [{ el, title: p.title, body: p.body, own: false }] : [];
  });
  return [...own, ...fixed]
    .filter(p => p.el.getBoundingClientRect().height > 1)
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

/** Every target on screen, the card's anchor first; inside a panel, the one section showing. */
export function measure(stop: Stop, part: number | null): Shot {
  if (part !== null) {
    const parts = partsOf(stop);
    const p = parts[Math.min(part, parts.length - 1)];
    const box = p ? partBox(p.el) : null;
    return { boxes: box ? [box] : [], anchor: box ? p.el : null, parts };
  }
  const boxes: Box[] = [];
  let anchor: Element | null = null;
  for (const selector of stop.targets) {
    for (const el of [...document.querySelectorAll(selector)].flatMap(drawn)) {
      const box = onScreen(el);
      if (!box) continue;
      anchor ??= el;
      boxes.push(box);
    }
  }
  return { boxes, anchor, parts: [] };
}

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const sameShot = (a: Shot, b: Shot) =>
  a.anchor === b.anchor
  && a.boxes.length === b.boxes.length && a.boxes.every((x, i) => sameBox(x, b.boxes[i]))
  && a.parts.length === b.parts.length && a.parts.every((p, i) => p.el === b.parts[i].el && p.title === b.parts[i].title && p.body === b.parts[i].body);

/** The panel's scrolling body: the last scroller in the dock with somewhere to go. */
export function scrollerOf(dock: Element): HTMLElement | null {
  return [...dock.querySelectorAll<HTMLElement>('.overflow-y-auto')].filter(el => el.scrollHeight > el.clientHeight + 1).at(-1) ?? null;
}

/** The section at the top of what the scroller shows; the first one while it sits at the top. */
export function partInView(parts: Part[], scroller: HTMLElement): number {
  if (scroller.scrollTop < 4) return parts.length ? 0 : -1;
  const top = scroller.getBoundingClientRect().top + 24;
  return parts.findIndex(p => scroller.contains(p.el) && p.el.getBoundingClientRect().bottom > top);
}

/** Brings a section to the top of its scroller, leaving the rest of the page where it is. */
export function scrollToPart(el: Element) {
  let scroller = el.parentElement;
  while (scroller && !scrolls(scroller)) scroller = scroller.parentElement;
  if (!scroller) return;
  const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scroller.scrollTo({ top: scroller.scrollTop + offset - 8, behavior: smooth ? 'smooth' : 'auto' });
}

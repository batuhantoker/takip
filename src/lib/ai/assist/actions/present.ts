/** highlight, show and markets: what TI puts on the map and in the conversation. */
import { formatDistance } from '@/lib/core/geodesic';
import { loadAdmin1, loadCountries } from '@/lib/places/areas/boundary-store';
import { frame, greatCircle, km, zoomForRadius, type Point } from '../query/geo';
import { resolveRegion } from '../query/region';
import { applyHighlight, type Highlight, type HighlightLine, type HighlightPoint, type Outcome, type Site } from '../tools';
import { fail, fmt, numIn, ok, placeOf, point, str, strings } from './shared';

export async function highlight(a: Record<string, unknown>, site: Site): Promise<Outcome> {
  const pts = (Array.isArray(a.points) ? a.points : []).slice(0, 30).map(p => {
    const at = point(p);
    return at ? { ...at, label: str((p as Record<string, unknown>).label, 60) } : null;
  }).filter((p): p is HighlightPoint => p !== null);
  const ar = point(a.area);
  const area = ar ? { ...ar, radiusKm: numIn((a.area as Record<string, unknown>).radius_km, 1, 5000) ?? 100, label: str((a.area as Record<string, unknown>).label, 60) } : null;

  const lines: HighlightLine[] = [];
  const said: string[] = [];
  for (const arrow of (Array.isArray(a.arrows) ? a.arrows : []).slice(0, 10)) {
    const r = (arrow && typeof arrow === 'object' ? arrow : {}) as Record<string, unknown>;
    const [from, to] = await Promise.all([placeOf(site, r.from), placeOf(site, r.to)]);
    if (!from || !to) { said.push(`could not place ${!from ? str(r.from) || 'a start' : str(r.to) || 'an end'}`); continue; }
    const d = formatDistance(km(from, to));
    lines.push({ coords: greatCircle(from, to), label: str(r.label, 60) || d, kind: 'arrow' });
    pts.push({ lat: from.lat, lng: from.lng, label: from.name }, { lat: to.lat, lng: to.lng, label: to.name });
    said.push(`${from.name} to ${to.name}: ${d}`);
  }
  const path = (Array.isArray(a.path) ? a.path : []).slice(0, 500).map(point).filter((p): p is Point => p !== null);
  if (path.length > 1) lines.push({ coords: path.map(p => [p.lng, p.lat]), kind: 'path' });

  const outlines: NonNullable<Highlight['outlines']> = [];
  const loaders = { countries: site.regions?.countries ?? loadCountries, admin1: site.regions?.admin1 ?? loadAdmin1, geocode: (q: string) => site.geocode(q) };
  for (const name of strings(a.outline).slice(0, 8)) {
    const region = await resolveRegion(name, loaders).catch(() => null);
    if (region) outlines.push({ geometry: region.geometry, label: region.name });
    else said.push(`no outline for "${name}" (countries and states only)`);
  }

  if (!pts.length && !area && !lines.length && !outlines.length) return fail('highlight', said.length ? `Nothing to mark: ${said.join('; ')}` : 'Nothing to highlight: give points, an area, arrows, a path or an outline');
  const prev = a.keep === true ? site.memo?.marks : null;
  const allLines = [...(prev?.lines ?? []), ...lines], allOutlines = [...(prev?.outlines ?? []), ...outlines];
  const next: Highlight = {
    points: [...(prev?.points ?? []), ...pts],
    area: area ?? prev?.area ?? null,
    ...(allLines.length ? { lines: allLines } : {}),
    ...(allOutlines.length ? { outlines: allOutlines } : {}),
  };
  applyHighlight(site, next);
  if (a.frame !== false) {
    const all: Point[] = [...pts, ...(area ? [area] : []), ...lines.flatMap(l => l.coords.map(([lng, lat]) => ({ lat, lng }))), ...outlines.map(o => o.geometry).flatMap(g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flatMap(p => p[0] ?? []).map(([lng, lat]) => ({ lat, lng })))];
    const view = frame(all, area ? zoomForRadius(area.radiusKm, 3) : 9);
    if (view) site.flyTo(view.lat, view.lng, view.zoom);
  }
  const parts = [
    pts.length ? `${pts.length} place${pts.length === 1 ? '' : 's'}` : '',
    area ? `an area round ${area.label || 'a point'}` : '',
    lines.length ? `${lines.length} line${lines.length === 1 ? '' : 's'}` : '',
    outlines.length ? `the outline of ${outlines.map(o => o.label).join(', ')}` : '',
  ].filter(Boolean);
  const listed = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return ok('highlight', `Marked ${listed}${said.length ? `; ${said.join('; ')}` : ''}`);
}

export function show(a: Record<string, unknown>): Outcome {
  const items = (Array.isArray(a.items) ? a.items : []).slice(0, 30).map(it => {
    const r = (it && typeof it === 'object' ? it : { label: it }) as Record<string, unknown>;
    const at = point(r);
    return { label: str(r.label ?? r.name ?? r.title, 160), detail: str(r.detail, 240) || undefined, ...(at ?? {}) };
  }).filter(it => it.label);
  if (!items.length) return fail('show', 'Nothing to show');
  return ok('show', `Showed ${items.length} item${items.length === 1 ? '' : 's'}`, undefined, { kind: 'show', title: str(a.title, 120) || 'Results', items });
}

/** Flattens the page's markets bag into quotes. */
export function quotesOf(markets: unknown): { name: string; symbol: string; group: string; price: number; change: number | null; currency: string }[] {
  if (!markets || typeof markets !== 'object') return [];
  const out: ReturnType<typeof quotesOf> = [];
  for (const [group, quotes] of Object.entries(markets as Record<string, unknown>)) {
    if (!quotes || typeof quotes !== 'object' || Array.isArray(quotes)) continue;
    for (const q of Object.values(quotes as Record<string, unknown>)) {
      if (!q || typeof q !== 'object') continue;
      const r = q as Record<string, unknown>;
      const price = typeof r.price === 'number' ? r.price : NaN;
      if (!Number.isFinite(price) || typeof r.name !== 'string') continue;
      out.push({ name: r.name, symbol: str(r.symbol, 20), group, price, change: typeof r.change_percent === 'number' ? r.change_percent : null, currency: str(r.currency, 8) });
    }
  }
  return out;
}

export function markets(a: Record<string, unknown>, site: Site): Outcome {
  const quotes = quotesOf(site.data().markets);
  if (!quotes.length) return fail('markets', 'Market data has not loaded yet');
  const want = strings(a.symbols).map(s => s.toLowerCase());
  const pick = want.length
    ? quotes.filter(q => want.some(w => q.name.toLowerCase().includes(w) || q.symbol.toLowerCase() === w || q.symbol.toLowerCase().replace(/[=^]/g, '').startsWith(w)))
    : quotes.filter(q => q.group === 'indices' || q.group === 'commodities' || q.group === 'crypto').slice(0, 14);
  if (!pick.length) return fail('markets', `No quotes for ${want.join(', ')}`);
  const rows = pick.slice(0, 20).map(q => ({ name: q.name, symbol: q.symbol, price: q.price, change_pct: q.change === null ? null : Math.round(q.change * 100) / 100, currency: q.currency }));
  return ok('markets', `${rows.length} quote${rows.length === 1 ? '' : 's'}`, rows, {
    kind: 'markets', title: want.length ? 'Quotes' : 'Markets now',
    items: pick.slice(0, 20).map(q => ({
      label: q.name, detail: q.symbol, value: `${fmt(q.price)}${q.currency && q.currency !== 'USD' ? ` ${q.currency}` : ''}${q.change === null ? '' : `  ${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%`}`,
      tone: q.change === null ? undefined : q.change >= 0 ? 'up' : 'down',
    })),
  });
}

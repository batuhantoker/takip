import { GDELT_FAMILIES, type GdeltFamily } from '@takip/connectors/gdelt/cameo';

/**
 * A GDELT story (see /api/gdelt-events) as the Alerts panel lists it: one row
 * beside the channels and wires, placed where its events are, headed by its
 * lead article.
 */
export interface StoryAlert {
  kind: 'story';
  id: string;
  /** When it was first reported. */
  ts: number;
  first: number;
  last: number;
  /** The lead article's own headline once the server has read it, else one from its URL. */
  title: string;
  /** The page's headline in its own language and script, for a translator; null until the server has read it. */
  headline: string | null;
  /** The lead article came through GDELT's translated feed, so it isn't in English. */
  foreign: boolean;
  family: GdeltFamily;
  place: string;
  precision: 'city' | 'region';
  lat: number;
  lng: number;
  /** The CAMEO root verb, "Fought". */
  action: string;
  actors: string[];
  goldstein: number | null;
  tone: number | null;
  reports: number;
  outlets: number;
  link: string | null;
  links: StoryLink[];
  others: (StoryLink & { reports: number })[];
  haystack: string;
}

export interface StoryLink { url: string; outlet: string; title: string | null }

/** The families a reader can pick; the feed leaves cooperation out, as the map layer does. */
export const STORY_FAMILIES: GdeltFamily[] = ['violence', 'protest', 'tension'];

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (v !== null && typeof v === 'object' ? (v as Loose) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const webUrl = (v: unknown): string | null => {
  const u = str(v);
  return u && /^https?:\/\//i.test(u) ? u : null;
};

function toLink(raw: unknown): StoryLink | null {
  const l = rec(raw);
  const url = webUrl(l.url);
  const outlet = str(l.outlet) ?? url?.replace(/^https?:\/\/(www\.)?/i, '').split(/[/:?#]/)[0];
  return url && outlet ? { url, outlet, title: str(l.title) } : null;
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const latinShare = (s: string) => {
  const letters = s.match(/\p{L}/gu)?.length ?? 0;
  return letters ? (s.match(/\p{Script=Latin}/gu)?.length ?? 0) / letters : 0;
};

/**
 * The page's own headline over the one read from its URL, unless the page is
 * in a script the slug spells in Latin: "uk deploy typhoon fighter jets" reads
 * better here than the same story's Hindi headline.
 */
export function pickHeadline(slug: string | null, page: string | null): string | null {
  if (!page) return null;
  return !slug || latinShare(page) >= 0.5 ? page : null;
}

/** `now` keeps a story off the future: GDELT stamps a window by its end, a few minutes ahead. */
export function toStory(raw: unknown, now = Date.now()): StoryAlert | null {
  const e = rec(raw);
  const id = str(e.id);
  const lat = num(e.lat);
  const lng = num(e.lng);
  const last = Date.parse(str(e.last_seen) ?? '');
  const family = GDELT_FAMILIES.find(f => f === e.family);
  if (!id || lat == null || lng == null || !Number.isFinite(last) || !family) return null;

  const links = (Array.isArray(e.links) ? e.links : []).map(toLink).filter((l): l is StoryLink => l !== null);
  const others = (Array.isArray(e.others) ? e.others : [])
    .map(o => {
      const l = toLink(o);
      return l ? { ...l, reports: num(rec(o).reports) ?? 1 } : null;
    })
    .filter((l): l is StoryLink & { reports: number } => l !== null);
  const place = str(e.name) ?? 'Unknown location';
  const action = str(e.action) ?? '';
  const actors = [str(e.actor1), str(e.actor2)].filter((a): a is string => a !== null);
  const slug = links.find(l => l.title)?.title ?? null;
  const headline = str(e.headline);
  const title = pickHeadline(slug, headline) ?? (slug ? sentence(slug) : [actors.join(' → '), action].filter(Boolean).join(' · ') || place);
  const first = Math.min(Date.parse(str(e.first_seen) ?? '') || last, now);

  return {
    kind: 'story',
    id: `gdelt:${id}`,
    ts: first,
    first,
    last: Math.min(last, now),
    title,
    headline,
    foreign: e.translated === true,
    family,
    place,
    precision: e.precision === 'region' ? 'region' : 'city',
    lat,
    lng,
    action,
    actors,
    goldstein: num(e.goldstein),
    tone: num(e.tone),
    reports: num(e.reports) ?? links.length,
    outlets: num(e.outlets) ?? new Set(links.map(l => l.outlet)).size,
    link: webUrl(e.url) ?? links[0]?.url ?? null,
    links,
    others,
    haystack: `${title} ${place} ${action} ${actors.join(' ')} ${links.map(l => `${l.outlet} ${l.title ?? ''}`).join(' ')} gdelt`.toLowerCase(),
  };
}

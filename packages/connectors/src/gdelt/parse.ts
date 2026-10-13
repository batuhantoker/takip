/**
 * TAKIP — readers for the GDELT 2.0 15-minute exports (open data, cite the GDELT Project).
 * Faithful to the files: nothing is dropped here except malformed lines; reduce.ts decides what is worth showing.
 */

/** ActionGeo_Type: how precisely GDELT placed the event. 1, 2 and 5 are centroids, not sites. */
export const GeoType = { none: 0, country: 1, usState: 2, usCity: 3, worldCity: 4, worldState: 5 } as const;

// Zero-based offsets in the 61-column Events export.
const EV = {
  id: 0, day: 1, actor1: 6, actor2: 16, isRoot: 25, code: 26, rootCode: 28, quad: 29, goldstein: 30,
  mentions: 31, sources: 32, articles: 33, tone: 34,
  geoType: 51, place: 52, country: 53, adm1: 54, lat: 56, lng: 57, featureId: 58, added: 59, url: 60,
} as const;
const EV_COLUMNS = 61;

// Zero-based offsets in the 16-column Mentions export.
const MN = { eventId: 0, eventAdded: 1, at: 2, type: 3, source: 4, url: 5, confidence: 11, tone: 13 } as const;
const MN_COLUMNS = 16;

/** One CAMEO-coded event: a single actor–action–place triple pulled from one article. */
export interface GdeltEventRow {
  id: string;
  /** SQLDATE, as GDELT inferred it from the text: often a year off for a fresh story, so nothing filters on it. */
  day: string;
  /** DATEADDED, the 15-minute window that first saw the event, epoch ms. */
  added: number;
  actor1: string;
  actor2: string;
  isRoot: boolean;
  code: string;
  rootCode: string;
  quad: number;
  /** −10 (most conflictual) … +10 (most cooperative). */
  goldstein: number;
  mentions: number;
  /** Usually 1 when first seen: corroboration arrives later, in the Mentions files. */
  sources: number;
  articles: number;
  tone: number;
  geoType: number;
  place: string;
  /** FIPS 10-4, not ISO (RS is Russia). */
  country: string;
  adm1: string;
  /** NaN when the event has no place. */
  lat: number;
  lng: number;
  featureId: string;
  url: string;
}

/** One article mentioning an event, in the window the article was seen. */
export interface GdeltMentionRow {
  eventId: string;
  /** The event's DATEADDED, epoch ms. */
  eventAdded: number;
  at: number;
  /** 1 web, 2 citation only, 3 CORE, 4 DTIC, 5 JSTOR, 6 non-textual. */
  type: number;
  /** The publisher's domain. */
  source: string;
  url: string;
  /** 10–100: how sure GDELT is that this passage describes the event. */
  confidence: number;
  tone: number;
}

/** `YYYYMMDDHHMMSS` → epoch ms, NaN when malformed. */
export function gdeltStamp(s: string): number {
  if (!/^\d{14}$/.test(s)) return NaN;
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
}

const num = (s: string | undefined) => (s ? Number(s) : NaN);
const int = (s: string | undefined) => Number(s) || 0;

function* lines(tsv: string, columns: number): Generator<string[]> {
  for (const line of tsv.split('\n')) {
    const c = line.replace(/\r$/, '').split('\t');
    if (c.length >= columns) yield c;
  }
}

export function parseEvents(tsv: string): GdeltEventRow[] {
  const out: GdeltEventRow[] = [];
  for (const c of lines(tsv, EV_COLUMNS)) {
    out.push({
      id: c[EV.id],
      day: c[EV.day],
      added: gdeltStamp(c[EV.added]),
      actor1: c[EV.actor1],
      actor2: c[EV.actor2],
      isRoot: c[EV.isRoot] === '1',
      code: c[EV.code],
      rootCode: c[EV.rootCode],
      quad: int(c[EV.quad]),
      goldstein: num(c[EV.goldstein]) || 0,
      mentions: int(c[EV.mentions]),
      sources: int(c[EV.sources]),
      articles: int(c[EV.articles]),
      tone: num(c[EV.tone]) || 0,
      geoType: int(c[EV.geoType]),
      place: c[EV.place],
      country: c[EV.country],
      adm1: c[EV.adm1],
      lat: num(c[EV.lat]),
      lng: num(c[EV.lng]),
      featureId: c[EV.featureId],
      url: c[EV.url].trim(),
    });
  }
  return out;
}

export function parseMentions(tsv: string): GdeltMentionRow[] {
  const out: GdeltMentionRow[] = [];
  for (const c of lines(tsv, MN_COLUMNS)) {
    out.push({
      eventId: c[MN.eventId],
      eventAdded: gdeltStamp(c[MN.eventAdded]),
      at: gdeltStamp(c[MN.at]),
      type: int(c[MN.type]),
      source: c[MN.source],
      url: c[MN.url],
      confidence: int(c[MN.confidence]),
      tone: num(c[MN.tone]) || 0,
    });
  }
  return out;
}

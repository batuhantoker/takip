import { inflateRawSync } from 'zlib';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import { parseEvents, parseMentions } from '@takip/connectors/gdelt/parse';
import { CAMEO_ROOTS, type GdeltFamily } from '@takip/connectors/gdelt/cameo';
import { reduceEvents, type GdeltLink, type GdeltPrecision, type GdeltReduction, type ReduceOptions } from '@takip/connectors/gdelt/reduce';

/**
 * ═══════════════════════════════════════════════════════════════
 *  GDELT 2.0 Events — reads the last hours of 15-minute exports
 *
 *  GDELT publishes a ZIP-compressed, tab-separated Events export every
 *  15 minutes at data.gdeltproject.org. Unlike the DOC API (which is
 *  aggressively rate-limited and only exposes a *publisher* country), these
 *  records carry real ActionGeo coordinates for where the event occurred.
 *
 *  Each window's Mentions file lists later articles reporting earlier
 *  events, which is how a story gathers its outlets over the hours.
 *
 *  The archives hold a single deflated entry, so we read the local file
 *  header and inflate it directly rather than pulling in a ZIP dependency.
 * ═══════════════════════════════════════════════════════════════
 */

const HOST = 'http://data.gdeltproject.org/gdeltv2/';
const FEEDS = [
  { manifest: `${HOST}lastupdate.txt`, suffix: '' },
  // Non-English press, machine-translated: the same columns under its own manifest.
  { manifest: `${HOST}lastupdate-translation.txt`, suffix: '.translation' },
];
const DEFAULT_HOURS = 2;

/**
 * GDELT's file host now serves a valid certificate and 301s every plain-HTTP
 * request to the HTTPS origin — including the http:// archive URLs it prints
 * in its own lastupdate.txt. Node's http.get throws outright on an https:
 * target, so following that redirect means switching clients, not recursing
 * back into the same one.
 *
 * It also advertises AAAA records ahead of A records. Hosts without working
 * IPv6 egress see the platform fetch() pick the first address and stall until
 * its connect timeout, so we go through Node's http client with family: 4 to
 * pin the request to IPv4 instead of depending on Happy Eyeballs behaviour we
 * do not control.
 */
function httpGetBufferIPv4(url: string, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = url.startsWith('https:') ? httpsGet : httpGet;
    const req = request(url, { family: 4, timeout: timeoutMs }, res => {
      const status = res.statusCode ?? 0;

      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        resolve(httpGetBufferIPv4(new URL(res.headers.location, url).toString(), timeoutMs));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error(`${url} responded ${status}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c as Buffer));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('timeout', () => req.destroy(new Error(`${url} timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

/** CAMEO QuadClass — the axis that makes this feed useful on a threat map. */
export const QUAD_LABELS: Record<number, string> = {
  1: 'Verbal Cooperation',
  2: 'Material Cooperation',
  3: 'Verbal Conflict',
  4: 'Material Conflict',
};

/** One story on the map: the articles reporting it, placed where most of its events are. */
export interface GdeltEvent {
  id: string;
  lat: number;
  lng: number;
  name: string;
  /** FIPS 10-4, not ISO. */
  country: string;
  family: GdeltFamily;
  precision: GdeltPrecision;
  event_code: string;
  root_code: string;
  /** The CAMEO root verb, e.g. "Fought". */
  action: string;
  quad: number;
  quad_label: string;
  actor1: string;
  actor2: string;
  /** −10 (most conflictual) … +10 (most cooperative) */
  goldstein: number;
  /** Average document tone, roughly −100…+100 but usually −20…+20 */
  tone: number;
  /** Distinct headlines; syndicated copies count once. */
  reports: number;
  outlets: number;
  articles: number;
  url: string;
  links: GdeltLink[];
  others: (GdeltLink & { reports: number })[];
  first_seen: string;
  last_seen: string;
  date: string;
}

/** Extracts the single deflated entry from a ZIP buffer. */
function unzipSingleEntry(buf: Buffer): string {
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Not a ZIP archive');
  }
  const method = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;

  // A streamed archive can report size 0 here and defer to the data descriptor;
  // in that case take everything up to the central directory.
  const end = compressedSize > 0 ? start + compressedSize : buf.indexOf('PK\x01\x02', start, 'binary');
  const body = buf.subarray(start, end > start ? end : undefined);

  // 8 = deflate, 0 = stored. GDELT uses deflate.
  return (method === 8 ? inflateRawSync(body) : body).toString('utf8');
}

/** `YYYYMMDDHHMMSS` moved back by n 15-minute windows. */
function windowBefore(stamp: string, n: number): string {
  const t = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(8, 10), +stamp.slice(10, 12)) - n * 15 * 60_000;
  return new Date(t).toISOString().replace(/\D/g, '').slice(0, 14);
}

// A published window never changes, so each file is fetched once while it is in range.
const fileCache = new Map<string, string>();

/** Null when the window is missing: lastupdate.txt can name an archive a moment before it is published. */
async function fetchArchive(url: string): Promise<string | null> {
  const hit = fileCache.get(url);
  if (hit !== undefined) return hit;
  let csv: string;
  try {
    csv = unzipSingleEntry(await httpGetBufferIPv4(url, 20000));
  } catch (e) {
    if (e instanceof Error && / responded 404$/.test(e.message)) return null;
    throw e;
  }
  fileCache.set(url, csv);
  if (fileCache.size > DEFAULT_HOURS * 4 * FEEDS.length * 2 * 2) fileCache.delete(fileCache.keys().next().value!);
  return csv;
}

async function latestStamp(manifestUrl: string): Promise<string> {
  const manifest = (await httpGetBufferIPv4(manifestUrl, 12000)).toString('utf8');
  const stamp = manifest.match(/(\d{14})(?:\.translation)?\.export\.CSV\.zip/)?.[1];
  if (!stamp) throw new Error(`No export archive listed in ${manifestUrl}`);
  return stamp;
}

async function readFeed(feed: (typeof FEEDS)[number], hours: number) {
  const latest = await latestStamp(feed.manifest);
  const stamps = Array.from({ length: hours * 4 }, (_, n) => windowBefore(latest, n));
  const files = await Promise.all(stamps.map(async stamp => {
    const [events, mentions] = await Promise.all([
      fetchArchive(`${HOST}${stamp}${feed.suffix}.export.CSV.zip`),
      fetchArchive(`${HOST}${stamp}${feed.suffix}.mentions.CSV.zip`),
    ]);
    return { stamp, events, mentions };
  }));
  return files.filter(f => f.events !== null);
}

export type FetchOptions = ReduceOptions & { hours?: number };

export interface GdeltEventsResult {
  events: GdeltEvent[];
  /** The 15-minute windows read, as `YYYYMMDDHHMMSS[.translation]`. */
  windows: string[];
  stats: GdeltReduction['stats'];
}

const iso = (t: number) => new Date(Number.isFinite(t) ? t : Date.now()).toISOString();

export async function fetchGdeltEvents(opts: FetchOptions = {}): Promise<GdeltEventsResult> {
  const hours = opts.hours ?? DEFAULT_HOURS;
  const [english, translated] = await Promise.allSettled(FEEDS.map(f => readFeed(f, hours)));
  if (english.status === 'rejected') throw english.reason;
  if (!english.value.length) throw new Error(`No GDELT export published in the last ${hours} h`);
  const feeds = translated.status === 'fulfilled' ? [english.value, translated.value] : [english.value];
  const files = feeds.flat();

  const { markers, stats } = reduceEvents({
    events: files.flatMap(f => parseEvents(f.events!)),
    mentions: files.flatMap(f => (f.mentions ? parseMentions(f.mentions) : [])),
  }, opts);

  const events = markers.map((m): GdeltEvent => {
    const h = m.headline;
    return {
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      name: m.place || 'Unknown location',
      country: m.country,
      family: m.family,
      precision: m.precision,
      event_code: h.code,
      root_code: h.rootCode,
      action: CAMEO_ROOTS[h.rootCode] ?? '',
      quad: h.quad,
      quad_label: QUAD_LABELS[h.quad] || 'Unclassified',
      actor1: h.actor1,
      actor2: h.actor2,
      goldstein: h.goldstein,
      tone: Number(h.tone.toFixed(2)),
      reports: m.reports,
      outlets: m.outlets,
      articles: m.articles,
      url: m.links[0]?.url ?? h.url,
      links: m.links,
      others: m.others,
      first_seen: iso(m.firstSeen),
      last_seen: iso(m.lastSeen),
      date: iso(m.firstSeen),
    };
  });

  const windows = feeds.flatMap((f, i) => f.map(w => `${w.stamp}${FEEDS[i].suffix}`));
  return { events, windows, stats };
}

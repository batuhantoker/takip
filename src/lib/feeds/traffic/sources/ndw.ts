import { levelFromPct, type TrafficSegment } from '../types';
import type { NdwSite } from './ndw-sites';

/**
 * NDW (Netherlands) travel times, DATEX II v3, every minute: about 60,000 road segments measured
 * from floating car data, each with the travel time NDW normally expects for that time.
 * No CORS, so it is read on the server. Licence: not stated on opendata.ndw.nu (NDW's sets on
 * data.overheid.nl are CC0); see docs/data-sources.md.
 */
export const NDW_READINGS_URL = 'https://opendata.ndw.nu/reistijden_meetgegevens.xml.gz';
export const NDW_BBOX = [3.2, 50.7, 7.3, 53.6] as const;

export interface NdwReading {
  site: string;
  /** ISO, the minute measured. */
  at: string;
  travelS: number;
  usualS?: number;
  /** Probe vehicles behind the value, when NDW says. */
  inputs?: number;
}

export const NDW_BLOCK_END = '</roa:siteMeasurements>';

/** Fewer probes than this and one slow car reads as a jam. */
const MIN_INPUTS = 10;
/** A reading older than this is a feed that stalled, not today's traffic. */
const MAX_AGE_MS = 15 * 60_000;

const num = (s: string | undefined) => (s == null ? undefined : Number(s));

/** One `<roa:siteMeasurements>` block, or null when it has no usable travel time. */
export function parseNdwBlock(block: string): NdwReading | null {
  if (block.includes('dataError')) return null;
  const site = /measurementSiteReference[^>]*\sid="([^"]+)"/.exec(block)?.[1];
  const at = /<roa:timeValue>([^<]+)</.exec(block)?.[1];
  const travel = /<roa:travelTime([^>]*)><roa:duration>([^<]+)</.exec(block);
  const travelS = num(travel?.[2]);
  if (!site || !at || travelS == null || !(travelS > 0)) return null;
  const usualS = num(/<roa:normallyExpectedTravelTime[^>]*><roa:duration>([^<]+)</.exec(block)?.[1]);
  const inputs = num(/numberOfInputValuesUsed="(\d+)"/.exec(travel?.[1] ?? '')?.[1]);
  return { site, at, travelS, ...(usualS != null && usualS > 0 && { usualS }), ...(inputs != null && { inputs }) };
}

/** Splits a stream of XML text into readings; feed it chunks, then call `end`. */
export function createNdwScanner(onReading: (r: NdwReading) => void) {
  let carry = '';
  const drain = (text: string) => {
    let from = 0;
    for (let i = text.indexOf(NDW_BLOCK_END); i >= 0; i = text.indexOf(NDW_BLOCK_END, from)) {
      const r = parseNdwBlock(text.slice(from, i));
      if (r) onReading(r);
      from = i + NDW_BLOCK_END.length;
    }
    return text.slice(from);
  };
  return {
    push(chunk: string) { carry = drain(carry + chunk); },
    end() { carry = ''; },
  };
}

/** Readings joined to their roads; free-flowing, thin or stale ones are left out. */
export function ndwSegments(readings: Iterable<NdwReading>, sites: Map<string, NdwSite>, now = Date.now()): TrafficSegment[] {
  const out: TrafficSegment[] = [];
  for (const r of readings) {
    if (r.usualS == null || (r.inputs != null && r.inputs < MIN_INPUTS)) continue;
    if (now - Date.parse(r.at) > MAX_AGE_MS) continue;
    const pct = (r.usualS / r.travelS) * 100;
    const level = levelFromPct(pct);
    const site = sites.get(r.site);
    if (!level || !site) continue;
    out.push({
      id: `ndw:${r.site}`, source: 'ndw', level, coords: site.coords, at: r.at,
      kmh: Math.round((site.lengthM / r.travelS) * 3.6), pctOfUsual: Math.round(pct),
      ...(site.name && { name: site.name }),
    });
  }
  return out;
}

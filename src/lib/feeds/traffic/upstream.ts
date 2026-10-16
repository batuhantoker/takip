import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';
import { NDW_SITES_PATH, readNdwSites, type NdwSite, type NdwSitesFile } from './sources/ndw-sites';
import { createNdwScanner, NDW_READINGS_URL, type NdwReading } from './sources/ndw';
import { odsExportUrl, type OdsCity } from './sources/opendatasoft';

const TIMEOUT_MS = 30_000;

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok || !res.body) throw new Error(`${new URL(url).hostname} HTTP ${res.status}`);
  return res;
}

/** The minute's readings: a 2 MB gzip that unpacks to ~56 MB of XML, so it is scanned as it streams. */
export async function fetchNdwReadings(): Promise<NdwReading[]> {
  const res = await get(NDW_READINGS_URL);
  const readings: NdwReading[] = [];
  const scanner = createNdwScanner(r => readings.push(r));
  // A .gz file served as application/xml: fetch leaves the gzip alone.
  const text = res.body!.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream());
  for await (const chunk of text as unknown as AsyncIterable<string>) scanner.push(chunk);
  scanner.end();
  if (!readings.length) throw new Error('NDW: no readings');
  return readings;
}

let sites: Promise<Map<string, NdwSite> | null> | null = null;

/** Built by tools/traffic/build-ndw.ts; null until it has been run here. */
export function loadNdwSites(): Promise<Map<string, NdwSite> | null> {
  return (sites ??= readFile(join(process.cwd(), NDW_SITES_PATH), 'utf8')
    .then(text => readNdwSites(JSON.parse(text) as NdwSitesFile))
    .catch(() => {
      console.warn(`[TAKIP] traffic: ${NDW_SITES_PATH} is missing; run tools/traffic/build-ndw.ts`);
      // Tried again on the next refresh, so a build while the server runs is picked up.
      sites = null;
      return null;
    }));
}

export async function fetchOds(city: OdsCity): Promise<unknown> {
  return (await get(odsExportUrl(city))).json();
}

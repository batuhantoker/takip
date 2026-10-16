import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Infoclimat weather webcams (~220, mostly France plus La Réunion), from the marker list embedded in the
 * association's own webcam map page, no key.
 * Terms: all rights reserved; reproduction or framing needs the association board's written consent, and automated
 * collection of site content is prohibited outside its API, which needs a key and carries no webcams
 * (infoclimat.fr/about, "Restrictions d'utilisation").
 */

const PAGE = 'https://www.infoclimat.fr/annuaire-webcams-meteo.html';
const WEBCAMS_PREFIX = 'var json_webcams = ';
const SOURCE = 'Infoclimat';

export const INFOCLIMAT_BOUNDS = { minLat: -22, maxLat: 52, minLng: -7, maxLng: 56 };

export interface InfoclimatWebcam {
  id?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** `<b>Name</b><br>Dernière image : …`, with HTML entities. */
  libelle?: string | null;
  style?: string | null;
}

/** The JSON value right after `prefix`, read up to its matching bracket. */
function embeddedJson(html: string, prefix: string): unknown {
  const start = html.indexOf(prefix);
  if (start < 0) return null;
  const from = start + prefix.length;
  let depth = 0;
  let inString = false;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      if (--depth === 0) return JSON.parse(html.slice(from, i + 1));
    }
  }
  return null;
}

export function extractWebcams(html: string): InfoclimatWebcam[] | null {
  try {
    const list = embeddedJson(html, WEBCAMS_PREFIX);
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

const MARKS: Record<string, string> = {
  acute: '́', grave: '̀', circ: '̂', uml: '̈', tilde: '̃', cedil: '̧', ring: '̊',
};
const NAMED: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', szlig: 'ß' };

/** Infoclimat names use Latin-1 named entities (`&eacute;`, `&Icirc;`, `&szlig;`). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&([a-zA-Z])(acute|grave|circ|uml|tilde|cedil|ring);/g, (_, ch: string, mark: string) => (ch + MARKS[mark]).normalize('NFC'))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, name: string) => NAMED[name] ?? m);
}

export function mapInfoclimatWebcam(w: InfoclimatWebcam): CctvCamera | null {
  const id = w?.id?.trim();
  if (!id || !/^\d+$/.test(id) || w.style !== 'active') return null;

  const { lat, lon: lng } = w;
  if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) return null;
  const b = INFOCLIMAT_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const name = decodeEntities(/<b>(.*?)<\/b>/.exec(w.libelle ?? '')?.[1] ?? '').replace(/\s+/g, ' ').trim();
  return {
    id: `infoclimat-${id}`,
    lat,
    lng,
    name: name || `${SOURCE} webcam ${id}`,
    city: '',
    country: '',
    feed_url: `https://www.infoclimat.fr/cartes/getProxyWebcam.php?idw=${id}&c=30&t=jpg`,
    external_url: `${PAGE}#${id}`,
    source: SOURCE,
  };
}

export async function fetchInfoclimatCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(PAGE, { signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`Infoclimat HTTP ${res.status}`);
  const webcams = extractWebcams(await res.text());
  if (!webcams) throw new Error('Infoclimat: no json_webcams on the map page');

  const seen = new Map<string, CctvCamera>();
  for (const w of webcams) {
    const cam = mapInfoclimatWebcam(w);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Weather webcams — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}

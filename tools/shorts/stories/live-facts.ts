/** What a feature's feed says right now, in the same sentences its /map page prints, for a tour to tell. */
import { createTranslator } from '../../../src/lib/core/i18n/translator';
import type { LayerPage, Spot } from '../../../src/lib/platform/site/catalog/types';
import type { Spoken } from '../../../src/lib/platform/site/clock';
import { auroraLine, issLine, launchLine, quakeLine } from '../../../src/lib/platform/site/live/lines';
import { inBox, viewBox } from './view';

const en = createTranslator('en', {});
const ROUTES = { earthquakes: '/api/earthquakes', launches: '/api/launches', aurora: '/api/aurora', iss: '/api/satellites?norad=25544' } as const;
const words = (s: Spoken) => s.map(p => (typeof p === 'string' ? p : `${new Date(p.at).toISOString().slice(11, 16)} UTC`)).join('');

type Quake = { magnitude: number; place: string; time: number; lat: number; lng: number };

export interface LiveFacts {
  /** The page's live sentence, or null when the feed has nothing true to say. */
  line: string | null;
  /** A sentence per spot label, where the feed says something about that view. */
  spots: Record<string, string>;
}

export async function liveFacts(base: string, page: LayerPage, spots: Spot[]): Promise<LiveFacts> {
  const out: LiveFacts = { line: null, spots: {} };
  if (!page.live) return out;
  const json = await fetch(base + ROUTES[page.live], { signal: AbortSignal.timeout(90_000) }).then(r => (r.ok ? r.json() : null), () => null);
  if (!json) return out;
  const now = Date.now();
  const line = { earthquakes: quakeLine, launches: launchLine, aurora: auroraLine, iss: issLine }[page.live](json, now, en);
  out.line = line ? words(line.text) : null;
  if (page.live === 'earthquakes') {
    const day = ((json as { earthquakes?: Quake[] }).earthquakes ?? []).filter(q => q.time >= now - 86_400_000);
    for (const s of spots) {
      const box = viewBox(s.view.lat, s.view.lon, s.view.zoom);
      const here = day.filter(q => inBox(box, q.lat, q.lng));
      if (!here.length) continue;
      const top = here.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
      out.spots[s.label] = `${here.length} earthquake${here.length > 1 ? 's' : ''} of magnitude 2.5 or more in view in the last 24 hours; the strongest M${top.magnitude.toFixed(1)}, ${top.place}.`;
    }
  }
  return out;
}

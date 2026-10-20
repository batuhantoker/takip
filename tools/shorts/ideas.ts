/**
 * What to make today. Live situations come first, each as the tour of the feature that shows it, flying to the
 * place with the facts as the feeds give them. Then the evergreen stories and the features not yet made.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LAYER_PAGES } from '../../src/lib/platform/site/layer-pages';

export interface Idea {
  maker: string;
  args: Record<string, string>;
  why: string;
  score: number;
}

type Quake = { id: string; lat: number; lng: number; depth: number; magnitude: number; place: string; time: number; source: string };
type WeatherEvent = { id: string; title: string; category: string; severity: string; lat: number; lng: number; source: string };
type Launch = { name: string; net: string; status: string; provider: string; rocket: string; mission: string };

/** EONET credits some events with a URL; say who it is. */
const sourceName = (s: string) => (/jtwc/i.test(s) ? 'the Joint Typhoon Warning Center' : /^https?:/.test(s) ? new URL(s).hostname.replace(/^www\./, '') : s);
const utc = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC on ${new Date(ms).toUTCString().slice(5, 16)}`;
const get = <T>(base: string, path: string) =>
  fetch(base + path, { signal: AbortSignal.timeout(90_000) }).then(r => (r.ok ? (r.json() as Promise<T>) : null), () => null);

async function situations(base: string): Promise<Idea[]> {
  const [quakes, weather, space, launches] = await Promise.all([
    get<{ earthquakes: Quake[] }>(base, '/api/earthquakes'),
    get<{ events: WeatherEvent[] }>(base, '/api/weather'),
    get<{ kp_index: number; storm_level: string }>(base, '/api/space-weather'),
    get<{ launches: Launch[] }>(base, '/api/launches'),
  ]);
  const ideas: Idea[] = [];

  const big = quakes?.earthquakes.filter(q => q.magnitude >= 5.5).sort((a, b) => b.magnitude - a.magnitude)[0];
  if (big) {
    ideas.push({
      maker: 'feature', score: 50 + (big.magnitude - 5.5) * 30,
      why: `M${big.magnitude.toFixed(1)} ${big.place}`,
      args: {
        page: 'earthquakes', name: `quake-${big.id}`, at: `${big.lat},${big.lng},6`, label: big.place,
        fact: `A magnitude ${big.magnitude.toFixed(1)} earthquake ${big.depth} km deep, ${big.place}, at ${utc(big.time)} (${big.source}).`,
      },
    });
  }

  const storm = weather?.events.find(e => e.category === 'severeStorms' && /hurricane|typhoon|cyclone|tropical/i.test(e.title));
  if (storm) {
    ideas.push({
      maker: 'feature', score: 60, why: storm.title,
      args: { page: 'hurricanes', name: `storm-${storm.id}`.replace(/[^\w-]+/g, '_'), at: `${storm.lat},${storm.lng},4.5`, label: storm.title, fact: `${storm.title}, tracked by ${sourceName(storm.source)}.` },
    });
  }

  if (space && space.kp_index >= 6) {
    ideas.push({
      maker: 'feature', score: 45 + (space.kp_index - 6) * 10, why: `Kp ${space.kp_index} (${space.storm_level})`,
      args: { page: 'aurora-forecast', name: `aurora-${new Date().toISOString().slice(0, 10)}`, fact: `The planetary Kp index is ${space.kp_index}: a ${space.storm_level.toLowerCase()} geomagnetic storm (NOAA).` },
    });
  }

  const now = Date.now();
  const next = launches?.launches.find(l => Date.parse(l.net) > now && Date.parse(l.net) - now < 86_400_000 && /go/i.test(l.status));
  if (next) {
    // Launch Library names launches "Rocket | Mission"
    const mission = next.name.split('|').pop()!.trim();
    ideas.push({
      maker: 'feature', score: 30, why: `${next.name} at ${utc(Date.parse(next.net))}`,
      args: { page: 'rocket-launches', name: `launch-${mission}`.replace(/[^\w-]+/g, '_').slice(0, 60), fact: `${next.provider} plans to launch ${mission} on a ${next.rocket} at ${utc(Date.parse(next.net))}.` },
    });
  }
  return ideas;
}

/** Shorts already filmed, any day: a folder with a video in it (the library holds scripts only). */
function made(root: string) {
  const dir = join(root, 'data/shorts');
  if (!existsSync(dir)) return new Set<string>();
  const filmed = (d: string) => readdirSync(d).some(f => f.endsWith('.mp4'));
  return new Set(readdirSync(dir).flatMap(day => {
    const d = join(dir, day);
    return statSync(d).isDirectory() ? readdirSync(d).filter(s => statSync(join(d, s)).isDirectory() && filmed(join(d, s))) : [];
  }));
}

export async function ideas(base: string, root: string): Promise<Idea[]> {
  const done = made(root);
  const out = (await situations(base)).filter(i => !done.has(i.args.name));
  if (!done.has('deep-time')) out.push({ maker: 'deep-time', args: {}, why: 'Pangaea to today in under a minute', score: 20 });
  // History's own pages first among the features: the past is what people share most
  const day = Math.floor(Date.now() / 86_400_000);
  // Space and Replay pages haven't been filmed yet; their views may not have a map to wait on
  const filmable = (p: (typeof LAYER_PAGES)[number]) => !p.mode || p.mode.view === 'history' || p.mode.view === 'deep';
  LAYER_PAGES.filter(p => !done.has(`feature-page-${p.slug}`) && !p.requiresEnv && filmable(p)).forEach((p, i) => {
    out.push({ maker: 'feature', args: { page: p.slug }, why: p.heading, score: (p.section === 'past' ? 15 : 10) - ((i + day) % LAYER_PAGES.length) / 100 });
  });
  return out.sort((a, b) => b.score - a.score);
}

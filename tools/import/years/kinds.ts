import {
  AIR_CLASSES, CROWD_CLASSES, EPIDEMIC_CLASSES, EXPLOSION_CLASSES, FAMINE_CLASSES, FIRE_CLASSES, INDUSTRIAL_CLASSES, MINING_CLASSES, MURDER_CLASSES,
  OPERATION_CLASSES, PROTEST_CLASSES, RAIL_CLASSES, RIOT_CLASSES, ROAD_CLASSES, SHOOTING_CLASSES, STRIKE_CLASSES, UPRISING_CLASSES, WILDFIRE_CLASSES,
} from '../fetch-events';
import { UA } from '../fetch-net';

/*
 * TAKIP event kinds by Wikidata class. Kinds whose subclass trees stray (riot's reaches Holocaust train journeys) take
 * only the classes wikidata-events lists; the rest take every subclass of their roots. Earlier entries win, so a siege
 * is a siege before it is a battle.
 */
const LISTED: [kind: string, classes: string[]][] = [
  ['battle.operation', OPERATION_CLASSES], ['crime.shooting', SHOOTING_CLASSES], ['crime.murder', MURDER_CLASSES],
  ['disaster.famine', FAMINE_CLASSES], ['disaster.epidemic', EPIDEMIC_CLASSES], ['disaster.wildfire', WILDFIRE_CLASSES], ['disaster.fire', FIRE_CLASSES],
  ['accident.aviation', AIR_CLASSES], ['accident.rail', RAIL_CLASSES], ['accident.road', ROAD_CLASSES], ['accident.mining', MINING_CLASSES],
  ['accident.explosion', EXPLOSION_CLASSES], ['accident.crowd', CROWD_CLASSES], ['accident.industrial', INDUSTRIAL_CLASSES],
  ['politics.riot', RIOT_CLASSES], ['politics.protest', PROTEST_CLASSES], ['politics.strike', STRIKE_CLASSES], ['conflict.rebellion', UPRISING_CLASSES],
];

export const KIND_ROOTS: [kind: string, roots: string[]][] = [
  ['battle.siege', ['Q188055']],
  ['nuclear.test', ['Q210112']],
  ['attack.terror', ['Q2223653']],
  ['politics.coup', ['Q45382']],
  ['politics.assassination', ['Q3882219']],
  ['conflict.genocide', ['Q41397']],
  ['conflict.massacre', ['Q3199915']],
  ['battle', ['Q178561']],
  ['politics.treaty', ['Q131569', 'Q625298']],
  ['politics.revolution', ['Q10931']],
  ['conflict.rebellion', ['Q124734']],
  ['war', ['Q198']],
  ['hazard.tsunami', ['Q8070']],
  ['hazard.quake', ['Q7944']],
  ['hazard.volcano', ['Q7692360']],
  ['hazard.storm', ['Q8092']],
  ['disaster.flood', ['Q8068']],
];

/** Class Q-id → its subclass-of roots, from QLever's Wikidata (query.wikidata.org rate-limits this IP). */
export async function fetchClassRoots(): Promise<Record<string, string[]>> {
  const roots = KIND_ROOTS.flatMap(([, r]) => r);
  const query = `PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX wd: <http://www.wikidata.org/entity/>
    SELECT ?class ?root WHERE { VALUES ?root { ${roots.map(r => `wd:${r}`).join(' ')} } ?class wdt:P279* ?root }`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch('https://qlever.dev/api/wikidata', {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok) throw new Error(`qlever ${res.status}`);
      const body = (await res.json()) as { results: { bindings: { class: { value: string }; root: { value: string } }[] } };
      const out: Record<string, string[]> = {};
      const q = (v: string) => v.replace('http://www.wikidata.org/entity/', '');
      for (const b of body.results.bindings) (out[q(b.class.value)] ??= []).push(q(b.root.value));
      return out;
    } catch (e) {
      if (attempt >= 8) throw e;
      console.log(`  qlever: ${(e as Error).message}; retrying in ${30 * attempt} s`);
      await new Promise(r => setTimeout(r, 30_000 * attempt));
    }
  }
}

/** The kind for an item of class `cls` (Q-id), or null. */
export function classKind(classRoots: Record<string, string[]>, cls: string | null | undefined): string | null {
  if (!cls) return null;
  const listed = LISTED.find(([, cs]) => cs.includes(cls));
  if (listed) return listed[0];
  const roots = new Set([cls, ...(classRoots[cls] ?? [])]);
  for (const [kind, rs] of KIND_ROOTS) if (rs.some(r => roots.has(r))) return kind;
  return null;
}

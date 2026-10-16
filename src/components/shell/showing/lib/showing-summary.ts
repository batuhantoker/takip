import { FAMILY_TEXT } from '@/components/panels/history/lib/history-content';
import { longDate } from '@/components/panels/history/lib/format-date';
import { HISTORY_FAMILIES } from '@/lib/history/popup';
import { WAR_LAYERS } from '@/lib/history/war-layers';
import { clockYear, clockYearLabel, FIRST_YEAR, LAST_YEAR, WORLD_BORDERS } from '@/lib/history/world-borders';
import { longMa, periodAt } from '@/lib/history/paleo/deep-time';
import type { LayerDef } from '@/components/panels/layers/layer-groups';
import { formatTime } from '@/lib/map/replay/time-input';
import { layerLabel, layersDrawn, type ShowingState } from './showing-state';

/** How many layer names a sentence lists before it counts the rest. */
const NAMED = 3;

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]) {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** A name inside a sentence: "Maritime / naval" → "maritime / naval", but "CCTV cameras" keeps its acronym. */
const lower = (name: string) => (/^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name);
const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** Names that lean on their Layers group ("Commercial" under Air), as a person would say them. */
const SAID: Record<string, string> = {
  flights: 'commercial flights', private: 'private flights', military: 'military flights', maritime: 'ships', sat_military: 'military satellites',
};

/** "ships, all satellites, earthquakes and 2 more layers", then, unless `only` picks layers, ArcGIS layers and drawn areas. */
function drawnPhrase(s: ShowingState, only?: (l: LayerDef) => boolean) {
  const names = layersDrawn(s.layers, s.mode).filter(l => !only || only(l)).map(l => SAID[l.key] ?? lower(layerLabel(l)));
  const parts = names.length > NAMED + 1 ? [...names.slice(0, NAMED), `${names.length - NAMED} more layers`] : names;
  if (!only && s.arcgis.length) parts.push(plural(s.arcgis.length, 'ArcGIS layer'));
  if (!only && s.areas.count) parts.push(plural(s.areas.count, 'drawn area'));
  return listOf(parts);
}

/** Replay moves what it records with its clock; live-only layers wait for LIVE. */
function replayBody(s: ShowingState) {
  const recorded = drawnPhrase(s);
  return recorded ? `${upper(recorded)} as recorded.` : 'Nothing on the map. Turn on ships or aircraft in Layers to replay them.';
}

const pausedNote = (n: number) => (n ? ` Your ${plural(n, 'live layer')} ${n === 1 ? 'is' : 'are'} paused until you go back to live.` : '');

function historyBody(s: ShowingState) {
  const families = Object.keys(HISTORY_FAMILIES).filter(f => s.families.includes(f)).map(f => lower(FAMILY_TEXT[f]?.name ?? HISTORY_FAMILIES[f].label));
  const events = families.length ? `${listOf(families)} around that date` : null;
  let main: string | null = null;
  if (s.borders === WORLD_BORDERS.code) {
    const y = s.time === null ? LAST_YEAR : clockYear(s.time);
    main = y < FIRST_YEAR ? 'No world borders this far back' : `World borders of ${clockYearLabel(Math.min(y, LAST_YEAR))}`;
  } else if (s.borders) {
    main = `${WAR_LAYERS.find(w => w.code === s.borders)?.label ?? 'Wartime'} borders`;
  } else if (s.colouring) {
    main = `Countries coloured by ${lower(s.colouring.name)}`;
  }
  if (main && events) return `${main}, with ${events}.`;
  if (main || events) return `${upper((main ?? events)!)}.`;
  return 'Nothing from the past is on yet. Turn on events or borders in History.';
}

/** One or two plain sentences on what the map shows: the mode and time first, then what is drawn. */
export function summaryFor(s: ShowingState): { title: string; body: string } {
  if (s.mode === 'deep') {
    const ma = s.ma ?? 0;
    const lead = s.chapter ? `${s.chapter}. ` : '';
    return { title: `Deep time · ${longMa(ma)}`, body: `${lead}The continents as they stood in the ${periodAt(ma).name}.${pausedNote(s.paused)}` };
  }
  if (s.mode === 'history') {
    const t = s.time ?? 0;
    return { title: `History · ${longDate(t)}${s.projected ? ' · projected' : ''}`, body: `${historyBody(s)}${pausedNote(s.paused)}` };
  }
  if (s.mode === 'replay') {
    const t = s.time ?? 0;
    const d = new Date(t);
    const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    return { title: `Replay · ${formatTime(t, Number.POSITIVE_INFINITY)}, ${hm} UTC`, body: `${replayBody(s)}${pausedNote(s.paused)}` };
  }
  const drawn = drawnPhrase(s);
  return { title: 'Live', body: drawn ? `${upper(drawn)}.` : 'Nothing on the map yet. Turn layers on in Layers.' };
}

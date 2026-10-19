import { FAMILY_TEXT } from '@/components/panels/history/lib/history-content';
import { longDate } from '@/components/panels/history/lib/format-date';
import { HISTORY_FAMILIES } from '@/lib/history/popup';
import { WAR_LAYERS } from '@/lib/history/war-layers';
import { clockYear, clockYearLabel, FIRST_YEAR, LAST_YEAR, WORLD_BORDERS } from '@/lib/history/world-borders';
import { longMa, periodAt } from '@/lib/history/paleo/deep-time';
import type { LayerDef } from '@/components/panels/layers/layer-groups';
import { formatTime } from '@/lib/map/replay/time-input';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { ENGLISH, layerLabel, layersDrawn, type ShowingState } from './showing-state';

/** How many layer names a sentence lists before it counts the rest. */
const NAMED = 3;

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[], t: Translate = ENGLISH) {
  if (items.length < 2) return items[0] ?? '';
  // House style has no serial comma, as en-GB.
  return new Intl.ListFormat(t.locale === 'en' ? 'en-GB' : t.intl, { type: 'conjunction' }).format(items);
}

/** A name inside a sentence: "Maritime / naval" → "maritime / naval", but "CCTV cameras" keeps its acronym, and German its capitals. */
const lower = (name: string, t: Translate) =>
  (t.locale !== 'de' && /^\p{Lu}\p{Ll}/u.test(name) ? name.charAt(0).toLocaleLowerCase(t.intl) + name.slice(1) : name);
const upper = (text: string, t: Translate) => text.charAt(0).toLocaleUpperCase(t.intl) + text.slice(1);

/** Names that lean on their Layers group ("Commercial" under Air), as a person would say them. */
const SAID: Record<string, string> = {
  flights: msg('commercial flights'), private: msg('private flights'), military: msg('military flights'), maritime: msg('ships'), sat_military: msg('military satellites'),
};

/** "ships, all satellites, earthquakes and 2 more layers", then, unless `only` picks layers, ArcGIS layers and drawn areas. */
function drawnPhrase(s: ShowingState, t: Translate, only?: (l: LayerDef) => boolean) {
  const names = layersDrawn(s.layers, s.mode).filter(l => !only || only(l)).map(l => (SAID[l.key] ? t(SAID[l.key]) : lower(layerLabel(l, t), t)));
  const parts = names.length > NAMED + 1
    ? [...names.slice(0, NAMED), t('{n, plural, one {# more layer} other {# more layers}}', { n: names.length - NAMED })]
    : names;
  if (!only && s.arcgis.length) parts.push(t('{n, plural, one {# ArcGIS layer} other {# ArcGIS layers}}', { n: s.arcgis.length }));
  if (!only && s.areas.count) parts.push(t('{n, plural, one {# drawn area} other {# drawn areas}}', { n: s.areas.count }));
  return listOf(parts, t);
}

/** Replay moves what it records with its clock; live-only layers wait for LIVE. */
function replayBody(s: ShowingState, t: Translate) {
  const recorded = drawnPhrase(s, t);
  return recorded
    ? upper(t('{layers} as recorded.', { layers: recorded }), t)
    : t('Nothing on the map. Turn on ships or aircraft in Layers to replay them.');
}

const pausedNote = (n: number, t: Translate) => (n
  ? ` ${t('{n, plural, one {Your # live layer is paused until you go back to live.} other {Your # live layers are paused until you go back to live.}}', { n })}`
  : '');

function historyBody(s: ShowingState, t: Translate) {
  const families = Object.keys(HISTORY_FAMILIES).filter(f => s.families.includes(f)).map(f => lower(t(FAMILY_TEXT[f]?.name ?? HISTORY_FAMILIES[f].label), t));
  const events = families.length ? listOf(families, t) : null;
  let main: string | null = null;
  if (s.borders === WORLD_BORDERS.code) {
    const y = s.time === null ? LAST_YEAR : clockYear(s.time);
    main = y < FIRST_YEAR ? t('No world borders this far back') : t('World borders of {year}', { year: clockYearLabel(Math.min(y, LAST_YEAR), t) });
  } else if (s.borders) {
    const war = WAR_LAYERS.find(w => w.code === s.borders);
    main = war ? t('{war} borders', { war: t(war.label) }) : t('Wartime borders');
  } else if (s.colouring) {
    main = t('Countries coloured by {indicator}', { indicator: lower(t(s.colouring.name), t) });
  }
  if (main && events) return t('{main}, with {events} around that date.', { main, events });
  if (events) return upper(t('{events} around that date.', { events }), t);
  if (main) return upper(t('{text}.', { text: main }), t);
  return t('Nothing from the past is on yet. Turn on events or borders in History.');
}

/** One or two plain sentences on what the map shows: the mode and time first, then what is drawn. */
export function summaryFor(s: ShowingState, t: Translate = ENGLISH): { title: string; body: string } {
  if (s.mode === 'deep') {
    const ma = s.ma ?? 0;
    const period = t(periodAt(ma).name);
    const body = s.chapter
      ? t('{chapter}. The continents as they stood in the {period}.', { chapter: t(s.chapter), period })
      : t('The continents as they stood in the {period}.', { period });
    return { title: `${t('Deep time')} · ${longMa(ma, t)}`, body: `${body}${pausedNote(s.paused, t)}` };
  }
  if (s.mode === 'history') {
    const time = s.time ?? 0;
    return { title: `${t('History')} · ${longDate(time, t)}${s.projected ? ` · ${t('projected')}` : ''}`, body: `${historyBody(s, t)}${pausedNote(s.paused, t)}` };
  }
  if (s.mode === 'replay') {
    const time = s.time ?? 0;
    const d = new Date(time);
    const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    return { title: `${t('Replay')} · ${formatTime(time, Number.POSITIVE_INFINITY, t)}, ${hm} UTC`, body: `${replayBody(s, t)}${pausedNote(s.paused, t)}` };
  }
  const drawn = drawnPhrase(s, t);
  return { title: t('Live'), body: drawn ? upper(t('{text}.', { text: drawn }), t) : t('Nothing on the map yet. Turn layers on in Layers.') };
}

import type { AnalyticsEngagement, EngagementEntry } from '../analytics-types';
import { count, minutes, pct, plural, sum } from './format';

/**
 * What the Engagement tab leads with: a few plain statements worked out from the range's numbers, most telling first,
 * each pointing at the card that backs it. Shares wait for enough people; counts speak sooner.
 */

/** Element ids of the Engagement tab's cards. */
export type FindingTarget = 'engagement-funnel' | 'engagement-stay' | 'engagement-entries' | 'engagement-use';
/** The tabs of the "What people use" card. */
export type UseTab = 'actions' | 'panels' | 'layers' | 'sections' | 'views';
export interface Finding { id: string; value: string; text: string; target: FindingTarget; tab?: UseTab }

/** Fewer people on the map than this and a share says more about chance than about the site. */
export const MIN_PEOPLE = 20;
/** Landings in one section before saying where they lead. */
export const MIN_LANDINGS = 15;
/** Share of the map's people an action reaches before it counts as a draw. */
export const MIN_REACH = 0.05;
export const MIN_SEARCHES = 10;
export const MIN_SIGN_UP_OPENS = 5;
/** Panel minutes before saying how many had none open, and the share worth saying. */
export const MIN_PANEL_MINUTES = 60;
export const NO_PANEL_SHARE = 0.6;
/** A section sending this share of its landings to the map is a doorway; this little, a dead end. */
export const DOORWAY = 0.2;
export const DEAD_END = 0.05;
/** Picks per search below this is a search that isn't finding things. */
export const POOR_PICKS = 0.25;
export const MAX_FINDINGS = 6;

/** What people go to the map for, as a phrase after "people on the map …". */
const DRAWS: Record<string, string> = {
  'camera.open': 'opened a camera',
  'feed.open': 'opened a live feed',
  'history.open': 'opened History',
  'space.enter': 'went out to space',
  'replay.start': 'started a replay',
  'alert.open': 'opened an alert',
  'ti.ask': 'asked TI',
  'route.plan': 'planned a route',
  'area.draw': 'drew an area',
  'dossier.open': 'opened a region dossier',
  'arcgis.add': 'added an ArcGIS layer',
};

/** '/city' → '/city pages'; the map itself by name. */
const sectionName = (section: string) => (section === '/' ? 'The map' : `${section} pages`);

/** Minutes begun, as a stay: one begun is under a minute. */
const stay = (n: number) => (n <= 1 ? 'under a minute' : minutes(n));

type Scored = Finding & { weight: number };

export function engagementFindings(e: AnalyticsEngagement): Finding[] {
  const out: Scored[] = [];
  const add = (weight: number, f: Finding) => out.push({ ...f, weight });
  const { people, leftWithinMinute, medianMinutes } = e.totals;
  const enough = people >= MIN_PEOPLE;

  if (enough) {
    add(90, {
      id: 'stay', value: pct(leftWithinMinute, people), target: 'engagement-stay',
      text: `left the map within a minute; the median person stayed ${stay(medianMinutes ?? 0)}`,
    });
    add(66, {
      id: 'came-back', value: pct(e.funnel.cameBack, people), target: 'engagement-funnel',
      text: `came back another day: ${count(e.funnel.cameBack)} of ${count(people)}`,
    });

    const draws = e.actions
      .filter(a => a.action in DRAWS && a.people / people >= MIN_REACH)
      .sort((a, b) => b.people - a.people || b.count - a.count)
      .slice(0, 2);
    draws.forEach((a, i) => add(i ? 58 : 80, {
      id: `draw-${a.action}`, value: pct(a.people, people), target: 'engagement-use', tab: 'actions',
      text: `of people on the map ${DRAWS[a.action]}, ${plural(a.count, 'time')} in all`,
    }));

    const panels = e.features.filter(f => f.feature.startsWith('panel:'));
    const panelMinutes = sum(panels.map(f => f.minutes));
    const none = panels.find(f => f.feature === 'panel:none')?.minutes ?? 0;
    if (panelMinutes >= MIN_PANEL_MINUTES && none / panelMinutes >= NO_PANEL_SHARE) {
      add(52, { id: 'no-panel', value: pct(none, panelMinutes), target: 'engagement-use', tab: 'panels', text: 'of map minutes had no panel open' });
    }
  }

  const sections = e.entries.sections.filter(s => s.page !== '/' && s.people >= MIN_LANDINGS);
  const rate = (s: EngagementEntry) => s.openedMap / s.people;
  const doorway = [...sections].filter(s => rate(s) >= DOORWAY).sort((a, b) => b.openedMap - a.openedMap || rate(b) - rate(a))[0];
  if (doorway) {
    add(72, {
      id: 'doorway', value: pct(doorway.openedMap, doorway.people), target: 'engagement-entries',
      text: `of the ${count(doorway.people)} who came in on ${sectionName(doorway.page)} went on to the map${doorway.medianMapMinutes ? ` (median ${stay(doorway.medianMapMinutes)} there)` : ''}`,
    });
  }
  const deadEnd = sections.filter(s => rate(s) <= DEAD_END).sort((a, b) => b.people - a.people)[0];
  if (deadEnd) {
    add(56, {
      id: 'dead-end', value: pct(deadEnd.openedMap, deadEnd.people), target: 'engagement-entries',
      text: `of the ${count(deadEnd.people)} who came in on ${sectionName(deadEnd.page)} opened the map`,
    });
  }

  const wall = e.features.find(f => f.feature === 'view:wall');
  if (wall?.people) {
    add(60, {
      id: 'wall', value: count(wall.people), target: 'engagement-funnel',
      text: wall.people === 1
        ? `person sat on the time-limit wall for ${minutes(wall.medianMinutes ?? wall.minutes)}`
        : `people sat on the time-limit wall, about ${minutes(wall.medianMinutes ?? 0)} each`,
    });
  }

  const runs = e.actions.find(a => a.action === 'search.run')?.count ?? 0;
  const picks = e.actions.find(a => a.action === 'search.pick')?.count ?? 0;
  if (runs >= MIN_SEARCHES) {
    add(picks / runs < POOR_PICKS ? 62 : 44, {
      id: 'search', value: pct(picks, runs), target: 'engagement-use', tab: 'actions',
      text: `of ${count(runs)} searches ended on a result (${plural(picks, 'pick')})`,
    });
  }

  if (e.funnel.signUpOpened >= MIN_SIGN_UP_OPENS) {
    add(48, {
      id: 'sign-up', value: count(e.funnel.signUpOpened), target: 'engagement-funnel',
      text: `people opened sign-up; ${plural(e.funnel.signedUp, 'account')} made in the range`,
    });
  }

  const ranked: Finding[] = out.sort((a, b) => b.weight - a.weight).slice(0, enough ? MAX_FINDINGS : MAX_FINDINGS - 1)
    .map(({ id, value, text, target, tab }) => ({ id, value, text, target, ...(tab ? { tab } : {}) }));
  if (enough) return ranked;
  return [{
    id: 'thin', value: count(people), target: 'engagement-stay',
    text: people
      ? `${people === 1 ? 'person' : 'people'} on the map in this range: too few yet to say what draws them (shares start at ${MIN_PEOPLE})`
      : 'No one has used the map in this range yet',
  }, ...ranked];
}

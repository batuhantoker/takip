import { describe, expect, it } from 'vitest';
import type { ActionUse, AnalyticsEngagement, EngagementEntry, FeatureUse } from '../analytics-types';
import { engagementFindings, MAX_FINDINGS } from './engagement-findings';

const feature = (feature: string, people: number, minutes: number, medianMinutes: number | null = null, more: Partial<FeatureUse> = {}): FeatureUse =>
  ({ feature, people, visitors: people, users: 0, minutes, medianMinutes, ...more });
const action = (name: string, people: number, count = people): ActionUse =>
  ({ action: name, people, visitors: people, users: 0, count, medianUses: count / people });
const entry = (page: string, people: number, openedMap: number, medianMapMinutes: number | null = null): EngagementEntry => ({ page, people, openedMap, medianMapMinutes });

/** The week of 2026-10-19 on takip.dev, admins left out: 293 browsers and 9 accounts on the map. */
function prod(over: Partial<AnalyticsEngagement> = {}): AnalyticsEngagement {
  return {
    today: '2026-10-26', since: '2026-10-01', days: 7, viewsSince: '2026-10-15',
    totals: { people: 302, visitors: 293, accounts: 9, minutes: 1394, medianMinutes: 2, leftWithinMinute: 122 },
    funnel: { arrived: 640, openedMap: 302, stayed: 120, cameBack: 7, signUpOpened: 31, signedUp: 15 },
    length: [], daily: [], hours: [], topUsers: [],
    entries: {
      sections: [entry('/city', 269, 124, 6), entry('/', 120, 118, 3), entry('/map', 63, 35, 4), entry('/compare', 36, 1, 2), entry('/country', 29, 6, 3), entry('/event', 13, 0)],
      pages: [],
    },
    features: [
      feature('view:map', 287, 1300, 2), feature('view:history', 33, 60), feature('view:space', 25, 40), feature('view:wall', 4, 94, 23),
      feature('panel:none', 290, 965), feature('panel:layers', 28, 120), feature('panel:history', 19, 60), feature('panel:space', 14, 32),
      feature('window:camera', 42, 70), feature('layer:alpr', 44, 90, 2, { arrivedOn: 38 }), feature('layer:military', 20, 50, 2, { arrivedOn: 3 }),
    ],
    actions: [
      action('camera.open', 80, 398), action('history.open', 47), action('space.enter', 39, 104), action('basemap.change', 36), action('account.sign_up_open', 31),
      action('layer.on', 30, 251), action('space.focus', 22), action('search.run', 21, 150), action('search.pick', 17, 28), action('history.jump', 9), action('replay.start', 6),
    ],
    ...over,
  };
}

const thin = (over: Partial<AnalyticsEngagement> = {}) => prod({
  totals: { people: 8, visitors: 7, accounts: 1, minutes: 30, medianMinutes: 1, leftWithinMinute: 4 },
  funnel: { arrived: 40, openedMap: 8, stayed: 2, cameBack: 1, signUpOpened: 2, signedUp: 1 },
  entries: { sections: [entry('/city', 12, 3), entry('/', 6, 6)], pages: [] },
  features: [feature('view:map', 8, 30, 1), feature('panel:none', 8, 25), feature('panel:layers', 2, 5), feature('view:wall', 1, 9, 9)],
  actions: [action('camera.open', 3, 5), action('search.run', 2, 3)],
  ...over,
});

describe('engagement findings', () => {
  it('ranks what a week of real traffic says, stay first, each pointing at its card', () => {
    const found = engagementFindings(prod());
    expect(found).toHaveLength(MAX_FINDINGS);
    expect(found.map(f => [f.id, f.value, f.target])).toEqual([
      ['stay', '40%', 'engagement-stay'],
      ['draw-camera.open', '26%', 'engagement-use'],
      ['doorway', '46%', 'engagement-entries'],
      ['came-back', '2%', 'engagement-funnel'],
      ['search', '19%', 'engagement-use'],
      ['wall', '4', 'engagement-funnel'],
    ]);
    const text = Object.fromEntries(found.map(f => [f.id, f.text]));
    expect(text.stay).toBe('left the map within a minute; the median person stayed 2 min');
    expect(text['draw-camera.open']).toBe('of people on the map opened a camera, 398 times in all');
    expect(text.doorway).toBe('of the 269 who came in on /city pages went on to the map (median 6 min there)');
    expect(text['came-back']).toBe('came back another day: 7 of 302');
    expect(text.search).toBe('of 150 searches ended on a result (28 picks)');
    expect(text.wall).toBe('people sat on the time-limit wall, about 23 min each');
    expect(found.find(f => f.id === 'draw-camera.open')?.tab).toBe('actions');
  });

  it('keeps the quieter findings for when the louder ones are missing', () => {
    const found = engagementFindings(prod({ actions: [], features: prod().features.filter(f => f.feature !== 'view:wall') }));
    expect(found.map(f => f.id)).toEqual(['stay', 'doorway', 'came-back', 'dead-end', 'no-panel', 'sign-up']);
    expect(found.find(f => f.id === 'dead-end')).toMatchObject({ value: '3%', text: 'of the 36 who came in on /compare pages opened the map' });
    expect(found.find(f => f.id === 'no-panel')).toMatchObject({ value: '82%', text: 'of map minutes had no panel open', tab: 'panels' });
  });

  it('ranks a search that finds things low, and counts sign-ups once enough opened it', () => {
    const found = engagementFindings(prod({
      actions: [action('search.run', 30, 100), action('search.pick', 25, 60), action('account.sign_up_open', 31)],
      entries: { sections: [], pages: [] },
      features: [],
    }));
    expect(found.map(f => f.id)).toEqual(['stay', 'came-back', 'sign-up', 'search']);
    expect(found.find(f => f.id === 'sign-up')?.text).toBe('people opened sign-up; 15 accounts made in the range');
  });

  it('says there are too few people yet instead of turning eight into shares', () => {
    const found = engagementFindings(thin());
    expect(found.map(f => f.id)).toEqual(['thin', 'wall']);
    expect(found[0]).toMatchObject({ value: '8', text: 'people on the map in this range: too few yet to say what draws them (shares start at 20)' });
    expect(found[1].text).toBe('person sat on the time-limit wall for 9 min');
    expect(found.some(f => f.value.endsWith('%'))).toBe(false);
  });

  it('says so when nobody has used the map', () => {
    const found = engagementFindings(thin({
      totals: { people: 0, visitors: 0, accounts: 0, minutes: 0, medianMinutes: null, leftWithinMinute: 0 },
      entries: { sections: [], pages: [] }, features: [], actions: [],
    }));
    expect(found).toEqual([{ id: 'thin', value: '0', text: 'No one has used the map in this range yet', target: 'engagement-stay' }]);
  });
});

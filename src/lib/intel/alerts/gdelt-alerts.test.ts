import { describe, expect, it } from 'vitest';
import { pickHeadline, toStory } from './gdelt-alerts';

const event = {
  id: '1328901399',
  lat: 41.08, lng: -81.52,
  name: 'Ohio, United States',
  family: 'violence',
  precision: 'region',
  action: 'Fought',
  actor1: 'POLICE', actor2: 'OHIO',
  goldstein: -10, tone: -11.76,
  reports: 2, outlets: 2, articles: 8,
  url: 'https://13wham.com/news/nation-world/police-man-shoots',
  links: [
    { url: 'https://13wham.com/news/nation-world/police-man-shoots', outlet: '13wham.com', title: 'police man shoots kills year old woman ohio gym' },
    { url: 'javascript:alert(1)', outlet: 'bad', title: 'x' },
  ],
  others: [{ url: 'https://www.cleveland19.com/2026/10/20/stabbing/', outlet: 'cleveland19.com', title: 'Year old fatally stabbed stark county', reports: 3 }],
  first_seen: '2026-10-20T14:30:00.000Z',
  last_seen: '2026-10-20T15:15:00.000Z',
};

describe('toStory', () => {
  it('turns a GDELT story into an alert headed by its lead article', () => {
    const s = toStory(event, Date.parse('2026-10-20T16:00:00Z'))!;
    expect(s).toMatchObject({
      kind: 'story',
      id: 'gdelt:1328901399',
      ts: Date.parse('2026-10-20T14:30:00.000Z'),
      last: Date.parse('2026-10-20T15:15:00.000Z'),
      title: 'Police man shoots kills year old woman ohio gym',
      family: 'violence',
      precision: 'region',
      actors: ['POLICE', 'OHIO'],
      reports: 2,
      outlets: 2,
      link: 'https://13wham.com/news/nation-world/police-man-shoots',
    });
    expect(s.links).toHaveLength(1);
    expect(s.others[0].reports).toBe(3);
    expect(s.haystack).toContain('ohio');
    expect(s.haystack).toContain('gdelt');
  });

  it('prefers the headline the server read from the page', () => {
    expect(toStory({ ...event, headline: 'Police shoot man at Akron gym' })!.title).toBe('Police shoot man at Akron gym');
  });

  it('keeps a window stamped ahead of the clock out of the future', () => {
    const now = Date.parse('2026-10-20T15:10:00Z');
    const s = toStory(event, now)!;
    expect(s.last).toBe(now);
    expect(toStory({ ...event, first_seen: '2026-10-20T15:15:00Z' }, now)!.ts).toBe(now);
  });

  it('falls back to the actors and verb when no link has a headline', () => {
    const s = toStory({ ...event, links: [{ url: 'https://example.com/123', outlet: 'example.com', title: null }] })!;
    expect(s.title).toBe('POLICE → OHIO · Fought');
  });

  it('drops a story without a place, a time or a known family', () => {
    expect(toStory({ ...event, lat: null })).toBeNull();
    expect(toStory({ ...event, last_seen: 'soon' })).toBeNull();
    expect(toStory({ ...event, family: 'gossip' })).toBeNull();
    expect(toStory(null)).toBeNull();
  });
});

describe('pickHeadline', () => {
  it('takes the page headline unless the slug spells a non-Latin one in English', () => {
    expect(pickHeadline('uk deploy typhoon fighter jets', 'UK to deploy Typhoon jets to Saudi Arabia')).toBe('UK to deploy Typhoon jets to Saudi Arabia');
    expect(pickHeadline('uk deploy typhoon fighter jets', 'अब ब्रिटेन सऊदी की मदद करेगा')).toBeNull();
    expect(pickHeadline(null, 'Росія відповіла')).toBe('Росія відповіла');
    expect(pickHeadline('anything', null)).toBeNull();
  });
});

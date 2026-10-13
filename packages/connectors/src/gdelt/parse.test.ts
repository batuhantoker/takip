import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gdeltStamp, parseEvents, parseMentions } from './parse';

// 35 verbatim rows from 20261013004500.export.CSV.
const EXPORT = readFileSync(new URL('./fixtures/export.tsv', import.meta.url), 'utf8');

// Verbatim rows from 20261013004500.mentions.CSV.
const MENTIONS = [
  '1327618528\t20261013004500\t20261013004500\t1\tpjmedia.com\thttps://pjmedia.com/aaron-hanscom/2026/10/12/who-does-morocco-want-to-win-spains-election-n4958238\t4\t715\t810\t768\t1\t100\t5330\t-2.19399538106235\t\t',
  '1327618529\t20261013004500\t20261013004500\t1\tcecildaily.com\thttp://www.cecildaily.com/ap/world/congos-former-president-kabila-launches-an-anti-government-front-including-m23-rebels/article_02181302-1e32-51c2-b227-cbeb4865b13b.html\t6\t1720\t1817\t1840\t0\t20\t3606\t-5.64102564102564\t\t',
].join('\n');

const WINDOW = Date.UTC(2026, 9, 13, 0, 45);

describe('parseEvents', () => {
  const rows = parseEvents(EXPORT);

  it('reads every row of the export', () => {
    expect(rows).toHaveLength(35);
  });

  it('maps the columns it keeps', () => {
    expect(rows.find(r => r.id === '1327618529')).toEqual({
      id: '1327618529', day: '20251013', added: WINDOW,
      actor1: 'GOMA', actor2: 'CONGO', isRoot: true,
      code: '180', rootCode: '18', quad: 4, goldstein: -9,
      mentions: 2, sources: 1, articles: 2, tone: -5.64102564102564,
      geoType: 4, place: 'Kivu, Sud, Rwanda', country: 'RW', adm1: 'RW15',
      lat: -2.631, lng: 29.5048, featureId: '10482168',
      url: 'http://www.cecildaily.com/ap/world/congos-former-president-kabila-launches-an-anti-government-front-including-m23-rebels/article_02181302-1e32-51c2-b227-cbeb4865b13b.html',
    });
  });

  it('leaves coordinates NaN for an unplaced event', () => {
    const r = rows.find(r => r.id === '1327618598')!;
    expect(r.geoType).toBe(0);
    expect(r.lat).toBeNaN();
  });

  it('skips truncated lines and tolerates CRLF', () => {
    const [first, second] = EXPORT.split('\n');
    expect(parseEvents(`${first}\r\n${second.slice(0, 80)}\n`)).toHaveLength(1);
  });
});

describe('parseMentions', () => {
  it('maps the columns it keeps', () => {
    const [m] = parseMentions(MENTIONS);
    expect(m).toEqual({
      eventId: '1327618528', eventAdded: WINDOW, at: WINDOW, type: 1, source: 'pjmedia.com',
      url: 'https://pjmedia.com/aaron-hanscom/2026/10/12/who-does-morocco-want-to-win-spains-election-n4958238',
      confidence: 100, tone: -2.19399538106235,
    });
    expect(parseMentions(MENTIONS)).toHaveLength(2);
  });
});

describe('gdeltStamp', () => {
  it('rejects anything but 14 digits', () => {
    expect(gdeltStamp('20261013004500')).toBe(WINDOW);
    expect(gdeltStamp('20261013')).toBeNaN();
  });
});

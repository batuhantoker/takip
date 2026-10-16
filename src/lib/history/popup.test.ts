import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { formatAt, gtdIdDay, gtdRelatedLine, type HistoryDetail, historyPopupHtml, RELATED_SHOWN, shownIds } from './popup';

const s = (iso: string) => Date.parse(iso) / 1000;

describe('history popup', () => {
  it('writes a time at its precision, BCE included', () => {
    expect(formatAt(s('1916-07-01'), Prec.day)).toBe('1 Jul 1916');
    expect(formatAt(s('1916-07-01'), Prec.month)).toBe('Jul 1916');
    expect(formatAt(s('1916-07-01'), Prec.year)).toBe('1916');
    expect(formatAt(s('1916-07-01'), Prec.decade)).toBe('1910s');
    expect(formatAt(s('1916-07-01'), Prec.century)).toBe('20th century');
    const bce = new Date(0);
    bce.setUTCFullYear(-499, 0, 1);
    expect(formatAt(bce.getTime() / 1000, Prec.year)).toBe('500 BCE');
  });

  it('leaves out a magnitude the map feature dropped, and escapes text', () => {
    const p = { id: 1, kind: 'battle', family: 'conflict', title: '<b>Somme</b>', t0: s('1916-07-01'), t1: s('1916-07-02'), prec: Prec.day, ongoing: 0, geoPrec: 1 };
    const html = historyPopupHtml(p, { ...p, tStart: p.t0, tEnd: s('1916-11-18'), endPrec: Prec.day, attrs: { outcome: 'Inconclusive', url: 'javascript:alert(1)' } });
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('DEATHS');
    expect(html).toContain('&lt;b&gt;Somme&lt;/b&gt;');
    expect(html).toContain('1 Jul 1916 – 18 Nov 1916');
    expect(html).toContain('Inconclusive');
    expect(html).not.toContain('javascript:');
  });

  it('shows quake magnitude to one decimal and links the source page', () => {
    const p = { id: 2, kind: 'hazard.quake', family: 'hazard', title: 'M 6.1 - Crete', t0: s('2026-10-01'), t1: s('2026-10-01'), prec: Prec.second, ongoing: 0, geoPrec: 1, magnitude: 6.12 };
    const html = historyPopupHtml(p, { ...p, tStart: p.t0, tEnd: null, endPrec: null, attrs: { url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd' } });
    expect(html).toContain('6.1');
    expect(html).toContain('href="https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd"');
  });

  it('links the stored Wikipedia article at once, and never as a second source page', () => {
    const p = { id: 3, kind: 'war.interstate', family: 'conflict', title: 'Cenepa Valley', t0: s('1995-01-26'), t1: s('1995-02-28'), prec: Prec.day, ongoing: 0, geoPrec: 4 };
    const d = { ...p, tStart: p.t0, tEnd: p.t1, endPrec: Prec.day, attrs: { wiki: 'Cenepa War' } };
    const html = historyPopupHtml(p, d);
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Cenepa_War"');
    expect(html).not.toContain('Source page');
    const battle = { ...d, attrs: { url: 'https://en.wikipedia.org/wiki/Battle_of_Turckheim' } };
    expect(historyPopupHtml(p, battle)).toContain('href="https://en.wikipedia.org/wiki/Battle_of_Turckheim"');
    expect(historyPopupHtml(p, battle)).not.toContain('Source page');
    const wiki = { title: 'Cenepa War', description: '1995 war', extract: 'The Cenepa War was a brief armed conflict between Ecuador and Peru.', image: null, url: 'https://en.wikipedia.org/wiki/Cenepa_War', ref: 'Cenepa War', lang: 'en', languages: [] };
    expect(historyPopupHtml(p, d, { wiki })).toContain('The Cenepa War was a brief armed conflict');
    expect(historyPopupHtml(p, d, { wiki })).not.toContain('data-history-lang');
  });

  it('shows the stored article in its language, with no picker', () => {
    const p = { id: 6, kind: 'battle', family: 'conflict', title: 'Batalla de Lleida', t0: s('1644-05-15'), t1: s('1644-05-15'), prec: Prec.day, ongoing: 0, geoPrec: 1 };
    const d = { ...p, tStart: p.t0, tEnd: null, endPrec: null, attrs: { wiki: 'fr:Bataille de Lérida (1644)' } };
    const wiki = {
      title: 'Bataille de Lérida (1644)', description: null, extract: 'La bataille de Lérida…', image: null, url: 'https://fr.wikipedia.org/wiki/Bataille_de_L%C3%A9rida_(1644)',
      ref: 'fr:Bataille de Lérida (1644)', lang: 'fr', languages: [{ lang: 'ca', title: 'Batalla de Lleida (1644)' }, { lang: 'en', title: 'Battle of Lleida (1644)' }],
    };
    const html = historyPopupHtml(p, d, { wiki });
    expect(html).toContain('La bataille de Lérida');
    expect(html).not.toContain('<select');
    expect(html).toContain('From French Wikipedia');
  });

  it('links an article in another Wikipedia under its language', () => {
    const p = { id: 5, kind: 'conflict.armed', family: 'conflict', title: 'Comoros: Anjouan', t0: s('1997-01-01'), t1: s('1998-01-01'), prec: Prec.year, ongoing: 0, geoPrec: 3 };
    const html = historyPopupHtml(p, { ...p, tStart: p.t0, tEnd: null, endPrec: null, attrs: { wiki: 'fr:Crise séparatiste des Comores' } });
    expect(html).toContain('href="https://fr.wikipedia.org/wiki/Crise_s%C3%A9paratiste_des_Comores"');
    expect(html).toContain('French Wikipedia');
  });

  it('says how an event was placed, preferring the importer’s own note', () => {
    const p = { id: 4, kind: 'conflict.armed', family: 'conflict', title: 'India: Kashmir', t0: s('1989-01-01'), t1: s('2025-01-01'), prec: Prec.year, ongoing: 0, geoPrec: 4 };
    const d = { ...p, tStart: p.t0, tEnd: p.t1, endPrec: Prec.year, attrs: {} };
    expect(historyPopupHtml(p, d)).toContain('Placed approximately by the source.');
    const placed = historyPopupHtml({ ...p, geoPrec: 3 }, { ...d, geoPrec: 3, attrs: { placed_at: 'middle of its 7,274 recorded clashes (UCDP GED)' } });
    expect(placed).toContain('Placed at the middle of its 7,274 recorded clashes (UCDP GED).');
    expect(placed).not.toContain('Placed at the area');
    expect(placed).not.toContain('Placed at:');
  });

  it('lists the war a battle is part of and what a war includes, loading the first few of each', () => {
    const war = { id: 7, kind: 'war.interstate', family: 'conflict', title: 'Gulf War', t0: s('1990-08-02'), t1: s('1991-02-28'), prec: Prec.day, ongoing: 0, geoPrec: 4 };
    const battles = Array.from({ length: 12 }, (_, i) => ({ rel: 'part_of', otherId: 100 + i, direction: 'in' as const, confidence: 1 }));
    const d: HistoryDetail = { ...war, tStart: war.t0, tEnd: war.t1, endPrec: Prec.day, attrs: {}, relations: [...battles, { rel: 'part_of', otherId: 9, direction: 'out', confidence: 1 }] };
    expect(shownIds(d)).toEqual([9, ...battles.slice(0, RELATED_SHOWN).map(b => b.otherId)]);
    const loaded = [{ ...war, id: 9, title: 'Gulf crisis', tStart: war.t0, tEnd: null, endPrec: null, attrs: {} }, { ...war, id: 101, kind: 'battle', title: 'Battle of Khafji', tStart: s('1991-01-29'), tEnd: null, endPrec: null, attrs: {} }];
    const html = historyPopupHtml(war, d, { related: loaded });
    expect(html).toContain('Part of</div>');
    expect(html).toContain('Gulf crisis');
    expect(html).toContain('Includes · 12');
    expect(html).toContain('Battle of Khafji');
    expect(html).toContain('and 11 more');
    expect(historyPopupHtml(war, d, {})).toContain('Loading…');
  });

  it('offers Pin only when asked, and leaves the kicker to the window once pinned', () => {
    const p = { id: 9, kind: 'conflict.rebellion', family: 'conflict', title: 'Kuomintang Islamic insurgency', t0: s('1950-01-01'), t1: s('1958-01-01'), prec: Prec.year, ongoing: 0, geoPrec: 3 };
    expect(historyPopupHtml(p)).not.toContain('data-pop-pin');
    expect(historyPopupHtml(p, undefined, {}, { pin: true })).toContain('data-pop-pin');
    const windowed = historyPopupHtml(p, undefined, {}, { windowed: true });
    expect(windowed).not.toContain('tk-pop-kicker');
    expect(windowed).toContain('Kuomintang Islamic insurgency');
  });

  it('reads the day out of a GTD eventid', () => {
    expect(gtdIdDay('200109110006')).toBe('11 Sep 2001');
    expect(gtdIdDay('197000000001')).toBe('1970');
    expect(gtdIdDay('197002000003')).toBe('Feb 1970');
    expect(gtdIdDay('1986122100120')).toBeNull();
    expect(gtdRelatedLine('200109110006, 200109110004, 200109110005, 200109110007')).toBe('4 attacks on 11 Sep 2001');
    expect(gtdRelatedLine('197002080001, 197002080002, 197002090003')).toBe('3 attacks from 8 Feb 1970 to 9 Feb 1970');
    expect(gtdRelatedLine('197002080001')).toBeNull();
  });

  describe('a GTD attack', () => {
    const p = { id: 75588, kind: 'attack.terror', family: 'terror', title: 'Hijacking — Arlington', t0: s('2001-09-11'), t1: s('2001-09-12'), prec: Prec.day, ongoing: 0, geoPrec: 1, magnitude: 190 };
    const summary = `09/11/2001: This was one of four related attacks that occurred in the United States. ${'In the third of these attacks, American Airlines Flight 77 crashed into the Pentagon. '.repeat(4)}The end.`;
    const d: HistoryDetail = {
      ...p, tStart: p.t0, tEnd: null, endPrec: null,
      attrs: {
        related: '200109110006, 200109110004, 200109110005, 200109110007', region: 'North America', provstate: 'Virginia', city: 'Arlington',
        summary, success: 1, suicide: 1, nwound: 106, attack: ['Hijacking', 'Armed Assault'], claimed: 1, claimmode: ['Video'],
        targets: [{ type: 'Military', target: 'The Pentagon' }, { type: 'Military' }],
        weapons: [{ type: 'Vehicle (not to include vehicle-borne explosives, i.e., car or truck bombs)' }, { type: 'Melee' }],
      },
      relations: [{ rel: 'related', otherId: 75586, direction: 'in', confidence: 1 }, { rel: 'related', otherId: 75587, direction: 'in', confidence: 1 }],
    };
    const other = (id: number, title: string, killed: number): HistoryDetail => ({ ...p, id, title, magnitude: killed, tStart: p.t0, tEnd: null, endPrec: null, attrs: {} });

    it('words its coded columns', () => {
      const html = historyPopupHtml(p, d);
      expect(html).toContain('Arlington, Virginia, North America');
      expect(html).toContain('Carried out');
      expect(html).toContain('Suicide attack');
      expect(html).toContain('Vehicle, Melee');
      expect(html).toContain('Yes, video');
      expect(html).not.toContain('Provstate');
      expect(html).not.toContain('>1<');
    });

    it('folds the summary behind Read more, without its date prefix', () => {
      const folded = historyPopupHtml(p, d);
      expect(folded).toContain('This was one of four');
      expect(folded).not.toContain('09/11/2001');
      expect(folded).not.toContain('The end.');
      expect(folded).toContain('data-history-more>Read more');
      const open = historyPopupHtml(p, d, { expanded: true });
      expect(open).toContain('The end.');
      expect(open).toContain('Show less');
    });

    it('lists related attacks by name and day once they load, and says the days before', () => {
      expect(historyPopupHtml(p, d)).toContain('Loading…');
      expect(historyPopupHtml(p, { ...d, relations: [] })).toContain('4 attacks on 11 Sep 2001');
      const html = historyPopupHtml(p, d, { related: [other(75587, 'Hijacking — New York City', 1383), other(75586, 'Hijacking — New York City', 1384)] });
      expect(html).toContain('Related attacks · 2');
      expect(html).toContain('data-history-event="75586"');
      expect(html.indexOf('75586')).toBeLessThan(html.indexOf('75587'));
      expect(html).toContain('11 Sep 2001 · 1,384 killed');
    });

    it('shows the Wikipedia article with its picture when one was found', () => {
      const wiki = { title: 'American Airlines Flight 77', description: '9/11 hijacked passenger flight', extract: '', image: { src: 'https://upload.wikimedia.org/a.jpg', width: 330, height: 238 }, url: 'https://en.wikipedia.org/wiki/American_Airlines_Flight_77', ref: 'American Airlines Flight 77', lang: 'en', languages: [] };
      const html = historyPopupHtml(p, d, { wiki });
      expect(html).toContain('src="https://upload.wikimedia.org/a.jpg"');
      expect(html).toContain('American Airlines Flight 77');
      expect(html).toContain('href="https://en.wikipedia.org/wiki/American_Airlines_Flight_77"');
      expect(historyPopupHtml(p, d, { wiki: null })).not.toContain('Wikipedia');
    });
  });
});

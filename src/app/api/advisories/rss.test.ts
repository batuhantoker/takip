import { describe, expect, it } from 'vitest';
import { decodeEntities, rssCategories, rssDate, rssItems, rssTag, rssTags, stripHtml } from './rss';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('C&#xF4;te d&#8217;Ivoire &amp; T&#xFC;rkiye &lt;br&gt;&nbsp;')).toBe('Côte d’Ivoire & Türkiye <br> ');
  });

  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&bogus; &#xZZ;')).toBe('&bogus; &#xZZ;');
  });
});

describe('rssTag', () => {
  const item = `<item>
    <title>Haut-U&#233;l&#233;</title>
    <description><![CDATA[Country List :  Colombia, Côte d'Ivoire &amp; more]]></description>
    <pubDate/>
    <ta:warnings><ta:level>4/5</ta:level><dc:description>Reconsider your need to travel</dc:description></ta:warnings>
  </item>`;

  it('decodes entities outside CDATA and keeps CDATA verbatim', () => {
    expect(rssTag(item, 'title')).toBe('Haut-Uélé');
    expect(rssTag(item, 'description')).toBe("Country List :  Colombia, Côte d'Ivoire &amp; more");
  });

  it('reads namespaced and self-closing tags, and does not confuse dc:description with description', () => {
    expect(rssTag(item, 'pubDate')).toBe('');
    expect(rssTag(rssTag(item, 'ta:warnings') ?? '', 'ta:level')).toBe('4/5');
    expect(rssTags(item, 'description')).toHaveLength(1);
    expect(rssTag(item, 'link')).toBeNull();
  });

  it('splits items and reads categories by domain', () => {
    const xml = `<rss><channel><item><category domain="Threat-Level">Level 3: Reconsider Travel</category>
      <category domain="Country-Tag">SA</category></item><item></item></channel></rss>`;
    const items = rssItems(xml);
    expect(items).toHaveLength(2);
    expect(rssCategories(items[0])).toEqual({ 'Threat-Level': 'Level 3: Reconsider Travel', 'Country-Tag': 'SA' });
  });
});

describe('stripHtml', () => {
  it('turns markup into one line of text', () => {
    expect(stripHtml("Reconsider travel<p><span style='white-space: initial;'>to </span><b>Saudi&nbsp;Arabia</b></p><br/>now"))
      .toBe('Reconsider travel to Saudi Arabia now');
  });
});

describe('rssDate', () => {
  it('keeps a date-only stamp as a date', () => {
    expect(rssDate('Mon, 12 Oct 2026')).toBe('2026-10-12');
  });

  it('applies Australian zone abbreviations', () => {
    expect(rssDate('01 Oct 2026 22:00:00 AEST')).toBe('2026-10-01T12:00:00.000Z');
    expect(rssDate('31 Mar 2026 23:00:00 AEDT')).toBe('2026-03-31T12:00:00.000Z');
  });

  it('reads GMT and numeric offsets', () => {
    expect(rssDate('Fri, 02 Oct 2026 04:00:00 GMT')).toBe('2026-10-02T04:00:00.000Z');
    expect(rssDate('Mon, 12 Oct 2026 17:36:21 +0200')).toBe('2026-10-12T15:36:21.000Z');
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(rssDate('')).toBeNull();
    expect(rssDate(null)).toBeNull();
    expect(rssDate('12 Foo 2026')).toBeNull();
    expect(rssDate('01 Oct 2026 22:00:00 XYZT')).toBeNull();
  });
});

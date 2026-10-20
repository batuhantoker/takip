import { describe, expect, it } from 'vitest';
import { LANGS } from './langs';
import { parsePage } from './parse';

const parse = (lang: string, title: string, text: string) => {
  const L = LANGS[lang];
  const pt = L.page(title);
  if (!pt) throw new Error(`not a year page: ${title}`);
  return parsePage(L, text, pt);
};
const brief = (r: ReturnType<typeof parse>) => r.bullets.map(b => ({ d: b.date, t: b.text, l: b.links, ...(b.ctx ? { c: b.ctx } : {}) }));

describe('English year pages', () => {
  const page = `{{Year nav|1683}}
== Events ==
=== January–March ===
* [[January 5]] &ndash; The [[Brandenburger Gold Coast|Brandenburger-African Company]] signs a treaty.<ref>x</ref>
* [[March 17]]–[[March 20|20]] – In a battle at [[Kalyan]] (near [[Mumbai|Bombay]]), Hambirrao defeats Ranamast Khan.
* c. [[March]] – A comet is seen.
=== July ===
* A fire burns in [[Newmarket, Suffolk]].
* [[September 12]]
** [[Battle of Vienna]]: the siege is lifted.
** Pope [[Innocent XI]] rejoices.
* [[December 30]] – [[January 2]], [[1684]]: Snow falls.
* 1681–1707 – [[Deccan wars]] continue.
=== Date unknown ===
* [[WWII]]:
** Unrelated.
== Births ==
* [[January 1]] – Someone`;

  it('dates bullets by day, range, month section and parent, and drops earlier spans', () => {
    const r = parse('en', '1683', page);
    expect(brief(r)).toEqual([
      { d: { y: 1683, m: 1, d: 5, prec: 'day' }, t: 'The Brandenburger-African Company signs a treaty.', l: ['Brandenburger Gold Coast'] },
      { d: { y: 1683, m: 3, d: 17, y2: 1683, m2: 3, d2: 20, prec: 'day' }, t: 'In a battle at Kalyan (near Bombay), Hambirrao defeats Ranamast Khan.', l: ['Kalyan', 'Mumbai'] },
      { d: { y: 1683, m: 3, prec: 'year', approx: true }, t: 'A comet is seen.', l: [] },
      { d: { y: 1683, m: 7, prec: 'month' }, t: 'A fire burns in Newmarket, Suffolk.', l: ['Newmarket, Suffolk'] },
      { d: { y: 1683, m: 9, d: 12, prec: 'day' }, t: 'Battle of Vienna: the siege is lifted.', l: ['Battle of Vienna'] },
      { d: { y: 1683, m: 9, d: 12, prec: 'day' }, t: 'Pope Innocent XI rejoices.', l: ['Innocent XI'] },
      { d: { y: 1683, m: 12, d: 30, y2: 1684, m2: 1, d2: 2, prec: 'day' }, t: 'Snow falls.', l: [] },
      { d: { y: 1683, prec: 'year' }, t: 'Unrelated.', l: [], c: ['WWII'] },
    ]);
    expect(r.skipped['span from an earlier year']).toBe(1);
  });

  it('reads BC decade pages by the year each bullet opens with', () => {
    const r = parse('en', '750s BC', '==Events and trends==\n* 756 BC—Founding of [[Cyzicus]].\n* c. 756 BC—Founding of [[Trabzon]].\n* Assyria declines.');
    expect(brief(r).map(b => [b.d.y, b.d.prec, b.d.approx ?? false])).toEqual([[-755, 'year', false], [-755, 'decade', true], [-758, 'decade', false]]);
  });

  it('dates a Current events day by its page and keeps the story lines as context', () => {
    const r = parse('en', 'Portal:Current events/2024 January 15', `{{Current events|year=2024|month=01|day=15|content=
<!-- All news items below this line -->
'''Armed conflicts and attacks'''
*[[Israel–Hamas war]]
**[[2024 Ra'anana attack]]
***A woman is killed in [[Ra'anana]]. [https://x (Haaretz)]
}}`);
    expect(brief(r)).toEqual([{ d: { y: 2024, m: 1, d: 15, prec: 'day' }, t: 'A woman is killed in Ra\'anana.', l: ["Ra'anana"], c: ["2024 Ra'anana attack", 'Israel–Hamas war'] }]);
    expect(r.bullets[0].sec).toEqual(['Armed conflicts and attacks']);
  });

  it('reads country pages and day-first dates', () => {
    const r = parse('en', '1990 in Turkey', '==Events==\n=== May ===\n* 1 May – May Day events result in 1,100 arrests.\n* Census held.');
    expect(brief(r).map(b => b.d)).toEqual([{ y: 1990, m: 5, d: 1, prec: 'day' }, { y: 1990, m: 5, prec: 'month' }]);
  });

  it('finds the events of a page laid out by region', () => {
    const r = parse('en', '1453', '== Africa ==\n* [[Cairo]] rises.\n== Births ==\n* x');
    expect(r.bullets.map(b => b.text)).toEqual(['Cairo rises.']);
  });
});

describe('other languages', () => {
  it.each([
    ['tr', '1683', '== Olaylar ==\n:* [[14 Temmuz]]-[[12 Eylül]] - [[II. Viyana Kuşatması]] başarısızlıkla sonuçlandı.', { y: 1683, m: 7, d: 14, y2: 1683, m2: 9, d2: 12, prec: 'day' }, 'II. Viyana Kuşatması başarısızlıkla sonuçlandı.'],
    ['de', '1683', '== Ereignisse ==\n=== Politik ===\n* 12. September: [[Schlacht am Kahlenberg]].', { y: 1683, m: 9, d: 12, prec: 'day' }, 'Schlacht am Kahlenberg.'],
    ['fr', '1683', '== Événements ==\n* {{1er janvier}}, [[Afrique occidentale]] : création de la colonie.', { y: 1683, m: 1, d: 1, prec: 'day' }, 'Afrique occidentale : création de la colonie.'],
    ['ru', '1683 год', '== События ==\n** [[31 октября]]—[[6 ноября]] — [[Осада Куртре (1683)|осада Куртре]].', { y: 1683, m: 10, d: 31, y2: 1683, m2: 11, d2: 6, prec: 'day' }, 'осада Куртре.'],
    ['es', '1683', '== Acontecimientos ==\n* [[12 de septiembre]]: [[Batalla de Viena|Segundo sitio de Viena]].', { y: 1683, m: 9, d: 12, prec: 'day' }, 'Segundo sitio de Viena.'],
    ['ar', '1683', '== أحداث ==\n* [[3 مايو]] - السلطان يجتاح بلغراد.', { y: 1683, m: 5, d: 3, prec: 'day' }, 'السلطان يجتاح بلغراد.'],
    ['fa', '۱۹۹۰', '== رویداد‌ها ==\n* [[۹ آوریل]] - رویداد.', { y: 1990, m: 4, d: 9, prec: 'day' }, 'رویداد.'],
    ['zh', '1683年', '== 大事记 ==\n* [[1月5日]] – 签订条约。', { y: 1683, m: 1, d: 5, prec: 'day' }, '签订条约。'],
    ['ja', '1683年', '== できごと ==\n* [[1月25日]]（天和2年[[12月28日 (旧暦)|12月28日]]） - [[江戸]]で火災', { y: 1683, m: 1, d: 25, prec: 'day' }, '江戸で火災'],
    ['ru', '500 год до н. э.', '== События ==\n* Восстание в [[Милет]]е.', { y: -499, prec: 'year' }, 'Восстание в Милете.'],
  ])('%s %s', (lang, title, text, date, out) => {
    const r = parse(lang, title, text);
    expect(r.bullets.map(b => [b.date, b.text])).toEqual([[date, out]]);
  });

  it('skips the years a war began before the page year (ru, tr)', () => {
    expect(parse('ru', '1683 год', '== События ==\n* [[1618 год|1618]]—1683 — закончилось завоевание.').skipped).toEqual({ 'span from an earlier year': 1 });
    const r = parse('tr', '1683', '== Olaylar ==\n* 1683-[[1699]]/[[1700]] - [[Kutsal İttifak Savaşları]] başladı.');
    expect(r.bullets.map(b => b.date)).toEqual([{ y: 1683, y2: 1699, prec: 'year' }]);
  });
});

describe('where the text puts it', () => {
  it.each([
    ['en', '1683', '== Events ==\n* [[March 22]] – Great fire in [[Newmarket, Suffolk]], forcing [[Charles II of England|King Charles]] to flee.', ['Newmarket, Suffolk']],
    ['de', '1956', '== Ereignisse ==\n* 22. November: Olympische Spiele in [[Melbourne]], [[Australien]]', ['Melbourne']],
    ['tr', '889', "== Olaylar ==\n* III. Guido, I. Berengar'ı [[Trebbia]] yakınlarında yendi, [[İzmir]]'de yangın çıktı. Sonra [[Roma]]'da taç giydi.", ['Trebbia', 'İzmir']],
    ['fr', '1698', '== Événements ==\n* octobre : [[Dresde]] : Patkul devient conseiller privé.', ['Dresde']],
    ['zh', '1683年', '== 大事记 ==\n* [[1月5日]] – 在[[威尼斯]]首演。', ['威尼斯']],
    ['ja', '1683年', '== できごと ==\n* [[1月25日]] - [[江戸]]で火災', ['江戸']],
  ])('%s', (lang, title, text, loc) => {
    expect(parse(lang, title, text).bullets[0].loc).toEqual(loc);
  });
});

import { describe, expect, it } from 'vitest';
import { heading, inline, logicalLines, normTitle, stripBlocks } from './wikitext';

const linked = (src: string, lang = 'en') => {
  const r = inline(src, lang);
  return { text: r.text, links: r.links.map(l => [l.title, r.text.slice(l.start, l.end)]) };
};

describe('inline', () => {
  it('renders links to their labels and records where they sit', () => {
    expect(linked("The [[Battle of Vienna|relief of Vienna]] ends the [[siege]]s of '''[[Vienna]]'''.")).toEqual({
      text: 'The relief of Vienna ends the sieges of Vienna.',
      links: [['Battle of Vienna', 'relief of Vienna'], ['Siege', 'sieges'], ['Vienna', 'Vienna']],
    });
  });

  it('drops files, categories and interwiki targets but keeps their visible text', () => {
    expect(linked('[[File:X.jpg|thumb|A [[Paris]] view]]Rome [[Category:1683]][[:en:Vulca|Vulca]] works')).toEqual({ text: 'Rome Vulca works', links: [] });
  });

  it('renders the templates year pages use and drops the rest', () => {
    expect(inline('{{circa}} 1683{{snd}}{{lang|fr|Paris}}{{citation needed|date=May 2020}} and {{ill|Gove|de|Gove}}', 'en').text).toBe('c. 1683 – Paris and Gove');
    expect(inline('{{1er janvier}}, [[Afrique occidentale]] : création', 'fr').text).toBe('1er janvier, Afrique occidentale : création');
    expect(inline('{{date+|7 mai}} : résistance', 'fr').text).toBe('7 mai : résistance');
  });

  it('keeps Cyrillic link trails and none in Arabic', () => {
    expect(inline('в [[Милет]]е', 'ru').text).toBe('в Милете');
    expect(linked('[[مصر]]ية', 'ar').links).toEqual([['مصر', 'مصر']]);
  });

  it('drops cited news sources and decodes entities', () => {
    expect(inline('Houthi strike [https://apnews.com/x (AP)] &ndash; [https://x.org the report]&nbsp;ok', 'en').text).toBe('Houthi strike – the report ok');
  });
});

describe('normTitle', () => {
  it('writes link targets as the wiki stores titles', () => {
    expect(normTitle('battle_of Vienna#Aftermath')).toBe('Battle of Vienna');
    expect(normTitle('#Notes')).toBeNull();
    expect(normTitle(':Treaty of Karlowitz')).toBe('Treaty of Karlowitz');
  });
});

describe('blocks and lines', () => {
  it('removes references and comments across lines and joins an open template', () => {
    const src = stripBlocks('* A<ref>{{cite web\n|url=x}}</ref> B<!-- note\n-->\n* C {{nowrap|\nD}}\n* E');
    expect(logicalLines(src)).toEqual(['* A B', '* C {{nowrap| D}}', '* E']);
  });

  it('reads headings', () => {
    expect(heading('=== [[January]]–March ===')).toEqual({ level: 3, text: 'January–March' });
    expect(heading('* not a heading')).toBeNull();
    expect(heading('== أحداث ===')).toEqual({ level: 2, text: 'أحداث' });
  });
});

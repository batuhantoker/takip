/* Wikitext to plain text with the links it made, for the bullet lines of year pages. Not a MediaWiki parser: enough for one-line list items. */

export type Link = { title: string; start: number; end: number };
export type Rendered = { text: string; links: Link[] };

/** Namespaces whose links are files or categories in the ten wikis read, dropped with their captions. */
const MEDIA_NS = /^:?\s*(?:file|image|category|media|datei|bild|kategorie|fichier|catégorie|файл|изображение|категория|dosya|resim|kategori|ملف|صورة|تصنيف|پرونده|تصویر|رده|archivo|imagen|categoría|文件|檔案|档案|图像|圖像|分类|分類|ファイル|画像|カテゴリ)\s*:/iu;
/** Interwiki prefixes: "[[:en:Vulca|Vulca]]" shows text but isn't a local article. */
const INTERWIKI = /^:?\s*(?:[a-z]{2,3}(?:-[a-z]+)?|wikt|wiktionary|wikisource|commons|wikidata|voy|species|meta|mw)\s*:/;

const TRAIL = new Set(['en', 'de', 'fr', 'es', 'tr', 'ru']);

const ENTITIES: Record<string, string> = {
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', ndash: '–', mdash: '—', minus: '−', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  hellip: '…', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', times: '×', deg: '°', middot: '·', zwj: '', zwnj: '‌', shy: '',
};
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });

/** A link target as the wiki stores the title: no anchor, spaces not underscores, first letter upper case. */
export function normTitle(raw: string): string | null {
  let t = decodeEntities(raw).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const hash = t.indexOf('#');
  if (hash === 0) return null;
  if (hash > 0) t = t.slice(0, hash).trim();
  if (t.startsWith(':')) t = t.slice(1).trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Removes comments, references, galleries and tables, which span lines and never hold list items worth keeping. */
export function stripBlocks(src: string): string {
  return src
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '')
    .replace(/<(gallery|references|timeline|graph|mapframe|syntaxhighlight|math|score|imagemap)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:onlyinclude|includeonly|noinclude|section)\b[^>]*>/gi, '')
    .replace(/<references\s*\/>/gi, '');
}

/** Index of the `close` that balances the `open` at `i` (both two characters), or -1. */
function matching(s: string, i: number, open: string, close: string): number {
  let depth = 0;
  for (let j = i; j < s.length - 1; j++) {
    if (s.startsWith(open, j)) {
      depth++;
      j++;
    } else if (s.startsWith(close, j)) {
      depth--;
      j++;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

/** Template parameters split at top-level pipes, with named ones keyed. */
function params(body: string): { name: string; pos: string[]; named: Record<string, string> } {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') {
      depth++;
      cur += two;
      i++;
    } else if ((two === '}}' || two === ']]') && depth > 0) {
      depth--;
      cur += two;
      i++;
    } else if (body[i] === '|' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += body[i];
  }
  parts.push(cur);
  const name = parts.shift()!.trim();
  const pos: string[] = [];
  const named: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.match(/^\s*([^=[\]{}]+?)\s*=([\s\S]*)$/);
    if (eq) named[eq[1].toLowerCase()] = eq[2].trim();
    else pos.push(p.trim());
  }
  return { name, pos, named };
}

const DASHES: Record<string, string> = { ndash: '–', mdash: '—', snd: ' – ', spnd: ' – ', 'spaced ndash': ' – ', 'spaced en dash': ' – ', nbsp: ' ', '-': '–', '--': '—', '·': '·', dot: '·', '•': '•', bull: '•', okina: 'ʻ', "'": "'", '`': '‘', '\'"': '\'"', '"\'': '"\'' };
/** Templates that link an article in another language and show the local name first. */
const INTERLANG = /^(?:ill|ill2|ill-wd|interlanguage link(?: multi)?|lien|нп\d?|iw|не переведено ?\d?|仮リンク|link-[a-z]{2,3}|translink|internal link helper\/[a-z]+|وصلة إنترويكي|ill-fr|enlink|伊|仮リンク2)$/i;
/** Templates that show their first parameter. */
const FIRST = /^(?:nowrap|nobr|small|smaller|big|abbr|abbrlink|flagcountry|flagu|flag|country|sort|sortname|nihongo|nihongo2|nowrap begin|polytonisch|lang-[a-z]+|transl|ref label|keypress|comment|tooltip|abbr2|unbulleted list|okina|mvar|math|sic|langx|nobold|noitalic|vorlage:lang|polytonic|bulleted list|hlist|plainlist|plain list|' ?|uri|transliteration|ruby|kanji|furigana|tsl|nlink|hebrew|cjk|zh|ja|ko)$/i;
/** Templates that show nothing (maintenance tags, notes, icons). */
const DROP = /^(?:citation needed|cn|fact|clarify|when|which|who|dubious|by whom|according to whom|vague|failed verification|sfn|sfnp|efn|efn-lr|efn-ua|refn|r|rp|ref|note|notetag|harvnb|harv|flagicon|flagdeco|flag icon|anchor|main|see also|further|details|clear|clr|-|break|toc|hauptartikel|siehe auch|подробнее|см\. также|основная статья|article détaillé|voir aussi|ap|véase también|ana madde|ayrıca bakınız|要出典|要検証|要出典範囲|citation|cite|cite web|cite book|cite news|cite journal|webarchive|wayback|commons|commonscat|portal|refimprove|unreferenced|nowrap end|nobr end|nihongo foot|sup|ref-?l?|ref\|.*)$/i;

function template(body: string, lang: string, depth: number): Rendered {
  const { name, pos, named } = params(body);
  const n = name.replace(/_/g, ' ').replace(/^(?:template|vorlage|modèle|шаблон|şablon|قالب|plantilla|模板|テンプレート|الگو):/i, '').trim();
  const low = n.toLowerCase();
  if (DASHES[low] !== undefined) return { text: DASHES[low], links: [] };
  if (low === 'circa' || low === 'c.' || low === 'ca.' || low === 'c') return { text: `c. ${pos[0] ?? ''}`.trim(), links: [] };
  if (low === 'ок.' || low === 'около') return { text: `ок. ${pos[0] ?? ''}`.trim(), links: [] };
  if (low === 'lang' || low === 'langue' || low === 'lang-rtl' || low === 'язык' || low === 'lang2') return inline(pos[1] ?? pos[0] ?? '', lang, depth + 1);
  if (INTERLANG.test(low)) {
    if (low === 'tsl' || low === 'translink') return inline(pos[3] || pos[2] || pos[1] || '', lang, depth + 1);
    if (low.startsWith('internal link helper') || low === 'enlink') return { text: '', links: [] };
    return inline(named[lang] ?? named.texte ?? named.text ?? named.trad ?? pos[0] ?? '', lang, depth + 1);
  }
  // French dates: {{1er janvier}}, {{date|7|mai|1683}}, {{date+|7 mai}}, {{date-|7 mai 1683}}.
  if (/^1er [a-zéû]+$/i.test(n) || /^[0-9]{1,2} [a-zéû]+$/i.test(n)) return { text: n, links: [] };
  if (/^date[-+]?$|^date sans lien$/i.test(low)) return { text: inline(pos.slice(0, 3).join(' '), lang, depth + 1).text, links: [] };
  if (low === 'er' || low === 'e' || low === 're' || low === 'ers' || low === 'es' || low === 'res') return { text: low, links: [] };
  if (low === '1er') return { text: '1er', links: [] };
  if (/^(?:s|siècle|s-|-s-|sp|s2|века?|век|siglo|romain|rom)$/.test(low)) return { text: pos.slice(0, 1).join(' '), links: [] };
  if (low === 'convert' || low === 'cvt' || low === 'val') return { text: [pos[0], pos[1]].filter(Boolean).join(' '), links: [] };
  if (low === 'ship' || low === 'sclass' || /^(?:hms|uss|ss|sms|hmas|hmcs|rms|ins|uss)$/.test(low)) return inline(pos.slice(0, 2).join(' '), lang, depth + 1);
  if (low === 'snf' || low === 'nobreak') return inline(pos[0] ?? '', lang, depth + 1);
  if (FIRST.test(low)) return inline(pos[0] ?? '', lang, depth + 1);
  if (DROP.test(low)) return { text: '', links: [] };
  return { text: '', links: [] };
}

/**
 * Renders one line of wikitext: templates by the small table above, links to their labels (recording where each
 * sits in the text), external links to their labels, bold and italics and HTML tags dropped.
 */
export function inline(src: string, lang: string, depth = 0): Rendered {
  let text = '';
  const links: Link[] = [];
  const add = (r: Rendered) => {
    for (const l of r.links) links.push({ title: l.title, start: l.start + text.length, end: l.end + text.length });
    text += r.text;
  };
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('{{', i) && depth < 8) {
      const j = matching(src, i, '{{', '}}');
      if (j < 0) {
        i += 2;
        continue;
      }
      // Parser functions and magic words: {{#if:…}}, {{PAGENAME}}.
      const body = src.slice(i + 2, j - 2);
      if (!/^\s*#/.test(body)) add(template(body, lang, depth));
      i = j;
      continue;
    }
    if (src.startsWith('[[', i)) {
      const j = matching(src, i, '[[', ']]');
      if (j < 0) {
        i += 2;
        continue;
      }
      const body = src.slice(i + 2, j - 2);
      i = j;
      const media = MEDIA_NS.test(body);
      // "[[:Category:X|label]]" shows its label; a file or a category tag shows nothing.
      if (media && !body.trimStart().startsWith(':')) continue;
      const bar = body.indexOf('|');
      const target = bar >= 0 ? body.slice(0, bar) : body;
      let label = bar >= 0 ? body.slice(bar + 1) : target.replace(/^:/, '');
      // "[[Paris, Texas|]]" (pipe trick) shows "Paris".
      if (bar >= 0 && !label.trim()) label = target.replace(/\s*\(.*\)\s*$/, '').replace(/,.*$/, '');
      // Link trails: "[[Милет]]е" shows "Милете". Arabic, Persian and CJK wikis have none.
      const trail = TRAIL.has(lang) ? (src.slice(i).match(/^[\p{Ll}]+/u)?.[0] ?? '') : '';
      i += trail.length;
      const r = inline(label + trail, lang, depth + 1);
      const title = media || INTERWIKI.test(target) ? null : normTitle(target);
      const start = text.length;
      add({ text: r.text, links: [] });
      if (title) links.push({ title, start, end: text.length });
      continue;
    }
    if (src[i] === '[' && /^\[(?:https?:)?\/\//i.test(src.slice(i, i + 10))) {
      const j = src.indexOf(']', i);
      if (j < 0) {
        i++;
        continue;
      }
      const label = src.slice(i + 1, j).replace(/^\S+\s*/, '');
      // "[https://… (Reuters)]": a news source cited, not part of the sentence.
      if (label && !/^\(.*\)$/.test(label.trim())) add(inline(label, lang, depth + 1));
      i = j + 1;
      continue;
    }
    if (src.startsWith("''", i)) {
      i += src.startsWith("'''", i) ? 3 : 2;
      continue;
    }
    if (src[i] === '<') {
      const m = src.slice(i).match(/^<\/?[a-z][a-z0-9]*\b[^>]*>/i);
      if (m) {
        if (/^<br\b/i.test(m[0])) text += ' ';
        i += m[0].length;
        continue;
      }
    }
    text += src[i];
    i++;
  }
  return depth ? { text, links } : tidy({ text, links });
}

/** Entities decoded and whitespace collapsed, keeping link offsets in step. */
function tidy(r: Rendered): Rendered {
  const marks = r.links.map(l => ({ ...l }));
  let out = '';
  const map: number[] = [];
  const src = r.text;
  for (let i = 0; i < src.length; i++) {
    map[i] = out.length;
    if (src[i] === '&') {
      const m = src.slice(i).match(/^&(#x[0-9a-f]+|#\d+|[a-z]+);/i);
      if (m) {
        const d = decodeEntities(m[0]);
        if (d !== m[0]) {
          out += d;
          for (let k = 1; k < m[0].length; k++) map[i + k] = out.length;
          i += m[0].length - 1;
          continue;
        }
      }
    }
    if (/\s/.test(src[i])) {
      if (out.length && !out.endsWith(' ')) out += ' ';
      continue;
    }
    out += src[i];
  }
  map[src.length] = out.length;
  const lead = out.length - out.trimStart().length;
  const text = out.trim();
  const links = marks.map(l => ({ title: l.title, start: Math.max(0, map[l.start] - lead), end: Math.min(text.length, map[l.end] - lead) })).filter(l => l.end > l.start);
  return { text, links };
}

/** "== Events ==" → { level: 2, text: "Events" }, with links and templates rendered. */
export function heading(line: string): { level: number; text: string } | null {
  // MediaWiki takes "== X ===" as a level-2 heading "X =".
  const m = line.match(/^(={1,6})\s*(.*?)\s*(={1,6})\s*$/);
  if (!m || !m[2]) return null;
  const level = Math.min(m[1].length, m[3].length);
  const inner = '='.repeat(m[1].length - level) + m[2] + '='.repeat(m[3].length - level);
  return { level, text: inline(inner, '').text.replace(/^=+|=+$/g, '').replace(/[\u200c\u200d]/g, '').replace(/\s+/g, ' ').trim() };
}

/** Joins lines that an open template or link continues, so a bullet is one line. */
export function logicalLines(src: string): string[] {
  const out: string[] = [];
  let buf = '';
  let open = 0;
  for (const line of src.split('\n')) {
    buf = buf ? `${buf} ${line}` : line;
    open += (line.match(/\{\{/g)?.length ?? 0) - (line.match(/\}\}/g)?.length ?? 0) + (line.match(/\[\[/g)?.length ?? 0) - (line.match(/\]\]/g)?.length ?? 0);
    if (open <= 0 || buf.length > 20000) {
      out.push(buf);
      buf = '';
      open = 0;
    }
  }
  if (buf) out.push(buf);
  return out;
}

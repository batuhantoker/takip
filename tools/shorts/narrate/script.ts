/** The words of a short in each language: English from the scene, the rest translated by the local model, all kept as editable files. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { englishScript, type Scene, type Script } from '../scene';
import { askJson } from './llm';

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', tr: 'Turkish', es: 'Spanish', pt: 'Brazilian Portuguese', fr: 'French', de: 'German',
  ru: 'Russian', ar: 'Modern Standard Arabic', zh: 'Simplified Chinese', ja: 'Japanese',
};

const SYSTEM = `You translate the voiceover and on-screen text of short vertical videos about maps and world data.
Write the way a native narrator speaks: short, vivid, natural sentences, never word for word.
Keep every fact, number, date and name exactly; add nothing. Keep "{n}" placeholders and the brand TAKIP as they are.
In "unit", {n} is replaced by the bare number shown on screen, counted in the English unit: in "{n} million years ago"
it is 252 for 252 million, so the translation must keep millions (Japanese and Chinese: 百万年前, not 万年前).
Keep numbers as digits, written the way that language writes them; a later step spells them out for the voice.
Reply with JSON only.`;

/** Why a translation can't be used, or null. */
export function scriptProblem(en: Script, tr: Script): string | null {
  if (!Array.isArray(tr.beats) || tr.beats.length !== en.beats.length) return 'beats must keep the same number of entries';
  for (const [i, b] of en.beats.entries()) {
    const t = tr.beats[i];
    if (t?.id !== b.id) return `beat ${i} must keep id "${b.id}"`;
    if (!t.say?.trim()) return `beat "${b.id}" has no line`;
    if (b.title && !t.title?.trim()) return `beat "${b.id}" lost its title`;
  }
  if (en.unit && !tr.unit?.includes('{n}')) return 'unit must keep {n}';
  if (en.legend && !tr.legend?.trim()) return 'legend must be translated';
  if (!tr.kicker?.trim() || !tr.ui?.sources || !tr.ui?.explore || (en.ui.bce && !tr.ui?.bce) || !tr.post?.title) return 'kicker, ui and post must all be filled';
  return null;
}

const REVIEW = `You check the translated narration of short videos against the English, as a native-speaking editor.
Reply with JSON only.`;

/** A second read, line by line: anything that changed a fact or reads badly is translated again with the reason. */
async function review(en: Script, out: Script, name: string): Promise<Script> {
  const pairs = en.beats.map((b, i) => ({ id: b.id, english: b.say, translation: out.beats[i].say }));
  // the counter's unit: {n} becomes the same bare number in both, so the scale must match
  if (en.unit && out.unit) pairs.push({ id: 'unit', english: en.unit, translation: out.unit });
  const { problems = [] } = await askJson<{ problems?: { id: string; issue: string }[] }>(REVIEW,
    `For each pair, does the ${name} line change, drop or add any fact, number, quantity, name or date, or read unnaturally ` +
    `to a native ${name} speaker? Return {"problems": [{"id": "...", "issue": "..."}]} listing only real problems, or [] for none.\n\n` +
    JSON.stringify(pairs, null, 2));
  const bad = problems.filter(p => pairs.some(q => q.id === p.id));
  if (!bad.length) return out;
  console.log(`  ${name}: fixing ${bad.map(p => `${p.id} (${p.issue})`).join('; ')}`);
  const { lines } = await askJson<{ lines: Record<string, string> }>(SYSTEM,
    `Translate these lines into ${name} again, fixing the problem noted for each.\n\n` +
    JSON.stringify(bad.map(p => ({ id: p.id, english: pairs.find(q => q.id === p.id)!.english, rejected: pairs.find(q => q.id === p.id)!.translation, problem: p.issue })), null, 2) +
    `\n\nReturn {"lines": {${bad.map(p => `"${p.id}": "..."`).join(', ')}}}.`,
    { check: v => (bad.every(p => v.lines?.[p.id]?.trim()) ? null : 'a line for every id is needed') });
  return { ...out, ...(lines.unit?.includes('{n}') ? { unit: lines.unit } : {}), beats: out.beats.map(b => (lines[b.id] ? { ...b, say: lines[b.id] } : b)) };
}

async function translate(en: Script, lang: string): Promise<Script> {
  const name = LANGUAGE_NAMES[lang] ?? lang;
  const out = await askJson<Script>(SYSTEM,
    `Translate this into ${name}. Return the same JSON with every string value translated, "lang" set to "${lang}", ` +
    `ids unchanged, and hashtags adapted for ${name}-speaking viewers (keep #TAKIP).\n\n${JSON.stringify(en, null, 2)}`,
    { check: v => scriptProblem(en, v) });
  return review(en, { ...out, lang }, name);
}

const SPEAK = `You prepare narration for a text-to-speech voice that misreads digits and abbreviations. Reply with JSON only.`;

/** Digits or an abbreviation ("ABD", "US"; not TAKIP), which the voice reads badly. */
const NEEDS_WORDS = /\d|\b(?!TAKIP\b)\p{Lu}{2,}\b/u;

/** Lines with digits get a `spoken` form, numbers and abbreviations in words, for the voice; the captions keep the digits. */
async function speakable(script: Script): Promise<Script> {
  const todo = script.beats.filter(b => NEEDS_WORDS.test(b.say) && !b.spoken);
  if (!todo.length) return script;
  const name = LANGUAGE_NAMES[script.lang] ?? script.lang;
  const { lines } = await askJson<{ lines: Record<string, string> }>(SPEAK,
    `Rewrite each ${name} line exactly as a native narrator reads it aloud: every number, date, percentage, unit and ` +
    `abbreviation in words, in the right grammatical form. Change nothing else.\n\n` +
    JSON.stringify(Object.fromEntries(todo.map(b => [b.id, b.say])), null, 2) +
    `\n\nReturn {"lines": {${todo.map(b => `"${b.id}": "..."`).join(', ')}}}.`,
    { check: v => (todo.every(b => v.lines?.[b.id]?.trim() && !/\d/.test(v.lines[b.id])) ? null : 'every id needs a line, with no digits left') });
  return { ...script, beats: script.beats.map(b => (lines[b.id] ? { ...b, spoken: lines[b.id] } : b)) };
}

const file = (dir: string, lang: string) => join(dir, `script.${lang}.json`);

/** Reads each language's script from the short's folder, writing the ones that are missing. Edited files are kept. */
export async function scripts(dir: string, scene: Scene, langs: string[]): Promise<Record<string, Script>> {
  const enPath = file(dir, 'en');
  if (!existsSync(enPath)) writeFileSync(enPath, JSON.stringify(englishScript(scene), null, 2) + '\n');
  const en = JSON.parse(readFileSync(enPath, 'utf8')) as Script;
  const out: Record<string, Script> = { en };
  for (const lang of langs.filter(l => l !== 'en')) {
    const path = file(dir, lang);
    if (!existsSync(path)) {
      console.log(`  translating to ${LANGUAGE_NAMES[lang] ?? lang}`);
      // translated from the shown text; spoken forms are made per language below
      writeFileSync(path, JSON.stringify(await translate({ ...en, beats: en.beats.map(b => ({ id: b.id, say: b.say, ...(b.title ? { title: b.title } : {}) })) }, lang), null, 2) + '\n');
    }
    out[lang] = JSON.parse(readFileSync(path, 'utf8')) as Script;
  }
  for (const lang of langs) {
    const ready = await speakable(out[lang]);
    if (ready !== out[lang]) writeFileSync(file(dir, lang), JSON.stringify(ready, null, 2) + '\n');
    out[lang] = ready;
  }
  return out;
}

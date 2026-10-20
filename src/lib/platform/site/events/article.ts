import { wikiLanguages, wikiSummary } from '@/lib/core/wikipedia/client';
import { articleRef, wikiRef } from '@/lib/core/wikipedia/refs';
import type { WikiSummary } from '@/lib/core/wikipedia/summary';

/**
 * An event page's Wikipedia summary, in the page's language when that Wikipedia has the article, else in the one
 * the importer stored. Held in this process so a page asked for again doesn't ask Wikipedia; a slow Wikipedia
 * leaves the summary out rather than holding the page.
 */

export type EventArticle = WikiSummary & { ref: string; lang: string };

const WAIT_MS = 2_500;
const HOLD_MS = 24 * 3_600_000;
const RETRY_MS = 10 * 60_000;
const MAX = 5_000;

const held = new Map<string, { at: number; ok: boolean; value: Promise<EventArticle | null> }>();

async function fetchArticle(stored: string, wiki: string): Promise<EventArticle | null> {
  const { lang, title } = articleRef(stored);
  if (lang === wiki) {
    const s = await wikiSummary(title, lang);
    return s && { ...s, ref: stored, lang };
  }
  const [own, languages] = await Promise.all([wikiSummary(title, lang), wikiLanguages(title, lang).catch(() => [])]);
  const there = languages.find(l => l.lang === wiki);
  const local = there && await wikiSummary(there.title, there.lang).catch(() => null);
  if (there && local) return { ...local, ref: wikiRef(there.lang, there.title), lang: there.lang };
  return own && { ...own, ref: stored, lang };
}

/** `wiki` is a Wikipedia code: the page's language ("zh", "pt"). */
export async function eventArticle(stored: string, wiki: string): Promise<EventArticle | null> {
  const key = `${stored}|${wiki}`;
  const now = Date.now();
  const hit = held.get(key);
  if (hit && now - hit.at < (hit.ok ? HOLD_MS : RETRY_MS)) return hit.value;
  if (held.size >= MAX) held.delete(held.keys().next().value!);
  const entry = { at: now, ok: true, value: fetchArticle(stored, wiki) };
  // A missing summary is asked again sooner, like a failed one: Wikipedia's answer may have been a passing one.
  entry.value = entry.value.then(found => {
    entry.ok = !!found;
    return found;
  }, () => {
    entry.ok = false;
    return null;
  });
  held.set(key, entry);
  const late = new Promise<null>(resolve => setTimeout(() => resolve(null), WAIT_MS));
  return Promise.race([entry.value, late]);
}

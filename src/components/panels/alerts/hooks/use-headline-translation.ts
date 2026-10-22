'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { StoryAlert } from '@/lib/intel/alerts/gdelt-alerts';
import type { AlertItem, NewsAlert } from '@/lib/intel/alerts/live-alerts';
import { baseLanguage, createHeadlineTranslator, translatesOnDevice, type HeadlineTranslator } from '@/lib/core/translate/on-device';
import { usePersisted } from './use-persisted';

/**
 * 'unsupported': this browser has no on-device translator. 'download': a language's model needs a click to download.
 * 'off': the reader turned it off.
 */
export type HeadlineState = 'unsupported' | 'off' | 'download' | 'working' | 'ready';

export interface Headline { text: string; original: string; from: string | null }

// The list's newest; translating the whole day's would only keep the device busy.
const LIMIT = 150;
/** A click on the panel's button downloads this many languages' models, the most frequent; a row fetches its own. */
const AT_ONCE = 3;

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
// Whether the browser translates doesn't change while the page is open.
const unchanging = () => () => {};

const headlineOf = (item: NewsAlert | StoryAlert) => (item.kind === 'story' ? item.headline ?? item.title : item.title);

/** Translates the headlines in `items` into `locale` on the device, where the browser can, and while the reader wants it. */
export function useHeadlineTranslation(items: AlertItem[], locale: string) {
  const supported = useSyncExternalStore(unchanging, translatesOnDevice, () => false);
  const [on, setOn] = usePersisted<boolean>('takip.alerts.translate', true, isBool);
  const translator = useMemo<HeadlineTranslator | null>(() => (supported ? createHeadlineTranslator(locale) : null), [supported, locale]);
  const [titles, setTitles] = useState<ReadonlyMap<string, Headline>>(new Map());
  const [languages, setLanguages] = useState<ReadonlyMap<string, string>>(new Map());
  const [download, setDownload] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [round, setRound] = useState(0);

  const heads = useMemo(() => items.flatMap(i => (i.kind === 'news' || i.kind === 'story' ? [{ id: i.id, text: headlineOf(i) }] : [])).slice(0, LIMIT), [items]);
  const headsKey = heads.map(h => h.id).join(',');

  useEffect(() => {
    if (!translator) return;
    let live = true;
    (async () => {
      const found = await Promise.all(heads.map(async h => ({ ...h, from: await translator.languageOf(h.text) })));
      if (!live) return;
      setLanguages(new Map(found.flatMap(h => (h.from ? [[h.id, h.from] as const] : []))));
      if (!on) return;
      const foreign = found.filter(h => h.from && h.from !== translator.target);
      const from = [...new Set(foreign.map(h => h.from!))];
      const states = await Promise.all(from.map(async f => [f, await translator.availability(f)] as const));
      if (!live) return;
      const count = (f: string) => foreign.filter(h => h.from === f).length;
      setDownload(states.filter(([, a]) => a === 'downloadable' || a === 'downloading').map(([f]) => f).sort((a, b) => count(b) - count(a)));
      await translator.open(states.filter(([, a]) => a === 'available').map(([f]) => f));
      setWorking(true);
      const out = new Map<string, Headline>();
      for (const h of foreign) {
        const text = await translator.translate(h.text, h.from!);
        if (!live) return;
        if (text && text !== h.text) out.set(h.id, { text, original: h.text, from: h.from });
      }
      setTitles(out);
      setWorking(false);
    })();
    return () => { live = false; };
    // headsKey stands for heads: a refresh with the same items needn't start again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translator, on, headsKey, round]);

  /** From a click, as Chrome asks: downloads these languages' models (the most frequent few by default), then translates. */
  const fetchModels = useCallback((languages: string[] = download.slice(0, AT_ONCE)) => {
    if (!translator) return;
    setOn(true);
    void translator.open(languages).then(() => setRound(r => r + 1));
  }, [translator, download, setOn]);

  // Once anything is translated the rest download from their rows, so the panel's button turns it off instead.
  const state: HeadlineState = !supported ? 'unsupported' : !on ? 'off' : working ? 'working' : titles.size || !download.length ? 'ready' : 'download';
  const shown = on ? titles : EMPTY;
  const waiting = useMemo(() => new Set(on ? download : []), [on, download]);
  const context = useMemo(() => ({ titles: shown, languages, target: baseLanguage(locale), waiting, fetchModels }), [shown, languages, locale, waiting, fetchModels]);
  return { state, setOn, fetchModels, context };
}

const EMPTY: ReadonlyMap<string, Headline> = new Map();

interface HeadlineContextValue {
  titles: ReadonlyMap<string, Headline>;
  languages: ReadonlyMap<string, string>;
  target: string;
  /** Languages whose model is waiting for a click to download. */
  waiting: ReadonlySet<string>;
  fetchModels: (languages?: string[]) => void;
}

export const HeadlineContext = createContext<HeadlineContextValue>({
  titles: EMPTY, languages: new Map(), target: 'en', waiting: new Set(), fetchModels: () => undefined,
});

/**
 * The title a row shows: its translation when there is one, and the language it was written in. `guess` is the
 * language the row is presumed to be in where the browser can't detect it: 'en' for the wires and GDELT's English
 * feed, null for its translated one.
 */
export function useHeadline(id: string, title: string, guess: string | null) {
  const { titles, languages, target, waiting, fetchModels } = useContext(HeadlineContext);
  const translated = titles.get(id);
  const from = translated?.from ?? languages.get(id) ?? guess;
  return {
    title: translated?.text ?? title,
    original: translated?.original ?? null,
    from,
    /** The article is in another language than the reader's, so a translated read is worth offering. */
    elsewhere: from ? from !== target : true,
    /** Downloads this headline's language from a click, where its model is still waiting. */
    fetch: from && !translated && waiting.has(from) ? () => fetchModels([from]) : null,
  };
}

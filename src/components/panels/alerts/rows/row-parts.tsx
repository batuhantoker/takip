'use client';

import { useState } from 'react';
import { ExternalLink, Languages, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Figure } from '@/components/ui/figure';
import { useT } from '@/components/ui/use-t';
import { fullDate, stamp } from '@/components/panels/alerts/format';
import { translatedPageUrl } from '@/lib/core/translate/on-device';

export const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

/** "German", "Almanca": a language by its code, in the reader's language. */
export const languageName = (code: string, intl: string) => new Intl.DisplayNames([intl], { type: 'language' }).of(code) ?? code;

/** Under a translated headline: the original, and the article itself through Google Translate where it's in another language. */
export function TranslatedRead({ original, elsewhere, link, from, fetch }: {
  original: string | null; elsewhere: boolean; link: string | null; from: string | null; fetch: (() => void) | null;
}) {
  const t = useT();
  if (!original && !fetch && !(elsewhere && link)) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      {original && <p className="text-meta text-ink-3">{t('Original: {title}', { title: original })}</p>}
      {fetch && from && (
        <Button size="sm" variant="ghost" icon={Languages} className="-ml-2" onClick={fetch}>
          {t('Translate from {language}, on this device', { language: languageName(from, t.intl) })}
        </Button>
      )}
      {elsewhere && link && (
        <Button size="sm" variant="ghost" icon={Languages} className="-ml-2" onClick={() => openLink(translatedPageUrl(link, t.locale))}>
          {t('Read it in {language}', { language: languageName(t.locale, t.intl) })}
        </Button>
      )}
    </div>
  );
}

/** A turning loader that fits an IconButton's icon slot. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cx(className, 'animate-spin motion-reduce:animate-none')} strokeWidth={1.75} />;
}

const toMs = (ts: number | string | null) => (typeof ts === 'string' ? Date.parse(ts) : ts);

/** Who else carried a report: name, lean, when, and a link to their post. */
export function Carriers({ title, rows, now }: {
  title: string;
  rows: { key: string; name: string; note?: string | null; ts: number | string | null; link: string | null }[];
  now: number;
}) {
  const t = useT();
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1 text-meta font-medium text-ink-3">{title}</p>
      <ul className="flex flex-col">
        {rows.map(r => {
          const ms = toMs(r.ts);
          return (
            <li key={r.key} className="flex h-7 min-w-0 items-center gap-2 text-small">
              <span className="shrink-0 text-ink-1">{r.name}</span>
              {r.note && <span className="min-w-0 truncate text-ink-3">{r.note}</span>}
              <span className="ml-auto shrink-0 text-meta text-ink-3" title={ms ? fullDate(ms, t) : undefined}>
                {ms && Number.isFinite(ms) ? <Figure>{stamp(ms, now, t)}</Figure> : null}
              </span>
              {r.link && (
                <a href={r.link} target="_blank" rel="noopener noreferrer" aria-label={t('Open the {name} post', { name: r.name })}
                  className={cx('flex size-6 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-surface-3 hover:text-ink-1', FOCUS_RING)}>
                  <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SIMILAR_SHOWN = 6;

/** A tighter list of the near-copies folded under one alert, each one a target of its own. */
export function SimilarList({ title, rows }: {
  title: string;
  rows: { key: string; label: string; meta?: string | null; onClick?: () => void }[];
}) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, SIMILAR_SHOWN);
  return (
    <div>
      <p className="mb-1 text-meta font-medium text-ink-3">{title} · {rows.length.toLocaleString(t.intl)}</p>
      <ul className="-mx-2 flex flex-col">
        {shown.map(r => (
          <li key={r.key}>
            <button type="button" onClick={r.onClick} disabled={!r.onClick}
              className={cx('flex min-h-7 w-full min-w-0 items-baseline gap-2 rounded-control px-2 py-1 text-left text-small enabled:hover:bg-surface-3', FOCUS_RING)}>
              <span className="line-clamp-2 min-w-0 flex-1 text-ink-2">{r.label}</span>
              {r.meta && <span className="shrink-0 text-meta text-ink-3">{r.meta}</span>}
            </button>
          </li>
        ))}
      </ul>
      {rows.length > SIMILAR_SHOWN && (
        <Button variant="ghost" size="sm" className="mt-1 -ml-2.5" onClick={() => setAll(a => !a)}>
          {all ? t('Show fewer') : t('Show {n} more', { n: rows.length - SIMILAR_SHOWN })}
        </Button>
      )}
    </div>
  );
}

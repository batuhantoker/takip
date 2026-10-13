'use client';
/**
 * TAKIP TI: what an actor quoted, and where from.
 *
 * Under a move, each quote in its own words with the source it came from, a
 * click away. A quote found word for word in its source is marked verbatim;
 * one that is not is marked as a paraphrase, so a reader knows which threads
 * hold all the way.
 */
import { ArrowDownRight, ArrowUpRight, BadgeCheck, ExternalLink, Minus } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { RunState } from '@/lib/oi/state';
import type { Citation, ContextItem, Frame } from '@/lib/oi/types';
import { leanWord } from '@/components/panels/ti-agent/theme';
import { TypeIcon } from '@/components/panels/ti-agent/atoms';

/** Where a source is from, in a few words: the outlet, the site, the file, the feed. */
export function sourceLabel(c: ContextItem | undefined, id: string): string {
  if (!c) return id;
  if (c.kind === 'data') return c.id === 'data' ? 'Your data' : c.source;
  if (c.kind === 'wiki') return 'Wikipedia';
  return c.source || (c.kind === 'quake' ? 'Earthquakes' : c.kind === 'market' ? 'Markets' : 'News');
}

/** What kind of source it is, in a word. */
export const SOURCE_KIND: Record<ContextItem['kind'], string> = {
  web: 'Article', wiki: 'Background', news: 'Live feed', social: 'Social media', quake: 'Earthquake', market: 'Markets', series: 'Market data', odds: 'Prediction market', data: 'Your data', camera: 'Live camera',
};

/** A source's published page, opened apart from the app. */
export function SourceLink({ url, label = 'Open source', className = '' }: { url?: string; label?: string; className?: string }) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" onClick={e => e.stopPropagation()} title={`${label}: ${host}`} aria-label={`${label} at ${host}`}
      className={cx('inline-flex shrink-0 items-center rounded-control text-ink-3 transition-colors hover:text-accent', FOCUS_RING, className)}>
      <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
    </a>
  );
}

/** Which way a quote (or an event) pushed, in the question's terms. */
export function PushTag({ c, frame }: { c: Pick<Citation, 'push' | 'favors'>; frame: Frame | null }) {
  const push = c.push ?? 'neutral';
  if (push === 'neutral' && !c.favors) {
    return <span className="inline-flex shrink-0 items-center gap-0.5 text-meta text-ink-3" title="Context: pushed neither way"><Minus aria-hidden className="size-3" />Context</span>;
  }
  const dir = push === 'no' ? 'no' : 'yes';
  const Icon = dir === 'yes' ? ArrowUpRight : ArrowDownRight;
  const word = frame?.kind === 'choice' ? (c.favors ? `For ${c.favors}` : 'For') : frame?.kind === 'number' ? `Pushes ${leanWord(frame, dir)}` : `Toward ${leanWord(frame, dir)}`;
  return (
    <span className="inline-flex max-w-[160px] shrink-0 items-center gap-0.5 text-meta text-ink-2" title="Which way it pushes the question">
      <Icon aria-hidden className="size-3 shrink-0" strokeWidth={2} />
      <span className="truncate">{word}</span>
    </span>
  );
}

/** Whether a quote was found in its source as quoted. */
export function Verbatim({ exact }: { exact: boolean }) {
  return exact
    ? <span className="inline-flex shrink-0 items-center gap-1 text-meta text-ink-2" title="Found word for word in the source"><BadgeCheck aria-hidden className="size-3" strokeWidth={2} />Verbatim</span>
    : <span className="shrink-0 text-meta text-ink-3" title="Not found word for word in the source">Paraphrase</span>;
}

export function Quotes({ s, cites, onSelect }: { s: RunState; cites: Citation[] | undefined; onSelect: (key: string | null) => void }) {
  // A move made with no sources to quote has no cites at all; one where the actor quoted nothing says so.
  if (!cites) return null;
  if (!cites.length) return s.context.length ? <p className="mt-1.5 text-meta text-ink-3">No source quoted</p> : null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {cites.map(c => {
        const src = s.context.find(x => x.id === c.source);
        return (
          <div key={c.source} className={cx('border-l-2 pl-3', c.exact ? 'border-line-strong' : 'border-line')}>
            <button type="button" onClick={e => { e.stopPropagation(); onSelect(`c:${c.source}`); }} title={src?.title ?? c.source}
              className={cx('block w-full rounded-control text-left', FOCUS_RING)}>
              <span className="block text-small text-ink-1 hover:text-ink-1">“{c.quote}”</span>
              {c.why && <span className="mt-0.5 block text-meta text-ink-3">{c.why}</span>}
            </button>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-meta text-ink-3">
              <TypeIcon k={`c:${c.source}`} subtype={src?.kind} className="size-3 shrink-0" />
              <button type="button" onClick={e => { e.stopPropagation(); onSelect(`c:${c.source}`); }} title={`Open ${sourceLabel(src, c.source)} [${c.source}]`}
                className={cx('min-w-0 truncate rounded-control hover:text-ink-1', FOCUS_RING)}>{sourceLabel(src, c.source)}</button>
              <span aria-hidden>·</span>
              <PushTag c={c} frame={s.frame} />
              <span className="ml-auto pl-2"><Verbatim exact={c.exact} /></span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

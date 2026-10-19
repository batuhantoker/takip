'use client';

import { RefreshCw } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { AlertBrief, AlertThread } from '@/lib/intel/alerts/digest';
import { ago, magnitude } from '@/components/panels/alerts/format';
import { TiGlyph } from '@/components/panels/ti-agent/atoms';
import { Spinner } from '@/components/panels/alerts/rows/row-parts';
import type { Overview } from '@/components/panels/alerts/hooks/use-overview';

const authorship = (by: string, t: Translate) => (by === 'gemini' ? t('Written by Gemini 2.0 Flash.') : t('Written by rules, without an AI model.'));

const SIDES: Record<AlertThread['perspective'], string> = {
  cross: msg('carried by both sides'),
  single: msg('one side only'),
  mixed: msg('mixed sourcing'),
};

/** TI's read of the feed: prose first, then the stories it found, then where it came from. */
export function BriefCard({ overview, now, activeThreadId, onThreadSelect }: {
  overview: Overview;
  now: number;
  activeThreadId?: string | null;
  onThreadSelect?: (id: string | null) => void;
}) {
  const t = useT();
  const { loading, result, error, stale, generate, notice } = overview;
  const brief = result?.brief;

  return (
    <section aria-label={t('Brief')} aria-busy={loading} className="rounded-card border border-line bg-surface-2 p-3">
      <header className="-mt-1 -mr-1 mb-2 flex items-center gap-2">
        <TiGlyph className="size-3.5" />
        <span className="min-w-0 flex-1 truncate text-meta font-medium text-ink-2">
          {loading ? t('Reading the feed…') : result ? `${t('Brief')} · ${ago(result.generatedAt, now, t)}` : t('Brief')}
        </span>
        <IconButton size="sm" label={t('Write it again')} icon={loading ? Spinner : RefreshCw} disabled={loading} onClick={generate} />
      </header>

      {stale && !loading && (
        <p className="mb-2 flex items-center gap-2 text-small text-ink-2">
          {t('New alerts have come in since.')}
          <button type="button" onClick={generate} className={cx('text-accent hover:underline', FOCUS_RING)}>{t('Update')}</button>
        </p>
      )}

      {loading && !result && (
        <div className="flex flex-col gap-2 py-1" aria-hidden>
          <span className="h-3 w-full animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
          <span className="h-3 w-11/12 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
          <span className="h-3 w-3/5 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-small text-ink-2">{error}</p>
          <Button size="sm" onClick={generate}>{t('Try again')}</Button>
        </div>
      )}

      {result && brief && <AlertsBrief result={result} brief={brief} now={now} activeThreadId={activeThreadId} onThreadSelect={onThreadSelect} />}
      {result && !brief && (
        <>
          <PlainBrief text={result.overview} highlights={result.highlights} />
          <p className="mt-3 text-meta text-ink-3">{authorship(result.generatedBy, t)}</p>
        </>
      )}
      {notice && <p className="mt-1 text-meta text-ink-3">{notice}</p>}
    </section>
  );
}

export function PlainBrief({ text, highlights }: { text: string; highlights: string[] }) {
  return (
    <>
      <p className="text-body whitespace-pre-line text-ink-1">{text}</p>
      {highlights.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-small text-ink-2">
          {highlights.map((h, i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-ink-4">–</span>{h}</li>)}
        </ul>
      )}
    </>
  );
}

function AlertsBrief({ result, brief, now, activeThreadId, onThreadSelect }: {
  result: { overview: string; generatedBy: string };
  brief: AlertBrief;
  now: number;
  activeThreadId?: string | null;
  onThreadSelect?: (id: string | null) => void;
}) {
  const t = useT();
  const prose = result.generatedBy === 'gemini' ? result.overview : brief.bottomLine;
  const quake = /quake/i.test(prose) ? null : brief.seismic?.strongest;
  const c = brief.coverage;
  const newest = c.newest ? ago(c.newest, now, t) : '';
  const quakeVars = quake && { magnitude: <span className="font-mono text-ink-1 tabular-nums">{magnitude(quake)}</span>, place: quake.place };
  return (
    <>
      <p className="text-body whitespace-pre-line text-ink-1">{prose}</p>

      {brief.threads.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-meta font-medium text-ink-3">{t('Stories')}{onThreadSelect && ` · ${t('pick one to filter the list')}`}</p>
          <ul className="-mx-2 flex flex-col">
            {brief.threads.map(th => {
              const on = activeThreadId === th.id;
              return (
                <li key={th.id}>
                  <button type="button" disabled={!onThreadSelect} aria-pressed={on} onClick={() => onThreadSelect?.(on ? null : th.id)}
                    className={cx('flex min-h-8 w-full items-baseline gap-2 rounded-control px-2 py-1.5 text-left', on ? 'bg-surface-3' : 'enabled:hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-small font-medium text-ink-1">{th.label}</span>
                      <span className="block truncate text-meta text-ink-3">
                        {t(SIDES[th.perspective])} · {t('{n, plural, one {# channel} other {# channels}}', { n: th.sources.length })}
                        {th.breaking > 0 ? ` · ${t('{n} breaking', { n: th.breaking })}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-meta text-ink-2 tabular-nums">{th.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {quake && quakeVars && (
        <p className="mt-3 text-small text-ink-2">
          {quake.tsunami
            ? t.rich('Strongest earthquake: {magnitude}, {place}, with a tsunami flag.', quakeVars)
            : t.rich('Strongest earthquake: {magnitude}, {place}.', quakeVars)}
        </p>
      )}

      <p className="mt-3 text-meta text-ink-3">
        {t('From {reports, plural, one {# report} other {# reports}} on {channels, plural, one {# channel} other {# channels}}{crossPosted, select, yes {, {corroborated} cross-posted} other {}}{fresh, select, yes {, newest {newest}} other {}}.', {
          reports: c.reports,
          channels: c.channels,
          crossPosted: c.corroborated > 0 ? 'yes' : 'no',
          corroborated: c.corroborated,
          fresh: newest ? 'yes' : 'no',
          newest,
        })} {t('Stories are grouped by keyword and not verified.')} {authorship(result.generatedBy, t)}
      </p>
    </>
  );
}

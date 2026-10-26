import { TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import type { EventSource } from '@/lib/platform/site/events/event-page';

const SHOWN = 3;
const LIST = 'divide-y divide-line rounded-card border border-line bg-surface-1';

/** Every source that records the event: who publishes it, its licence, and its own page for this record. Past the first few, folded but on the page. */
export function EventSources({ t, sources, title }: { t: Translate; sources: EventSource[]; title: string | null }) {
  // Folding one would hide no more than the button takes.
  const shown = sources.length > SHOWN + 1 ? SHOWN : sources.length;
  const row = (s: EventSource) => (
    <li key={s.code} className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[14px] font-medium text-ink-1">
        {s.url ? <a href={s.url} rel="noopener" className={TEXT_LINK}>{s.name}</a> : s.name}
      </span>
      <span className="text-[13px] leading-relaxed text-ink-3">
        {[
          s.owner,
          s.title && s.title !== title ? t('names it “{title}”', { title: s.title }) : null,
        ].filter(Boolean).join(' · ')}
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
        {s.licence && (s.licenceUrl ? <a href={s.licenceUrl} rel="noopener license" className={TEXT_LINK}>{s.licence}</a> : <span>{s.licence}</span>)}
        {s.attribution && <span>{s.attribution}</span>}
        {s.recordUrl && <a href={s.recordUrl} rel="noopener" className={TEXT_LINK}>{t('Source page')}</a>}
      </span>
    </li>
  );
  return (
    <>
      <ul className={LIST}>{sources.slice(0, shown).map(row)}</ul>
      {sources.length > shown && (
        <details className="mt-3">
          <summary className={cx('cursor-pointer text-[13px] font-medium text-ink-2 hover:text-ink-1', FOCUS_RING)}>
            {t('{n, plural, one {# more source} other {# more sources}}', { n: sources.length - shown })}
          </summary>
          <ul className={cx(LIST, 'mt-3')}>{sources.slice(shown).map(row)}</ul>
        </details>
      )}
    </>
  );
}

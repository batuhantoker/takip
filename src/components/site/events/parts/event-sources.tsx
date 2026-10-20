import { TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import type { EventSource } from '@/lib/platform/site/events/event-page';

/** Every source that records the event: who publishes it, its licence, and its own page for this record. */
export function EventSources({ t, sources, title }: { t: Translate; sources: EventSource[]; title: string | null }) {
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
      {sources.map(s => (
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
      ))}
    </ul>
  );
}

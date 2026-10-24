import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { craftPath, KIND_LABEL, type RosterCraft } from '@/lib/platform/site/space/roster';

export type CraftCard = { craft: RosterCraft; detail?: string | null };

/** Spacecraft as links to their pages: name, then what it is and a detail (where it is, a date). */
export function CraftCards({ t, items, columns = true }: { t: Translate; items: CraftCard[]; columns?: boolean }) {
  return (
    <ul className={cx('grid gap-2', columns && 'sm:grid-cols-2')}>
      {items.map(({ craft, detail }) => (
        <li key={craft.slug}>
          <Link href={localePath(t.locale, craftPath(craft))}
            className={cx('flex h-full flex-col gap-0.5 rounded-card border border-line bg-surface-1 px-3.5 py-2.5 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
            <span className="text-[14px] font-medium text-ink-1">{craft.name}</span>
            <span className="text-[12px] text-ink-3">{[t(KIND_LABEL[craft.kind]), detail].filter(Boolean).join(' · ')}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

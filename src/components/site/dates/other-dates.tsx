import Link from 'next/link';
import { Fragment } from 'react';
import { TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';

const PAGES = [
  { path: '/ramadan', label: msg('Ramadan dates') },
  { path: '/easter', label: msg('Easter dates') },
  { path: '/jewish-holidays', label: msg('Jewish holidays') },
];

/** The one line that links the other dates pages from each of them. */
export function OtherDates({ t, path, className = '' }: { t: Translate; path: string; className?: string }) {
  return (
    <p className={`text-[14px] text-ink-2 ${className}`}>
      {t('More dates:')}{' '}
      {PAGES.filter(p => p.path !== path).map((p, i) => (
        <Fragment key={p.path}>
          {i > 0 && ' · '}
          <Link href={localePath(t.locale, p.path)} className={TEXT_LINK}>{t(p.label)}</Link>
        </Fragment>
      ))}
    </p>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { layerPage, pagePath } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { pageIn, type SiteText } from '@/lib/platform/site/text';

/**
 * A place page's caveats, then links to the layers' own pages, which say how each layer works. Their text isn't
 * repeated here: the same paragraphs on every city's page would be copy-paste.
 */
export function Notes({ text, notes, layers }: { text: SiteText; notes: ReactNode[]; layers: string[] }) {
  const { t } = text;
  const pages = layers.map(slug => layerPage(slug)).filter(p => !!p).map(p => pageIn(text, p));
  return (
    <Section title={t('Good to know')}>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-3 border-l-2 border-amber/50 pl-4">
          {notes.map((n, i) => <li key={i} className="text-[14px] leading-relaxed">{n}</li>)}
        </ul>
      )}
      {pages.length > 0 && (
        <p className="mt-5 text-[14px] text-ink-2">
          {t('How the layers work, where their data comes from and what they can’t tell you:')}{' '}
          {pages.map((p, i) => (
            <span key={p.slug}>
              {i > 0 && ', '}
              <Link href={localePath(t.locale, pagePath(p))} className={TEXT_LINK}>{p.heading}</Link>
            </span>
          ))}
        </p>
      )}
    </Section>
  );
}

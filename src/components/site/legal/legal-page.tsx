import Link from 'next/link';
import { Fragment, isValidElement, type ReactNode } from 'react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { getT } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { CONTACT_EMAIL, POLICY_LINKS } from '@/lib/platform/site/legal';

export type LegalSection = { id: string; title: string; items: string[] };

export type RichTranslate = Translate & { rich(source: string, vars: Record<string, ReactNode>): ReactNode };

/** t.rich for server components: use-t's withRich lives in a client module. */
export function withRich(t: Translate): RichTranslate {
  const rich = t as RichTranslate;
  rich.rich = (source, vars) => t.parts(source, vars).map((part, i) => (isValidElement(part) ? <Fragment key={i}>{part}</Fragment> : (part as ReactNode)));
  return rich;
}

/** The policy pages, one link each; `here` is left out. */
export function PolicyNav({ t, here, className }: { t: Translate; here?: string; className?: string }) {
  return (
    <nav aria-label={t('About TAKIP')} className={cx('flex flex-wrap gap-x-5 gap-y-2', className)}>
      {POLICY_LINKS.filter(l => l.href !== here).map(l => (
        <Link key={l.href} href={localePath(t.locale, l.href)} className={cx('hover:text-ink-1', FOCUS_RING)}>{t(l.label)}</Link>
      ))}
    </nav>
  );
}

export function MailLink({ className }: { className?: string }) {
  return <a href={`mailto:${CONTACT_EMAIL}`} className={cx('text-accent hover:underline', FOCUS_RING, className)}>{CONTACT_EMAIL}</a>;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-8">
      <h2 className="text-[20px] font-semibold text-ink-1">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A policy page in plain words: what it covers, its sections as short points, how to reach us, and when it last changed. */
export async function LegalPage({ path, kicker, title, lede, sections, updated, children }: {
  path: string;
  kicker: string;
  title: string;
  lede: ReactNode;
  sections: LegalSection[];
  /** Date.UTC of the last change that mattered. */
  updated: number;
  /** Shown after the sections, before the contact line. */
  children?: ReactNode;
}) {
  const t = withRich(await getT());
  const date = new Date(updated).toLocaleDateString(t.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-14 text-ink-1 sm:px-6">
      <div className="mx-auto max-w-[44rem]">
        <Link href="/" className="text-[13px] text-ink-3 hover:text-ink-1">{t('← Back to TAKIP')}</Link>

        <header className="mt-8">
          <p className="text-[13px] font-medium text-ink-3">{t(kicker)}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">{t(title)}</h1>
          <div className="mt-4 text-[15px] leading-relaxed text-ink-2">{lede}</div>
        </header>

        {sections.map(s => (
          <Section key={s.id} id={s.id} title={t(s.title)}>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-4">
              {s.items.map(item => <li key={item}>{t(item)}</li>)}
            </ul>
          </Section>
        ))}

        {children}

        {path !== '/contact' && (
          <Section id="contact" title={t('Questions?')}>
            <p className="text-sm leading-relaxed text-ink-2">{t.rich('Write to us at {email}.', { email: <MailLink /> })}</p>
          </Section>
        )}

        <footer className="mt-14 border-t border-line pt-5 text-[12px] text-ink-3">
          <p>{t('Last changed on {date}.', { date })}</p>
          <PolicyNav t={t} here={path} className="mt-3" />
        </footer>
      </div>
    </main>
  );
}

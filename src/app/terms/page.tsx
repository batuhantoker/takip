import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getT } from '@/lib/core/i18n/request';
import { msg } from '@/lib/core/i18n/translator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Terms of use'),
    description: t('The terms for using TAKIP, in plain words: what the map is and is not for, fair use, accounts, plans and ads, the API, and AI answers.'),
    alternates: { canonical: '/terms' },
  };
}

const UPDATED = Date.UTC(2026, 9, 19);

const SECTIONS: { id: string; title: string; items: string[] }[] = [
  {
    id: 'what',
    title: msg('What TAKIP is'),
    items: [
      msg('TAKIP gathers public information onto one map: flights, ships, cameras, weather, hazards, news, markets, space and history. Almost all of it comes from other organisations’ public feeds, shown as they publish it.'),
      msg('Data can be late, incomplete or wrong, and a source can stop at any time. Do not use TAKIP to navigate, fly or sail, or for safety, emergency, medical, legal or financial decisions; use the official source for those.'),
      msg('The data stays its publishers’. If you reuse it outside TAKIP, their terms apply.'),
    ],
  },
  {
    id: 'fair-use',
    title: msg('Using it fairly'),
    items: [
      msg('Do not use TAKIP to stalk, harass or threaten anyone, or to track a person without their knowledge.'),
      msg('Look up people, usernames and systems only where you have a lawful reason, and scan a system only with its owner’s permission.'),
      msg('Do not try to break into TAKIP, overload it, or get around its limits, such as the daily map time without an account or an API key’s rate limit.'),
      msg('Do not scrape the site in bulk; use the API, within its limits.'),
      msg('Do not use TAKIP for anything that is against the law where you are.'),
    ],
  },
  {
    id: 'accounts',
    title: msg('Accounts'),
    items: [
      msg('An account is optional. If you make one, use an email address you can receive mail at and keep your password to yourself; you are responsible for what is done with your account.'),
      msg('You can delete your account at any time from Account settings, under Delete account. The privacy page says what that removes.'),
      msg('We may suspend or close an account that breaks these terms, and will tell you why where we can.'),
    ],
  },
  {
    id: 'plans',
    title: msg('Plans, ads and the API'),
    items: [
      msg('Plans differ in how long the map stays open each day, how far back Replay reaches and other limits, shown in Account settings. They can change, but not to take away something you have already paid for.'),
      msg('Paid plans are not on sale yet. When they are, the price, how renewal works and how to cancel are shown before you pay.'),
      msg('The free plans show a few ads from Google AdSense, never on the map. Pro shows none.'),
      msg('API keys are for you and your own apps. Keep them secret, stay within their limits, and do not resell access to the API.'),
    ],
  },
  {
    id: 'ai',
    title: msg('TI and other AI features'),
    items: [
      msg('TI’s briefings, answers and predictions are written by language models and can be wrong. Check the sources TI shows before relying on them.'),
      msg('When you use your own AI key, the provider’s terms and charges apply to what you send it.'),
    ],
  },
  {
    id: 'yours',
    title: msg('What you add'),
    items: [
      msg('Areas, workspaces, issue reports and anything else you add stay yours. You let us store and process them to run TAKIP for you, and for nothing else.'),
      msg('Do not add anything you have no right to share, or anything unlawful.'),
    ],
  },
  {
    id: 'no-guarantees',
    title: msg('No guarantees'),
    items: [
      msg('TAKIP is provided as it is, without warranties. We work to keep it running and accurate, but cannot promise it will always be available, up to date or free of errors.'),
      msg('As far as the law allows, we are not liable for losses that come from using TAKIP or relying on what it shows. Nothing here takes away rights that the law where you live gives you and does not let you give up.'),
    ],
  },
  {
    id: 'changes',
    title: msg('Changes'),
    items: [
      msg('TAKIP changes often, and these terms may change with it. The date below shows when they last changed; using TAKIP after a change means you accept the new terms.'),
    ],
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-8">
      <h2 className="text-[20px] font-semibold text-ink-1">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function TermsPage() {
  const t = await getT();
  const updated = new Date(UPDATED).toLocaleDateString(t.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-14 text-ink-1 sm:px-6">
      <div className="mx-auto max-w-[44rem]">
        <Link href="/" className="text-[13px] text-ink-3 hover:text-ink-1">
          {t('← Back to TAKIP')}
        </Link>

        <header className="mt-8">
          <p className="text-[13px] font-medium text-ink-3">{t('Terms of use')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">{t('Terms, in plain words')}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {t('These terms apply when you use TAKIP: the map, its public pages, accounts and the API. By using TAKIP you agree to them.')}
            {' '}
            <Link href="/privacy" className="text-accent hover:underline">{t('The privacy page')}</Link>
            {' '}
            {t('says what data we keep and why.')}
          </p>
        </header>

        {SECTIONS.map(s => (
          <Section key={s.id} id={s.id} title={t(s.title)}>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-4">
              {s.items.map(item => <li key={item}>{t(item)}</li>)}
            </ul>
          </Section>
        ))}

        <Section id="contact" title={t('Questions?')}>
          <p className="text-sm leading-relaxed text-ink-2">
            {t('Use Report an issue in the map’s More menu; you do not need an account.')}
          </p>
        </Section>

        <p className="mt-14 border-t border-line pt-5 text-[12px] text-ink-3">
          {t('Last changed on {date}.', { date: updated })}
        </p>
      </div>
    </main>
  );
}

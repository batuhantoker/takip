import type { Metadata } from 'next';
import { LegalPage, MailLink, withRich, type LegalSection } from '@/components/site/legal/legal-page';
import { getT } from '@/lib/core/i18n/request';
import { msg } from '@/lib/core/i18n/translator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Contact'),
    description: t('How to reach TAKIP: wrong data, a source to add, privacy requests, removal requests and anything else.'),
    alternates: { canonical: '/contact' },
  };
}

const SECTIONS: LegalSection[] = [
  {
    id: 'what',
    title: msg('What to write about'),
    items: [
      msg('Something wrong on the map: say what you saw, where and when, and send the link if you have it.'),
      msg('A source or layer you would like added, or one of yours you would like shown.'),
      msg('Privacy requests: a copy of your data, a correction or a deletion. Write from the email address on your account.'),
      msg('Removing a camera, a picture or anything else of yours: the copyright and removal page says what to include.'),
      msg('Ads, the API, press or working together.'),
    ],
  },
  {
    id: 'faster',
    title: msg('Sometimes quicker'),
    items: [
      msg('Report an issue, in the map’s More menu, sends us your message with a snapshot of the map view, so we can see what you saw. You do not need an account.'),
      msg('To delete your account yourself, open Account settings and choose Delete account.'),
    ],
  },
  {
    id: 'reply',
    title: msg('What happens next'),
    items: [
      msg('Every message is read by a person. Privacy and removal requests are answered first.'),
    ],
  },
];

export default async function ContactPage() {
  const t = withRich(await getT());
  return (
    <LegalPage path="/contact" kicker={msg('Contact')} title={msg('Contact TAKIP')} updated={Date.UTC(2026, 9, 21)} sections={SECTIONS}
      lede={<p>{t.rich('TAKIP is an independent project. Write to {email} about anything on the map or these pages.', { email: <MailLink /> })}</p>} />
  );
}

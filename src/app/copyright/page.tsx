import type { Metadata } from 'next';
import { LegalPage, MailLink, withRich, type LegalSection } from '@/components/site/legal/legal-page';
import { getT } from '@/lib/core/i18n/request';
import { msg } from '@/lib/core/i18n/translator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Copyright and removal'),
    description: t('How a camera operator, rights holder or anyone shown on TAKIP asks for a camera, picture or page to be removed.'),
    alternates: { canonical: '/copyright' },
  };
}

const SECTIONS: LegalSection[] = [
  {
    id: 'shown',
    title: msg('What TAKIP shows'),
    items: [
      msg('Cameras and streams are shown from the public address their operators publish them at, credited to their source.'),
      msg('Pictures, texts and data from other sites are credited to them, under their own licences.'),
      msg('Cameras that go offline stay on the map as faded “off air” pins until their operator or we decide otherwise.'),
    ],
  },
  {
    id: 'ask',
    title: msg('Asking for removal'),
    items: [
      msg('The link to the page, camera or picture, or where it is on the map.'),
      msg('Who you are and why you are asking: the owner, the camera’s operator, someone acting for them, or someone shown in it.'),
      msg('What you want removed or changed, and why.'),
      msg('How to reach you.'),
      msg('For a copyright claim, a statement that you believe in good faith the use is not authorised, that what you sent is accurate, and that you own the rights or may act for whoever does, with your name as a signature.'),
    ],
  },
  {
    id: 'next',
    title: msg('What happens next'),
    items: [
      msg('We usually hide the item while we look into it, and tell you what we decided.'),
      msg('If something of yours was removed by mistake, write with the link and why it should come back; we may pass your answer to whoever asked for the removal.'),
    ],
  },
];

export default async function CopyrightPage() {
  const t = withRich(await getT());
  return (
    <LegalPage path="/copyright" kicker={msg('Copyright and removal')} title={msg('Removing something from TAKIP')} updated={Date.UTC(2026, 9, 21)} sections={SECTIONS}
      lede={<p>{t.rich('If a camera, picture or page on TAKIP is yours, or shows you, and you want it removed, write to {email} with the details below.', { email: <MailLink /> })}</p>} />
  );
}

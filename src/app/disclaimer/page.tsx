import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, withRich, type LegalSection } from '@/components/site/legal/legal-page';
import { getT } from '@/lib/core/i18n/request';
import { msg } from '@/lib/core/i18n/translator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Disclaimer'),
    description: t('What TAKIP’s data is and is not: third-party feeds shown as published, sometimes late or wrong, and never for navigation, safety or trading.'),
    alternates: { canonical: '/disclaimer' },
  };
}

const SECTIONS: LegalSection[] = [
  {
    id: 'data',
    title: msg('The data is other people’s'),
    items: [
      msg('Almost everything on the map comes from public feeds run by others: aircraft and ship transponders, space agencies, weather services, road authorities, news sites and more. TAKIP shows it as they publish it.'),
      msg('A position can be minutes old, a feed can stop, and a report can be wrong. Missing aircraft or ships do not mean nothing is there.'),
      msg('Estimates, forecasts and projections are labelled as such, and may turn out differently.'),
    ],
  },
  {
    id: 'not-for',
    title: msg('Not for navigation or emergencies'),
    items: [
      msg('Do not use TAKIP to navigate, fly or sail, or for safety, emergency, medical or legal decisions. Use the official source.'),
      msg('In an emergency, call your local emergency number and follow the authorities’ instructions, not the map.'),
      msg('Market prices may be delayed, and nothing on TAKIP is financial advice.'),
    ],
  },
  {
    id: 'ai',
    title: msg('AI answers'),
    items: [
      msg('TI’s briefings, answers and predictions are written by language models and can be wrong. Check the sources TI shows before relying on them.'),
    ],
  },
  {
    id: 'borders',
    title: msg('Borders and names'),
    items: [
      msg('Maps, borders and place names are drawn from their sources, past and present. They are not TAKIP’s view on any dispute.'),
    ],
  },
  {
    id: 'others',
    title: msg('Other sites and names'),
    items: [
      msg('Links and embeds lead to sites TAKIP does not run; their content and terms are theirs.'),
      msg('Names and logos of sources belong to their owners. Showing them does not mean they endorse TAKIP or work with it.'),
    ],
  },
];

export default async function DisclaimerPage() {
  const t = withRich(await getT());
  return (
    <LegalPage path="/disclaimer" kicker={msg('Disclaimer')} title={msg('What the map can and cannot tell you')} updated={Date.UTC(2026, 9, 21)} sections={SECTIONS}
      lede={<p>{t.rich('TAKIP puts public information on one map so it is easier to see. It is a window, not an authority. {terms} apply as well.', {
        terms: <Link href="/terms" className="text-accent hover:underline">{t('The terms of use')}</Link>,
      })}</p>} />
  );
}

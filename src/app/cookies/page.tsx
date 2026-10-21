import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, withRich, type LegalSection } from '@/components/site/legal/legal-page';
import { getT } from '@/lib/core/i18n/request';
import { msg } from '@/lib/core/i18n/translator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Cookies'),
    description: t('The cookies TAKIP and Google set, what each is for, and how to refuse or clear them.'),
    alternates: { canonical: '/cookies' },
  };
}

/*
 * Checked 2026-10-21 against: takip-lang (src/lib/core/i18n/choice.ts), Better Auth's cookiePrefix and
 * cookieCache (apps/api/src/auth/auth.ts), the ad script (src/components/shell/ads), and the camera embeds
 * (src/lib/feeds/cameras/types.ts). Browser storage is listed on the privacy page.
 */
const SECTIONS: LegalSection[] = [
  {
    id: 'ours',
    title: msg('Cookies TAKIP sets'),
    items: [
      msg('takip-lang: the language you picked, so every page opens in it. Set only when you pick one, and kept for 400 days.'),
      msg('Cookies whose names begin with takip. (takip.session_token and its companions): they keep you signed in and finish a two-step sign-in. Set only when you sign in, and removed when you sign out.'),
      msg('None of TAKIP’s own cookies are used for ads or to follow you to other sites.'),
    ],
  },
  {
    id: 'others',
    title: msg('Cookies other services set'),
    items: [
      msg('Google AdSense, on the free plans: cookies such as __gads, __gpi and __eoi on this site, and Google’s own on its domains, to choose and count ads and to stop ad fraud. Where the law requires your consent, Google’s consent message asks for it first. Pro shows no ads, so these are not set.'),
      msg('YouTube and other video services: some cameras and live news channels are their videos, and when one plays, that service may set its own cookies.'),
      msg('Cloudflare carries the connection to TAKIP and may set a cookie to tell people from automated traffic.'),
    ],
  },
  {
    id: 'storage',
    title: msg('Browser storage, not cookies'),
    items: [
      msg('Your settings, the areas you draw, your watchlist and the random visitor id are kept in your browser’s local storage, not in cookies, and are not sent with every request. The privacy page lists each one.'),
    ],
  },
  {
    id: 'choices',
    title: msg('Your choices'),
    items: [
      msg('Your browser can block or clear this site’s cookies. TAKIP still works without them, but it forgets your language and signs you out.'),
      msg('Turn off personalised ads in Google’s My Ad Center, or decline in the consent message; you then see ads that do not depend on your history.'),
      msg('Clearing this site’s data in your browser removes the cookies and the browser storage together.'),
    ],
  },
];

export default async function CookiesPage() {
  const t = withRich(await getT());
  return (
    <LegalPage path="/cookies" kicker={msg('Cookies')} title={msg('Cookies, in plain words')} updated={Date.UTC(2026, 9, 21)} sections={SECTIONS}
      lede={<p>{t.rich('TAKIP sets only the cookies it needs to work: your language, and your sign-in if you have an account. Ads and some videos bring cookies of their own. {privacy} says what else is kept and why.', {
        privacy: <Link href="/privacy" className="text-accent hover:underline">{t('The privacy page')}</Link>,
      })}</p>} />
  );
}

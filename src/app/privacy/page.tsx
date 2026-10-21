import type { Metadata } from 'next';
import { Fragment, isValidElement, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity, Bot, Camera, ChevronDown, HardDrive, KeyRound, Map as MapIcon, Megaphone, Search, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react';
import { MailLink, PolicyNav } from '@/components/site/legal/legal-page';
import { getT } from '@/lib/core/i18n/request';
import { msg, type Translate } from '@/lib/core/i18n/translator';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Privacy'),
    description: t('Privacy at TAKIP, in plain words: optional accounts, the usage data we keep to improve TAKIP, your settings on your device, how ads work, and exactly which services hear from us when you use a feature.'),
    alternates: { canonical: '/privacy' },
  };
}

/**
 * Every statement on this page is drawn from the code in this repository, not
 * from a template; when a data flow changes, this page changes with it.
 *
 * Reviewed 2026-10-04 against: src/app/api/(places)/geo, src/app/api/(intel)/osint/*,
 * src/app/api/(intel)/ai/*, src/app/api/(ai)/ai/*, src/lib/ai/* (client, service, web,
 * newsroom, markets), src/lib/intel/recon/sanctions.ts, src/lib/intel/recon/username/*,
 * src/lib/intel/recon/chain/*, src/app/page.tsx (IP location, storage),
 * src/components/map/world-map.tsx (base map, satellite), src/app/globals.css
 * (fonts), src/components/panels/alerts/alerts-panel.tsx, src/lib/feeds/weather/clouds/tiles.ts,
 * src/lib/intel/markets/donbot.ts, src/components/panels/ti-agent/assist/voice.ts, use-live-voice.ts,
 * src/lib/ai/assist/actions/{nearby,weather}.ts, the CCTV sources, and
 * src/components/shell/ads/* and src/lib/platform/ads.ts, and every localStorage and
 * sessionStorage key in src/. Usage data (2026-10-19): apps/api/src/access/map-time.ts,
 * src/lib/platform/visitor.ts, apps/api/src/auth/sign-ins.ts, apps/api/src/analytics/page-reads.ts (with
 * src/components/site/page-view.tsx) and their retention in usage-prune.ts and audit-prune.ts.
 */

const REVIEWED = Date.UTC(2026, 9, 19);

type RichTranslate = Translate & { rich(source: string, vars: Record<string, ReactNode>): ReactNode };

/** t.rich for this server component: use-t's withRich lives in a client module. */
function withRich(t: Translate): RichTranslate {
  const rich = t as RichTranslate;
  rich.rich = (source, vars) => t.parts(source, vars).map((part, i) => (isValidElement(part) ? <Fragment key={i}>{part}</Fragment> : (part as ReactNode)));
  return rich;
}

/* ───────────── The pieces ───────────── */

function Pledge({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface-1 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-2">{icon}</span>
        <h3 className="text-[13px] font-semibold text-ink-1">{title}</h3>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-8">
      <h2 className="text-[20px] font-semibold text-ink-1">{title}</h2>
      {intro && <p className="mt-2 text-sm leading-relaxed text-ink-2">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** One thing you might do, what it involves, and (a click away) exactly who hears from us. */
async function Flow({ icon, title, summary, services, children }: {
  icon: ReactNode; title: string; summary: ReactNode; services?: { name: string; what: string }[]; children?: ReactNode;
}) {
  const t = await getT();
  return (
    <div className="rounded-card border border-line bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <div className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{summary}</div>
          {children}
          {services && services.length > 0 && (
            <details className="group mt-3">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12px] text-accent hover:underline [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                {t('Which services, exactly')}
              </summary>
              <ul className="mt-3 flex flex-col gap-2 border-l border-line pl-4">
                {services.map(s => (
                  <li key={s.name} className="text-[12.5px] leading-relaxed">
                    <span className="font-mono text-[11.5px] text-ink-1">{t(s.name)}</span>
                    <span className="text-ink-2"> · {t(s.what)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

const STORED: { what: string; detail: string }[] = [
  { what: msg('Your AI key for TI'), detail: msg('Kept for this browser tab only, and gone when you close it, unless you tick “Remember on this device”.') },
  { what: msg('Your TI settings and recent predictions'), detail: msg('Which provider and model you use, whether replies are read aloud, and a list of your last 25 predictions so you can reopen them.') },
  { what: msg('Your TI Assist conversation'), detail: msg('For this tab only, so a reload does not lose it.') },
  { what: msg('Areas you draw on the map'), detail: msg('So a refresh does not wipe your work.') },
  { what: msg('How the map looks'), detail: msg('Your Style Studio colours, which layers are switched on, and the last city the map opened on.') },
  { what: msg('Your market watchlist and recent fingerprint searches'), detail: msg('So they are there next time. The search list can be cleared from the search panel.') },
  { what: msg('When you last waved off the ad blocker note'), detail: msg('So it asks at most once a day.') },
  { what: msg('A random visitor id'), detail: msg('Sent with the map’s once-a-minute usage count, and once when you open one of the public pages (see What we measure). It is a random number, not your name; clearing this site’s data replaces it with a new one.') },
];

const PROMISES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <UserRound className="h-4 w-4" />, title: msg('An account is optional'), body: msg('The map opens without one. An account keeps your email and sign-in details, and you can download or delete everything it holds from Account settings.') },
  { icon: <Activity className="h-4 w-4" />, title: msg('Usage data, to make TAKIP better'), body: msg('We count how long the map is open, which tools and layers get used and where it is used from, to improve TAKIP and build better tools. It stays on our server, with no analytics company involved. The free plans show a few Google ads, and Google sets its own cookies for them; Pro has none.') },
  { icon: <HardDrive className="h-4 w-4" />, title: msg('Your things stay with you'), body: msg('Your settings, history and keys are kept in your own browser, where you can see them and clear them. Not on our servers.') },
  { icon: <KeyRound className="h-4 w-4" />, title: msg('Your AI key is yours'), body: msg('Used only for the request you make, passed straight to the provider you chose, and never stored on our servers or written to a log.') },
];

const SHORT = [
  msg('Most of what you see comes from public sources. To show it, our server asks those sources, much as your browser would.'),
  msg('When you look something up, the question goes to the service that holds the answer, and only for that lookup.'),
  msg('Your preferences and history live in your browser. Clearing this site’s data in your browser removes all of it.'),
  msg('Features that use AI run on the key and provider you choose, and we pass your request straight through.'),
  msg('We do not keep a record of what you search, look up or type. We do keep the address you use the map from, and the town it points to, to see where TAKIP is used.'),
  msg('We count map time, which tools and layers are in use and which actions people take (a search, a route), per account or per browser, to see what helps and improve it. What we measure below says exactly what.'),
  msg('If you report an issue, we keep your message, a snapshot of your map view and your browser’s details, tied to your account if you are signed in. Deleting the account deletes its reports.'),
  msg('The site reaches you through Cloudflare, which carries the connection between your browser and our server, as it does for much of the web.'),
  msg('The free plans show a few ads from Google, never on the map. Google may use cookies to choose and measure them. Pro shows none.'),
];

const GOOD_TO_KNOW = [
  { title: msg('A lookup is a question to someone else'), body: msg('The service that answers a lookup sees what was asked. If what you are researching is sensitive, keep that in mind before you search.') },
  { title: msg('Shared links are open'), body: msg('Anyone with a prediction’s link can open it while it is kept. Share it with the people you mean to.') },
  { title: msg('AI is a starting point'), body: msg('Briefings and predictions are written by language models. TI shows its sources so you can check them, and you should.') },
  { title: msg('Scan only what you may'), body: msg('Scans are rate limited and kept away from private networks, but whether you may scan a system is between you and its owner.') },
];

const LEAD = 'text-ink-1';

/* ───────────── The page ───────────── */

export default async function PrivacyPage() {
  const t = withRich(await getT());
  const lead = (text: string) => <span className={LEAD}>{text}</span>;
  const reviewed = new Date(REVIEWED).toLocaleDateString(t.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-14 text-ink-1 sm:px-6">
      <div className="mx-auto max-w-[44rem]">
        <Link href="/" className="text-[13px] text-ink-3 hover:text-ink-1">
          {t('← Back to TAKIP')}
        </Link>

        <header className="mt-8">
          <p className="text-[13px] font-medium text-ink-3">{t('Privacy')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">{t('Privacy, in plain words')}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {t('TAKIP is a window onto public information: flights, ships, cameras, news, markets and more, gathered onto one map. We built it so you can use it without telling us who you are. This page says what that means in practice, and, where a feature needs to ask another service for something, exactly which one.')}
          </p>
        </header>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {PROMISES.map(p => <Pledge key={p.title} icon={p.icon} title={t(p.title)}>{t(p.body)}</Pledge>)}
        </div>

        <Section id="short" title={t('The short version')}>
          <ul className="flex flex-col gap-3 text-sm leading-relaxed text-ink-2">
            {SHORT.map(line => (
              <li key={line} className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green" />
                <span>{t(line)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="device" title={t('What stays on your device')}
          intro={t('These are kept in your browser’s own storage on this device. We receive one only when a feature needs it, like your AI key for a TI request, or the visitor id that goes with the map’s minute count. Clearing this site’s data in your browser settings removes them all.')}>
          <div className="divide-y divide-line rounded-card border border-line bg-surface-1">
            {STORED.map(s => (
              <div key={s.what} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
                <span className="text-[13px] font-medium sm:w-56 sm:flex-shrink-0">{t(s.what)}</span>
                <span className="text-[13px] leading-relaxed text-ink-2">{t(s.detail)}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="usage" title={t('What we measure, and why')}
          intro={t('We use this to see which tools people rely on and which go unused, so we can improve TAKIP and build better tools. It stays on our own server: it is not shared with the ad network or with any analytics company.')}>
          <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-2">
            <li>{lead(t('Map time.'))} {t('While the map is open and on screen, it tells our server once a minute. That minute counts toward the day’s map time, and is noted against the view (map, space, history or replay), the open panel, the data layers switched on and their sections (air, sea and so on), any open window such as a camera, and whether it is a phone. Not where you look on the map, what you search or what you type.')}</li>
            <li>{lead(t('Reading the pages.'))} {t('Opening one of the public pages, such as a city, a layer or a guide, counts one view: which page, in which language, the site that sent you, and the random visitor id this browser keeps. It spends none of your map time. If you then open the map, the first page you read is noted as where you landed.')}</li>
            <li>{lead(t('Actions.'))} {t('We count what people do by name: a search run, a route planned, a camera opened, a recon lookup by kind (email, domain…). Never the words, places, addresses or names themselves.')}</li>
            <li>{t.rich('{signedOut} those minutes are tied to the random visitor id this browser keeps, along with the browser’s name, the site that first sent you here, the page you landed on, and the address you connect from with the town and country it points to. Clearing this site’s data starts a new id.', { signedOut: lead(t('Signed out,')) })}</li>
            <li>{t.rich('{signedIn} they are tied to your account, with the addresses you use the map from and where they point to, and the browser’s visitor id is linked to it. Each sign-in is recorded with its time, address and browser.', { signedIn: lead(t('Signed in,')) })}</li>
            <li>{lead(t('Your location, when you use it.'))} {t('If you use your location on the map (Your location in search, Use my location, or navigation), we note the position your browser gives, as precisely as it gives it, and the town it is in. While navigating that is at most one position a minute. We never ask for your location just to note it.')}</li>
            <li>{t.rich('{subject} is looked up on our own server in a copy of DB-IP’s free database, so the address isn’t sent anywhere for it. It is a rough guess, usually the right country and a nearby town.', { subject: lead(t('Where an address points to')) })}</li>
            <li>{lead(t('How long:'))} {t('all of this, sign-ins included, is kept for 90 days and then deleted. Counts of API requests, which plan limits rely on, are kept for up to 400 days (35 for visitors).')}</li>
            <li>{lead(t('Yours to take or delete:'))} {t('your account’s download includes all of it, and deleting the account deletes it, with the browsers linked to it.')}</li>
          </ul>
        </Section>

        <Section id="services" title={t('When we reach out to other services')}
          intro={t('TAKIP does not keep a database of intelligence of its own: it asks public services in real time. Here is what that involves, by what you are doing. Each service treats what it receives under its own privacy policy.')}>
          <div className="flex flex-col gap-3">
            <Flow icon={<MapIcon className="h-4 w-4" />} title={t('Opening the map')}
              summary={t('So the map can open over your part of the world, our server asks several IP location services at once roughly where your connection is, and goes with the place most of them agree on; your browser’s time zone, sent along, rules out guesses in another one. It is a city-level guess used only to place the map (the place we keep for usage counts is looked up separately, see What we measure). If you have already let this site use your device’s location, the map opens there instead, the same as if you had moved it there yourself; unlike Your location, it isn’t added to the usage statistics. If nothing can tell, the map opens over your time zone’s main city, or a well-covered city. The map itself (its tiles, the satellite view when you switch to it, and the typefaces) loads from the services that draw it, as with any website that shows a map.')}
              services={[
                { name: msg('ipinfo.io, ip-api.com, ipwho.is, ipapi.co and freeipapi.com, all at once'), what: msg('your connection’s IP address, asked from our server, to place the map') },
                { name: 'DB-IP (db-ip.com)', what: msg('nothing is sent: a copy of its IP-to-town database on our server places the address the map is used from (IP geolocation by DB-IP, CC BY 4.0)') },
                { name: 'OpenFreeMap (tiles.openfreemap.org)', what: msg('the map tiles, map symbols and label typefaces for the part of the world in view') },
                { name: 'CARTO (basemaps.cartocdn.com)', what: msg('the map tiles instead, only if you pick CARTO as the base map') },
                { name: 'Esri (server.arcgisonline.com)', what: msg('satellite imagery, only when you switch to the satellite view') },
                { name: 'Wikipedia', what: msg('the name and position of a place you click on the map, asked from our server, so Wikipedia never sees you') },
                { name: 'Google Fonts', what: msg('the typefaces the site uses') },
              ]} />

            <Flow icon={<Search className="h-4 w-4" />} title={t('Looking something up')}
              summary={t.rich('The RECON tools answer by asking the public service that holds the answer, from our server. That service sees the email, domain, address or name you looked up, but not who you are. Two checks never leave our server at all: {phones} are read with a library that runs here, and {sanctions} run against a copy of the published list we keep.', {
                phones: lead(t('phone numbers')),
                sanctions: lead(t('sanctions searches')),
              })}
              services={[
                { name: 'XposedOrNot', what: msg('an email address, for breach checks') },
                { name: 'Hudson Rock', what: msg('an email or domain, for infostealer checks') },
                { name: 'Shodan InternetDB, RIPE, RDAP, Google Public DNS, crt.sh', what: msg('a host, address or domain, for infrastructure, ownership, DNS and certificate lookups') },
                { name: 'ip-api.com, Tor Project, AlienVault OTX', what: msg('an IP address or indicator, for location and threat checks') },
                { name: msg('CIRCL and MITRE'), what: msg('a CVE number, for vulnerability details') },
                { name: msg('GitHub, and a dozen public profile sites'), what: msg('a username, to see where it is in use') },
                { name: 'maclookup.app', what: msg('a hardware (MAC) address, for its maker') },
                { name: msg('mempool.space, Blockscout, the public Solana network, CoinGecko'), what: msg('a wallet address, and prices to value it') },
              ]} />

            <Flow icon={<Camera className="h-4 w-4" />} title={t('Watching cameras and live alerts')}
              summary={t('Camera pictures and streams come straight from whoever runs each camera (a road authority, a harbour, a city) or from the video service it uses, such as YouTube, which may set its own cookies when a video plays. A few alerts carry photos that load from Telegram when you open them, and the Live Clouds layer loads its imagery from NOAA while it is switched on. In each case the service sees an ordinary request from your browser, as for any picture on the web.')} />

            <Flow icon={<Sparkles className="h-4 w-4" />} title={t('Using TI, on your own AI key')}
              summary={t('TI runs on the AI provider and key you choose. When you start a prediction, talk to TI Assist or check your key, your request goes from our server to that provider: your question and any data you add for a prediction, or the conversation and what is on the map for Assist. The provider sees our server’s address, not yours. Your key is used for that request and nothing else.')}
              services={[
                { name: msg('The provider you choose'), what: msg('OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek, xAI, Mistral or Alibaba Cloud: your key and your request. With local models, the request goes to a model server the site’s owner runs, and to no one else') },
                { name: msg('News publishers’ feeds, GDELT, Wikipedia'), what: msg('a few keywords from your question, to find the reporting and background a prediction reads; the articles found are then read from their publishers') },
                { name: 'Yahoo Finance', what: msg('the ticker of a price your question is about, for its price history and its news') },
                { name: msg('Polymarket and Manifold'), what: msg('a few keywords from your question, to find what prediction markets price it at; and, for the suggestions on the ask form, nothing about you at all') },
                { name: msg('Photon and Nominatim (OpenStreetMap)'), what: msg('a place name, when you search for one or TI looks one up; and, to name the town of a location you used, a point rounded to about 10 km, asked from our server') },
                { name: 'OpenStreetMap Overpass', what: msg('a point and a kind of place (dams, airports…), when TI looks up what is mapped near it') },
                { name: 'Open-Meteo', what: msg('a point, when TI reads the weather there') },
              ]}>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                {t('A prediction has its own link so it can be shared: anyone you give the link to can open it, and it is kept on our server for three hours after it finishes. The microphone in TI Assist uses your browser’s own speech recognition (in Chrome and Edge, a Google or Microsoft service); we only ever receive the words. Talking with TI live (OpenAI engines only) sends your voice straight from your browser to OpenAI on your own key: our server uses the key once to open a short session and keeps neither the key nor the audio.')}
              </p>
            </Flow>

            <Flow icon={<Megaphone className="h-4 w-4" />} title={t('Seeing ads, on the free plans')}
              summary={t("A small ad sits under some sidebar panels and in the docs; the map, TI and the tools you are working in never carry one, and Pro shows none at all. The ads come from Google AdSense: your browser loads them from Google, which sees your IP address and the page you are on. Google and its partners use cookies to show ads based on your visits to this and other sites, to cap how often you see one and to count clicks. Visitors in Europe and the UK are asked first, in Google's consent message, and can say no. If an ad blocker stops them, a note asks, at most once a day, whether you would let them through; nothing stops working either way.")}
              services={[
                { name: 'Google AdSense (googlesyndication.com, doubleclick.net)', what: msg('your IP address, the page, and its own cookies, to choose, show and count ads') },
              ]}>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                {t.rich('How Google uses what it learns here: {link}.', {
                  link: (
                    <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer"
                      className="text-accent hover:underline">policies.google.com/technologies/partner-sites</a>
                  ),
                })}
              </p>
            </Flow>

            <Flow icon={<Bot className="h-4 w-4" />} title={t('AI briefings and token scans')}
              summary={t('The briefing, analysis and overview buttons send the feed headlines they summarise to Google Gemini, on this site’s own key. A DonBot token scan opens DigitalDon’s scanner in a sealed frame, which receives the token you scan.')} />
          </div>
        </Section>

        <Section id="good-to-know" title={t('Good to know')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {GOOD_TO_KNOW.map(x => (
              <div key={x.title} className="rounded-card border border-line bg-surface-1 p-4">
                <h3 className="text-[13px] font-semibold">{t(x.title)}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{t(x.body)}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="choices" title={t('Your choices')}>
          <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-2">
            <li>{t.rich('{clear} by clearing this site’s data in your browser settings.', { clear: lead(t('Clear everything')) })}</li>
            <li>{t.rich('{remove} from Account settings: choose Delete account, and we email you a link; opening it in a browser signed in to that account deletes the account and everything it holds, including sign-ins through Google, Facebook or GitHub.', { remove: lead(t('Delete your account')) })}</li>
            <li>{t.rich('{turnOff} in {adCenter}, or decline in the consent message; you then see ads that do not depend on your history.', {
              turnOff: lead(t('Turn off personalised ads')),
              adCenter: (
                <a href="https://myadcenter.google.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t("Google's My Ad Center")}</a>
              ),
            })}</li>
            <li>{t.rich('{keep} by leaving “Remember on this device” unticked; it is then forgotten when the tab closes.', { keep: lead(t('Keep your AI key to one session')) })}</li>
            <li>{t.rich('{only}: map layers, cameras and AI features reach out only when you switch them on or use them.', { only: lead(t('Use only what you need')) })}</li>
          </ul>
        </Section>

        <Section id="contact" title={t('Questions?')}>
          <p className="text-sm leading-relaxed text-ink-2">
            {t('If something here is unclear, or you think we have missed something, tell us and we will put it right.')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            {t.rich('Write to {email}. For a copy of your data, a correction or a deletion, write from the email address on your account.', { email: <MailLink /> })}
          </p>
        </Section>

        <footer className="mt-14 border-t border-line pt-5 text-[12px] text-ink-3">
          <p>{t('Last checked against the code on {date}. When a feature changes what it shares, this page changes with it.', { date: reviewed })}</p>
          <PolicyNav t={t} here="/privacy" className="mt-3" />
        </footer>
      </div>
    </main>
  );
}

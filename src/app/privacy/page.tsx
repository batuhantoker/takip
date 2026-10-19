import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity, Bot, Camera, ChevronDown, ExternalLink, HardDrive, KeyRound, Map as MapIcon, Megaphone, MessageCircle, Search, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'Privacy at TAKIP, in plain words: optional accounts, the usage data we keep to improve TAKIP, your settings on your device, how ads work, and exactly which services hear from us when you use a feature.',
  alternates: { canonical: '/privacy' },
};

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
 * src/lib/platform/visitor.ts, apps/api/src/auth/sign-ins.ts and their retention in usage-prune.ts and audit-prune.ts.
 */

const REVIEWED = '19 October 2026';

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
function Flow({ icon, title, summary, services, children }: {
  icon: ReactNode; title: string; summary: ReactNode; services?: { name: string; what: string }[]; children?: ReactNode;
}) {
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
                Which services, exactly
              </summary>
              <ul className="mt-3 flex flex-col gap-2 border-l border-line pl-4">
                {services.map(s => (
                  <li key={s.name} className="text-[12.5px] leading-relaxed">
                    <span className="font-mono text-[11.5px] text-ink-1">{s.name}</span>
                    <span className="text-ink-2"> · {s.what}</span>
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
  { what: 'Your AI key for TI', detail: 'Kept for this browser tab only, and gone when you close it, unless you tick “Remember on this device”.' },
  { what: 'Your TI settings and recent predictions', detail: 'Which provider and model you use, whether replies are read aloud, and a list of your last 25 predictions so you can reopen them.' },
  { what: 'Your TI Assist conversation', detail: 'For this tab only, so a reload does not lose it.' },
  { what: 'Areas you draw on the map', detail: 'So a refresh does not wipe your work.' },
  { what: 'How the map looks', detail: 'Your Style Studio colours, which layers are switched on, and the last city the map opened on.' },
  { what: 'Your market watchlist and recent fingerprint searches', detail: 'So they are there next time. The search list can be cleared from the search panel.' },
  { what: 'When you last waved off the ad blocker note', detail: 'So it asks at most once a day.' },
  { what: 'A random visitor id', detail: 'Sent with the map’s once-a-minute usage count (see What we measure). It is not your name or address; clearing this site’s data replaces it with a new one.' },
];

const PROMISES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <UserRound className="h-4 w-4" />, title: 'An account is optional', body: 'The map opens without one. An account keeps your email and sign-in details, and you can download or delete everything it holds from Account settings.' },
  { icon: <Activity className="h-4 w-4" />, title: 'Usage data, to make TAKIP better', body: 'We count how long the map is open and which tools and layers get used, to improve TAKIP and build better tools. It stays on our server, with no analytics company involved. The free plans show a few Google ads, and Google sets its own cookies for them; Pro has none.' },
  { icon: <HardDrive className="h-4 w-4" />, title: 'Your things stay with you', body: 'Your settings, history and keys are kept in your own browser, where you can see them and clear them. Not on our servers.' },
  { icon: <KeyRound className="h-4 w-4" />, title: 'Your AI key is yours', body: 'Used only for the request you make, passed straight to the provider you chose, and never stored on our servers or written to a log.' },
];

/* ───────────── The page ───────────── */

export default function PrivacyPage() {
  return (
    // docs-root releases the full-screen map's scroll lock (see globals.css), so the page scrolls.
    <main className="docs-root min-h-screen bg-surface-0 px-5 py-14 text-ink-1 sm:px-6">
      <div className="mx-auto max-w-[44rem]">
        <Link href="/" className="text-[13px] text-ink-3 hover:text-ink-1">
          ← Back to TAKIP
        </Link>

        <header className="mt-8">
          <p className="text-[13px] font-medium text-ink-3">Privacy</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">Privacy, in plain words</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            TAKIP is a window onto public information: flights, ships, cameras, news, markets and more, gathered onto
            one map. We built it so you can use it without telling us who you are. This page says what that means in
            practice, and, where a feature needs to ask another service for something, exactly which one.
          </p>
        </header>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {PROMISES.map(p => <Pledge key={p.title} icon={p.icon} title={p.title}>{p.body}</Pledge>)}
        </div>

        <Section id="short" title="The short version">
          <ul className="flex flex-col gap-3 text-sm leading-relaxed text-ink-2">
            {[
              'Most of what you see comes from public sources. To show it, our server asks those sources, much as your browser would.',
              'When you look something up, the question goes to the service that holds the answer, and only for that lookup.',
              'Your preferences and history live in your browser. Clearing this site’s data in your browser removes all of it.',
              'Features that use AI run on the key and provider you choose, and we pass your request straight through.',
              'We do not keep a record of what you search. Signed out, your address is used only in memory and as a daily scrambled count, to keep usage fair for everyone.',
              'We count map time and which tools and layers are in use, per account or per browser, to see what helps and improve it. What we measure below says exactly what.',
              'If you report an issue, we keep your message, a snapshot of your map view and your browser’s details, tied to your account if you are signed in. Deleting the account deletes its reports.',
              'The site reaches you through Cloudflare, which carries the connection between your browser and our server, as it does for much of the web.',
              'The free plans show a few ads from Google, never on the map. Google may use cookies to choose and measure them. Pro shows none.',
            ].map(t => (
              <li key={t} className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="device" title="What stays on your device"
          intro="These are kept in your browser’s own storage on this device. We receive one only when a feature needs it, like your AI key for a TI request, or the visitor id that goes with the map’s minute count. Clearing this site’s data in your browser settings removes them all.">
          <div className="divide-y divide-line rounded-card border border-line bg-surface-1">
            {STORED.map(s => (
              <div key={s.what} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
                <span className="text-[13px] font-medium sm:w-56 sm:flex-shrink-0">{s.what}</span>
                <span className="text-[13px] leading-relaxed text-ink-2">{s.detail}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="usage" title="What we measure, and why"
          intro="We use this to see which tools people rely on and which go unused, so we can improve TAKIP and build better tools. It stays on our own server: it is not shared with the ad network or with any analytics company.">
          <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-2">
            <li><span className="text-ink-1">Map time.</span> While the map is open and on screen, it tells our server once a minute. That minute counts toward the day’s map time, and is noted against the view (map, space, history or replay), the open panel, the data layers switched on, any open window such as a camera, and whether it is a phone. Not where you look on the map, what you search or what you type.</li>
            <li><span className="text-ink-1">Signed out,</span> those minutes are tied to the random visitor id this browser keeps, along with the browser’s name, the site that first sent you here and the page you landed on. Clearing this site’s data starts a new id.</li>
            <li><span className="text-ink-1">Signed in,</span> they are tied to your account, and the browser’s visitor id is linked to it. Each sign-in is recorded with its time, address and browser.</li>
            <li><span className="text-ink-1">How long:</span> all of this, sign-ins included, is kept for 90 days and then deleted. Counts of API requests, which plan limits rely on, are kept for up to 400 days (35 for visitors).</li>
            <li><span className="text-ink-1">Yours to take or delete:</span> your account’s download includes all of it, and deleting the account deletes it, with the browsers linked to it.</li>
          </ul>
        </Section>

        <Section id="services" title="When we reach out to other services"
          intro="TAKIP does not keep a database of intelligence of its own: it asks public services in real time. Here is what that involves, by what you are doing. Each service treats what it receives under its own privacy policy.">
          <div className="flex flex-col gap-3">
            <Flow icon={<MapIcon className="h-4 w-4" />} title="Opening the map"
              summary={<>
                So the map can open over your part of the world, our server asks an IP location service roughly where your
                connection is. It is a city-level guess, it is not stored, and if it cannot tell, the map opens on a
                well-covered city instead. The map itself (its tiles, the satellite view when you switch to it, and the
                typefaces) loads from the services that draw it, as with any website that shows a map.
              </>}
              services={[
                { name: 'ipapi.co, then freeipapi.com, then ip-api.com', what: 'your connection’s IP address, asked from our server, to place the map' },
                { name: 'OpenFreeMap (tiles.openfreemap.org)', what: 'the map tiles, map symbols and label typefaces for the part of the world in view' },
                { name: 'CARTO (basemaps.cartocdn.com)', what: 'the map tiles instead, only if you pick CARTO as the base map' },
                { name: 'Esri (server.arcgisonline.com)', what: 'satellite imagery, only when you switch to the satellite view' },
                { name: 'Wikipedia', what: 'the name and position of a place you click on the map, asked from our server, so Wikipedia never sees you' },
                { name: 'Google Fonts', what: 'the typefaces the site uses' },
              ]} />

            <Flow icon={<Search className="h-4 w-4" />} title="Looking something up"
              summary={<>
                The RECON tools answer by asking the public service that holds the answer, from our server. That service
                sees the email, domain, address or name you looked up, but not who you are. Two checks never leave our
                server at all: <span className="text-ink-1">phone numbers</span> are read with a library
                that runs here, and <span className="text-ink-1">sanctions searches</span> run against a
                copy of the published list we keep.
              </>}
              services={[
                { name: 'XposedOrNot', what: 'an email address, for breach checks' },
                { name: 'Hudson Rock', what: 'an email or domain, for infostealer checks' },
                { name: 'Shodan InternetDB, RIPE, RDAP, Google Public DNS, crt.sh', what: 'a host, address or domain, for infrastructure, ownership, DNS and certificate lookups' },
                { name: 'ip-api.com, Tor Project, AlienVault OTX', what: 'an IP address or indicator, for location and threat checks' },
                { name: 'CIRCL and MITRE', what: 'a CVE number, for vulnerability details' },
                { name: 'GitHub, and a dozen public profile sites', what: 'a username, to see where it is in use' },
                { name: 'maclookup.app', what: 'a hardware (MAC) address, for its maker' },
                { name: 'mempool.space, Blockscout, the public Solana network, CoinGecko', what: 'a wallet address, and prices to value it' },
              ]} />

            <Flow icon={<Camera className="h-4 w-4" />} title="Watching cameras and live alerts"
              summary={<>
                Camera pictures and streams come straight from whoever runs each camera (a road authority, a harbour, a
                city) or from the video service it uses, such as YouTube, which may set its own cookies when a video plays.
                A few alerts carry photos that load from Telegram when you open them, and the Live Clouds layer loads its
                imagery from NOAA while it is switched on. In each case the service sees an ordinary request from your
                browser, as for any picture on the web.
              </>} />

            <Flow icon={<Sparkles className="h-4 w-4" />} title="Using TI, on your own AI key"
              summary={<>
                TI runs on the AI provider and key you choose. When you start a prediction, talk to TI Assist or check your
                key, your request goes from our server to that provider: your question and any data you add for a
                prediction, or the conversation and what is on the map for Assist. The provider sees our server’s address,
                not yours. Your key is used for that request and nothing else.
              </>}
              services={[
                { name: 'The provider you choose', what: 'OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek, xAI, Mistral or Alibaba Cloud: your key and your request. With local models, the request goes to a model server the site\u2019s owner runs, and to no one else' },
                { name: 'News publishers’ feeds, GDELT, Wikipedia', what: 'a few keywords from your question, to find the reporting and background a prediction reads; the articles found are then read from their publishers' },
                { name: 'Yahoo Finance', what: 'the ticker of a price your question is about, for its price history and its news' },
                { name: 'Polymarket and Manifold', what: 'a few keywords from your question, to find what prediction markets price it at; and, for the suggestions on the ask form, nothing about you at all' },
                { name: 'Photon and Nominatim (OpenStreetMap)', what: 'a place name, when you search for one or TI looks one up' },
                { name: 'OpenStreetMap Overpass', what: 'a point and a kind of place (dams, airports…), when TI looks up what is mapped near it' },
                { name: 'Open-Meteo', what: 'a point, when TI reads the weather there' },
              ]}>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                A prediction has its own link so it can be shared: anyone you give the link to can open it, and it is kept
                on our server for three hours after it finishes. The microphone in TI Assist uses your browser’s own
                speech recognition (in Chrome and Edge, a Google or Microsoft service); we only ever receive the words.
                Talking with TI live (OpenAI engines only) sends your voice straight from your browser to OpenAI on your own
                key: our server uses the key once to open a short session and keeps neither the key nor the audio.
              </p>
            </Flow>

            <Flow icon={<Megaphone className="h-4 w-4" />} title="Seeing ads, on the free plans"
              summary={<>
                A small ad sits under some sidebar panels and in the docs; the map, TI and the tools you are working in
                never carry one, and Pro shows none at all. The ads come from Google AdSense: your browser loads them from
                Google, which sees your IP address and the page you are on. Google and its partners use cookies to show
                ads based on your visits to this and other sites, to cap how often you see one and to count clicks.
                Visitors in Europe and the UK are asked first, in Google&apos;s consent message, and can say no. If an ad
                blocker stops them, a note asks, at most once a day, whether you would let them through; nothing stops
                working either way.
              </>}
              services={[
                { name: 'Google AdSense (googlesyndication.com, doubleclick.net)', what: 'your IP address, the page, and its own cookies, to choose, show and count ads' },
              ]}>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                How Google uses what it learns here:{' '}
                <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline">policies.google.com/technologies/partner-sites</a>.
              </p>
            </Flow>

            <Flow icon={<Bot className="h-4 w-4" />} title="AI briefings and token scans"
              summary={<>
                The briefing, analysis and overview buttons send the feed headlines they summarise to Google Gemini, on this
                site’s own key. A DonBot token scan opens DigitalDon’s scanner in a sealed frame, which receives the token
                you scan.
              </>} />
          </div>
        </Section>

        <Section id="good-to-know" title="Good to know">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { t: 'A lookup is a question to someone else', b: 'The service that answers a lookup sees what was asked. If what you are researching is sensitive, keep that in mind before you search.' },
              { t: 'Shared links are open', b: 'Anyone with a prediction’s link can open it while it is kept. Share it with the people you mean to.' },
              { t: 'AI is a starting point', b: 'Briefings and predictions are written by language models. TI shows its sources so you can check them, and you should.' },
              { t: 'Scan only what you may', b: 'Scans are rate limited and kept away from private networks, but whether you may scan a system is between you and its owner.' },
            ].map(x => (
              <div key={x.t} className="rounded-card border border-line bg-surface-1 p-4">
                <h3 className="text-[13px] font-semibold">{x.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{x.b}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="choices" title="Your choices">
          <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-2">
            <li><span className="text-ink-1">Clear everything</span> by clearing this site’s data in your browser settings.</li>
            <li><span className="text-ink-1">Turn off personalised ads</span> in{' '}
              <a href="https://myadcenter.google.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google&apos;s My Ad Center</a>,
              or decline in the consent message; you then see ads that do not depend on your history.</li>
            <li><span className="text-ink-1">Keep your AI key to one session</span> by leaving “Remember on this device” unticked; it is then forgotten when the tab closes.</li>
            <li><span className="text-ink-1">Use only what you need</span>: map layers, cameras and AI features reach out only when you switch them on or use them.</li>
            <li><span className="text-ink-1">Run your own copy</span>: TAKIP is open source, so you can host it yourself and decide who operates it.</li>
          </ul>
        </Section>

        <Section id="contact" title="Questions?">
          <p className="text-sm leading-relaxed text-ink-2">
            If something here is unclear, or you think we have missed something, tell us and we will put it right.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a href="https://github.com/batuhantoker/takip/issues" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3.5 h-9 text-[13px] font-medium text-ink-1 hover:bg-surface-3">
              <ExternalLink className="h-4 w-4" /> Open an issue on GitHub
            </a>
            <a href="https://discord.gg/umBykEpb98" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3.5 h-9 text-[13px] font-medium text-ink-1 hover:bg-surface-3">
              <MessageCircle className="h-4 w-4" /> Ask on Discord
            </a>
          </div>
        </Section>

        <p className="mt-14 border-t border-line pt-5 text-[12px] text-ink-3">
          Last checked against the code on {REVIEWED}. When a feature changes what it shares, this page changes with it.
        </p>
      </div>
    </main>
  );
}

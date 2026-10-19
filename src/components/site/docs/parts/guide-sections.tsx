'use client';

import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { Callout, Code, CodeBlock, Pre, Section } from './docs-primitives';

const READ_BY_APP = [
  {
    k: 'SDK_INGEST_KEY',
    v: msg('Shared secret for /api/sdk/ingest. The endpoint fails closed: while this is unset, ingestion is disabled and returns 503.'),
  },
  {
    k: 'AIS_API_KEY',
    v: msg('aisstream.io key for live vessel positions. Without it /api/maritime still has ports and chokepoints, but no ships.'),
  },
  {
    k: 'CLOUDFLARE_API_TOKEN',
    v: msg('A Cloudflare token scoped to Radar: Read, for the internet outages and attack-origins layer. Unset, /api/cloudflare-radar reports itself unconfigured.'),
  },
  {
    k: 'TOMTOM_API_KEY',
    v: msg('TomTom key for the worldwide traffic flow tiles. Unset, /api/traffic/flow answers 204.'),
  },
  {
    k: 'GEMINI_API_KEY_1 … _8',
    v: msg('The server’s own Gemini keys for the AI routes, used for Pro plans. Anyone can still send their own in X-Gemini-Key.'),
  },
  {
    k: 'TAKIP_PORT',
    v: msg('Host port the UI is published on. The container itself always listens on 3000.'),
  },
];

const INTERFACE_PARTS = [
  {
    k: msg('Layer Panel'),
    v: msg('The left rail. Switches individual feeds on and off, and carries the theme selector.'),
  },
  {
    k: msg('RECON Toolkit'),
    v: msg('DNS, WHOIS, certificate transparency, IP and ASN enrichment, breach checks, sanctions, CVE lookup, port scanning.'),
  },
  {
    k: msg('Intel Feed'),
    v: msg('A running stream of incoming events across every enabled feed.'),
  },
  {
    k: msg('Region Dossier'),
    v: msg('Double right-click the map for a composite summary of that location from every feed covering it.'),
  },
  {
    k: msg('Entity Graph'),
    v: msg('Link analysis, expanding one node at a time into its neighbours.'),
  },
  {
    k: msg('Status Bar'),
    v: msg('Community and docs links on the left, then a live ticker of prices and significant seismic events.'),
  },
];

const SHORTCUTS = [
  { key: 'F', desc: msg('Toggle fullscreen') },
  { key: 'S', desc: msg('Share current view') },
  { key: 'L', desc: msg('Toggle layer panel') },
  { key: 'M', desc: msg('Toggle markets panel') },
  { key: 'I', desc: msg('Toggle intel feed') },
  { key: 'R', desc: msg('Reset to global view') },
  { key: '?', desc: msg('Show help') },
  { key: 'ESC', desc: msg('Close panels / popups') },
];

export function OverviewSection() {
  const t = useT();
  return (
    <Section id="overview" eyebrow={t('Guide')} title={t('Overview')}>
      <p>
        {t.rich('Every data point on the map is rendered through WebGL via MapLibre GL, which is what lets the interface hold thousands of concurrent entities at 60fps. The application is a Next.js app: the map and HUD run in the browser, and each live feed is normalised by a route under {api} before it reaches the client.', {
          api: <Code>/api</Code>,
        })}
      </p>
      <p>
        {t('That boundary is deliberate. Upstream sources disagree about formats, rate limits, and CORS policy, so the API layer absorbs those differences and hands back consistent JSON.')}
      </p>
      <Callout tone="good" title={t('No credentials needed')}>
        {t('Aviation, satellites, fires, earthquakes, weather, news, and CVE data all come from public keyless feeds, and the RECON tools run keyless too. A few layers need a key of their own: live vessels, Cloudflare Radar and TomTom traffic flow.')}
      </Callout>
    </Section>
  );
}

export function QuickStartSection({ origin }: { origin: string }) {
  const t = useT();
  return (
    <Section id="quickstart" eyebrow={t('Guide')} title={t('Quick start')}>
      <p>
        {t.rich('Every feed is a plain {get} returning JSON and needs no authentication — paste any of these into a terminal.', {
          get: <Code>GET</Code>,
        })}
      </p>
      <CodeBlock
        label={t('Fetch live aircraft')}
        tabs={[
          { label: 'cURL', lang: 'bash', code: `curl -s ${origin}/api/flights | jq '.commercial_flights | length'` },
          {
            label: 'JavaScript',
            lang: 'javascript',
            code: `const res = await fetch("${origin}/api/flights");
const { commercial_flights, military_flights } = await res.json();
console.log(commercial_flights.length, "commercial;", military_flights.length, "military");`,
          },
          {
            label: 'Python',
            lang: 'python',
            code: `import requests

data = requests.get("${origin}/api/flights").json()
print(len(data["commercial_flights"]), "commercial")`,
          },
        ]}
      />
      <p>
        {t.rich('If you only need magnitudes rather than geometry, {stats} is the right endpoint to poll — it collapses the heavy feeds into a handful of counters.', {
          stats: <Code>/api/stats</Code>,
        })}
      </p>
      <Pre label={t('Aggregate counters')} lang="bash">{`curl -s ${origin}/api/stats
# { "stats": { "flights": 9241, "sats": 2043, "cctv": 2117,
#              "weather": 58, "nuclear": 191, "incidents": 412 },
#   "timestamp": "2026-07-29T12:00:00Z" }`}</Pre>
      <p>{t('The OSINT lookups each take one subject, so they compose cleanly in a pipeline. They need an account, so send an API key:')}</p>
      <Pre label={t('Passive subdomain enumeration')} lang="bash">{`curl -s -H "Authorization: Bearer $YOUR_API_KEY" "${origin}/api/osint/certs?domain=example.com" | jq -r '.subdomains[]'`}</Pre>
      <p>
        {t.rich('The same key opens the accounts API ({v1}, documented at {v1Docs}) and replay data ({replay}). Without one, most of their endpoints answer {required}; {keyPolicy} lists the ones open to everyone. A free account comes with a key.', {
          v1: <Code>/api/v1</Code>,
          v1Docs: <Code>/api/v1/docs</Code>,
          replay: <Code>/api/replay</Code>,
          required: <Code>401 api_key_required</Code>,
          keyPolicy: <Code>/api/v1/key-policy</Code>,
        })}
      </p>
      <Callout tone="info" title={t('Try before you write code')}>
        {t.rich('Every GET endpoint in the reference below has a {send} button that runs it against this instance and shows the live response.', {
          send: <strong>{t('Send request')}</strong>,
        })}
      </Callout>
    </Section>
  );
}

export function SelfHostingSection() {
  const t = useT();
  return (
    <Section id="self-hosting" eyebrow={t('Guide')} title={t('Self-hosting')}>
      <p>
        {t.rich('The map needs Node 20+ and no database. Accounts, and with them the OSINT tools, come from the accounts API in {apiDir}, which {dev} starts beside the web app on port 4100. A local instance is three commands:', {
          apiDir: <Code>apps/api</Code>,
          dev: <Code>npm run dev</Code>,
        })}
      </p>
      <Pre label={t('Local development')} lang="bash">{`git clone https://github.com/batuhantoker/takip.git
cd takip
npm install
npm run dev        # http://localhost:3000`}</Pre>
      <p>{t('For a production build, or to run the checks:')}</p>
      <Pre label={t('Build and test')} lang="bash">{`npm run build && npm start
npm run lint
npm test           # vitest
npm run test:live  # includes tests that hit live upstream feeds`}</Pre>
      <p>
        {t.rich('A {dockerfile} and {compose} ship with the repository. The container always listens on port 3000 internally; {port} controls the host port it is published on.', {
          dockerfile: <Code>Dockerfile</Code>,
          compose: <Code>docker-compose.yml</Code>,
          port: <Code>TAKIP_PORT</Code>,
        })}
      </p>
      <Pre label="Docker" lang="bash">{`cp .env.example .env
docker compose up -d`}</Pre>
    </Section>
  );
}

export function ConfigurationSection() {
  const t = useT();
  return (
    <Section id="configuration" eyebrow={t('Guide')} title={t('Configuration')}>
      <p>
        {t.rich('Copy {example} to {env}. Read that file before filling anything in — most of the keys it lists are reserved for future sources and are not consumed by the current code.', {
          example: <Code>.env.example</Code>,
          env: <Code>.env</Code>,
        })}
      </p>
      <h3 className="text-[15px] font-semibold text-ink-1 pt-3">
        {t('Read by the application')}
      </h3>
      <div className="space-y-2">
        {READ_BY_APP.map(row => (
          <div
            key={row.k}
            className="rounded-card border border-line bg-surface-1 p-4"
          >
            <div className="font-mono text-[13px] text-ink-1 mb-1">{row.k}</div>
            <div className="text-[14px] leading-[1.65] text-ink-2">{t(row.v)}</div>
          </div>
        ))}
      </div>
      <h3 className="text-[15px] font-semibold text-ink-1 pt-3">
        {t('Optional — higher limits or deeper results')}
      </h3>
      <p>
        {t.rich('{openskyId} and {openskySecret} lift OpenSky’s anonymous budget of 400 credits a day. {etherscan} and {helius} deepen Ethereum and Solana wallet lookups. {firms} and {n2yo} are not read: the keyless feeds serve those layers.', {
          openskyId: <Code>OPENSKY_CLIENT_ID</Code>,
          openskySecret: <Code>OPENSKY_CLIENT_SECRET</Code>,
          etherscan: <Code>ETHERSCAN_API_KEY</Code>,
          helius: <Code>HELIUS_API_KEY</Code>,
          firms: <Code>FIRMS_API_KEY</Code>,
          n2yo: <Code>N2YO_API_KEY</Code>,
        })}
      </p>
      <Callout tone="warn" title={t('Secrets hygiene')}>
        {t.rich('Generate secrets with {command}. Never commit a populated {env} — only {example} belongs in version control.', {
          command: <Code>openssl rand -hex 32</Code>,
          env: <Code>.env</Code>,
          example: <Code>.env.example</Code>,
        })}
      </Callout>
    </Section>
  );
}

export function InterfaceSection() {
  const t = useT();
  return (
    <Section id="interface" eyebrow={t('Guide')} title={t('Interface guide')}>
      <p>
        {t('The map fills the viewport and every control floats above it. Panels are toggles rather than destinations, so you can build up exactly the picture you need and drop the rest.')}
      </p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {INTERFACE_PARTS.map(row => (
          <div
            key={row.k}
            className="rounded-card border border-line bg-surface-1 p-4"
          >
            <div className="text-[14px] font-medium text-ink-1 mb-1">{t(row.k)}</div>
            <div className="text-[14px] leading-[1.65] text-ink-2">{t(row.v)}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ShortcutsSection() {
  const t = useT();
  return (
    <Section id="shortcuts" eyebrow={t('Guide')} title={t('Keyboard shortcuts')}>
      <p>
        {t.rich('Press {key} at any time inside the application to bring up this list.', { key: <Code>?</Code> })}
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {SHORTCUTS.map(s => (
          <div
            key={s.key}
            className="flex items-center gap-3 rounded-card border border-line bg-surface-1 px-3.5 py-2.5"
          >
            <kbd className="font-mono text-[12px] min-w-[2.4rem] text-center px-2 py-1 rounded-[4px] border border-line-strong bg-surface-2 text-ink-1">
              {s.key}
            </kbd>
            <span className="text-[14px] text-ink-2">{t(s.desc)}</span>
          </div>
        ))}
      </div>
      <p className="pt-2">
        {t.rich('In these docs, {palette} (or {slash}) opens search from anywhere on the page.', {
          palette: <Code>⌘K</Code>,
          slash: <Code>/</Code>,
        })}
      </p>
    </Section>
  );
}

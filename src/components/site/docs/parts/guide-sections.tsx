'use client';

import { Callout, Code, CodeBlock, Pre, Section } from './docs-primitives';

export function OverviewSection() {
  return (
    <Section id="overview" eyebrow="Guide" title="Overview">
      <p>
        Every data point on the map is rendered through WebGL via MapLibre GL, which is what lets the interface
        hold thousands of concurrent entities at 60fps. The application is a Next.js app: the map and HUD run in
        the browser, and each live feed is normalised by a route under <Code>/api</Code> before it reaches the
        client.
      </p>
      <p>
        That boundary is deliberate. Upstream sources disagree about formats, rate limits, and CORS policy, so
        the API layer absorbs those differences and hands back consistent JSON.
      </p>
      <Callout tone="good" title="No credentials needed">
        Aviation, satellites, fires, earthquakes, weather, news, and CVE data all come from public keyless
        feeds, and the RECON tools run keyless too. A few layers need a key of their own: live vessels, Cloudflare
        Radar and TomTom traffic flow.
      </Callout>
    </Section>
  );
}

export function QuickStartSection({ origin }: { origin: string }) {
  return (
    <Section id="quickstart" eyebrow="Guide" title="Quick start">
      <p>
        Every feed is a plain <Code>GET</Code> returning JSON and needs no authentication — paste any of these
        into a terminal.
      </p>
      <CodeBlock
        label="Fetch live aircraft"
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
        If you only need magnitudes rather than geometry, <Code>/api/stats</Code> is the right endpoint to poll —
        it collapses the heavy feeds into a handful of counters.
      </p>
      <Pre label="Aggregate counters" lang="bash">{`curl -s ${origin}/api/stats
# { "stats": { "flights": 9241, "sats": 2043, "cctv": 2117,
#              "weather": 58, "nuclear": 191, "incidents": 412 },
#   "timestamp": "2026-07-29T12:00:00Z" }`}</Pre>
      <p>The OSINT lookups each take one subject, so they compose cleanly in a pipeline. They need an account, so send an API key:</p>
      <Pre label="Passive subdomain enumeration" lang="bash">{`curl -s -H "Authorization: Bearer $YOUR_API_KEY" "${origin}/api/osint/certs?domain=example.com" | jq -r '.subdomains[]'`}</Pre>
      <p>
        The same key opens the accounts API (<Code>/api/v1</Code>, documented at <Code>/api/v1/docs</Code>) and replay data
        (<Code>/api/replay</Code>). Without one, most of their endpoints answer <Code>401 api_key_required</Code>;{' '}
        <Code>/api/v1/key-policy</Code> lists the ones open to everyone. A free account comes with a key.
      </p>
      <Callout tone="info" title="Try before you write code">
        Every GET endpoint in the reference below has a <strong>Send request</strong> button that runs it against
        this instance and shows the live response.
      </Callout>
    </Section>
  );
}

export function SelfHostingSection() {
  return (
    <Section id="self-hosting" eyebrow="Guide" title="Self-hosting">
      <p>
        The map needs Node 20+ and no database. Accounts, and with them the OSINT tools, come from the accounts
        API in <Code>apps/api</Code>, which <Code>npm run dev</Code> starts beside the web app on port 4100. A local
        instance is three commands:
      </p>
      <Pre label="Local development" lang="bash">{`git clone https://github.com/batuhantoker/takip.git
cd takip
npm install
npm run dev        # http://localhost:3000`}</Pre>
      <p>For a production build, or to run the checks:</p>
      <Pre label="Build and test" lang="bash">{`npm run build && npm start
npm run lint
npm test           # vitest
npm run test:live  # includes tests that hit live upstream feeds`}</Pre>
      <p>
        A <Code>Dockerfile</Code> and <Code>docker-compose.yml</Code> ship with the repository. The container
        always listens on port 3000 internally; <Code>TAKIP_PORT</Code> controls the host port it is published
        on.
      </p>
      <Pre label="Docker" lang="bash">{`cp .env.example .env
docker compose up -d`}</Pre>
    </Section>
  );
}

export function ConfigurationSection() {
  return (
    <Section id="configuration" eyebrow="Guide" title="Configuration">
      <p>
        Copy <Code>.env.example</Code> to <Code>.env</Code>. Read that file before filling anything in — most of
        the keys it lists are reserved for future sources and are not consumed by the current code.
      </p>
      <h3 className="text-[15px] font-semibold text-ink-1 pt-3">
        Read by the application
      </h3>
      <div className="space-y-2">
        {[
          {
            k: 'SDK_INGEST_KEY',
            v: 'Shared secret for /api/sdk/ingest. The endpoint fails closed: while this is unset, ingestion is disabled and returns 503.',
          },
          {
            k: 'AIS_API_KEY',
            v: 'aisstream.io key for live vessel positions. Without it /api/maritime still has ports and chokepoints, but no ships.',
          },
          {
            k: 'CLOUDFLARE_API_TOKEN',
            v: 'A Cloudflare token scoped to Radar: Read, for the internet outages and attack-origins layer. Unset, /api/cloudflare-radar reports itself unconfigured.',
          },
          {
            k: 'TOMTOM_API_KEY',
            v: 'TomTom key for the worldwide traffic flow tiles. Unset, /api/traffic/flow answers 204.',
          },
          {
            k: 'GEMINI_API_KEY_1 … _8',
            v: 'The server’s own Gemini keys for the AI routes, used for Pro plans. Anyone can still send their own in X-Gemini-Key.',
          },
          {
            k: 'TAKIP_PORT',
            v: 'Host port the UI is published on. The container itself always listens on 3000.',
          },
        ].map(row => (
          <div
            key={row.k}
            className="rounded-card border border-line bg-surface-1 p-4"
          >
            <div className="font-mono text-[13px] text-ink-1 mb-1">{row.k}</div>
            <div className="text-[14px] leading-[1.65] text-ink-2">{row.v}</div>
          </div>
        ))}
      </div>
      <h3 className="text-[15px] font-semibold text-ink-1 pt-3">
        Optional — higher limits or deeper results
      </h3>
      <p>
        <Code>OPENSKY_CLIENT_ID</Code> and <Code>OPENSKY_CLIENT_SECRET</Code> lift OpenSky’s anonymous budget of
        400 credits a day. <Code>ETHERSCAN_API_KEY</Code> and <Code>HELIUS_API_KEY</Code> deepen Ethereum and
        Solana wallet lookups. <Code>FIRMS_API_KEY</Code> and <Code>N2YO_API_KEY</Code> are not read: the keyless
        feeds serve those layers.
      </p>
      <Callout tone="warn" title="Secrets hygiene">
        Generate secrets with <Code>openssl rand -hex 32</Code>. Never commit a populated <Code>.env</Code> —
        only <Code>.env.example</Code> belongs in version control.
      </Callout>
    </Section>
  );
}

export function InterfaceSection() {
  return (
    <Section id="interface" eyebrow="Guide" title="Interface guide">
      <p>
        The map fills the viewport and every control floats above it. Panels are toggles rather than
        destinations, so you can build up exactly the picture you need and drop the rest.
      </p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {[
          {
            k: 'Layer Panel',
            v: 'The left rail. Switches individual feeds on and off, and carries the theme selector.',
          },
          {
            k: 'RECON Toolkit',
            v: 'DNS, WHOIS, certificate transparency, IP and ASN enrichment, breach checks, sanctions, CVE lookup, port scanning.',
          },
          {
            k: 'Intel Feed',
            v: 'A running stream of incoming events across every enabled feed.',
          },
          {
            k: 'Region Dossier',
            v: 'Double right-click the map for a composite summary of that location from every feed covering it.',
          },
          {
            k: 'Entity Graph',
            v: 'Link analysis, expanding one node at a time into its neighbours.',
          },
          {
            k: 'Status Bar',
            v: 'Community and docs links on the left, then a live ticker of prices and significant seismic events.',
          },
        ].map(row => (
          <div
            key={row.k}
            className="rounded-card border border-line bg-surface-1 p-4"
          >
            <div className="text-[14px] font-medium text-ink-1 mb-1">{row.k}</div>
            <div className="text-[14px] leading-[1.65] text-ink-2">{row.v}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ShortcutsSection() {
  return (
    <Section id="shortcuts" eyebrow="Guide" title="Keyboard shortcuts">
      <p>
        Press <Code>?</Code> at any time inside the application to bring up this list.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {[
          { key: 'F', desc: 'Toggle fullscreen' },
          { key: 'S', desc: 'Share current view' },
          { key: 'L', desc: 'Toggle layer panel' },
          { key: 'M', desc: 'Toggle markets panel' },
          { key: 'I', desc: 'Toggle intel feed' },
          { key: 'R', desc: 'Reset to global view' },
          { key: '?', desc: 'Show help' },
          { key: 'ESC', desc: 'Close panels / popups' },
        ].map(s => (
          <div
            key={s.key}
            className="flex items-center gap-3 rounded-card border border-line bg-surface-1 px-3.5 py-2.5"
          >
            <kbd className="font-mono text-[12px] min-w-[2.4rem] text-center px-2 py-1 rounded-[4px] border border-line-strong bg-surface-2 text-ink-1">
              {s.key}
            </kbd>
            <span className="text-[14px] text-ink-2">{s.desc}</span>
          </div>
        ))}
      </div>
      <p className="pt-2">
        In these docs, <Code>⌘K</Code> (or <Code>/</Code>) opens search from anywhere on the page.
      </p>
    </Section>
  );
}

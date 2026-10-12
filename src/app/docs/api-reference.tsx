'use client';

import { API_GROUPS, endpointId } from './apiCatalog';
import { Callout, Code, Section } from './docsPrimitives';
import EndpointCard from './EndpointCard';

export function ApiReference({ origin }: { origin: string }) {
  return (
    <>
      <Section id="api" eyebrow="API Reference" title="Conventions">
        <p>
          All routes live under <Code>/api</Code> on whatever origin serves the application. Reads are{' '}
          <Code>GET</Code>, writes are <Code>POST</Code> with a JSON body. Nothing requires authentication except{' '}
          <Code>/api/sdk/ingest</Code> and <Code>/api/github-webhook</Code>. OI runs on a model key you bring,
          sent in the <Code>X-OI-Key</Code> header.
        </p>
        <div className="space-y-2.5">
          {[
            {
              k: 'Errors',
              v: 'Failures return a non-2xx status with an `error` key, often alongside `detail` carrying the upstream message. Most routes proxy third parties, so treat upstream failure as normal — check response.ok before reading the body.',
            },
            {
              k: 'Caching',
              v: 'Routes set their own Cache-Control TTLs: typically 45–60s for fast-moving feeds, up to a day for static reference data. Polling faster than the TTL gains nothing but load. Where a route advertises refreshInterval, use it.',
            },
            {
              k: 'Rate limits',
              v: 'The three AI endpoints allow 5 requests per minute per IP and return 429 beyond that. Other routes are bounded indirectly by their upstream sources.',
            },
            { k: 'Timestamps', v: 'Every timestamp field is ISO 8601 in UTC.' },
          ].map(row => (
            <div key={row.k} className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5">
              <div className="font-mono text-[11.5px] text-[var(--gold-primary)] mb-1.5">{row.k}</div>
              <div className="text-[12.5px] leading-[1.7] text-[var(--text-secondary)]">{row.v}</div>
            </div>
          ))}
        </div>
        <Callout tone="warn" title="Responsible use">
          The RECON scanner and <Code>/api/osint/sweep</Code> generate traffic against the targets you name. Only
          point them at infrastructure you own or have written authorisation to test. The remaining OSINT routes
          are passive and query third-party datasets rather than the subject itself.
        </Callout>
      </Section>

      {API_GROUPS.map(group => (
        <Section key={group.id} id={`api-${group.id}`} eyebrow="API Reference" title={group.title}>
          <p>{group.blurb}</p>
          <div className="space-y-2.5 pt-1">
            {group.endpoints.map(ep => (
              <EndpointCard key={endpointId(ep)} ep={ep} origin={origin} />
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

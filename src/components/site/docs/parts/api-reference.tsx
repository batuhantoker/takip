'use client';

import { API_GROUPS, endpointId } from '@/components/site/docs/api-catalog';
import { Callout, Code, Section } from './docs-primitives';
import EndpointCard from './endpoint-card';

export function ApiReference({ origin }: { origin: string }) {
  return (
    <>
      <Section id="api" eyebrow="API reference" title="Conventions">
        <p>
          All routes live under <Code>/api</Code> on whatever origin serves the application. Reads are{' '}
          <Code>GET</Code>, writes are <Code>POST</Code> with a JSON body. Nothing requires authentication except{' '}
          <Code>/api/sdk/ingest</Code>, <Code>/api/github-webhook</Code>, and the AI endpoints when they run on the
          server&apos;s Gemini key, which is for Pro plans. TI runs on a model key you bring, sent in the{' '}
          <Code>X-AI-Key</Code> header; <Code>Authorization</Code> is reserved for TAKIP API keys.
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
            <div key={row.k} className="rounded-card border border-line bg-surface-1 p-4">
              <div className="text-[14px] font-medium text-ink-1 mb-1">{row.k}</div>
              <div className="text-[14px] leading-[1.65] text-ink-2">{row.v}</div>
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
        <Section key={group.id} id={`api-${group.id}`} eyebrow="API reference" title={group.title}>
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

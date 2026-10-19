'use client';

import { API_GROUPS, endpointId } from '@/components/site/docs/api-catalog';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { Callout, Code, Section } from './docs-primitives';
import EndpointCard from './endpoint-card';

const CONVENTIONS = [
  {
    k: msg('Errors'),
    v: msg('Failures return a non-2xx status with an `error` key, often alongside `detail` carrying the upstream message. Most routes proxy third parties, so treat upstream failure as normal — check response.ok before reading the body.'),
  },
  {
    k: msg('Caching'),
    v: msg('Routes set their own Cache-Control TTLs: typically 45–60s for fast-moving feeds, up to a day for static reference data. Polling faster than the TTL gains nothing but load. Where a route advertises refreshInterval, use it.'),
  },
  {
    k: msg('Rate limits'),
    v: msg('The three AI endpoints allow 5 requests per minute per IP and return 429 beyond that. Other routes are bounded indirectly by their upstream sources.'),
  },
  { k: msg('Timestamps'), v: msg('Every timestamp field is ISO 8601 in UTC.') },
];

export function ApiReference({ origin }: { origin: string }) {
  const t = useT();
  return (
    <>
      <Section id="api" eyebrow={t('API reference')} title={t('Conventions')}>
        <p>
          {t.rich("All routes live under {api} on whatever origin serves the application. Reads are {get}, writes are {post} with a JSON body. Nothing requires authentication except {ingest}, {webhook}, and the AI endpoints when they run on the server's Gemini key, which is for Pro plans. TI runs on a model key you bring, sent in the {aiKey} header; {authorization} is reserved for TAKIP API keys.", {
            api: <Code>/api</Code>,
            get: <Code>GET</Code>,
            post: <Code>POST</Code>,
            ingest: <Code>/api/sdk/ingest</Code>,
            webhook: <Code>/api/github-webhook</Code>,
            aiKey: <Code>X-AI-Key</Code>,
            authorization: <Code>Authorization</Code>,
          })}
        </p>
        <div className="space-y-2.5">
          {CONVENTIONS.map(row => (
            <div key={row.k} className="rounded-card border border-line bg-surface-1 p-4">
              <div className="text-[14px] font-medium text-ink-1 mb-1">{t(row.k)}</div>
              <div className="text-[14px] leading-[1.65] text-ink-2">{t(row.v)}</div>
            </div>
          ))}
        </div>
        <Callout tone="warn" title={t('Responsible use')}>
          {t.rich('The RECON scanner and {sweep} generate traffic against the targets you name. Only point them at infrastructure you own or have written authorisation to test. The remaining OSINT routes are passive and query third-party datasets rather than the subject itself.', {
            sweep: <Code>/api/osint/sweep</Code>,
          })}
        </Callout>
      </Section>

      {API_GROUPS.map(group => (
        <Section key={group.id} id={`api-${group.id}`} eyebrow={t('API reference')} title={t(group.title)}>
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

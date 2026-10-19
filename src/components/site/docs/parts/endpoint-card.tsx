'use client';

import { useMemo, useState } from 'react';
import { endpointId, type ApiEndpoint } from '@/components/site/docs/api-catalog';
import { CodeBlock, CopyButton, type CodeTab } from './docs-primitives';
import { useT } from '@/components/ui/use-t';

const METHOD_STYLES: Record<string, string> = {
  GET: 'text-green border-green/35',
  POST: 'text-amber border-amber/35',
  DELETE: 'text-red border-red/35',
};

/** Line continuation for the shell snippets. */
const CONT = ` ${String.fromCharCode(92)}\n`;

/** Snippets for a route that reads request headers (a model key, a run token). */
function buildWithHeaders(method: string, url: string, body: string, headers: [string, string][]): CodeTab[] {
  const hasBody = method === 'POST';
  const all: [string, string][] = hasBody ? [['Content-Type', 'application/json'], ...headers] : headers;
  const curl = [
    `curl -s${method === 'GET' ? '' : ` -X ${method}`} "${url}"`,
    ...all.map(([k, v]) => `  -H "${k}: ${v}"`),
    ...(hasBody ? [`  -d '${body}'`] : []),
  ].join(CONT);
  const jsHeaders = all.map(([k, v]) => `"${k}": "${v}"`).join(', ');
  const js = [
    `const res = await fetch("${url}", {`,
    `  method: "${method}",`,
    `  headers: { ${jsHeaders} },`,
    ...(hasBody ? [`  body: JSON.stringify(${body.replace(/\n/g, '\n  ')})`] : []),
    '});',
    'const data = await res.json();',
  ].join('\n');
  const pyBody = body.replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None');
  const py = [
    'import requests',
    '',
    `r = requests.${method.toLowerCase()}(`,
    `    "${url}",`,
    `    headers={${headers.map(([k, v]) => `"${k}": "${v}"`).join(', ')}},`,
    ...(hasBody ? [`    json=${pyBody},`] : []),
    ')',
    'data = r.json()',
  ].join('\n');
  return [
    { label: 'cURL', lang: 'bash', code: curl },
    { label: 'JavaScript', lang: 'javascript', code: js },
    { label: 'Python', lang: 'python', code: py },
  ];
}

/* ─────────────────────────────────────────────────────────────
   Request snippet generation
   ───────────────────────────────────────────────────────────── */

function buildTabs(ep: ApiEndpoint, url: string): CodeTab[] {
  const method = Array.isArray(ep.method) ? ep.method[0] : ep.method;
  const isPost = method === 'POST';
  const body = ep.bodyExample || '{}';
  if (ep.headers) return buildWithHeaders(method, url, body, Object.entries(ep.headers));

  const curl = isPost
    ? `curl -s -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`
    : `curl -s "${url}"`;

  const js = isPost
    ? `const res = await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${body.replace(/\n/g, '\n  ')})
});
const data = await res.json();`
    : `const res = await fetch("${url}");
const data = await res.json();`;

  const py = isPost
    ? `import requests

r = requests.post(
    "${url}",
    json=${body.replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')},
)
data = r.json()`
    : `import requests

r = requests.get("${url}")
data = r.json()`;

  return [
    { label: 'cURL', lang: 'bash', code: curl },
    { label: 'JavaScript', lang: 'javascript', code: js },
    { label: 'Python', lang: 'python', code: py },
  ];
}

/* ─────────────────────────────────────────────────────────────
   Endpoint card
   ───────────────────────────────────────────────────────────── */

export default function EndpointCard({ ep, origin }: { ep: ApiEndpoint; origin: string }) {
  const t = useT();
  const methods = Array.isArray(ep.method) ? ep.method : [ep.method];
  const primary = methods[0];
  const id = endpointId(ep);

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((ep.params || []).map(p => [p.name, (p.example || '').split(' | ')[0] || '']))
  );

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: number; ms: number; body: string; ok: boolean } | null>(null);

  /** Live URL reflecting whatever the reader has typed into the param inputs. */
  const liveUrl = useMemo(() => {
    const qs = (ep.params || [])
      .filter(p => values[p.name]?.trim())
      .map(p => `${p.name}=${encodeURIComponent(values[p.name].trim())}`)
      .join('&');
    return `${ep.path}${qs ? `?${qs}` : ''}`;
  }, [ep, values]);

  const tabs = useMemo(() => buildTabs(ep, `${origin}${liveUrl}`), [ep, origin, liveUrl]);

  const canTry = primary === 'GET' && !ep.requiresAuth;
  const missingRequired = (ep.params || []).filter(p => p.required && !values[p.name]?.trim());

  const run = async () => {
    setRunning(true);
    setResult(null);
    const started = performance.now();
    try {
      const res = await fetch(liveUrl, { headers: { Accept: 'application/json' } });
      const ms = Math.round(performance.now() - started);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON — show the raw body */
      }
      const truncated = pretty.length > 4000 ? `${pretty.slice(0, 4000)}\n\n${t('… truncated')}` : pretty;
      setResult({ status: res.status, ms, body: truncated, ok: res.ok });
    } catch (e) {
      setResult({
        status: 0,
        ms: Math.round(performance.now() - started),
        ok: false,
        body: t('Request failed: {error}', { error: e instanceof Error ? e.message : String(e) }),
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      id={id}
      className={`scroll-mt-28 rounded-card border bg-surface-1 transition-colors ${
        open ? 'border-line-strong' : 'border-line hover:border-line-strong'
      }`}
    >
      {/* ── Header row ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full text-left p-4 flex items-start gap-3 group"
      >
        <div className="flex flex-col gap-1 shrink-0 pt-0.5">
          {methods.map(m => (
            <span
              key={m}
              className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-[4px] border text-center ${METHOD_STYLES[m]}`}
            >
              {m}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[13px] text-ink-1 font-medium break-all mb-1">
            {ep.path}
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">{ep.summary}</p>
        </div>

        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 shrink-0 mt-0.5 text-ink-3 group-hover:text-ink-1 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
        <div className="px-4 pb-4 -mt-1">
          {/* Params */}
          {ep.params && ep.params.length > 0 && (
            <div className="mb-4">
              <div className="text-[12px] font-medium text-ink-3 mb-2">{t('Query parameters')}</div>
              <div className="space-y-2">
                {ep.params.map(p => (
                  <div key={p.name} className="grid grid-cols-1 sm:grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1 items-start">
                    <div className="flex items-center gap-1.5 pt-1.5">
                      <span className="font-mono text-[13px] text-ink-1">{p.name}</span>
                      {p.required ? (
                        <span className="text-[11px] text-amber">{t('required')}</span>
                      ) : (
                        <span className="text-[11px] text-ink-3">{t('optional')}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <input
                        value={values[p.name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [p.name]: e.target.value }))}
                        placeholder={p.example || p.name}
                        aria-label={t('{name} value', { name: p.name })}
                        className="w-full h-8 px-2.5 rounded-md text-[13px] font-mono bg-surface-2 border border-line-strong text-ink-1 placeholder:text-ink-4 outline-none focus:border-accent"
                      />
                      <p className="text-[13px] leading-relaxed text-ink-2 mt-1">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request body */}
          {ep.bodyExample && (
            <>
              <div className="text-[12px] font-medium text-ink-3 mb-1">{t('Request body')}</div>
              <CodeBlock dense tabs={[{ label: 'JSON', lang: 'json', code: ep.bodyExample }]} />
            </>
          )}

          {/* Request snippets */}
          <div className="text-[12px] font-medium text-ink-3 mb-1 mt-4">{t('Request')}</div>
          <CodeBlock dense tabs={tabs} />

          {/* Try it */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {canTry ? (
              <>
                <button
                  onClick={run}
                  disabled={running || missingRequired.length > 0}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 h-8 rounded-md bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {running ? (
                    <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                  {running ? t('Running') : t('Send request')}
                </button>
                {missingRequired.length > 0 && (
                  <span className="text-[12px] text-ink-3">
                    {t.rich('Fill in {names} first', { names: <span className="font-mono">{missingRequired.map(p => p.name).join(', ')}</span> })}
                  </span>
                )}
                <CopyButton value={`${origin}${liveUrl}`} />
              </>
            ) : (
              <span className="text-[12px] text-ink-3">
                {ep.requiresAuth
                  ? t('Requires a credential — run this from your own client.')
                  : t('POST endpoint — run this from your own client.')}
              </span>
            )}
          </div>

          {/* Live response */}
          {result && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-medium text-ink-3">{t('Response')}</span>
                <span
                  className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-[4px] border ${
                    result.ok ? 'text-green border-green/35' : 'text-red border-red/35'
                  }`}
                >
                  {result.status || 'ERR'}
                </span>
                <span className="text-[11px] font-mono text-ink-3 tabular-nums">{result.ms} ms</span>
              </div>
              <CodeBlock dense tabs={[{ label: 'JSON', lang: 'json', code: result.body }]} />
            </div>
          )}

          {/* Returns */}
          <div className="mt-4">
            <div className="text-[12px] font-medium text-ink-3 mb-1.5">{t('Response keys')}</div>
            <div className="flex flex-wrap gap-1.5">
              {ep.returns.map(r => (
                <span
                  key={r}
                  className="font-mono text-[12px] px-1.5 py-0.5 rounded-[4px] bg-surface-2 border border-line text-ink-2"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* Env */}
          {ep.env && ep.env.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-medium text-ink-3">{t('Environment')}</span>
              {ep.env.map(e => (
                <span
                  key={e}
                  className="font-mono text-[12px] px-1.5 py-0.5 rounded-[4px] bg-surface-2 border border-line text-ink-2"
                >
                  {e}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {ep.notes && (
            <p className="mt-4 text-[13px] leading-[1.65] text-ink-3 border-l-2 border-line-strong pl-3">
              {ep.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import type { Tone } from '@/components/ui/class-names';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { CopyButton, ResultRow, Target, Verdict, type ToolResultProps } from './result-primitives';

const GRADE_TONE: Record<string, Tone> = { A: 'green', B: 'blue', C: 'amber', F: 'red' };

/** Which protective headers a site sends, graded. */
export function HeadersResult({ r, query }: ToolResultProps) {
  const sec = r.security ?? { score: 0, max: 6, grade: 'F', present: [], missing: [] };
  const present: string[] = sec.present ?? [];
  const missing: string[] = sec.missing ?? [];
  return (
    <div>
      <Verdict tone={GRADE_TONE[sec.grade] ?? 'neutral'} title={`Grade ${sec.grade}`}
        body={<><span className="tabular-nums">{sec.score} of {sec.max}</span> protective headers on <Target value={r.final_url || query} /></>} />

      <PanelSection title="Protective headers">
        {[...present.map(n => [n, true] as const), ...missing.map(n => [n, false] as const)].map(([name, set]) => (
          <div key={name} className="flex items-center gap-2.5 border-b border-line py-1.5 last:border-0">
            {set
              ? <Check aria-hidden className="size-4 shrink-0 text-green" strokeWidth={2} />
              : <Minus aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={2} />}
            <span className="text-small text-ink-1">{name}</span>
            <span className="ml-auto text-meta text-ink-3">{set ? 'Set' : 'Missing'}</span>
          </div>
        ))}
      </PanelSection>

      <PanelSection title="Response">
        <ResultRow label="Answers with" value={`HTTP ${r.status}`} mono={false}
          note={r.redirected && r.final_url ? `after redirecting to ${r.final_url}` : undefined} />
        <ResultRow label="Server" value={r.headers?.server} mono={false} />
        <ResultRow label="Powered by" value={r.headers?.['x-powered-by']} mono={false} />
      </PanelSection>
    </div>
  );
}

/** What a site is built on, read only from what it actually emits. */
export function TechResult({ r, query }: ToolResultProps) {
  const techs: { name: string; category: string; evidence: string }[] = r.technologies ?? [];
  const groups = [...new Set(techs.map(t => t.category))];
  return (
    <div>
      <Verdict title={techs.length ? `${techs.length} ${techs.length === 1 ? 'technology' : 'technologies'} detected` : 'Nothing identifiable'}
        body={techs.length
          ? <>On <Target value={r.final_url || query} />, from its headers and markup</>
          : <>No headers, cookies or markup on <Target value={r.final_url || query} /> matched a known signature.</>} />
      {groups.map(cat => (
        <PanelSection key={cat} title={cat}>
          {techs.filter(t => t.category === cat).map(t => (
            <ListRow key={t.name} compact title={t.name} subtitle={<span className="text-ink-3">{t.evidence}</span>} />
          ))}
        </PanelSection>
      ))}
      {!techs.length && (
        <PanelSection title="Response">
          <ResultRow label="Server" value={r.server} mono={false} />
          <ResultRow label="Powered by" value={r.powered_by} mono={false} />
        </PanelSection>
      )}
    </div>
  );
}

const NAMES_SHOWN = 30;

/** Hostnames found under a domain, merged from several public sources. */
export function SubdomainsResult({ r, query }: ToolResultProps) {
  const [all, setAll] = useState(false);
  const names: string[] = r.subdomains ?? [];
  const sources: { name: string; ok: boolean; found: number }[] = r.sources ?? [];

  return (
    <div>
      <Verdict tone={names.length ? 'blue' : undefined}
        title={names.length ? `${names.length.toLocaleString()} ${names.length === 1 ? 'subdomain' : 'subdomains'}` : 'No subdomains found'}
        body={<>Under <Target value={r.domain || query} /></>} />

      <PanelSection title="Sources">
        <div className="flex flex-wrap gap-1.5">
          {sources.map(s => (
            <Tag key={s.name} tone={s.ok ? 'green' : 'red'}>{s.name}{s.ok ? ` · ${s.found}` : ' · failed'}</Tag>
          ))}
        </div>
      </PanelSection>

      {names.length > 0 && (
        <PanelSection title="Hostnames" hint={names.length} action={<CopyButton text={names.join('\n')} />}>
          <ul className="flex flex-col gap-1 text-small text-ink-1">
            {(all ? names : names.slice(0, NAMES_SHOWN)).map(n => <li key={n} className="break-all">{n}</li>)}
          </ul>
          {names.length > NAMES_SHOWN && (
            <Button className="mt-2 -ml-2.5" variant="ghost" size="sm" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${names.length.toLocaleString()}`}
            </Button>
          )}
        </PanelSection>
      )}
    </div>
  );
}

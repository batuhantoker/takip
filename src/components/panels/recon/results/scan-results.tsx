'use client';

import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import type { Tone } from '@/components/ui/class-names';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { CopyButton, ResultRow, Target, Verdict, type ToolResultProps } from './result-primitives';

const GRADE_TONE: Record<string, Tone> = { A: 'green', B: 'blue', C: 'amber', F: 'red' };

/** Which protective headers a site sends, graded. */
export function HeadersResult({ r, query }: ToolResultProps) {
  const t = useT();
  const sec = r.security ?? { score: 0, max: 6, grade: 'F', present: [], missing: [] };
  const present: string[] = sec.present ?? [];
  const missing: string[] = sec.missing ?? [];
  return (
    <div>
      <Verdict tone={GRADE_TONE[sec.grade] ?? 'neutral'} title={t('Grade {grade}', { grade: sec.grade })}
        body={t.rich('{score} of {max} protective headers on {site}', {
          score: <span className="tabular-nums">{sec.score}</span>, max: <span className="tabular-nums">{sec.max}</span>, site: <Target value={r.final_url || query} />,
        })} />

      <PanelSection title={t('Protective headers')}>
        {[...present.map(n => [n, true] as const), ...missing.map(n => [n, false] as const)].map(([name, set]) => (
          <div key={name} className="flex items-center gap-2.5 border-b border-line py-1.5 last:border-0">
            {set
              ? <Check aria-hidden className="size-4 shrink-0 text-green" strokeWidth={2} />
              : <Minus aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={2} />}
            <span className="text-small text-ink-1">{name}</span>
            <span className="ml-auto text-meta text-ink-3">{set ? t('Set') : t('Missing')}</span>
          </div>
        ))}
      </PanelSection>

      <PanelSection title={t('Response')}>
        <ResultRow label={t('Answers with')} value={`HTTP ${r.status}`} mono={false}
          note={r.redirected && r.final_url ? t('after redirecting to {url}', { url: r.final_url }) : undefined} />
        <ResultRow label={t('Server')} value={r.headers?.server} mono={false} />
        <ResultRow label={t('Powered by')} value={r.headers?.['x-powered-by']} mono={false} />
      </PanelSection>
    </div>
  );
}

/** What a site is built on, read only from what it actually emits. */
export function TechResult({ r, query }: ToolResultProps) {
  const t = useT();
  const techs: { name: string; category: string; evidence: string }[] = r.technologies ?? [];
  const groups = [...new Set(techs.map(tech => tech.category))];
  return (
    <div>
      <Verdict title={techs.length ? t('{n, plural, one {# technology detected} other {# technologies detected}}', { n: techs.length }) : t('Nothing identifiable')}
        body={techs.length
          ? t.rich('On {site}, from its headers and markup', { site: <Target value={r.final_url || query} /> })
          : t.rich('No headers, cookies or markup on {site} matched a known signature.', { site: <Target value={r.final_url || query} /> })} />
      {groups.map(cat => (
        <PanelSection key={cat} title={cat}>
          {techs.filter(tech => tech.category === cat).map(tech => (
            <ListRow key={tech.name} compact title={tech.name} subtitle={<span className="text-ink-3">{tech.evidence}</span>} />
          ))}
        </PanelSection>
      ))}
      {!techs.length && (
        <PanelSection title={t('Response')}>
          <ResultRow label={t('Server')} value={r.server} mono={false} />
          <ResultRow label={t('Powered by')} value={r.powered_by} mono={false} />
        </PanelSection>
      )}
    </div>
  );
}

const NAMES_SHOWN = 30;

/** Hostnames found under a domain, merged from several public sources. */
export function SubdomainsResult({ r, query }: ToolResultProps) {
  const t = useT();
  const [all, setAll] = useState(false);
  const names: string[] = r.subdomains ?? [];
  const sources: { name: string; ok: boolean; found: number }[] = r.sources ?? [];

  return (
    <div>
      <Verdict tone={names.length ? 'blue' : undefined}
        title={names.length ? t('{n, plural, one {# subdomain} other {# subdomains}}', { n: names.length }) : t('No subdomains found')}
        body={t.rich('Under {domain}', { domain: <Target value={r.domain || query} /> })} />

      <PanelSection title={t('Sources')}>
        <div className="flex flex-wrap gap-1.5">
          {sources.map(s => (
            <Tag key={s.name} tone={s.ok ? 'green' : 'red'}>{s.name}{s.ok ? ` · ${s.found}` : ` · ${t('failed')}`}</Tag>
          ))}
        </div>
      </PanelSection>

      {names.length > 0 && (
        <PanelSection title={t('Hostnames')} hint={names.length} action={<CopyButton text={names.join('\n')} />}>
          <ul className="flex flex-col gap-1 text-small text-ink-1">
            {(all ? names : names.slice(0, NAMES_SHOWN)).map(n => <li key={n} className="break-all">{n}</li>)}
          </ul>
          {names.length > NAMES_SHOWN && (
            <Button className="mt-2 -ml-2.5" variant="ghost" size="sm" onClick={() => setAll(!all)}>
              {all ? t('Show fewer') : t('Show all {n}', { n: names.length })}
            </Button>
          )}
        </PanelSection>
      )}
    </div>
  );
}

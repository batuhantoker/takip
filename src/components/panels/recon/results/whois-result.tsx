'use client';

import type { Tone } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { ResultRow, SanctionsBadge, day, fromNow, plain, type ToolResultProps } from './result-primitives';

type Entity = { roles?: string[]; name?: string; org?: string };

const GRADE_TONE: Record<string, Tone> = { A: 'green', B: 'neutral', C: 'amber', F: 'red' };

// The headers the route scores, in the order a reader would fix them.
const PROTECTIVE: [string, string][] = [
  ['strict-transport-security', 'HSTS'],
  ['content-security-policy', 'CSP'],
  ['x-frame-options', 'X-Frame-Options'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
];

const party = (entities: Entity[], role: string) => {
  const e = entities.find(x => x.roles?.includes(role));
  return e ? (e.org || e.name) : null;
};

/** Who registered a domain and when (RDAP), and how its website answers. */
export function WhoisResult({ r, query }: ToolResultProps) {
  const t = useT();
  const rdap = r.rdap;
  const entities: Entity[] = rdap?.entities ?? [];
  const http = r.http;
  const score = r.security_score;
  const missing = http ? PROTECTIVE.filter(([h]) => !http.headers?.[h]).map(([, name]) => name) : [];

  return (
    <div>
      <SanctionsBadge match={r.sanctions_match} />
      <PanelSection title={t('Domain registration')}>
        {rdap ? (
          <>
            <ResultRow label={t('Domain')} value={(rdap.name || r.domain || query).toLowerCase()} mono={false} />
            <ResultRow label={t('Registrar')} value={party(entities, 'registrar')} mono={false} />
            <ResultRow label={t('Registrant')} value={party(entities, 'registrant')} mono={false} />
            <ResultRow label={t('Registered')} value={day(r.registration, t.intl)} note={fromNow(r.registration, t.intl)} />
            <ResultRow label={t('Expires')} value={day(r.expiration, t.intl)} note={fromNow(r.expiration, t.intl)} />
            <ResultRow label={t('Last changed')} value={day(r.last_changed, t.intl)} note={fromNow(r.last_changed, t.intl)} />
            <ResultRow label={t('Status')} value={(rdap.status ?? []).map(plain)} mono={false} />
            <ResultRow label={t('Name servers')} value={(rdap.nameservers ?? []).map((n: string) => n.toLowerCase())} mono={false} />
          </>
        ) : (
          <p className="text-small text-ink-2">{t('No registration record came back. Some country domains don’t publish one.')}</p>
        )}
      </PanelSection>

      {http && (
        <PanelSection title={t('Website')}>
          <ResultRow label={t('Answers with')} value={`HTTP ${http.status}`} mono={false}
            note={http.redirected && http.final_url ? t('after redirecting to {url}', { url: http.final_url }) : undefined} />
          <ResultRow label={t('Server')} value={http.headers?.server} mono={false} />
          <ResultRow label={t('Powered by')} value={http.headers?.['x-powered-by']} mono={false} />
          {score && (
            <ResultRow label={t('Security headers')} value={t('Grade {grade} · {score} of {max} points', { grade: score.grade, score: score.score, max: score.max })} mono={false}
              tone={GRADE_TONE[score.grade]} note={missing.length ? t('Missing {headers}', { headers: missing.join(', ') }) : t('All the protective headers are set')} />
          )}
        </PanelSection>
      )}
    </div>
  );
}

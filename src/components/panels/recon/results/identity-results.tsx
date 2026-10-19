'use client';

import { ExternalLink } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { ListRow } from '@/components/ui/list-row';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { ResultRow, Verdict, day, fromNow, known, plain, type ToolResultProps } from './result-primitives';

/** libphonenumber's line types in words; unknown ones as plain words. */
export function lineType(type: string, t: Translate): string {
  switch (type) {
    case 'MOBILE': return t('Mobile');
    case 'FIXED_LINE': return t('Fixed line');
    case 'FIXED_LINE_OR_MOBILE': return t('Fixed line or mobile');
    case 'VOIP': return t('VoIP');
    case 'TOLL_FREE': return t('Toll free');
    case 'PREMIUM_RATE': return t('Premium rate');
    case 'SHARED_COST': return t('Shared cost');
    case 'PERSONAL_NUMBER': return t('Personal number');
    case 'PAGER': return t('Pager');
    case 'UAN': return t('Company number');
    case 'VOICEMAIL': return t('Voicemail');
    default: return plain(type);
  }
}

export function UsernameResult({ r }: ToolResultProps) {
  const t = useT();
  const found: number = r.found?.length ?? 0;
  const handle = <span className="text-ink-1">{r.username}</span>;
  const checked = <span className="tabular-nums">{t('{checked} of {total}', { checked: r.checked, total: r.total_available })}</span>;
  return (
    <div>
      <Verdict tone={found ? 'green' : undefined}
        title={found ? t('{n, plural, one {# confirmed account} other {# confirmed accounts}}', { n: found }) : t('No confirmed accounts')}
        body={r.elapsed_ms
          ? t.rich('For {handle} · {checked} sites checked in {seconds} s', { handle, checked, seconds: <span className="tabular-nums">{(r.elapsed_ms / 1000).toLocaleString(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> })
          : t.rich('For {handle} · {checked} sites checked', { handle, checked })} />

      {r.found?.length > 0 && (
        <PanelSection title={t('Confirmed accounts')} hint={r.found.length}>
          {r.found.map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="green" />} title={f.site}
              subtitle={f.url.replace(/^https?:\/\//, '')} href={f.url} external
              trailing={<ExternalLink aria-hidden className="size-3 text-ink-3" />} />
          ))}
        </PanelSection>
      )}

      {r.inconclusive?.length > 0 && (
        <PanelSection title={t('Unsure')} hint={r.inconclusive.length}>
          <p className="mb-1.5 text-small text-ink-2">{t('These sites answered “exists” for a random control handle too, so a hit here is not evidence of an account.')}</p>
          {r.inconclusive.map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="amber" />} title={f.site}
              subtitle={f.url.replace(/^https?:\/\//, '')} href={f.url} external
              trailing={<ExternalLink aria-hidden className="size-3 text-ink-3" />} />
          ))}
        </PanelSection>
      )}

      {r.blocked?.length > 0 && (
        <PanelSection title={t('Blocked, so not checked')} hint={r.blocked.length}>
          <p className="mb-1.5 text-small text-ink-2">{t('These sites refused the lookup, so an account here is neither confirmed nor ruled out.')}</p>
          {r.blocked.map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="muted" />} title={f.site} subtitle={f.reason}
              href={f.url} external trailing={<ExternalLink aria-hidden className="size-3 text-ink-3" />} />
          ))}
        </PanelSection>
      )}

      {r.errors?.length > 0 && (
        <PanelSection title={t('Unreachable')} hint={r.errors.length}>
          {r.errors.slice(0, 10).map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="red" />} title={f.site} subtitle={f.reason} />
          ))}
        </PanelSection>
      )}

      {r.skipped?.length > 0 && (
        <PanelSection title={t('Not applicable')} hint={r.skipped.length}>
          <p className="text-small text-ink-2">{t('{sites}. The handle breaks these sites’ username rules.', { sites: r.skipped.map((s: any) => s.site).join(', ') })}</p>
        </PanelSection>
      )}

      <p className="mt-4 text-meta leading-relaxed text-ink-3">
        {r.verified
          ? t('Every positive is re-tested against a random control handle; sites that accepted it are listed as unsure. Confirm before acting.')
          : t('Calibration was off, so these hits are unfiltered and include pages that only look like profiles.')}
        {r.source && <> · {t('Source: {source}', { source: r.source })}</>}
      </p>
    </div>
  );
}

export function GithubResult({ r }: ToolResultProps) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center gap-3">
        {r.avatar_url && <img src={r.avatar_url} alt="" className="size-10 shrink-0 rounded-full border border-line" />}
        <div className="min-w-0">
          <a href={`https://github.com/${r.username}`} target="_blank" rel="noopener noreferrer"
            className="block truncate text-title font-semibold text-ink-1 hover:text-accent">{r.name || r.username}</a>
          <div className="truncate text-small text-ink-2">
            @{r.username} · {t.rich('{n, plural, one {{count} follower} other {{count} followers}}', { n: r.followers ?? 0, count: <span className="tabular-nums">{(r.followers ?? 0).toLocaleString(t.intl)}</span> })}
            {' · '}{t.rich('{n, plural, one {{count} repository} other {{count} repositories}}', { n: r.public_repos ?? 0, count: <span className="tabular-nums">{(r.public_repos ?? 0).toLocaleString(t.intl)}</span> })}
          </div>
        </div>
      </div>
      <PanelSection title={t('Profile')}>
        <ResultRow label={t('Bio')} value={r.bio} mono={false} />
        <ResultRow label={t('Company')} value={r.company} mono={false} />
        <ResultRow label={t('Location')} value={r.location} mono={false} />
        <ResultRow label={t('Email')} value={r.email} mono={false} />
        <ResultRow label={t('Website')} value={r.blog} mono={false} />
        <ResultRow label="X (Twitter)" value={r.twitter ? `@${r.twitter}` : null} mono={false} />
        <ResultRow label={t('Joined')} value={day(r.created_at, t.intl)} note={fromNow(r.created_at, t.intl)} />
      </PanelSection>
      {r.recent_repos?.length > 0 && (
        <PanelSection title={t('Recently updated repositories')} hint={r.recent_repos.length}>
          {r.recent_repos.map((repo: any, i: number) => (
            <ListRow key={i} compact title={repo.name} meta={repo.language ?? undefined}
              href={`https://github.com/${r.username}/${repo.name}`} external
              trailing={repo.updated ? <span className="text-meta text-ink-3">{fromNow(repo.updated, t.intl)}</span> : undefined} />
          ))}
        </PanelSection>
      )}
    </div>
  );
}

export function PhoneResult({ r }: ToolResultProps) {
  const t = useT();
  const voip = r.line_type === 'VOIP';
  return (
    <div>
      <Verdict tone={r.valid ? 'green' : 'red'} title={r.valid ? t('Valid number') : t('Not a valid number')}
        body={r.valid ? [r.region, r.line_type && r.line_type !== 'UNKNOWN' ? lineType(r.line_type, t) : null].filter(Boolean).join(' · ') : t('It doesn’t fit any country’s numbering plan. Check the country code.')} />
      <PanelSection title={t('Number')}>
        <ResultRow label={t('As typed')} value={r.query} />
        {r.valid && (
          <>
            <ResultRow label="E.164" value={r.number} />
            <ResultRow label={t('International')} value={r.international} />
            <ResultRow label={t('National')} value={r.national} />
            <ResultRow label={t('Country')} value={known(r.region) ? `${r.region} (${r.country_code})` : null} mono={false} />
            <ResultRow label={t('Line type')} value={r.line_type ? lineType(r.line_type, t) : null} mono={false} tone={voip ? 'amber' : undefined}
              note={voip ? t('Internet numbers are easy to get and drop') : undefined} />
          </>
        )}
      </PanelSection>
    </div>
  );
}

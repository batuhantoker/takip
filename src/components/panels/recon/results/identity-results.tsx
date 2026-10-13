'use client';

import { ExternalLink } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { ListRow } from '@/components/ui/list-row';
import { Dot } from '@/components/ui/tag';
import { ResultRow, Verdict, day, fromNow, known, plain, type ToolResultProps } from './result-primitives';

export function UsernameResult({ r }: ToolResultProps) {
  const found: number = r.found?.length ?? 0;
  return (
    <div>
      <Verdict tone={found ? 'green' : undefined}
        title={found ? `${found} confirmed ${found === 1 ? 'account' : 'accounts'}` : 'No confirmed accounts'}
        body={<>For <span className="text-ink-1">{r.username}</span> · <span className="tabular-nums">{r.checked} of {r.total_available}</span> sites checked{r.elapsed_ms ? <> in <span className="tabular-nums">{(r.elapsed_ms / 1000).toFixed(1)}</span> s</> : null}</>} />

      {r.found?.length > 0 && (
        <PanelSection title="Confirmed accounts" hint={r.found.length}>
          {r.found.map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="green" />} title={f.site}
              subtitle={f.url.replace(/^https?:\/\//, '')} href={f.url} external
              trailing={<ExternalLink aria-hidden className="size-3 text-ink-3" />} />
          ))}
        </PanelSection>
      )}

      {r.inconclusive?.length > 0 && (
        <PanelSection title="Unsure" hint={r.inconclusive.length}>
          <p className="mb-1.5 text-small text-ink-2">These sites answered “exists” for a random control handle too, so a hit here is not evidence of an account.</p>
          {r.inconclusive.map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="amber" />} title={f.site}
              subtitle={f.url.replace(/^https?:\/\//, '')} href={f.url} external
              trailing={<ExternalLink aria-hidden className="size-3 text-ink-3" />} />
          ))}
        </PanelSection>
      )}

      {r.blocked?.length > 0 && (
        <PanelSection title="Blocked, so not checked" hint={r.blocked.length}>
          <p className="mb-1.5 text-small text-ink-2">These sites refused the lookup, so an account here is neither confirmed nor ruled out.</p>
          {r.blocked.map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="muted" />} title={f.site} subtitle={f.reason}
              href={f.url} external trailing={<ExternalLink aria-hidden className="size-3 text-ink-3" />} />
          ))}
        </PanelSection>
      )}

      {r.errors?.length > 0 && (
        <PanelSection title="Unreachable" hint={r.errors.length}>
          {r.errors.slice(0, 10).map((f: any, i: number) => (
            <ListRow key={i} compact leading={<Dot tone="red" />} title={f.site} subtitle={f.reason} />
          ))}
        </PanelSection>
      )}

      {r.skipped?.length > 0 && (
        <PanelSection title="Not applicable" hint={r.skipped.length}>
          <p className="text-small text-ink-2">{r.skipped.map((s: any) => s.site).join(', ')}. The handle breaks these sites’ username rules.</p>
        </PanelSection>
      )}

      <p className="mt-4 text-meta leading-relaxed text-ink-3">
        {r.verified
          ? 'Every positive is re-tested against a random control handle; sites that accepted it are listed as unsure. Confirm before acting.'
          : 'Calibration was off, so these hits are unfiltered and include pages that only look like profiles.'}
        {r.source && <> · Source: {r.source}</>}
      </p>
    </div>
  );
}

export function GithubResult({ r }: ToolResultProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {r.avatar_url && <img src={r.avatar_url} alt="" className="size-10 shrink-0 rounded-full border border-line" />}
        <div className="min-w-0">
          <a href={`https://github.com/${r.username}`} target="_blank" rel="noopener noreferrer"
            className="block truncate text-title font-semibold text-ink-1 hover:text-accent">{r.name || r.username}</a>
          <div className="truncate text-small text-ink-2">
            @{r.username} · <span className="tabular-nums">{(r.followers ?? 0).toLocaleString()}</span> followers · <span className="tabular-nums">{(r.public_repos ?? 0).toLocaleString()}</span> repositories
          </div>
        </div>
      </div>
      <PanelSection title="Profile">
        <ResultRow label="Bio" value={r.bio} mono={false} />
        <ResultRow label="Company" value={r.company} mono={false} />
        <ResultRow label="Location" value={r.location} mono={false} />
        <ResultRow label="Email" value={r.email} mono={false} />
        <ResultRow label="Website" value={r.blog} mono={false} />
        <ResultRow label="X (Twitter)" value={r.twitter ? `@${r.twitter}` : null} mono={false} />
        <ResultRow label="Joined" value={day(r.created_at)} note={fromNow(r.created_at)} />
      </PanelSection>
      {r.recent_repos?.length > 0 && (
        <PanelSection title="Recently updated repositories" hint={r.recent_repos.length}>
          {r.recent_repos.map((repo: any, i: number) => (
            <ListRow key={i} compact title={repo.name} meta={repo.language ?? undefined}
              href={`https://github.com/${r.username}/${repo.name}`} external
              trailing={repo.updated ? <span className="text-meta text-ink-3">{fromNow(repo.updated)}</span> : undefined} />
          ))}
        </PanelSection>
      )}
    </div>
  );
}

export function PhoneResult({ r }: ToolResultProps) {
  const voip = r.line_type === 'VOIP';
  return (
    <div>
      <Verdict tone={r.valid ? 'green' : 'red'} title={r.valid ? 'Valid number' : 'Not a valid number'}
        body={r.valid ? [r.region, r.line_type && r.line_type !== 'UNKNOWN' ? plain(r.line_type).toLowerCase() : null].filter(Boolean).join(' · ') : 'It doesn’t fit any country’s numbering plan. Check the country code.'} />
      <PanelSection title="Number">
        <ResultRow label="As typed" value={r.query} />
        {r.valid && (
          <>
            <ResultRow label="E.164" value={r.number} />
            <ResultRow label="International" value={r.international} />
            <ResultRow label="National" value={r.national} />
            <ResultRow label="Country" value={known(r.region) ? `${r.region} (${r.country_code})` : null} mono={false} />
            <ResultRow label="Line type" value={r.line_type ? plain(r.line_type) : null} mono={false} tone={voip ? 'amber' : undefined}
              note={voip ? 'Internet numbers are easy to get and drop' : undefined} />
          </>
        )}
      </PanelSection>
    </div>
  );
}

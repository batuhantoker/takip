'use client';

import { User, CheckCircle, ExternalLink, AlertTriangle, ShieldAlert, XCircle, Terminal, Phone } from 'lucide-react';
import { ResultRow, SectionHeader, type ToolResultProps } from './result-primitives';

export function UsernameResult({ r }: ToolResultProps) {
  const ACCENT = '#00E676';


  return (
    <div>
      <SectionHeader title="USERNAME HUNT" icon={User} color={ACCENT} />

      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {[
          { label: 'FOUND', value: r.found?.length ?? 0, color: ACCENT },
          { label: 'UNSURE', value: r.inconclusive?.length ?? 0, color: '#FF9500' },
          { label: 'BLOCKED', value: r.blocked?.length ?? 0, color: '#E040FB' },
          { label: 'CHECKED', value: r.checked ?? 0, color: '#87CEEB' },
        ].map((c: any) => (
          <div key={c.label} className="rounded border px-2 py-1.5" style={{ borderColor: `${c.color}33`, background: `${c.color}0d` }}>
            <div className="text-[9px] font-mono text-[var(--text-muted)]">{c.label}</div>
            <div className="text-[11px] font-mono font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <ResultRow label="Handle" value={r.username} color={ACCENT} />
      <ResultRow
        label="Coverage"
        value={`${r.checked} of ${r.total_available} sites · ${r.not_found_count ?? 0} ruled out`}
      />
      <ResultRow label="Elapsed" value={r.elapsed_ms ? `${(r.elapsed_ms / 1000).toFixed(1)}s` : null} />

      {r.found?.length > 0 && (
        <>
          <SectionHeader title={`CONFIRMED ACCOUNTS (${r.found.length})`} icon={CheckCircle} color={ACCENT} />
          {r.found.map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
              <span className="w-[110px] flex-shrink-0 font-bold" style={{ color: ACCENT }}>{f.site}</span>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 break-all text-[var(--text-secondary)] hover:text-white hover:underline flex items-center gap-1">
                {f.url.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
              </a>
            </div>
          ))}
        </>
      )}

      {/* Positives that a control username also triggered — shown apart so
          they are never mistaken for real accounts. */}
      {r.inconclusive?.length > 0 && (
        <>
          <SectionHeader title={`UNVERIFIABLE (${r.inconclusive.length})`} icon={AlertTriangle} color="#FF9500" />
          <div className="text-[10px] font-mono text-[var(--text-secondary)] leading-snug mb-1">
            These sites answered &quot;exists&quot; for a random control handle too, so a hit here is not evidence of an account.
          </div>
          {r.inconclusive.map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#FF9500]" />
              <span className="w-[110px] flex-shrink-0 text-[#FF9500]">{f.site}</span>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 break-all text-[var(--text-muted)] hover:text-white hover:underline">
                {f.url.replace(/^https?:\/\//, '')}
              </a>
            </div>
          ))}
        </>
      )}

      {/* Refused the request — absence was never established here, so these
          must not be silently folded into "not found". */}
      {r.blocked?.length > 0 && (
        <>
          <SectionHeader title={`BLOCKED — NOT CHECKED (${r.blocked.length})`} icon={ShieldAlert} color="#E040FB" />
          <div className="text-[10px] font-mono text-[var(--text-secondary)] leading-snug mb-1">
            These sites refused the lookup, so nothing was learned either way — an account here is neither confirmed nor ruled out.
          </div>
          {r.blocked.map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-[10px] font-mono">
              <span className="w-[110px] flex-shrink-0 text-[#E040FB]">{f.site}</span>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 break-all text-[var(--text-muted)] hover:text-white hover:underline">
                check manually
              </a>
              <span className="text-[var(--text-muted)]">{f.reason}</span>
            </div>
          ))}
        </>
      )}

      {r.errors?.length > 0 && (
        <>
          <SectionHeader title={`UNREACHABLE (${r.errors.length})`} icon={XCircle} color="#FF3D3D" />
          {r.errors.slice(0, 10).map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-[10px] font-mono">
              <span className="w-[110px] flex-shrink-0 text-[#FF3D3D]">{f.site}</span>
              <span className="flex-1 text-[var(--text-muted)]">{f.reason}</span>
            </div>
          ))}
        </>
      )}

      {r.skipped?.length > 0 && (
        <>
          <SectionHeader title={`NOT APPLICABLE (${r.skipped.length})`} icon={XCircle} color="#5C5A54" />
          <div className="text-[10px] font-mono text-[var(--text-muted)] leading-snug">
            {r.skipped.map((s: any) => s.site).join(', ')} — the handle does not meet these sites&apos; username rules.
          </div>
        </>
      )}

      <div className="mt-3 text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
        {r.verified
          ? 'Every positive re-tested against a random control handle; sites that accepted it are listed as unverifiable. Calibration catches most soft 404s but is not exhaustive — confirm before acting.'
          : 'Calibration disabled — positives are unfiltered and include soft 404s.'}
        <br />Source: {r.source}
      </div>
    </div>
  );
}

export function GithubResult({ r }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="GITHUB RECON" icon={Terminal} color="#87CEEB" />
      <div className="flex items-center gap-3 mb-2">
        {r.avatar_url && <img src={r.avatar_url} alt="avatar" className="w-10 h-10 rounded-full border border-[#87CEEB]/30" />}
        <div>
          <div className="text-[11px] font-mono font-bold text-[#87CEEB]">{r.name || r.username}</div>
          <div className="text-[10px] font-mono text-[var(--text-muted)]">@{r.username} • {r.followers} followers</div>
        </div>
      </div>
      <ResultRow label="Company" value={r.company} />
      <ResultRow label="Location" value={r.location} />
      <ResultRow label="Email" value={r.email} color="#00E676" />
      <ResultRow label="Twitter" value={r.twitter} color="#448AFF" />
      <ResultRow label="Website" value={r.blog} />
      <ResultRow label="Bio" value={r.bio} />
      {r.recent_repos?.length > 0 && (
        <div className="mt-2 p-2 border border-[#87CEEB]/20 bg-[#87CEEB]/5 rounded">
          <span className="text-[10px] font-mono text-[#87CEEB] block mb-1">RECENT REPOS</span>
          {r.recent_repos.map((repo: any, i: number) => (
            <div key={i} className="flex justify-between text-[10px] font-mono mb-0.5">
              <span className="text-[#E8E6E0]">{repo.name}</span>
              <span className="text-[var(--text-muted)]">{repo.language || 'Unknown'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhoneResult({ r }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="PHONE INTELLIGENCE" icon={Phone} color="#FF9500" />
      <ResultRow label="Query" value={r.query} color="#FF9500" />
      <ResultRow label="Valid" value={r.valid ? 'YES' : 'NO'} color={r.valid ? '#00E676' : '#FF3D3D'} />
      {r.valid && (
        <>
          <ResultRow label="E.164 Format" value={r.number} />
          <ResultRow label="Intl Format" value={r.international} />
          <ResultRow label="Nat Format" value={r.national} />
          <ResultRow label="Country" value={`${r.region} (${r.country_code})`} />
          <ResultRow label="Line Type" value={r.line_type} color={r.line_type === 'MOBILE' ? '#00E5FF' : r.line_type === 'VOIP' ? '#FF9500' : undefined} />
        </>
      )}
    </div>
  );
}

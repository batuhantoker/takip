'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Tag } from '@/components/ui/tag';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { bareUrl, type Row } from '@/lib/intel/recon/fingerprint/rows';
import { StatusPill, PlatformTile } from './fingerprint-parts';
import { MATCH_DISPLAY } from './fingerprint-status';

/** The profile's own picture, or the platform initial when there is none or it won't load. */
export function ProfileAvatar({ row, small }: { row: Row; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = row.profile?.avatar;
  if (!src || failed) return <PlatformTile row={row} small={small} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatars from dozens of hosts; no-referrer keeps the search out of their logs
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      className={cx('shrink-0 rounded-control border border-line bg-surface-2 object-cover', small ? 'size-[18px]' : 'size-7')} />
  );
}

export function MatchTag({ row }: { row: Row }) {
  const t = useT();
  // Unconnected is the default; saying it on every card says nothing.
  if (!row.match || row.match.tier === 'unknown' || (row.status !== 'verified' && row.status !== 'verifying')) return null;
  const d = MATCH_DISPLAY[row.match.tier];
  return <Tag tone={d.tone}>{t(d.label)}</Tag>;
}

export function ProfileCard({ row, query, live }: { row: Row; query: string; live: boolean }) {
  const t = useT();
  const p = row.profile;
  const details = [p?.location, p?.joined && t('joined {year}', { year: p.joined.slice(0, 4) })].filter(Boolean).join(' · ');
  const tie = row.match && row.match.tier !== 'unknown' ? row.match.reasons[0] : undefined;
  const why = [tie, row.status !== 'verified' ? row.reason : undefined].filter(Boolean);

  return (
    <a href={row.url} target="_blank" rel="noopener noreferrer"
      className={cx('group flex flex-col gap-1.5 rounded-card border border-line bg-surface-2 p-2.5 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <div className="flex min-w-0 items-center gap-2">
        <ProfileAvatar row={row} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-medium text-ink-1">{row.site}</div>
          <div className="truncate text-meta text-ink-3">{p?.name ? `${p.name} · @${query}` : `@${query}`}</div>
        </div>
        <StatusPill status={row.status} live={live} />
        <MatchTag row={row} />
      </div>
      {details && <p className="truncate text-meta text-ink-2">{details}</p>}
      {p?.bio && <p className="line-clamp-2 text-meta text-ink-2">{p.bio}</p>}
      {why.map(w => <p key={w} className="text-meta text-ink-3">{w}</p>)}
      <div className="flex items-center justify-between gap-2 text-meta text-ink-3">
        <span className="truncate group-hover:text-ink-2">{bareUrl(row.url)}</span>
        <ExternalLink aria-hidden className="size-3 shrink-0" />
      </div>
    </a>
  );
}

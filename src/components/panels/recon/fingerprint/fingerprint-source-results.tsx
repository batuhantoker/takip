'use client';

import { Check, Loader2, X } from 'lucide-react';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import type { FingerprintState } from './use-fingerprint-search';
import { ResultRow, plain } from '@/components/panels/recon/results/result-primitives';
import { parseHandle } from '@/lib/intel/recon/people/handles';
import { SearchNext, type Lead } from './fingerprint-leads';

type Source = FingerprintState['sources'][number];
type Data = NonNullable<Source['data']>;

const count = (n: number) => n.toLocaleString();

function BreachAnswer({ data }: { data: Data }) {
  const breaches = data.breaches || [];
  const exposed = data.data_exposed || [];
  const details = data.details || [];
  if (!breaches.length) return <p className="text-small text-ink-2">Not found in any known breach.</p>;
  return (
    <>
      <p className="mb-2 text-small text-amber">
        In {breaches.length} known {breaches.length === 1 ? 'breach' : 'breaches'}{data.risk?.label ? ` · ${data.risk.label.toLowerCase()} risk` : ''}
      </p>
      {details.length ? (
        <ul className="flex flex-col">
          {details.slice(0, 12).map(b => (
            <li key={b.name} className="flex items-baseline gap-2 border-b border-line py-1.5 text-small last:border-0">
              <span className="min-w-0 flex-1 truncate text-ink-1" title={b.data.join(', ')}>{b.name}</span>
              {b.records != null && <span className="shrink-0 font-mono text-meta text-ink-3 tabular-nums">{count(b.records)}</span>}
              {b.year && <span className="w-10 shrink-0 text-right font-mono text-meta text-ink-2 tabular-nums">{b.year}</span>}
            </li>
          ))}
          {details.length > 12 && <li className="pt-1.5 text-meta text-ink-3">and {details.length - 12} more</li>}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">{breaches.map((b, i) => <Tag key={`${b}-${i}`}>{b}</Tag>)}</div>
      )}
      {exposed.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-meta font-medium text-ink-3">What leaked</p>
          <div className="flex flex-wrap gap-1.5">{exposed.map(d => <Tag key={d}>{d}</Tag>)}</div>
        </>
      )}
    </>
  );
}

function StealerAnswer({ data, phone }: { data: Data; phone: boolean }) {
  const stealers = data.stealers || [];
  if (!stealers.length) return <p className="text-small text-ink-2">Not in Hudson Rock’s infostealer logs.</p>;
  const machines = `${stealers.length} infected ${stealers.length === 1 ? 'computer' : 'computers'}`;
  return (
    <>
      <p className="mb-2 text-small text-red">
        {phone
          ? `Used as a login on ${machines}. Anyone can type a number into a form, so this shows the number was used, not by whom.`
          : `Found in the logs of ${machines}: passwords saved there are exposed.`}
      </p>
      <ul className="flex flex-col">
        {stealers.slice(0, 8).map((s, i) => (
          <li key={i} className="flex items-baseline gap-2 border-b border-line py-1.5 text-small last:border-0">
            <span className="w-[84px] shrink-0 font-mono text-meta text-ink-2 tabular-nums">{s.date_compromised?.slice(0, 10) ?? 'undated'}</span>
            <span className="min-w-0 flex-1 truncate text-ink-1">{s.operating_system || 'Unknown system'}</span>
            <span className="shrink-0 text-meta text-ink-3">
              {count((s.total_user_services ?? 0) + (s.total_corporate_services ?? 0))} logins
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const KIND_NOTE: Record<string, string> = {
  free: 'a personal address at a free provider',
  organisation: 'an organisation’s own domain',
  disposable: 'a throwaway inbox',
  relay: 'a forwarding alias that hides the real address',
  none: 'a domain that takes no mail',
};

function ProfileAnswer({ fp, data }: { fp: FingerprintState; data: Data }) {
  const g = data.gravatar;
  const gh = data.github;
  const key = data.pgp;
  const mail = data.mail;
  const accounts = [...(g?.verified ?? []), ...(g?.links ?? [])].map(u => ({ url: u, h: parseHandle(u) })).filter(a => a.h);
  const leads: Lead[] = (data.usernames ?? []).map(u => ({ type: 'username', value: u.value, from: u.from }));
  const failed = Object.entries(data.errors ?? {});

  return (
    <>
      {mail && (
        <>
          <ResultRow label="Mail" value={mail.provider ?? 'No mail servers'} mono={false} note={KIND_NOTE[mail.kind]}
            tone={mail.kind === 'disposable' || mail.kind === 'none' ? 'amber' : undefined} />
          {mail.mx.length > 0 && <ResultRow label="Mail servers" value={mail.mx.slice(0, 4)} mono={false} />}
        </>
      )}
      {g && (
        <>
          <ResultRow label="Gravatar" value={g.name ?? 'Profile without a name'} mono={false} note={[g.location, g.bio].filter(Boolean).join(' · ') || undefined} />
          {accounts.length > 0 && (
            <ResultRow label="Its accounts" mono={false}
              value={accounts.slice(0, 8).map(a => `${a.h!.label} · ${a.h!.handle}${g.verified.includes(a.url) ? ' (verified)' : ''}`)} />
          )}
        </>
      )}
      {gh && (
        <>
          {gh.users.length > 0 && <ResultRow label="GitHub account" value={gh.users.map(u => u.login)} mono={false} note="shows this address on its profile" />}
          {gh.commits.total > 0 && (
            <ResultRow label="GitHub commits" mono={false}
              value={[
                `${count(gh.commits.total)} public ${gh.commits.total === 1 ? 'commit' : 'commits'}${gh.commits.first ? `, ${gh.commits.first} to ${gh.commits.last}` : ''}`,
                ...gh.commits.authors.map(a => (a.login ? `${a.name} (${a.login})` : a.name)).slice(0, 4),
              ]}
              note={gh.commits.repos.length ? `in ${gh.commits.repos.slice(0, 4).join(', ')}` : undefined} />
          )}
        </>
      )}
      {key && (
        <ResultRow label="PGP key" mono={false} value={key.uids.slice(0, 4)}
          note={`${key.fingerprint.match(/.{1,4}/g)!.join(' ')}${key.created ? ` · made ${key.created}` : ''} · address proved to keys.openpgp.org`} />
      )}
      {!g && !gh && !key && <p className="py-2 text-small text-ink-2">No public Gravatar, GitHub or PGP key uses this address.</p>}
      {failed.length > 0 && <p className="pt-2 text-meta text-ink-3">No answer from {failed.map(([s, why]) => `${plain(s)} (${why})`).join(', ')}.</p>}
      <SearchNext fp={fp} leads={leads} />
    </>
  );
}

function NumberAnswer({ data }: { data: Data }) {
  const region = data.region_code && data.region_code !== 'Unknown' ? `${data.region} (${data.region_code})` : data.region;
  return (
    <>
      <ResultRow label="Status" value={data.valid ? 'Valid number' : 'Not a valid number'} tone={data.valid ? 'green' : 'red'} mono={false} />
      <ResultRow label="E.164" value={data.number} />
      <ResultRow label="International" value={data.international} />
      <ResultRow label="National" value={data.national} />
      <ResultRow label="Country code" value={data.country_code} />
      <ResultRow label="Region" value={region} mono={false} />
      <ResultRow label="Line type" value={data.line_type ? plain(data.line_type) : null} mono={false} />
    </>
  );
}

function SourceAnswer({ fp, s }: { fp: FingerprintState; s: Source }) {
  if (s.state === 'error') return <p className="text-small text-ink-2">{s.error || 'This source didn’t answer.'}</p>;
  if (!s.data) return null;
  if (s.id === 'profile') return <ProfileAnswer fp={fp} data={s.data} />;
  if (s.id === 'breach') return <BreachAnswer data={s.data} />;
  if (s.id === 'stealer') return <StealerAnswer data={s.data} phone={fp.searched?.type === 'phone'} />;
  if (s.id === 'number') return <NumberAnswer data={s.data} />;
  return null;
}

/** Email and phone lookups: which sources answered, then each one's answer in its own section. */
export function FingerprintSourceResults({ fp }: { fp: FingerprintState }) {
  return (
    <div>
      <PanelSection title="Sources">
        {fp.sources.map(s => (
          <ListRow key={s.id} compact
            leading={s.state === 'pending' ? <Loader2 aria-hidden className="size-3.5 animate-spin text-ink-3 motion-reduce:animate-none" />
              : s.state === 'done' ? <Check aria-hidden className="size-3.5 text-green" /> : <X aria-hidden className="size-3.5 text-red" />}
            title={s.label} subtitle={s.via}
            meta={s.state === 'pending' ? 'Checking…' : s.state === 'error' ? 'No answer' : undefined} />
        ))}
      </PanelSection>

      {fp.sources.filter(s => s.state !== 'pending').map(s => (
        <PanelSection key={s.id} title={s.label}>
          <SourceAnswer fp={fp} s={s} />
        </PanelSection>
      ))}
    </div>
  );
}

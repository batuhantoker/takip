'use client';

import { BadgeCheck, ExternalLink } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import type { Account, Fact, Identity } from '@/lib/intel/recon/people/correlate';
import { bareUrl } from '@/lib/intel/recon/fingerprint/rows';
import type { FingerprintState } from './use-fingerprint-search';
import { SearchNext, type Lead } from './fingerprint-leads';

const sitesNote = (sites: string[]) => (sites.length <= 3 ? sites.join(', ') : `${sites.slice(0, 3).join(', ')} +${sites.length - 3}`);

function FactRow({ label, facts, link }: { label: string; facts: Fact[]; link?: boolean }) {
  if (!facts.length) return null;
  return (
    <div className="flex items-start gap-3 border-b border-line py-2 last:border-0">
      <span className="w-[96px] shrink-0 text-small text-ink-2">{label}</span>
      <ul className="flex min-w-0 flex-1 flex-col gap-1 text-small">
        {facts.map(f => (
          <li key={f.value} className="min-w-0">
            {link
              ? <a href={f.value} target="_blank" rel="noopener noreferrer" className="break-words text-ink-1 hover:underline">{bareUrl(f.value)}</a>
              : <span className="break-words text-ink-1">{f.value}</span>}
            <span className="text-meta text-ink-3"> · {sitesNote(f.sites)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountRow({ a }: { a: Account }) {
  return (
    <li className="flex min-w-0 items-center gap-2 text-small">
      {a.verified && <BadgeCheck aria-label="Verified by the platform" className="size-3.5 shrink-0 text-green" />}
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-ink-1 hover:underline">
        <span className="truncate">{a.label} · {a.handle}</span>
        <ExternalLink aria-hidden className="size-3 shrink-0 text-ink-3" />
      </a>
      <span className="truncate text-meta text-ink-3">from {sitesNote(a.sites)}</span>
    </li>
  );
}

/** Who the hits describe: the details they share, accounts they point at, and what to search next. */
export function FingerprintIdentity({ fp, identity, query }: { fp: FingerprintState; identity: Identity; query: string }) {
  const handle = query.toLowerCase();
  const leads: Lead[] = [
    ...identity.emails.map(e => ({ type: 'email' as const, value: e.value, from: e.sites })),
    ...identity.accounts
      // Fediverse handles carry their server ("name@host") and can't be swept as a username.
      .filter(a => a.handle.toLowerCase() !== handle && /^[\w.-]{2,40}$/.test(a.handle))
      .map(a => ({ type: 'username' as const, value: a.handle, from: [`${a.label} via ${a.sites[0]}`] })),
  ];
  const empty = !identity.names.length && !identity.locations.length && !identity.websites.length && !identity.bios.length && !identity.accounts.length;
  if (empty && !identity.tied) return null;

  return (
    <PanelSection title="Who this looks like"
      hint={identity.tied ? `${identity.cluster.length} profiles tied together` : 'nothing ties these profiles together'}>
      {!identity.tied && (
        <p className="mb-2 text-small text-ink-2">
          None of the profiles link to each other or share a name, photo or website, so these details may belong to different people.
        </p>
      )}
      {!empty && <div className="rounded-card border border-line px-3">
        <FactRow label="Name" facts={identity.names} />
        <FactRow label="Location" facts={identity.locations} />
        <FactRow label="Website" facts={identity.websites} link />
        <FactRow label="About" facts={identity.bios.slice(0, 2)} />
        <FactRow label="Email" facts={identity.emails} />
        {identity.accounts.length > 0 && (
          <div className="flex items-start gap-3 py-2">
            <span className="w-[96px] shrink-0 text-small text-ink-2">Linked accounts</span>
            <ul className="flex min-w-0 flex-1 flex-col gap-1">{identity.accounts.slice(0, 10).map(a => <AccountRow key={a.url} a={a} />)}</ul>
          </div>
        )}
      </div>}
      <SearchNext fp={fp} leads={leads} />
    </PanelSection>
  );
}

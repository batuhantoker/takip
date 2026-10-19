'use client';

import { Check, Loader2, X } from 'lucide-react';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { FingerprintState } from './use-fingerprint-search';
import { ResultRow, plain } from '@/components/panels/recon/results/result-primitives';
import { lineType } from '@/components/panels/recon/results/identity-results';
import { parseHandle } from '@/lib/intel/recon/people/handles';
import { SearchNext, type Lead } from './fingerprint-leads';

type Source = FingerprintState['sources'][number];
type Data = NonNullable<Source['data']>;

function BreachAnswer({ data }: { data: Data }) {
  const t = useT();
  const breaches = data.breaches || [];
  const exposed = data.data_exposed || [];
  const details = data.details || [];
  if (!breaches.length) return <p className="text-small text-ink-2">{t('Not found in any known breach.')}</p>;
  return (
    <>
      <p className="mb-2 text-small text-amber">
        {t('{n, plural, one {In # known breach} other {In # known breaches}}', { n: breaches.length })}
        {data.risk?.label ? ` · ${t('{level, select, low {low risk} medium {medium risk} high {high risk} critical {critical risk} other {{level} risk}}', { level: data.risk.label.toLowerCase() })}` : ''}
      </p>
      {details.length ? (
        <ul className="flex flex-col">
          {details.slice(0, 12).map(b => (
            <li key={b.name} className="flex items-baseline gap-2 border-b border-line py-1.5 text-small last:border-0">
              <span className="min-w-0 flex-1 truncate text-ink-1" title={b.data.join(', ')}>{b.name}</span>
              {b.records != null && <span className="shrink-0 font-mono text-meta text-ink-3 tabular-nums">{b.records.toLocaleString(t.intl)}</span>}
              {b.year && <span className="w-10 shrink-0 text-right font-mono text-meta text-ink-2 tabular-nums">{b.year}</span>}
            </li>
          ))}
          {details.length > 12 && <li className="pt-1.5 text-meta text-ink-3">{t('and {n} more', { n: details.length - 12 })}</li>}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">{breaches.map((b, i) => <Tag key={`${b}-${i}`}>{b}</Tag>)}</div>
      )}
      {exposed.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-meta font-medium text-ink-3">{t('What leaked')}</p>
          <div className="flex flex-wrap gap-1.5">{exposed.map(d => <Tag key={d}>{d}</Tag>)}</div>
        </>
      )}
    </>
  );
}

function StealerAnswer({ data, phone }: { data: Data; phone: boolean }) {
  const t = useT();
  const stealers = data.stealers || [];
  if (!stealers.length) return <p className="text-small text-ink-2">{t('Not in Hudson Rock’s infostealer logs.')}</p>;
  return (
    <>
      <p className="mb-2 text-small text-red">
        {phone
          ? t('{n, plural, one {Used as a login on # infected computer. Anyone can type a number into a form, so this shows the number was used, not by whom.} other {Used as a login on # infected computers. Anyone can type a number into a form, so this shows the number was used, not by whom.}}', { n: stealers.length })
          : t('{n, plural, one {Found in the logs of # infected computer: passwords saved there are exposed.} other {Found in the logs of # infected computers: passwords saved there are exposed.}}', { n: stealers.length })}
      </p>
      <ul className="flex flex-col">
        {stealers.slice(0, 8).map((s, i) => (
          <li key={i} className="flex items-baseline gap-2 border-b border-line py-1.5 text-small last:border-0">
            <span className="w-[84px] shrink-0 font-mono text-meta text-ink-2 tabular-nums">{s.date_compromised?.slice(0, 10) ?? t('undated')}</span>
            <span className="min-w-0 flex-1 truncate text-ink-1">{s.operating_system || t('Unknown system')}</span>
            <span className="shrink-0 text-meta text-ink-3">
              {t('{n, plural, one {# login} other {# logins}}', { n: (s.total_user_services ?? 0) + (s.total_corporate_services ?? 0) })}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const KIND_NOTE: Record<string, string> = {
  free: msg('a personal address at a free provider'),
  organisation: msg('an organisation’s own domain'),
  disposable: msg('a throwaway inbox'),
  relay: msg('a forwarding alias that hides the real address'),
  none: msg('a domain that takes no mail'),
};

function ProfileAnswer({ fp, data }: { fp: FingerprintState; data: Data }) {
  const t = useT();
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
          <ResultRow label={t('Mail')} value={mail.provider ?? t('No mail servers')} mono={false} note={KIND_NOTE[mail.kind] ? t(KIND_NOTE[mail.kind]) : undefined}
            tone={mail.kind === 'disposable' || mail.kind === 'none' ? 'amber' : undefined} />
          {mail.mx.length > 0 && <ResultRow label={t('Mail servers')} value={mail.mx.slice(0, 4)} mono={false} />}
        </>
      )}
      {g && (
        <>
          <ResultRow label="Gravatar" value={g.name ?? t('Profile without a name')} mono={false} note={[g.location, g.bio].filter(Boolean).join(' · ') || undefined} />
          {accounts.length > 0 && (
            <ResultRow label={t('Its accounts')} mono={false}
              value={accounts.slice(0, 8).map(a => {
                const account = `${a.h!.label} · ${a.h!.handle}`;
                return g.verified.includes(a.url) ? t('{account} (verified)', { account }) : account;
              })} />
          )}
        </>
      )}
      {gh && (
        <>
          {gh.users.length > 0 && <ResultRow label={t('GitHub account')} value={gh.users.map(u => u.login)} mono={false} note={t('shows this address on its profile')} />}
          {gh.commits.total > 0 && (
            <ResultRow label={t('GitHub commits')} mono={false}
              value={[
                gh.commits.first
                  ? t('{n, plural, one {# public commit, {from} to {to}} other {# public commits, {from} to {to}}}', { n: gh.commits.total, from: gh.commits.first, to: gh.commits.last ?? '' })
                  : t('{n, plural, one {# public commit} other {# public commits}}', { n: gh.commits.total }),
                ...gh.commits.authors.map(a => (a.login ? `${a.name} (${a.login})` : a.name)).slice(0, 4),
              ]}
              note={gh.commits.repos.length ? t('in {repos}', { repos: gh.commits.repos.slice(0, 4).join(', ') }) : undefined} />
          )}
        </>
      )}
      {key && (
        <ResultRow label={t('PGP key')} mono={false} value={key.uids.slice(0, 4)}
          note={[key.fingerprint.match(/.{1,4}/g)!.join(' '), key.created ? t('made {date}', { date: key.created }) : null, t('address proved to keys.openpgp.org')].filter(Boolean).join(' · ')} />
      )}
      {!g && !gh && !key && <p className="py-2 text-small text-ink-2">{t('No public Gravatar, GitHub or PGP key uses this address.')}</p>}
      {failed.length > 0 && <p className="pt-2 text-meta text-ink-3">{t('No answer from {sources}.', { sources: failed.map(([s, why]) => `${plain(s)} (${why})`).join(', ') })}</p>}
      <SearchNext fp={fp} leads={leads} />
    </>
  );
}

function NumberAnswer({ data }: { data: Data }) {
  const t = useT();
  const region = data.region_code && data.region_code !== 'Unknown' ? `${data.region} (${data.region_code})` : data.region;
  return (
    <>
      <ResultRow label={t('Status')} value={data.valid ? t('Valid number') : t('Not a valid number')} tone={data.valid ? 'green' : 'red'} mono={false} />
      <ResultRow label="E.164" value={data.number} />
      <ResultRow label={t('International')} value={data.international} />
      <ResultRow label={t('National')} value={data.national} />
      <ResultRow label={t('Country code')} value={data.country_code} />
      <ResultRow label={t('Region')} value={region} mono={false} />
      <ResultRow label={t('Line type')} value={data.line_type ? lineType(data.line_type, t) : null} mono={false} />
    </>
  );
}

function SourceAnswer({ fp, s }: { fp: FingerprintState; s: Source }) {
  const t = useT();
  if (s.state === 'error') return <p className="text-small text-ink-2">{s.error || t('This source didn’t answer.')}</p>;
  if (!s.data) return null;
  if (s.id === 'profile') return <ProfileAnswer fp={fp} data={s.data} />;
  if (s.id === 'breach') return <BreachAnswer data={s.data} />;
  if (s.id === 'stealer') return <StealerAnswer data={s.data} phone={fp.searched?.type === 'phone'} />;
  if (s.id === 'number') return <NumberAnswer data={s.data} />;
  return null;
}

/** Email and phone lookups: which sources answered, then each one's answer in its own section. */
export function FingerprintSourceResults({ fp }: { fp: FingerprintState }) {
  const t = useT();
  return (
    <div>
      <PanelSection title={t('Sources')}>
        {fp.sources.map(s => (
          <ListRow key={s.id} compact
            leading={s.state === 'pending' ? <Loader2 aria-hidden className="size-3.5 animate-spin text-ink-3 motion-reduce:animate-none" />
              : s.state === 'done' ? <Check aria-hidden className="size-3.5 text-green" /> : <X aria-hidden className="size-3.5 text-red" />}
            title={t(s.label)} subtitle={s.via}
            meta={s.state === 'pending' ? t('Checking…') : s.state === 'error' ? t('No answer') : undefined} />
        ))}
      </PanelSection>

      {fp.sources.filter(s => s.state !== 'pending').map(s => (
        <PanelSection key={s.id} title={t(s.label)}>
          <SourceAnswer fp={fp} s={s} />
        </PanelSection>
      ))}
    </div>
  );
}

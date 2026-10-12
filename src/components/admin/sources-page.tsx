'use client';

import { adminSend, useAdminData } from './admin-api';
import { Badge, ErrorText, Muted, PageTitle, TABLE, TD, TH, when } from './admin-parts';
import { useAdminAction } from './use-admin-action';

type CoverageStatus = 'ok' | 'degraded' | 'down' | 'not_recording';

/** GET /api/admin/sources (apps/api/src/replay/sources.ts). */
type SourceState = {
  code: string;
  name: string;
  attribution: string | null;
  record: boolean;
  build: boolean;
  switchedAt: number | null;
  switchedBy: string | null;
  coverage: { status: CoverageStatus; tLo: number; tHi: number | null } | null;
};

const STATUS: Record<CoverageStatus, { label: string; tone: 'gold' | 'plain' | 'danger' | 'muted' }> = {
  ok: { label: 'ok', tone: 'gold' },
  degraded: { label: 'degraded', tone: 'plain' },
  down: { label: 'down', tone: 'danger' },
  not_recording: { label: 'not recording', tone: 'muted' },
};

export default function SourcesPage() {
  const { data, error, reload } = useAdminData<{ sources: SourceState[] }>('/sources');
  const { busy, error: actionError, run } = useAdminAction(reload);

  const flip = (source: SourceState, which: 'record' | 'build') => {
    const on = !source[which];
    // Nothing is archived while recording is off, and no rebuild can bring that time back.
    if (which === 'record' && !on && !window.confirm(`Stop recording ${source.name}? Data that arrives while it is off is lost for good.`)) return;
    void run(() => adminSend('PUT', `/sources/${source.code}`, { [which]: on }));
  };

  return (
    <>
      <PageTitle title="Sources" />
      <Muted>
        Record writes a feed&rsquo;s raw payloads to the archive. Build turns the archive into replay history. With build off the
        archive is kept, and turning it back on followed by <span className="font-mono">npm run ingest -- rebuild</span> fills
        the gap. Changes reach the recorder within a minute and are written to the audit log.
      </Muted>
      <div className="h-4" />
      <ErrorText message={error ?? actionError} />
      {data && (
        <div className="overflow-x-auto border border-[var(--border-primary)] bg-[#0A0A0A]">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Source</th>
                <th className={TH}>Record</th>
                <th className={TH}>Build</th>
                <th className={TH}>Latest sealed hour</th>
                <th className={TH}>Last switched</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map(source => (
                <tr key={source.code}>
                  <td className={TD}>
                    <div className="text-[var(--text-primary)]">{source.name}</div>
                    <div className="font-mono text-[11px] text-[var(--text-muted)]">{source.code}</div>
                  </td>
                  <td className={TD}>
                    <Switch on={source.record} states={['Recording', 'Not recording']} disabled={busy} label={`Record ${source.name}`} onClick={() => flip(source, 'record')} />
                  </td>
                  <td className={TD}>
                    <Switch on={source.build} states={['Building', 'Not building']} disabled={busy} label={`Build history from ${source.name}`} onClick={() => flip(source, 'build')} />
                  </td>
                  <td className={TD}>
                    {source.coverage ? (
                      <div className="flex flex-col gap-1">
                        <Badge tone={STATUS[source.coverage.status].tone}>{STATUS[source.coverage.status].label}</Badge>
                        <span className="text-[11px] text-[var(--text-muted)]">until {when(source.coverage.tHi)}</span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-[11px] text-[var(--text-muted)]`}>
                    {source.switchedAt ? <>{when(source.switchedAt)}<br />{source.switchedBy}</> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}

function Switch({ on, states, disabled, label, onClick }: {
  on: boolean;
  states: [on: string, off: string];
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 h-8 whitespace-nowrap disabled:opacity-40"
    >
      <span className={`relative inline-block w-8 h-4 border transition-colors ${on ? 'border-[var(--gold-primary)]/50 bg-[var(--gold-primary)]/20' : 'border-white/15 bg-white/[0.04]'}`}>
        <span className={`absolute top-[2px] w-2.5 h-2.5 transition-all ${on ? 'left-[17px] bg-[var(--gold-primary)]' : 'left-[2px] bg-[var(--text-muted)]'}`} />
      </span>
      <span className={`text-[12px] ${on ? 'text-[var(--text-primary)]' : 'text-[var(--alert-red)]'}`}>{on ? states[0] : states[1]}</span>
    </button>
  );
}

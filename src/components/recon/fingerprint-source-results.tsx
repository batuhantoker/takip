'use client';

import { Phone, ShieldAlert, CheckCircle, XCircle, Server, Loader2 } from 'lucide-react';
import { ACCENT } from '@/lib/recon-fingerprint';
import type { FingerprintState } from './use-fingerprint-search';

export function FingerprintSourceResults({ fp, isFullScreen }: { fp: FingerprintState; isFullScreen: boolean }) {
  return (
    <>
      <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
        {fp.sources.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-b-0 border-[var(--border-primary)]/60 text-[10px] font-mono">
            <span className="flex items-center gap-2 min-w-0">
              {s.state === 'pending' ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: ACCENT }} />
                : s.state === 'done' ? <CheckCircle className="w-3 h-3 text-[#00E676]" />
                : <XCircle className="w-3 h-3 text-[#FF3D3D]" />}
              <span className="text-[var(--text-primary)] font-bold">{s.label}</span>
              <span className="text-[var(--text-muted)] truncate">{s.via}</span>
            </span>
            <span className="flex-shrink-0" style={{ color: s.state === 'done' ? '#00E676' : s.state === 'error' ? '#FF3D3D' : ACCENT }}>
              {s.state === 'pending' ? 'CHECKING' : s.state === 'done' ? 'DONE' : 'FAILED'}
            </span>
          </div>
        ))}
      </div>

      <div className={`grid gap-2 ${isFullScreen ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {fp.sources.filter(s => s.state !== 'pending').map(s => (
          <div key={s.id} className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {s.id === 'breach' ? <ShieldAlert className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                : s.id === 'mail' ? <Server className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                : <Phone className="w-3.5 h-3.5" style={{ color: ACCENT }} />}
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-primary)]">{s.label.toUpperCase()}</span>
            </div>

            {s.state === 'error' && <div className="text-[10px] font-mono text-[#FF3D3D]">{s.error}</div>}

            {s.state === 'done' && s.id === 'breach' && (() => {
              const breaches: string[] = s.data?.breaches || [];
              const exposed: string[] = s.data?.data_exposed || [];
              return breaches.length === 0 ? (
                <div className="text-[10px] font-mono text-[#00E676]">Not found in any known breach corpus.</div>
              ) : (
                <>
                  <div className="text-[10px] font-mono text-[#FF9500] mb-1.5">Appears in {breaches.length} known {breaches.length === 1 ? 'breach' : 'breaches'}</div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {/* The corpus can list one breach name twice. */}
                    {breaches.map((b, i) => (
                      <span key={`${b}-${i}`} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/25">{b}</span>
                    ))}
                  </div>
                  {exposed.length > 0 && (
                    <>
                      <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-1">DATA CLASSES EXPOSED</div>
                      <div className="flex flex-wrap gap-1">
                        {exposed.map(d => (
                          <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]">{d}</span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {s.state === 'done' && s.id === 'mail' && (() => {
              const records: string[] = s.data?.summary?.mail_servers || [];
              // RFC 7505 null MX ("0 .") is a domain declaring it takes no mail.
              const mx = records.filter(m => !/^0\s+\.?$/.test(m.trim()));
              return (
                <>
                  <div className="text-[10px] font-mono text-[var(--text-secondary)] mb-1.5 break-all">{s.data?.domain}</div>
                  {mx.length === 0 ? (
                    <div className="text-[10px] font-mono text-[#FF9500]">
                      {records.length ? 'Null MX — this domain declares it accepts no mail.' : 'No MX records — this domain cannot receive mail.'}
                    </div>
                  ) : (
                    <>
                      <div className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] mb-1">MAIL SERVERS ({mx.length})</div>
                      {mx.slice(0, 6).map(m => (
                        <div key={m} className="text-[10px] font-mono text-[var(--text-primary)] break-all leading-snug">{m}</div>
                      ))}
                    </>
                  )}
                </>
              );
            })()}

            {s.state === 'done' && s.id === 'number' && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {[
                  ['Status', s.data?.valid ? 'VALID NUMBER' : 'NOT A VALID NUMBER', s.data?.valid ? '#00E676' : '#FF3D3D'],
                  ['E.164', s.data?.number],
                  ['International', s.data?.international],
                  ['National', s.data?.national],
                  ['Country code', s.data?.country_code],
                  ['Region', s.data?.region_code && s.data.region_code !== 'Unknown' ? `${s.data.region} (${s.data.region_code})` : s.data?.region],
                  ['Line type', s.data?.line_type?.replace(/_/g, ' ')],
                ].filter(([, v]) => v).map(([k, v, c]) => (
                  <div key={k} className="min-w-0">
                    <div className="text-[8px] font-mono tracking-widest text-[var(--text-muted)]">{String(k).toUpperCase()}</div>
                    <div className="text-[10px] font-mono break-all" style={{ color: c || 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

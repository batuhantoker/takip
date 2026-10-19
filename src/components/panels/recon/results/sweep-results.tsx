'use client';

import { ChevronDown, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { ReconData } from '@/lib/intel/recon/lookup';
import { SEVERITY_TONE, Verdict, known, severityLabel } from './result-primitives';

export function SweepProgress({ progress }: { progress: { current: number; total: number } }) {
  const t = useT();
  const pct = progress.total ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  return (
    <div className="rounded-card border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between text-small">
        <span className="flex items-center gap-2 text-ink-1"><Loader2 aria-hidden className="size-3.5 animate-spin text-accent motion-reduce:animate-none" />{t('Scanning the subnet…')}</span>
        <span className="font-mono text-ink-2 tabular-nums">{progress.current.toLocaleString(t.intl)} / {progress.total.toLocaleString(t.intl)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SweepResults({ sweepResult, isFullScreen, expandedDevice, setExpandedDevice, fetchCveDetails, cveCache, onSweepVisualize }: {
  sweepResult: ReconData;
  isFullScreen: boolean;
  expandedDevice: string | null;
  setExpandedDevice: (v: string | null) => void;
  fetchCveDetails: (cveIds: string[]) => void;
  cveCache: Record<string, ReconData>;
  onSweepVisualize?: (data: ReconData) => void;
}) {
  const t = useT();
  const breakdown = (Object.entries(sweepResult.summary.device_breakdown) as [string, number][]).sort((a, b) => b[1] - a[1]);
  const total = sweepResult.summary.total_responsive;
  const where = [sweepResult.center.city, sweepResult.center.country].filter(known).join(', ');
  const mono = 'font-mono tabular-nums';

  return (
    <div>
      <Verdict title={total ? t('{n, plural, one {# exposed device} other {# exposed devices}}', { n: total }) : t('No exposed devices')}
        body={<>{t.rich('In {subnet}', { subnet: <span className={mono}>{sweepResult.subnet}</span> })}{where ? ` · ${where}` : ''}{known(sweepResult.center.isp) ? ` · ${sweepResult.center.isp}` : ''}</>} />

      {total > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {breakdown.map(([type, count]) => (
            <Tag key={type}>{t(type)}<span className="font-mono font-normal text-ink-3 tabular-nums">{count}</span></Tag>
          ))}
        </div>
      )}

      {onSweepVisualize && total > 0 && (
        <Button className="mt-4" variant="secondary" icon={Globe} onClick={() => onSweepVisualize(sweepResult)}>{t('Show on the map')}</Button>
      )}

      <PanelSection title={t('Devices')} hint={total}>
        <div className="flex flex-col divide-y divide-line">
          {sweepResult.devices.map((device: any) => {
            const open = expandedDevice === device.ip;
            return (
              <div key={device.ip}>
                <button type="button" aria-expanded={open}
                  onClick={() => {
                    const next = open ? null : device.ip;
                    setExpandedDevice(next);
                    if (next && device.vulns.length > 0) fetchCveDetails(device.vulns);
                  }}
                  className={cx('-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-mono text-body font-medium text-ink-1 tabular-nums">{device.ip}</span>
                    <span className="truncate text-small text-ink-2">
                      {[device.device_type && t(device.device_type), device.hostnames[0]].filter(Boolean).join(' · ')}
                      {!open && device.ports.length > 0 && (
                        <span className="text-ink-3"> · {t.rich('ports {ports}', { ports: <span className={mono}>{device.ports.slice(0, 6).join(', ')}{device.ports.length > 6 ? ` +${device.ports.length - 6}` : ''}</span> })}</span>
                      )}
                    </span>
                  </span>
                  {device.vulns.length > 0 && <Tag tone="red">{t('{n, plural, one {# CVE} other {# CVEs}}', { n: device.vulns.length })}</Tag>}
                  <ChevronDown aria-hidden className={cx('size-4 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                </button>

                {open && (
                  <div className="pb-3">
                    <div className={cx('grid gap-4', isFullScreen ? 'grid-cols-2' : 'grid-cols-1')}>
                      <div>
                        <p className="mb-1.5 text-meta font-medium text-ink-3">{t('Open ports')}</p>
                        <div className="flex flex-wrap gap-1">
                          {device.ports.map((port: number) => (
                            <span key={port} className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-meta text-ink-1 tabular-nums">{port}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-meta font-medium text-ink-3">{t('Hostnames')}</p>
                        {device.hostnames.length > 0
                          ? device.hostnames.map((h: string) => <div key={h} className="break-all text-small text-ink-2">{h}</div>)
                          : <span className="text-small text-ink-3">{t('No reverse DNS')}</span>}
                      </div>
                    </div>
                    {device.vulns.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-meta font-medium text-ink-3">{t('Vulnerabilities')}<span className="font-normal"> · {device.vulns.length}</span></p>
                        <div className="flex flex-col gap-2">
                          {device.vulns.map((cveId: string) => {
                            const info = cveCache[cveId];
                            const loading = !info || info.loading;
                            return (
                              <div key={cveId} className="rounded-card border border-line bg-surface-2 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-small font-medium text-ink-1">{cveId}</span>
                                    {info?.cvss != null && <span className="font-mono text-meta text-ink-3 tabular-nums">CVSS {info.cvss}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {info?.severity && <Tag tone={SEVERITY_TONE(info.severity)}>{severityLabel(info.severity, t)}</Tag>}
                                    <a href={`https://nvd.nist.gov/vuln/detail/${cveId}`} target="_blank" rel="noreferrer" aria-label={t('{id} on NVD', { id: cveId })} className={cx('rounded-sm text-ink-3 hover:text-ink-1', FOCUS_RING)}>
                                      <ExternalLink aria-hidden className="size-3.5" />
                                    </a>
                                  </div>
                                </div>
                                {loading ? (
                                  <div className="mt-1 flex items-center gap-2 text-small text-ink-3">
                                    <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />{t('Loading details…')}
                                  </div>
                                ) : (
                                  <>
                                    <p className="mt-1 text-small text-ink-2">{info.description}</p>
                                    {info.cwe && <p className="mt-1 text-meta text-ink-3">{t('Weakness: {cwe}', { cwe: info.cwe })}</p>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PanelSection>

      <p className="mt-6 text-meta text-ink-3">
        {t.rich('Scanned {hosts} hosts in {seconds} s · ASN {asn}', {
          hosts: <span className={mono}>{sweepResult.summary.total_hosts.toLocaleString(t.intl)}</span>,
          seconds: <span className={mono}>{(sweepResult.sweep_time_ms / 1000).toLocaleString(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>,
          asn: <span className={mono}>{sweepResult.center.asn}</span>,
        })}
      </p>
    </div>
  );
}

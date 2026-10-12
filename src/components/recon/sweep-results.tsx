'use client';

import { Globe, ChevronDown, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import type { ReconData } from '@/lib/recon-lookup';

export function SweepProgress({ sweepProgress }: { sweepProgress: { current: number; total: number } }) {
  return (
    <div className="p-3 rounded-lg border border-[#FF3D3D]/30 bg-[#FF3D3D]/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono tracking-wider text-[#FF3D3D]">SWEEPING SUBNET...</span>
        <span className="text-[11px] font-mono text-[#E8E6E0]">{sweepProgress.total} hosts</span>
      </div>
      <div className="w-full h-1.5 bg-[#1A1A18] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg, #FF3D3D, #FF6B00, #FFD700)', animation: 'sweep-pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

export function SweepResults({
  sweepResult, isFullScreen, expandedDevice, setExpandedDevice, fetchCveDetails, cveCache, onSweepVisualize,
}: {
  sweepResult: ReconData;
  isFullScreen: boolean;
  expandedDevice: string | null;
  setExpandedDevice: (v: string | null) => void;
  fetchCveDetails: (cveIds: string[]) => void;
  cveCache: Record<string, ReconData>;
  onSweepVisualize?: (data: ReconData) => void;
}) {
  return (
    <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto styled-scrollbar">
      {/* Summary */}
      <div className="p-3 border-b border-[#2A2A28]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-mono tracking-wider text-[#E8E6E0]">{sweepResult.subnet}</div>
            <div className="text-[10px] font-mono text-[#5C5A54]">{sweepResult.center.city}, {sweepResult.center.country} · {sweepResult.center.isp}</div>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-mono font-bold text-[#FF3D3D]">{sweepResult.summary.total_responsive}</div>
            <div className="text-[9px] font-mono text-[#5C5A54] tracking-wider">DEVICES FOUND</div>
          </div>
        </div>
        {/* Breakdown Bar */}
        <div className="flex h-2 rounded-full overflow-hidden bg-[#1A1A18] mb-2">
          {Object.entries(sweepResult.summary.device_breakdown).map(([type, count]: [string, any]) => {
            const device = sweepResult.devices.find((d: any) => d.device_type === type);
            return <div key={type} style={{ width: `${(count / sweepResult.summary.total_responsive) * 100}%`, backgroundColor: device?.device_color || '#666' }} title={`${type}: ${count}`} />;
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(sweepResult.summary.device_breakdown).map(([type, count]: [string, any]) => {
            const device = sweepResult.devices.find((d: any) => d.device_type === type);
            return (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: device?.device_color || '#666' }} />
                <span className="text-[10px] font-mono text-[#8A8880]">{type}</span>
                <span className="text-[10px] font-mono text-[#E8E6E0] font-bold">{String(count)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Visualize Button */}
      <div className="p-3 border-b border-[#2A2A28]">
        <button onClick={() => onSweepVisualize?.(sweepResult)}
          className="w-full py-2.5 rounded-lg font-mono text-[10px] tracking-wider font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(255,61,61,0.2), rgba(255,107,0,0.2))', border: '1px solid rgba(255,61,61,0.5)', color: '#FF3D3D', textShadow: '0 0 10px rgba(255,61,61,0.5)' }}
        >
          <Globe className="w-4 h-4" /> VISUALIZE ON GLOBE
        </button>
      </div>
      {/* Device List */}
      <div className={isFullScreen ? "flex flex-col gap-3 p-4" : "divide-y divide-[#2A2A28]"}>
        {sweepResult.devices.map((device: any) => {
          const isExpanded = expandedDevice === device.ip;
          return (
          <div key={device.ip} className={isFullScreen
            ? "bg-[#0D0D0C] border border-[#2A2A28] rounded-lg overflow-hidden hover:border-[#3A3A38] transition-colors"
            : "px-3 py-2.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          }>
            {/* Device Header */}
            <div
              className={isFullScreen
                ? "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#151514] transition-colors"
                : "flex items-center justify-between mb-1"
              }
              onClick={() => {
                if (!isFullScreen) return;
                const next = isExpanded ? null : device.ip;
                setExpandedDevice(next);
                if (next && device.vulns.length > 0) fetchCveDetails(device.vulns);
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: device.device_color }} />
                <span className={`flex-shrink-0 ${isFullScreen ? "text-[14px]" : "text-[10px]"} font-mono font-bold text-[#E8E6E0]`}>{device.ip}</span>
                {device.hostnames.length > 0 && (
                  <span className={`${isFullScreen ? "text-[10px]" : "text-[10px]"} font-mono text-[#5C5A54] truncate min-w-0`}>{device.hostnames[0]}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {device.vulns.length > 0 && (
                  <span className={`${isFullScreen ? "text-[11px]" : "text-[9px]"} font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap`}>
                    {device.vulns.length} CVEs
                  </span>
                )}
                <span className={`${isFullScreen ? "text-[11px]" : "text-[9px]"} font-mono px-1.5 py-0.5 rounded whitespace-nowrap`} style={{ backgroundColor: device.device_color + '20', color: device.device_color, border: `1px solid ${device.device_color}40` }}>{device.device_type}</span>
                {isFullScreen && (
                  <ChevronDown className={`w-4 h-4 text-[#5C5A54] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>
            </div>

            {/* Compact info (sidebar mode) */}
            {!isFullScreen && (
              <>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#5C5A54]">
                  <span>Ports: {device.ports.slice(0, 8).join(', ')}{device.ports.length > 8 ? ` +${device.ports.length - 8}` : ''}</span>
                  {device.vulns.length > 0 && (
                    <div className="group relative flex items-center gap-1 cursor-help">
                      <span className="text-[#FF3D3D] flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> {device.vulns.length} CVEs
                      </span>
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 p-2 bg-[#1A1A18] border border-[#FF3D3D50] rounded-md shadow-xl min-w-[140px] max-w-[220px] max-h-[150px] overflow-y-auto styled-scrollbar">
                        <div className="text-[9px] font-mono text-[#FF3D3D] mb-1 tracking-wider uppercase border-b border-[#FF3D3D30] pb-1">Identified Vulnerabilities</div>
                        <div className="flex flex-col gap-0.5">
                          {device.vulns.map((cve: string) => (
                            <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-[#E8E6E0] hover:text-[#FF3D3D] transition-colors truncate">
                              {cve}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {device.hostnames.length > 0 && <div className="text-[10px] font-mono text-[#8A8880] mt-0.5 truncate">{device.hostnames[0]}</div>}
              </>
            )}

            {/* Full-Screen Expanded Detail */}
            {isFullScreen && isExpanded && (
              <div className="border-t border-[#2A2A28]">
                {/* Ports + Hostnames Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#2A2A28]">
                  <div className="bg-[#0D0D0C] p-4">
                    <div className="text-[11px] font-mono text-[#5C5A54] tracking-widest uppercase mb-2">Open Ports</div>
                    <div className="flex flex-wrap gap-1.5">
                      {device.ports.map((port: number) => (
                        <span key={port} className="px-2 py-1 bg-[#1A1A18] border border-[#2A2A28] rounded text-[10px] font-mono text-[var(--cyan-primary)]">{port}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#0D0D0C] p-4">
                    <div className="text-[11px] font-mono text-[#5C5A54] tracking-widest uppercase mb-2">Hostnames</div>
                    {device.hostnames.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {device.hostnames.map((h: string) => (
                          <span key={h} className="text-[10px] font-mono text-[#E8E6E0]">{h}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-[#3A3A38]">No reverse DNS</span>
                    )}
                  </div>
                </div>

                {/* CVE Intelligence */}
                {device.vulns.length > 0 && (
                  <div className="p-4 border-t border-[#2A2A28]">
                    <div className="text-[11px] font-mono text-[#5C5A54] tracking-widest uppercase mb-3">Vulnerabilities ({device.vulns.length})</div>
                    <div className="flex flex-col gap-2">
                      {device.vulns.map((cveId: string) => {
                        const info = cveCache[cveId];
                        const isLoading = !info || info.loading;
                        const severityColor = !info?.severity ? '#5C5A54'
                          : info.severity === 'CRITICAL' ? '#FF3D3D'
                          : info.severity === 'HIGH' ? '#FF6B00'
                          : info.severity === 'MEDIUM' ? '#FFD700'
                          : '#76FF03';
                        return (
                          <div key={cveId} className="bg-[#111] border border-[#2A2A28] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-bold text-[#E8E6E0]">{cveId}</span>
                                {info?.cvss != null && (
                                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: severityColor + '15', color: severityColor, border: `1px solid ${severityColor}40` }}>CVSS {info.cvss}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {info?.severity && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: severityColor + '15', color: severityColor, border: `1px solid ${severityColor}40` }}>{info.severity}</span>
                                )}
                                <a href={`https://nvd.nist.gov/vuln/detail/${cveId}`} target="_blank" rel="noreferrer" className="text-[#5C5A54] hover:text-[#E8E6E0] transition-colors">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                            {isLoading ? (
                              <div className="flex items-center gap-2 py-1">
                                <Loader2 className="w-3 h-3 animate-spin text-[#5C5A54]" />
                                <span className="text-[11px] font-mono text-[#5C5A54]">Fetching vulnerability intelligence...</span>
                              </div>
                            ) : (
                              <>
                                <p className="text-[10px] font-mono text-[#8A8880] leading-relaxed">{info.description}</p>
                                {info.cwe && <div className="text-[11px] font-mono text-[#5C5A54] mt-2">Weakness: {info.cwe}</div>}
                                {info.affected && info.affected.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {info.affected.map((a: any, i: number) => (
                                      <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1A1A18] border border-[#2A2A28] rounded text-[#8A8880]">
                                        {a.vendor}/{a.product}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
      <div className="px-3 py-2 border-t border-[#2A2A28]">
        <div className="text-[9px] font-mono text-[#5C5A54] tracking-wider">SWEPT {sweepResult.summary.total_hosts} HOSTS IN {(sweepResult.sweep_time_ms / 1000).toFixed(1)}s · ASN {sweepResult.center.asn}</div>
      </div>
    </div>
  );
}

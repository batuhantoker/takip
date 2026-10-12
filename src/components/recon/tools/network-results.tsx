'use client';

import { Server, Wifi, Bug, AlertTriangle, Network, Globe, Fingerprint } from 'lucide-react';
import { ResultRow, SectionHeader, PortRow, renderFallback, renderFallbackExcluding, type ToolResultProps } from './result-primitives';

export function ScannerResult({ r, query, scanType }: ToolResultProps) {
  const ports = r.ports || r.open_ports || r.results || [];
  const host = r.host || r.target || query;
  return (
    <div>
      <SectionHeader title="HOST INFO" icon={Server} color="#00E5FF" />
      <ResultRow label="Target" value={host} color="#00E5FF" />
      <ResultRow label="Scan Type" value={r.scan_type || scanType} />
      <ResultRow label="Duration" value={r.duration || r.scan_time} />
      {Array.isArray(ports) && ports.length > 0 && (
        <>
          <SectionHeader title={`OPEN PORTS (${ports.length})`} icon={Wifi} color="#00E676" />
          <div className="space-y-0.5">
            {ports.map((p: any, i: number) => (
              <PortRow key={i} port={p.port || p} state={p.state || 'open'} service={p.service || p.name} version={p.version} />
            ))}
          </div>
        </>
      )}
      {(!Array.isArray(ports) || ports.length === 0) && renderFallback(r)}
    </div>
  );
}

export function VulnResult({ r, query }: ToolResultProps) {
  const vulns = r.vulnerabilities || r.vulns || r.cves || [];
  const exploits = vulns.filter((v: any) => v.is_exploit);
  const regularVulns = vulns.filter((v: any) => !v.is_exploit);
  
  return (
    <div>
      <SectionHeader title="VULNERABILITY ASSESSMENT" icon={Bug} color="#FF3D3D" />
      <ResultRow label="Target" value={r.target || query} color="#FF3D3D" />
      <ResultRow label="Total CVEs" value={Array.isArray(vulns) ? vulns.length : 0} color={Array.isArray(vulns) && vulns.length > 0 ? '#FF3D3D' : '#00E676'} />
      <ResultRow label="Risk Level" value={r.risk_level || r.severity} />
      {Array.isArray(regularVulns) && regularVulns.length > 0 && (
        <div className="mt-2 space-y-1">
          {regularVulns.slice(0, 20).map((v: any, i: number) => (
            <div key={i} className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-red-400">{v.id || v.cve || v.name}</span>
                {v.severity && <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : v.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{v.severity}</span>}
              </div>
              {v.cvss && <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">CVSS: {v.cvss} ({v.type || 'cve'})</div>}
              {v.description && <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1 line-clamp-2">{v.description}</p>}
            </div>
          ))}
        </div>
      )}
      
      {exploits.length > 0 && (
        <div className="mt-4">
          <SectionHeader title={`POSSIBLE EXPLOITS (${exploits.length})`} icon={AlertTriangle} color="#FF9500" />
          <div className="mt-2 space-y-1">
            {exploits.slice(0, 10).map((e: any, i: number) => (
              <div key={i} className="p-2 rounded-lg border border-orange-500/30 bg-orange-500/10 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-orange-400">{e.id}</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">EXPLOIT</span>
                </div>
                <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1 flex justify-between">
                  <span>Source: {e.type?.toUpperCase() || 'UNKNOWN'}</span>
                  {e.cvss && <span>CVSS: {e.cvss}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {(!Array.isArray(vulns) || vulns.length === 0) && renderFallback(r)}
    </div>
  );
}

export function ShodanResult({ r, query }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="SHODAN IOT INTELLIGENCE" icon={Network} color="#FF3D3D" />
      <ResultRow label="Target IP" value={r.ip || query} color="#FF3D3D" />
      {r.hostnames?.length > 0 && <ResultRow label="Hostnames" value={r.hostnames.join(', ')} />}
      {r.ports?.length > 0 && <ResultRow label="Open Ports" value={r.ports.join(', ')} color="#00E5FF" />}
      {r.tags?.length > 0 && <ResultRow label="Tags" value={r.tags.join(', ')} color="#FF9500" />}
      {r.vulns?.length > 0 && (
        <div className="mt-2 p-2 border border-red-500/30 bg-red-500/10 rounded">
          <span className="text-[11px] font-mono text-red-400 font-bold mb-1 block">VULNERABILITIES ({r.vulns.length})</span>
          <div className="flex flex-wrap gap-1">
            {r.vulns.slice(0, 10).map((v: string) => (
              <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A18] text-[#8A8880] hover:text-[#FF3D3D]">{v}</a>
            ))}
            {r.vulns.length > 10 && <span className="text-[10px] font-mono text-[#8A8880]">+{r.vulns.length - 10} more</span>}
          </div>
        </div>
      )}
      {renderFallbackExcluding(r, ['ip','hostnames','ports','tags','vulns','cpes'])}
    </div>
  );
}

export function BgpResult({ r }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="BGP ROUTING INTELLIGENCE" icon={Globe} color="#00E5FF" />
      <ResultRow label="Query" value={r.query} color="#00E5FF" />
      {r.type === 'ip' && r.ip && (
        <>
          {r.ip.prefixes?.map((p: any, i: number) => (
            <div key={i} className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
              <ResultRow label="ASN" value={`AS${p.asn.asn} - ${p.asn.name}`} color="#00E5FF" />
              <ResultRow label="Prefix" value={p.prefix} />
              <ResultRow label="Country" value={p.asn.country_code} />
              <ResultRow label="Description" value={p.asn.description} />
            </div>
          ))}
        </>
      )}
      {r.type === 'asn' && r.asn && (
        <div className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
          <ResultRow label="ASN" value={`AS${r.asn.asn}`} color="#00E5FF" />
          <ResultRow label="Name" value={r.asn.name} />
          <ResultRow label="Description" value={r.asn.description} />
          <ResultRow label="Country" value={r.asn.country_code} />
          {r.prefixes && <ResultRow label="Prefixes" value={`IPv4: ${r.prefixes.total_v4} | IPv6: ${r.prefixes.total_v6}`} />}
          {r.peers && <ResultRow label="Peers" value={r.peers.total} />}
        </div>
      )}
      {renderFallbackExcluding(r, ['query', 'type', 'ip', 'asn', 'prefixes', 'peers', 'timestamp'])}
    </div>
  );
}

export function MacResult({ r }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="MAC VENDOR LOOKUP" icon={Fingerprint} color="#FFD700" />
      <ResultRow label="MAC Address" value={r.mac} color="#FFD700" />
      <ResultRow label="Vendor" value={r.vendor} color={r.vendor === 'Not Found' ? '#FF3D3D' : '#00E676'} />
    </div>
  );
}

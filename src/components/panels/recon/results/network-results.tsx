'use client';

import { ExternalLink } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { ResultRow, PortRow, SEVERITY_TONE, Target, Verdict, known, plain, renderFallback, renderFallbackExcluding, type ToolResultProps } from './result-primitives';
import { CveLine } from './cve-line';

const SCAN_KEYS = ['host', 'target', 'scan_type', 'duration', 'scan_time', 'ports', 'open_ports', 'results'];

export function ScannerResult({ r, query }: ToolResultProps) {
  const ports = r.ports || r.open_ports || r.results || [];
  const list = Array.isArray(ports) ? ports : [];
  return (
    <div>
      <Verdict title={list.length ? `${list.length} open ${list.length === 1 ? 'port' : 'ports'}` : 'No open ports found'}
        body={<>On <Target value={r.host || r.target || query} />{(r.duration || r.scan_time) && <> · took {r.duration || r.scan_time}</>}</>} />
      {list.length > 0 && (
        <PanelSection title="Open ports" hint={list.length}>
          {list.map((p: any, i: number) => (
            <PortRow key={i} port={p.port || p} state={p.state || 'open'} service={p.service || p.name} version={p.version} />
          ))}
        </PanelSection>
      )}
      {renderFallbackExcluding(r, SCAN_KEYS)}
    </div>
  );
}

const VULN_KEYS = ['target', 'host', 'vulnerabilities', 'vulns', 'cves', 'risk_level', 'severity'];

export function VulnResult({ r, query }: ToolResultProps) {
  const vulns: any[] = Array.isArray(r.vulnerabilities || r.vulns || r.cves) ? (r.vulnerabilities || r.vulns || r.cves) : [];
  const exploits = vulns.filter(v => v.is_exploit);
  const regular = vulns.filter(v => !v.is_exploit);
  const risk = r.risk_level || r.severity;
  return (
    <div>
      <Verdict tone={vulns.length ? SEVERITY_TONE(risk) === 'neutral' ? 'amber' : SEVERITY_TONE(risk) : 'green'}
        title={vulns.length ? `${vulns.length} known ${vulns.length === 1 ? 'vulnerability' : 'vulnerabilities'}` : 'No known vulnerabilities'}
        body={<>For software seen on <Target value={r.target || query} />{risk ? <> · {plain(risk)} risk</> : null}</>} />
      {regular.length > 0 && (
        <PanelSection title="Vulnerabilities" hint={regular.length > 20 ? `first 20 of ${regular.length}` : regular.length}>
          {regular.slice(0, 20).map((v, i) => (
            <CveLine key={i} id={v.id || v.cve || v.name} severity={v.severity} cvss={v.cvss} type={v.type} description={v.description} />
          ))}
        </PanelSection>
      )}
      {exploits.length > 0 && (
        <PanelSection title="Public exploits" hint={exploits.length}>
          {exploits.slice(0, 10).map((e, i) => <CveLine key={i} id={e.id} cvss={e.cvss} type={e.type} exploit />)}
        </PanelSection>
      )}
      {renderFallbackExcluding(r, VULN_KEYS)}
    </div>
  );
}

/** "cpe:/a:nginx:nginx:1.18.0" → "nginx 1.18.0". */
const software = (cpe: string) => {
  const [, , , product = '', version = ''] = cpe.replace(/^cpe:2\.3:/, 'cpe:/').split(':');
  return [product.replace(/_/g, ' '), version].filter(v => v && v !== '*').join(' ') || cpe;
};

export function ShodanResult({ r, query }: ToolResultProps) {
  const ports: number[] = r.ports ?? [];
  const ip = r.ip || query;
  return (
    <div>
      <Verdict title={ports.length ? `${ports.length} open ${ports.length === 1 ? 'port' : 'ports'}` : 'Nothing seen open'}
        body={ports.length
          ? <>As last seen on <Target value={ip} /> by Shodan’s scanners</>
          : <>Shodan has no record of open services on <Target value={ip} />.</>} />
      {(ports.length > 0 || r.hostnames?.length > 0) && (
        <PanelSection title="Exposed services">
          <ResultRow label="Open ports" value={ports.join(', ')} mono />
          <ResultRow label="Host names" value={r.hostnames ?? []} mono={false} />
          <ResultRow label="Software" value={(r.cpes ?? []).map(software)} mono={false} />
          <ResultRow label="Tags" value={(r.tags ?? []).map(plain).join(', ')} mono={false} />
        </PanelSection>
      )}
      {r.vulns?.length > 0 && (
        <PanelSection title="Known vulnerabilities" hint={r.vulns.length}>
          <div className="flex flex-wrap gap-1.5">
            {r.vulns.slice(0, 24).map((v: string) => (
              <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-6 items-center gap-1 rounded-control border border-line bg-surface-2 px-1.5 font-mono text-meta text-ink-2 tabular-nums hover:border-line-strong hover:text-ink-1">
                {v}<ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
              </a>
            ))}
            {r.vulns.length > 24 && <span className="self-center text-meta text-ink-3">and {r.vulns.length - 24} more</span>}
          </div>
        </PanelSection>
      )}
      {renderFallbackExcluding(r, ['ip', 'hostnames', 'ports', 'tags', 'vulns', 'cpes', 'status'])}
    </div>
  );
}

const COUNTRY = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const country = (code?: string) => {
  if (!known(code)) return null;
  try { return `${COUNTRY?.of(code!) ?? code} (${code})`; } catch { return code!; }
};

/** Who runs the network an IP sits in, or what an ASN is. */
export function BgpResult({ r, query }: ToolResultProps) {
  const asn = r.type === 'ip' ? r.ip?.asn : r.asn;
  if (!asn) return renderFallback(r);
  const holder = known(asn.description) && asn.description !== asn.name ? asn.description : null;
  // For an IP both country fields are ip-api's geolocation, so they say the same thing.
  const place = country(asn.country_code)
    ?? (r.type === 'ip' && known(r.ip.rir_allocation) && !/^undefined/.test(r.ip.rir_allocation) ? r.ip.rir_allocation : null);
  return (
    <div>
      <Verdict title={known(asn.name) ? asn.name : `AS${asn.asn}`}
        body={r.type === 'ip' ? <>Runs the network behind <Target value={r.query || query} /></> : 'Autonomous system'} />
      <PanelSection title="Network">
        <ResultRow label="ASN" value={known(asn.asn) ? `AS${asn.asn}` : null} mono />
        <ResultRow label="Holder" value={holder} mono={false} />
        <ResultRow label={r.type === 'ip' ? 'Located in' : 'Registered in'} value={place} mono={false} />
        {r.type === 'ip' && <ResultRow label="Reverse DNS" value={known(r.ip.ptr_record) ? r.ip.ptr_record : null} mono={false} />}
        {r.type === 'asn' && r.prefixes?.total_v4 + r.prefixes?.total_v6 > 0 && (
          <ResultRow label="Prefixes" value={`${r.prefixes.total_v4} IPv4 · ${r.prefixes.total_v6} IPv6`} />
        )}
        {r.type === 'asn' && r.peers?.total > 0 && <ResultRow label="Peers" value={r.peers.total} />}
      </PanelSection>
    </div>
  );
}

export function MacResult({ r }: ToolResultProps) {
  const found = known(r.vendor) && r.vendor !== 'Not Found';
  return (
    <div>
      <Verdict title={found ? r.vendor : 'No maker on record'}
        body={found ? 'Made the network card with this address' : 'This prefix isn’t in the public register. Randomised and private addresses never are.'} />
      <PanelSection title="Address">
        <ResultRow label="MAC" value={r.mac} mono />
        <ResultRow label="Prefix (OUI)" value={r.prefix} mono />
        <ResultRow label="Maker’s address" value={r.address?.replace(/\s*\n\s*/g, ', ')} mono={false} />
      </PanelSection>
    </div>
  );
}

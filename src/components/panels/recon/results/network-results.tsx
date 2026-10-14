'use client';

import { ExternalLink } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { ResultRow, PortRow, SEVERITY_TONE, Target, Verdict, known, plain, renderFallback, renderFallbackExcluding, type ToolResultProps } from './result-primitives';
import { CveLine } from './cve-line';
import { serviceName } from '@/lib/recon/ports';

/** A live connect scan: which of the common ports answered, and how long the sweep took. */
export function ScannerResult({ r, query }: ToolResultProps) {
  const list: any[] = Array.isArray(r.ports) ? r.ports : [];
  const host = r.host || r.target || query;
  return (
    <div>
      <Verdict tone={list.length ? 'blue' : undefined}
        title={list.length ? `${list.length} open ${list.length === 1 ? 'port' : 'ports'}` : 'No open ports found'}
        body={<>On <Target value={host} />{r.address && r.address !== host ? <> ({r.address})</> : null}{r.scanned ? <> · {r.scanned} common ports checked</> : null}{r.duration ? <> in {r.duration}</> : null}</>} />
      {list.length > 0 && (
        <PanelSection title="Open ports" hint={list.length}>
          {list.map((p, i) => <PortRow key={i} port={p.port} state={p.state || 'open'} service={p.service} />)}
        </PanelSection>
      )}
      {!list.length && (
        <p className="mt-3 text-small text-ink-2">Nothing answered on the common ports. A firewall may be dropping the probes, or the host only listens elsewhere.</p>
      )}
    </div>
  );
}

/** Known CVEs for a host, worst first, with how many of each severity and how many are being exploited. */
export function VulnResult({ r, query }: ToolResultProps) {
  const vulns: any[] = Array.isArray(r.vulnerabilities) ? r.vulnerabilities : [];
  const total: number = r.total ?? vulns.length;
  const c = r.counts ?? {};
  const risk = r.risk_level && r.risk_level !== 'NONE' ? r.risk_level : null;
  const stack: string[] = (r.software ?? []).map(software);
  const target = r.target || query;
  const address = r.ip && r.ip !== target ? <> ({r.ip})</> : null;
  const breakdown = [
    c.critical && `${c.critical} critical`, c.high && `${c.high} high`, c.medium && `${c.medium} medium`, c.low && `${c.low} low`,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <Verdict tone={!total ? 'green' : SEVERITY_TONE(risk ?? '') === 'neutral' ? 'amber' : SEVERITY_TONE(risk ?? '')}
        title={total ? `${total.toLocaleString()} known ${total === 1 ? 'vulnerability' : 'vulnerabilities'}` : 'No known vulnerabilities'}
        body={total
          ? <>On <Target value={target} />{address}{c.kev ? <> · <span className="text-red">{c.kev} actively exploited</span></> : null}</>
          : <>Shodan has no CVEs on record for <Target value={target} />{address}.</>} />

      {total > 0 && (
        <PanelSection title="Summary">
          <ResultRow label="Risk" value={risk ? plain(risk) : null} tone={SEVERITY_TONE(risk ?? '')} mono={false} />
          <ResultRow label="By severity" value={breakdown || null} mono={false} />
          <ResultRow label="In CISA KEV" value={c.kev ?? 0} tone={c.kev ? 'red' : undefined}
            note={c.kev ? 'Known to be exploited in the wild' : undefined} />
        </PanelSection>
      )}

      {stack.length > 0 && (
        <PanelSection title="Software seen">
          <div className="flex flex-wrap gap-1.5">
            {stack.map(s => <span key={s} className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5 text-meta text-ink-2">{s}</span>)}
          </div>
        </PanelSection>
      )}

      {vulns.length > 0 && (
        <PanelSection title="Worst first" hint={vulns.length < total ? `top ${vulns.length} of ${total.toLocaleString()}` : vulns.length}>
          {vulns.map((v, i) => (
            <CveLine key={i} id={v.id} severity={v.severity} cvss={v.cvss} epss={v.epss} kev={v.kev} description={v.description} />
          ))}
        </PanelSection>
      )}

      {total > 0 && (
        <p className="mt-4 text-meta leading-relaxed text-ink-3">
          Matched by the software versions in Shodan’s last scan, so a patched build that keeps its version string still shows up. Confirm before acting.
        </p>
      )}
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
      {ports.length > 0 && (
        <PanelSection title="Open ports" hint={ports.length}>
          {ports.map(p => <PortRow key={p} port={p} state="open" service={serviceName(p)} />)}
        </PanelSection>
      )}
      {(r.hostnames?.length > 0 || r.cpes?.length > 0 || r.tags?.length > 0) && (
        <PanelSection title="Host">
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
  // An IP's country is where it geolocates; an ASN's is where its registry says it is.
  const place = country(asn.country_code);
  return (
    <div>
      <Verdict title={known(asn.name) ? asn.name : `AS${asn.asn}`}
        body={r.type === 'ip' ? <>Runs the network behind <Target value={r.query || query} /></> : 'Autonomous system'} />
      <PanelSection title="Network">
        <ResultRow label="ASN" value={known(asn.asn) ? `AS${asn.asn}` : null} mono />
        <ResultRow label="Holder" value={holder} mono={false} />
        <ResultRow label={r.type === 'ip' ? 'Located in' : 'Registered in'} value={place} mono={false} />
        <ResultRow label="Registry" value={r.registry} mono={false} />
        {r.type === 'ip' && <ResultRow label="Announced prefix" value={known(r.ip.prefix) ? r.ip.prefix : null} />}
        {r.type === 'ip' && <ResultRow label="Reverse DNS" value={known(r.ip.ptr_record) ? r.ip.ptr_record : null} mono={false} />}
        {r.type === 'asn' && r.prefixes?.total_v4 + r.prefixes?.total_v6 > 0 && (
          <ResultRow label="Prefixes" value={`${r.prefixes.total_v4.toLocaleString()} IPv4 · ${r.prefixes.total_v6.toLocaleString()} IPv6`} />
        )}
        {r.type === 'asn' && r.peers?.total > 0 && (
          <ResultRow label="Peers" value={`${r.peers.total} · ${r.peers.upstream?.length ?? 0} upstream`} />
        )}
      </PanelSection>
      {r.type === 'asn' && r.peers?.upstream?.length > 0 && (
        <PanelSection title="Upstream networks" hint={r.peers.upstream.length}>
          <div className="flex flex-wrap gap-1.5">
            {r.peers.upstream.slice(0, 20).map((asn: number) => (
              <span key={asn} className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-meta text-ink-2 tabular-nums">AS{asn}</span>
            ))}
          </div>
        </PanelSection>
      )}
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

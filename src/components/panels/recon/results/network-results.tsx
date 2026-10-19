'use client';

import { ExternalLink } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { ResultRow, PortRow, SEVERITY_TONE, Target, Verdict, known, plain, renderFallback, renderFallbackExcluding, severityLabel, type ToolResultProps } from './result-primitives';
import { CveLine } from './cve-line';
import { serviceName } from '@/lib/intel/recon/network/ports';

/** A live connect scan: which of the common ports answered, and how long the sweep took. */
export function ScannerResult({ r, query }: ToolResultProps) {
  const t = useT();
  const list: any[] = Array.isArray(r.ports) ? r.ports : [];
  const host = r.host || r.target || query;
  const on = <><Target value={host} />{r.address && r.address !== host ? <> ({r.address})</> : null}</>;
  return (
    <div>
      <Verdict tone={list.length ? 'blue' : undefined}
        title={list.length ? t('{n, plural, one {# open port} other {# open ports}}', { n: list.length }) : t('No open ports found')}
        body={!r.scanned ? t.rich('On {host}', { host: on })
          : r.duration ? t.rich('On {host} · {n, plural, one {# common port checked} other {# common ports checked}} in {duration}', { host: on, n: r.scanned, duration: r.duration })
          : t.rich('On {host} · {n, plural, one {# common port checked} other {# common ports checked}}', { host: on, n: r.scanned })} />
      {list.length > 0 && (
        <PanelSection title={t('Open ports')} hint={list.length}>
          {list.map((p, i) => <PortRow key={i} port={p.port} state={p.state || 'open'} service={p.service} />)}
        </PanelSection>
      )}
      {!list.length && (
        <p className="mt-3 text-small text-ink-2">{t('Nothing answered on the common ports. A firewall may be dropping the probes, or the host only listens elsewhere.')}</p>
      )}
    </div>
  );
}

/** Known CVEs for a host, worst first, with how many of each severity and how many are being exploited. */
export function VulnResult({ r, query }: ToolResultProps) {
  const t = useT();
  const vulns: any[] = Array.isArray(r.vulnerabilities) ? r.vulnerabilities : [];
  const total: number = r.total ?? vulns.length;
  const c = r.counts ?? {};
  const risk = r.risk_level && r.risk_level !== 'NONE' ? r.risk_level : null;
  const stack: string[] = (r.software ?? []).map(software);
  const target = r.target || query;
  const on = <><Target value={target} />{r.ip && r.ip !== target ? <> ({r.ip})</> : null}</>;
  const breakdown = [
    c.critical && t('{n} critical', { n: c.critical }), c.high && t('{n} high', { n: c.high }),
    c.medium && t('{n} medium', { n: c.medium }), c.low && t('{n} low', { n: c.low }),
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <Verdict tone={!total ? 'green' : SEVERITY_TONE(risk ?? '') === 'neutral' ? 'amber' : SEVERITY_TONE(risk ?? '')}
        title={total ? t('{n, plural, one {# known vulnerability} other {# known vulnerabilities}}', { n: total }) : t('No known vulnerabilities')}
        body={total
          ? <>{t.rich('On {target}', { target: on })}{c.kev ? <> · <span className="text-red">{t('{n} actively exploited', { n: c.kev })}</span></> : null}</>
          : t.rich('Shodan has no CVEs on record for {target}.', { target: on })} />

      {total > 0 && (
        <PanelSection title={t('Summary')}>
          <ResultRow label={t('Risk')} value={risk ? severityLabel(risk, t) : null} tone={SEVERITY_TONE(risk ?? '')} mono={false} />
          <ResultRow label={t('By severity')} value={breakdown || null} mono={false} />
          <ResultRow label={t('In CISA KEV')} value={c.kev ?? 0} tone={c.kev ? 'red' : undefined}
            note={c.kev ? t('Known to be exploited in the wild') : undefined} />
        </PanelSection>
      )}

      {stack.length > 0 && (
        <PanelSection title={t('Software seen')}>
          <div className="flex flex-wrap gap-1.5">
            {stack.map(s => <span key={s} className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5 text-meta text-ink-2">{s}</span>)}
          </div>
        </PanelSection>
      )}

      {vulns.length > 0 && (
        <PanelSection title={t('Worst first')} hint={vulns.length < total ? t('top {n} of {total}', { n: vulns.length, total }) : vulns.length}>
          {vulns.map((v, i) => (
            <CveLine key={i} id={v.id} severity={v.severity} cvss={v.cvss} epss={v.epss} kev={v.kev} description={v.description} />
          ))}
        </PanelSection>
      )}

      {total > 0 && (
        <p className="mt-4 text-meta leading-relaxed text-ink-3">
          {t('Matched by the software versions in Shodan’s last scan, so a patched build that keeps its version string still shows up. Confirm before acting.')}
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
  const t = useT();
  const ports: number[] = r.ports ?? [];
  const ip = r.ip || query;
  return (
    <div>
      <Verdict title={ports.length ? t('{n, plural, one {# open port} other {# open ports}}', { n: ports.length }) : t('Nothing seen open')}
        body={ports.length
          ? t.rich('As last seen on {ip} by Shodan’s scanners', { ip: <Target value={ip} /> })
          : t.rich('Shodan has no record of open services on {ip}.', { ip: <Target value={ip} /> })} />
      {ports.length > 0 && (
        <PanelSection title={t('Open ports')} hint={ports.length}>
          {ports.map(p => <PortRow key={p} port={p} state="open" service={serviceName(p)} />)}
        </PanelSection>
      )}
      {(r.hostnames?.length > 0 || r.cpes?.length > 0 || r.tags?.length > 0) && (
        <PanelSection title={t('Host')}>
          <ResultRow label={t('Host names')} value={r.hostnames ?? []} mono={false} />
          <ResultRow label={t('Software')} value={(r.cpes ?? []).map(software)} mono={false} />
          <ResultRow label={t('Tags')} value={(r.tags ?? []).map(plain).join(', ')} mono={false} />
        </PanelSection>
      )}
      {r.vulns?.length > 0 && (
        <PanelSection title={t('Known vulnerabilities')} hint={r.vulns.length}>
          <div className="flex flex-wrap gap-1.5">
            {r.vulns.slice(0, 24).map((v: string) => (
              <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-6 items-center gap-1 rounded-control border border-line bg-surface-2 px-1.5 font-mono text-meta text-ink-2 tabular-nums hover:border-line-strong hover:text-ink-1">
                {v}<ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
              </a>
            ))}
            {r.vulns.length > 24 && <span className="self-center text-meta text-ink-3">{t('and {n} more', { n: r.vulns.length - 24 })}</span>}
          </div>
        </PanelSection>
      )}
      {renderFallbackExcluding(r, ['ip', 'hostnames', 'ports', 'tags', 'vulns', 'cpes', 'status'])}
    </div>
  );
}

const country = (code: string | undefined, intl: string) => {
  if (!known(code)) return null;
  try { return `${new Intl.DisplayNames([intl], { type: 'region' }).of(code!) ?? code} (${code})`; } catch { return code!; }
};

/** Who runs the network an IP sits in, or what an ASN is. */
export function BgpResult({ r, query }: ToolResultProps) {
  const t = useT();
  const asn = r.type === 'ip' ? r.ip?.asn : r.asn;
  if (!asn) return renderFallback(r);
  const holder = known(asn.description) && asn.description !== asn.name ? asn.description : null;
  // An IP's country is where it geolocates; an ASN's is where its registry says it is.
  const place = country(asn.country_code, t.intl);
  return (
    <div>
      <Verdict title={known(asn.name) ? asn.name : `AS${asn.asn}`}
        body={r.type === 'ip' ? t.rich('Runs the network behind {ip}', { ip: <Target value={r.query || query} /> }) : t('Autonomous system')} />
      <PanelSection title={t('Network')}>
        <ResultRow label="ASN" value={known(asn.asn) ? `AS${asn.asn}` : null} mono />
        <ResultRow label={t('Holder')} value={holder} mono={false} />
        <ResultRow label={r.type === 'ip' ? t('Located in') : t('Registered in')} value={place} mono={false} />
        <ResultRow label={t('Registry')} value={r.registry} mono={false} />
        {r.type === 'ip' && <ResultRow label={t('Announced prefix')} value={known(r.ip.prefix) ? r.ip.prefix : null} />}
        {r.type === 'ip' && <ResultRow label={t('Reverse DNS')} value={known(r.ip.ptr_record) ? r.ip.ptr_record : null} mono={false} />}
        {r.type === 'asn' && r.prefixes?.total_v4 + r.prefixes?.total_v6 > 0 && (
          <ResultRow label={t('Prefixes')} value={`${r.prefixes.total_v4.toLocaleString(t.intl)} IPv4 · ${r.prefixes.total_v6.toLocaleString(t.intl)} IPv6`} />
        )}
        {r.type === 'asn' && r.peers?.total > 0 && (
          <ResultRow label={t('Peers')} value={t('{total} · {n} upstream', { total: r.peers.total, n: r.peers.upstream?.length ?? 0 })} />
        )}
      </PanelSection>
      {r.type === 'asn' && r.peers?.upstream?.length > 0 && (
        <PanelSection title={t('Upstream networks')} hint={r.peers.upstream.length}>
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
  const t = useT();
  const found = known(r.vendor) && r.vendor !== 'Not Found';
  return (
    <div>
      <Verdict title={found ? r.vendor : t('No maker on record')}
        body={found ? t('Made the network card with this address') : t('This prefix isn’t in the public register. Randomised and private addresses never are.')} />
      <PanelSection title={t('Address')}>
        <ResultRow label="MAC" value={r.mac} mono />
        <ResultRow label={t('Prefix (OUI)')} value={r.prefix} mono />
        <ResultRow label={t('Maker’s address')} value={r.address?.replace(/\s*\n\s*/g, ', ')} mono={false} />
      </PanelSection>
    </div>
  );
}

'use client';

import { Server, FileText, Lock, Shield } from 'lucide-react';
import { ResultRow, SectionHeader, SanctionsBadge, renderFallback, renderFallbackExcluding, type ToolResultProps } from './result-primitives';

export function DnsResult({ r, query }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="DNS RECORDS" icon={Server} color="#448AFF" />
      <ResultRow label="Domain" value={r.domain || query} color="#448AFF" />
      {r.A && <ResultRow label="A Records" value={Array.isArray(r.A) ? r.A.join(', ') : r.A} />}
      {r.AAAA && <ResultRow label="AAAA" value={Array.isArray(r.AAAA) ? r.AAAA.join(', ') : r.AAAA} />}
      {r.MX && <ResultRow label="MX" value={Array.isArray(r.MX) ? r.MX.map((m:any) => m.exchange || m).join(', ') : r.MX} />}
      {r.NS && <ResultRow label="NS" value={Array.isArray(r.NS) ? r.NS.join(', ') : r.NS} />}
      {r.TXT && <ResultRow label="TXT" value={Array.isArray(r.TXT) ? r.TXT.join(' | ') : r.TXT} />}
      {r.CNAME && <ResultRow label="CNAME" value={Array.isArray(r.CNAME) ? r.CNAME.join(', ') : r.CNAME} />}
      {r.SOA && <ResultRow label="SOA" value={typeof r.SOA === 'object' ? `${r.SOA.nsname} (${r.SOA.hostmaster})` : r.SOA} />}
      {renderFallbackExcluding(r, ['domain','A','AAAA','MX','NS','TXT','CNAME','SOA','timestamp','cached'])}
    </div>
  );
}

export function WhoisResult({ r, query }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="WHOIS INTELLIGENCE" icon={FileText} color="#FFD700" />
      <SanctionsBadge match={r.sanctions_match} />
      <ResultRow label="Domain" value={r.domain_name || r.domainName || query} color="#FFD700" />
      <ResultRow label="Registrar" value={r.registrar} />
      <ResultRow label="Created" value={r.creation_date || r.createdDate} />
      <ResultRow label="Expires" value={r.expiration_date || r.expiresDate} />
      <ResultRow label="Updated" value={r.updated_date || r.updatedDate} />
      <ResultRow label="Status" value={Array.isArray(r.status) ? r.status.join(', ') : r.status} />
      <ResultRow label="Nameservers" value={Array.isArray(r.name_servers || r.nameServers) ? (r.name_servers || r.nameServers).join(', ') : r.name_servers} />
      {renderFallbackExcluding(r, ['domain_name','domainName','registrar','creation_date','createdDate','expiration_date','expiresDate','updated_date','updatedDate','status','name_servers','nameServers','timestamp','cached','raw','sanctions_match'])}
    </div>
  );
}

export function CertsResult({ r, query }: ToolResultProps) {
  const certs = r.certificates || r.certs || (Array.isArray(r) ? r : []);
  return (
    <div>
      <SectionHeader title="CERTIFICATE TRANSPARENCY" icon={Lock} color="#E040FB" />
      <ResultRow label="Domain" value={query} color="#E040FB" />
      <ResultRow label="Certificates" value={Array.isArray(certs) ? certs.length : 0} />
      {Array.isArray(certs) && certs.slice(0, 15).map((c: any, i: number) => (
        <div key={i} className="mt-1.5 p-2 rounded border border-[var(--border-secondary)]/30 bg-[var(--bg-tertiary)]/30">
          <ResultRow label="Issuer" value={c.issuer_name || c.issuer} />
          <ResultRow label="Common Name" value={c.common_name || c.name_value} />
          <ResultRow label="Not Before" value={c.not_before} />
          <ResultRow label="Not After" value={c.not_after} />
        </div>
      ))}
      {(!Array.isArray(certs) || certs.length === 0) && renderFallback(r)}
    </div>
  );
}

export function SslResult({ r, query }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="SSL/TLS ANALYSIS" icon={Shield} color="#76FF03" />
      <ResultRow label="Target" value={query} color="#76FF03" />
      <ResultRow label="Protocol" value={r.protocol || r.tls_version} />
      <ResultRow label="Cipher" value={r.cipher || r.cipher_suite} />
      <ResultRow label="Valid" value={r.valid !== undefined ? (r.valid ? 'YES' : 'NO') : undefined} color={r.valid ? '#00E676' : '#FF3D3D'} />
      <ResultRow label="Issuer" value={r.issuer} />
      <ResultRow label="Subject" value={r.subject} />
      <ResultRow label="Expires" value={r.expires || r.not_after} />
      <ResultRow label="SANs" value={Array.isArray(r.sans) ? r.sans.join(', ') : r.sans} />
      {renderFallback(r)}
    </div>
  );
}

import { htmlEsc, pop, popCoords, sentence, type PopTone } from './kit';

type FeatureProps = NonNullable<GeoJSON.GeoJsonProperties>;

const utc = (v: unknown): string | null => {
  const s = String(v ?? '');
  return s ? `${s.slice(0, 16).replace('T', ' ')} UTC` : null;
};

export function malwarePopupHtml(p: FeatureProps): string {
  const online = p.status === 'online';
  const place = [p.city, p.country].filter(Boolean).join(', ');
  return pop({
    kicker: sentence(String(p.threat_type || 'malware').replace(/_/g, ' ')),
    tone: online ? 'red' : 'neutral',
    meta: online ? 'Online' : sentence(p.status || 'Unknown'),
    title: p.malware || 'Unclassified payload',
    subtitle: place || undefined,
    rows: [
      { label: 'Host', value: `${p.ip}:${p.port ?? 0}`, mono: true },
      { label: 'Network', value: p.as_name ? `AS${p.asn} ${p.as_name}` : null },
      { label: 'Live URLs', value: Number(p.url_count) || 1, mono: true },
      { label: 'First seen', value: String(p.first_seen || '').split(' ')[0] || null, mono: true },
      { label: 'Last report', value: String(p.last_seen || '').split(' ')[0] || null, mono: true },
    ],
    note: p.reporter ? `Reported by ${p.reporter}` : undefined,
    // The specific URLhaus report behind this node.
    links: [p.reference && { href: p.reference, label: 'URLhaus report' }],
  });
}

export function outagePopupHtml(p: FeatureProps): string {
  // MapLibre serialises feature properties, so booleans can arrive as strings.
  const ongoing = p.ongoing === true || p.ongoing === 'true';
  return pop({
    kicker: 'Internet outage',
    tone: ongoing ? 'amber' : 'neutral',
    meta: ongoing ? 'Ongoing' : 'Resolved',
    title: p.country_name,
    body: p.description ? htmlEsc(p.description) : undefined,
    rows: [
      { label: 'Cause', value: sentence(p.cause || 'Unspecified') },
      { label: 'Scope', value: p.scope || 'Nationwide' },
      { label: 'Started', value: utc(p.start), mono: true },
      { label: 'Ended', value: utc(p.end), mono: true },
    ],
    note: 'Cloudflare Radar',
    links: [{ href: p.url, label: 'Radar detail' }],
  });
}

export function attackOriginPopupHtml(p: FeatureProps): string {
  return pop({
    kicker: 'Attack traffic origin',
    tone: 'red',
    title: p.country_name,
    rows: [
      { label: 'Share', value: `${p.share}%`, mono: true },
      { label: 'Country code', value: p.country, mono: true },
    ],
    note: 'Share of layer-3 attack traffic observed by Cloudflare Radar, by origin.',
  });
}

/* Every field is read off the Feodo Tracker blocklist row: an address, a
   family, a hosting country and two timestamps. No attack is observed. */
export function c2ServerPopupHtml(p: FeatureProps): string {
  const online = p.status === 'online';
  return pop({
    kicker: 'Botnet control server',
    tone: online ? 'amber' : 'neutral',
    meta: online ? 'Online' : sentence(p.status || 'Unknown'),
    title: p.malware || 'Family not reported',
    subtitle: p.hostname || undefined,
    rows: [
      { label: 'Address', value: p.ip, mono: true },
      { label: 'Port', value: p.port, mono: true },
      { label: 'Hosted in', value: p.country || 'Not reported' },
      { label: 'Network', value: p.as_number ? `AS${p.as_number}${p.as_name ? ` ${p.as_name}` : ''}` : null },
      { label: 'First seen', value: p.first_seen || null, mono: true },
      { label: 'Last online', value: p.last_online || null, mono: true },
    ],
    note: 'A blocklist entry, not an observed attack. The marker sits at the hosting country, not the host.',
    links: [{ href: p.source_url || 'https://feodotracker.abuse.ch/browse/', label: 'Feodo Tracker' }],
  });
}

export function scanTargetPopupHtml(p: FeatureProps, coords: number[]): string {
  return pop({
    kicker: 'Scan target',
    tone: 'red',
    title: p.id,
    subtitle: [[p.city, p.country].filter(Boolean).join(', '), p.isp].filter(Boolean).join(' · ') || undefined,
    rows: [
      { label: 'Type', value: sentence(p.type || 'Unknown') },
      { label: 'Location', value: popCoords(coords[1], coords[0]), mono: true },
    ],
  });
}

export function supplierPopupHtml(p: FeatureProps): string {
  const tone: PopTone = p.risk_level === 'CRITICAL' ? 'red' : p.risk_level === 'HIGH' ? 'amber' : 'neutral';
  let threats: string[] = [];
  try { threats = p.active_threats ? JSON.parse(p.active_threats) : []; } catch { /* not a list */ }
  return pop({
    kicker: 'Supplier',
    tone,
    meta: p.risk_level ? `${sentence(p.risk_level)} risk` : undefined,
    title: p.name,
    subtitle: [p.category, [p.city, p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    body: threats.length ? `<div class="tk-pop-label">Active threats</div>${threats.map(t => `<div>${htmlEsc(t)}</div>`).join('')}` : undefined,
  });
}

export function sweepDevicePopupHtml(p: FeatureProps): string {
  const parse = (v: unknown): string[] => { try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a : []; } catch { return []; } };
  const ports = parse(p.ports);
  const vulns = parse(p.vulns);
  const hostnames = parse(p.hostnames);
  const risk = String(p.risk_level || '');
  const tone: PopTone = risk === 'CRITICAL' ? 'red' : risk === 'HIGH' || risk === 'MEDIUM' ? 'amber' : 'neutral';
  return pop({
    kicker: sentence(p.device_type || 'Device'),
    tone,
    title: p.ip,
    subtitle: hostnames.length ? hostnames.join(', ') : undefined,
    rows: [
      { label: 'Open ports', value: ports.length ? `${ports.slice(0, 12).join(', ')}${ports.length > 12 ? ' …' : ''}` : 'None', mono: true },
      { label: 'Risk', value: sentence(risk || 'Unknown'), tone },
      vulns.length > 0 && { label: 'CVEs', value: `${vulns.slice(0, 5).join(', ')}${vulns.length > 5 ? ` +${vulns.length - 5} more` : ''}`, mono: true, tone: 'red' },
    ],
  });
}

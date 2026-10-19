import { htmlEsc, levelWord, pop, popCoords, sentence, type PopTone } from './kit';
import { t } from '@/lib/core/i18n/active';

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
    meta: online ? t('Online') : p.status ? sentence(p.status) : t('Unknown'),
    title: p.malware || t('Unclassified payload'),
    subtitle: place || undefined,
    rows: [
      { label: t('Host'), value: `${p.ip}:${p.port ?? 0}`, mono: true },
      { label: t('Network'), value: p.as_name ? `AS${p.asn} ${p.as_name}` : null },
      { label: t('Live URLs'), value: Number(p.url_count) || 1, mono: true },
      { label: t('First seen'), value: String(p.first_seen || '').split(' ')[0] || null, mono: true },
      { label: t('Last report'), value: String(p.last_seen || '').split(' ')[0] || null, mono: true },
    ],
    note: p.reporter ? t('Reported by {reporter}', { reporter: String(p.reporter) }) : undefined,
    // The specific URLhaus report behind this node.
    links: [p.reference && { href: p.reference, label: t('URLhaus report') }],
  });
}

export function outagePopupHtml(p: FeatureProps): string {
  // MapLibre serialises feature properties, so booleans can arrive as strings.
  const ongoing = p.ongoing === true || p.ongoing === 'true';
  return pop({
    kicker: t('Internet outage'),
    tone: ongoing ? 'amber' : 'neutral',
    meta: ongoing ? t('Ongoing') : t('Resolved'),
    title: p.country_name,
    body: p.description ? htmlEsc(p.description) : undefined,
    rows: [
      { label: t('Cause'), value: p.cause ? sentence(p.cause) : t('Unspecified') },
      { label: t('Scope'), value: p.scope || t('Nationwide') },
      { label: t('Started'), value: utc(p.start), mono: true },
      { label: t('Ended'), value: utc(p.end), mono: true },
    ],
    note: 'Cloudflare Radar',
    links: [{ href: p.url, label: t('Radar detail') }],
  });
}

export function attackOriginPopupHtml(p: FeatureProps): string {
  return pop({
    kicker: t('Attack traffic origin'),
    tone: 'red',
    title: p.country_name,
    rows: [
      { label: t('Share'), value: `${p.share}%`, mono: true },
      { label: t('Country code'), value: p.country, mono: true },
    ],
    note: t('Share of layer-3 attack traffic observed by Cloudflare Radar, by origin.'),
  });
}

/* Every field is read off the Feodo Tracker blocklist row: an address, a
   family, a hosting country and two timestamps. No attack is observed. */
export function c2ServerPopupHtml(p: FeatureProps): string {
  const online = p.status === 'online';
  return pop({
    kicker: t('Botnet control server'),
    tone: online ? 'amber' : 'neutral',
    meta: online ? t('Online') : p.status ? sentence(p.status) : t('Unknown'),
    title: p.malware || t('Family not reported'),
    subtitle: p.hostname || undefined,
    rows: [
      { label: t('Address'), value: p.ip, mono: true },
      { label: t('Port'), value: p.port, mono: true },
      { label: t('Hosted in'), value: p.country || t('Not reported') },
      { label: t('Network'), value: p.as_number ? `AS${p.as_number}${p.as_name ? ` ${p.as_name}` : ''}` : null },
      { label: t('First seen'), value: p.first_seen || null, mono: true },
      { label: t('Last online'), value: p.last_online || null, mono: true },
    ],
    note: t('A blocklist entry, not an observed attack. The marker sits at the hosting country, not the host.'),
    links: [{ href: p.source_url || 'https://feodotracker.abuse.ch/browse/', label: 'Feodo Tracker' }],
  });
}

export function scanTargetPopupHtml(p: FeatureProps, coords: number[]): string {
  return pop({
    kicker: t('Scan target'),
    tone: 'red',
    title: p.id,
    subtitle: [[p.city, p.country].filter(Boolean).join(', '), p.isp].filter(Boolean).join(' · ') || undefined,
    rows: [
      { label: t('Type'), value: p.type ? sentence(p.type) : t('Unknown') },
      { label: t('Location'), value: popCoords(coords[1], coords[0]), mono: true },
    ],
  });
}

export function supplierPopupHtml(p: FeatureProps): string {
  const tone: PopTone = p.risk_level === 'CRITICAL' ? 'red' : p.risk_level === 'HIGH' ? 'amber' : 'neutral';
  let threats: string[] = [];
  try { threats = p.active_threats ? JSON.parse(p.active_threats) : []; } catch { /* not a list */ }
  return pop({
    kicker: t('Supplier'),
    tone,
    meta: p.risk_level ? t('{level} risk', { level: levelWord(p.risk_level) }) : undefined,
    title: p.name,
    subtitle: [p.category, [p.city, p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    body: threats.length ? `<div class="tk-pop-label">${htmlEsc(t('Active threats'))}</div>${threats.map(threat => `<div>${htmlEsc(threat)}</div>`).join('')}` : undefined,
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
    kicker: p.device_type ? sentence(p.device_type) : t('Device'),
    tone,
    title: p.ip,
    subtitle: hostnames.length ? hostnames.join(', ') : undefined,
    rows: [
      { label: t('Open ports'), value: ports.length ? `${ports.slice(0, 12).join(', ')}${ports.length > 12 ? ' …' : ''}` : t('None'), mono: true },
      { label: t('Risk'), value: risk ? levelWord(risk) : t('Unknown'), tone },
      vulns.length > 0 && { label: 'CVEs', value: `${vulns.slice(0, 5).join(', ')}${vulns.length > 5 ? ` ${t('+{n} more', { n: vulns.length - 5 })}` : ''}`, mono: true, tone: 'red' },
    ],
  });
}

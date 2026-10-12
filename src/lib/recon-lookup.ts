import { ipToNumber, numberToIp, calculateSubnetStart, classifyDevice, assessRisk, batchFetch, ShodanInternetDBResponse, SweepDevice } from '@/lib/osint-utils';

// Lookup routes answer with unvalidated JSON of many shapes.
export type ReconData = any;

export function lookupUrl(activeTab: string, query: string, scanType: string) {
  let url = '';
  switch (activeTab) {

    case 'dns': url = `/api/osint/dns?domain=${encodeURIComponent(query)}`; break;
    case 'certs': url = `/api/osint/certs?domain=${encodeURIComponent(query)}`; break;
    case 'whois': url = `/api/osint/whois?domain=${encodeURIComponent(query)}`; break;
    case 'threats': url = `/api/osint/threats?query=${encodeURIComponent(query)}`; break;
    case 'bgp': url = `/api/osint/bgp?query=${encodeURIComponent(query)}`; break;
    case 'mac': url = `/api/osint/mac?mac=${encodeURIComponent(query)}`; break;
    case 'phone': url = `/api/osint/phone?number=${encodeURIComponent(query)}`; break;
    case 'leaks': url = `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(query)}`; break;
    case 'crypto': url = `/api/osint/crypto?address=${encodeURIComponent(query)}`; break;
    case 'username': url = `/api/osint/username?username=${encodeURIComponent(query)}`; break;
    case 'github': url = `/api/osint/github?user=${encodeURIComponent(query)}`; break;
    case 'vuln': url = `/api/scanner?target=${encodeURIComponent(query)}&type=vuln`; break;
    case 'scanner': url = `/api/scanner?target=${encodeURIComponent(query)}&type=${scanType}`; break;
    case 'headers': url = `/api/scanner?target=${encodeURIComponent(query)}&type=headers`; break;
    case 'ssl': url = `/api/scanner?target=${encodeURIComponent(query)}&type=ssl`; break;
    case 'subdomains': url = `/api/scanner?target=${encodeURIComponent(query)}&type=subdomains`; break;
    case 'tech': url = `/api/scanner?target=${encodeURIComponent(query)}&type=tech`; break;
    case 'shodan': url = `https://internetdb.shodan.io/${encodeURIComponent(query)}`; break;
  }
  return url;
}

export function parseLeaks(data: ReconData, query: string) {
  let breachList: string[] = [];
  const dataExposed = new Set<string>();
  if (data.BreachesSummary && data.BreachesSummary.site) {
     breachList = data.BreachesSummary.site.split(';').filter(Boolean);
  }
  if (data.ExposedData && Array.isArray(data.ExposedData)) {
     data.ExposedData.forEach((item: any) => {
        if (item.data_classes && Array.isArray(item.data_classes)) {
           item.data_classes.forEach((dc: string) => dataExposed.add(dc));
        }
     });
  }
  return {
     email: query,
     breached: breachList.length > 0,
     breaches: breachList,
     data_exposed: Array.from(dataExposed).sort()
  };
}

export async function runSweep(query: string, cidr: number, totalHosts: number, onProgress: (done: number) => void) {
  const t0 = Date.now();
  const res = await fetch(`/api/osint/sweep?ip=${encodeURIComponent(query)}&cidr=${cidr}`);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Sweep failed (${res.status})`); }
  const initData = await res.json();

  const ipParts = initData.target_ip.split('.').map(Number) as [number, number, number, number];
  const ipNum = ipToNumber(ipParts);
  const subnetStart = calculateSubnetStart(ipNum, cidr);
  const subnet = numberToIp(subnetStart);

  const urls: string[] = [];
  for (let i = 0; i < totalHosts; i++) {
    urls.push(`https://internetdb.shodan.io/${numberToIp((subnetStart + i) >>> 0)}`);
  }

  const shodanResults = await batchFetch<ShodanInternetDBResponse>(urls, 15, async (u) => {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }, onProgress);

  const devices: SweepDevice[] = [];
  const deviceBreakdown: Record<string, number> = {};
  for (const sr of shodanResults) {
    if (!sr) continue;
    const classification = classifyDevice(sr.ports, sr.cpes, sr.tags);
    const risk = assessRisk({ ports: sr.ports, vulns: sr.vulns });
    devices.push({
      ip: sr.ip, ports: sr.ports, hostnames: sr.hostnames,
      cpes: sr.cpes, vulns: sr.vulns, tags: sr.tags,
      device_type: classification.device_type,
      device_icon: classification.device_icon,
      device_color: classification.device_color,
      risk_level: risk
    });
    deviceBreakdown[classification.device_type] = (deviceBreakdown[classification.device_type] || 0) + 1;
  }

  return {
    center: initData.center,
    subnet: `${subnet}/${cidr}`,
    cidr,
    target_ip: initData.target_ip,
    devices,
    summary: { total_hosts: totalHosts, total_responsive: devices.length, device_breakdown: deviceBreakdown },
    sweep_time_ms: Date.now() - t0
  };
}

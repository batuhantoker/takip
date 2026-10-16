import { ALLOWED_DOMAINS } from '../lib/config.js';
import { wdCacheGet, wdCacheSet } from '../lib/wikidata.js';
import { addSanctionsToGraph, dedup } from '../lib/graph.js';

async function resolveIP(id) {
  const rootId = `ip:${id}`;
  const nodes = [], links = [];
  const cached = wdCacheGet(`ip:${id}`);
  if (cached) return { ...cached };

  // Step 1: ip-api.com — geolocation, ISP, ASN, proxy/hosting detection
  try {
    const ipApiUrl = `http://ip-api.com/json/${encodeURIComponent(id)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting`;
    const parsed = new URL(ipApiUrl);
    if (!ALLOWED_DOMAINS.has(parsed.hostname)) throw new Error(`Blocked domain: ${parsed.hostname}`);
    const res = await fetch(ipApiUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        // ISP node
        if (data.isp) {
          const ispId = `company:${data.isp}`;
          nodes.push({ id: ispId, label: data.isp, type: 'company', properties: { role: 'ISP', org: data.org || '', source: 'ip-api.com' } });
          links.push({ source: rootId, target: ispId, label: 'HOSTED_BY' });
          addSanctionsToGraph(data.isp, rootId, nodes, links);
        }

        // ASN node
        if (data.as) {
          const asLabel = data.asname || data.as;
          const asId = `company:${data.as}`;
          nodes.push({ id: asId, label: asLabel, type: 'company', properties: { as_number: data.as, source: 'ip-api.com' } });
          links.push({ source: rootId, target: asId, label: 'ASN' });
        }

        // Country node
        if (data.country) {
          const cid = `country:${data.country}`;
          nodes.push({ id: cid, label: data.country, type: 'country', properties: { code: data.countryCode || '', source: 'ip-api.com' } });
          links.push({ source: rootId, target: cid, label: 'LOCATED_IN' });
          addSanctionsToGraph(data.country, rootId, nodes, links);
        }

        // City node (as event type with lat/lng)
        if (data.city) {
          const cityId = `event:${data.city}`;
          nodes.push({
            id: cityId, label: data.city, type: 'event',
            properties: {
              lat: data.lat, lon: data.lon, region: data.regionName || '',
              zip: data.zip || '', timezone: data.timezone || '', source: 'ip-api.com',
            },
          });
          links.push({ source: rootId, target: cityId, label: 'GEOLOCATED' });
        }

        // Tag proxy/hosting/mobile flags on the root IP node
        nodes.push({
          id: rootId, label: id, type: 'ip',
          properties: {
            proxy: !!data.proxy, hosting: !!data.hosting, mobile: !!data.mobile,
            source: 'ip-api.com',
          },
        });
      }
    }
  } catch (e) { console.warn('[INTEL] ip-api.com error:', e.message); }

  // Step 2: RIPEstat WHOIS
  try {
    const whoisUrl = `https://stat.ripe.net/data/whois/data.json?resource=${encodeURIComponent(id)}`;
    const parsed = new URL(whoisUrl);
    if (!ALLOWED_DOMAINS.has(parsed.hostname)) throw new Error(`Blocked domain: ${parsed.hostname}`);
    const res = await fetch(whoisUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      const records = json.data?.records || [];
      for (const record of records) {
        for (const field of record) {
          if (field.key === 'netname' || field.key === 'NetName') {
            const netId = `company:${field.value}`;
            nodes.push({ id: netId, label: field.value, type: 'company', properties: { role: 'Network', source: 'RIPEstat WHOIS' } });
            links.push({ source: rootId, target: netId, label: 'HOSTED_BY' });
          }
        }
      }
    }
  } catch (e) { console.warn('[INTEL] RIPEstat WHOIS error:', e.message); }

  // Step 3: RIPEstat Abuse Contact
  try {
    const abuseUrl = `https://stat.ripe.net/data/abuse-contact-finder/data.json?resource=${encodeURIComponent(id)}`;
    const parsed = new URL(abuseUrl);
    if (!ALLOWED_DOMAINS.has(parsed.hostname)) throw new Error(`Blocked domain: ${parsed.hostname}`);
    const res = await fetch(abuseUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      const contacts = json.data?.abuse_contacts || [];
      for (const email of contacts) {
        if (email) {
          const eid = `person:${email}`;
          nodes.push({ id: eid, label: email, type: 'person', properties: { role: 'Abuse Contact', source: 'RIPEstat' } });
          links.push({ source: rootId, target: eid, label: 'ABUSE CONTACT' });
        }
      }
    }
  } catch (e) { console.warn('[INTEL] RIPEstat abuse-contact error:', e.message); }

  // Step 4: RIPEstat Network Info
  try {
    const netUrl = `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(id)}`;
    const parsed = new URL(netUrl);
    if (!ALLOWED_DOMAINS.has(parsed.hostname)) throw new Error(`Blocked domain: ${parsed.hostname}`);
    const res = await fetch(netUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      const prefix = json.data?.prefix;
      const asns = json.data?.asns || [];
      if (prefix) {
        const prefId = `ip:${prefix}`;
        nodes.push({ id: prefId, label: prefix, type: 'ip', properties: { role: 'Prefix', source: 'RIPEstat' } });
        links.push({ source: rootId, target: prefId, label: 'PREFIX' });
      }
      for (const asn of asns) {
        const asnId = `company:AS${asn}`;
        nodes.push({ id: asnId, label: `AS${asn}`, type: 'company', properties: { as_number: `AS${asn}`, source: 'RIPEstat' } });
        links.push({ source: rootId, target: asnId, label: 'ASN' });
      }
    }
  } catch (e) { console.warn('[INTEL] RIPEstat network-info error:', e.message); }

  const result = dedup(nodes, links);
  wdCacheSet(`ip:${id}`, result);
  return result;
}

export { resolveIP };

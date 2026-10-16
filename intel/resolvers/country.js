import { wdCacheGet, wdCacheSet, sparql, wdSearch } from '../lib/wikidata.js';
import { addSanctionsToGraph, dedup } from '../lib/graph.js';

async function resolveCountry(id) {
  const rootId = `country:${id}`;
  const nodes = [], links = [];
  const cached = wdCacheGet(`country:${id}`);
  if (cached) return { ...cached };

  try {
    const qid = await wdSearch(id);
    const filter = qid
      ? `VALUES ?item { wd:${qid} }`
      : `?item rdfs:label "${id}"@en . ?item wdt:P31 wd:Q6256 .`;
    const results = await sparql(`
      SELECT ?item ?itemLabel ?headLabel ?capitalLabel ?population ?gdp
             ?tld ?callingCode ?memberOfLabel ?neighborLabel WHERE {
        ${filter}
        OPTIONAL { ?item wdt:P35 ?head . }
        OPTIONAL { ?item wdt:P36 ?capital . }
        OPTIONAL { ?item wdt:P1082 ?population . }
        OPTIONAL { ?item wdt:P2131 ?gdp . }
        OPTIONAL { ?item wdt:P78 ?tld . }
        OPTIONAL { ?item wdt:P474 ?callingCode . }
        OPTIONAL { ?item wdt:P463 ?memberOf . }
        OPTIONAL { ?item wdt:P47 ?neighbor . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      } LIMIT 50`);

    const seenHeads = new Set();
    const seenMembers = new Set();
    const seenNeighbors = new Set();
    let propsSet = false;

    for (const r of results) {
      // Head of state/government
      if (r.headLabel?.value && !seenHeads.has(r.headLabel.value)) {
        seenHeads.add(r.headLabel.value);
        const hid = `person:${r.headLabel.value}`;
        nodes.push({ id: hid, label: r.headLabel.value, type: 'person', properties: { role: 'Head of State', source: 'Wikidata' } });
        links.push({ source: rootId, target: hid, label: 'HEAD OF STATE' });
      }

      // Capital city
      if (r.capitalLabel?.value && !propsSet) {
        const capId = `event:${r.capitalLabel.value}`;
        nodes.push({ id: capId, label: r.capitalLabel.value, type: 'event', properties: { role: 'Capital', source: 'Wikidata' } });
        links.push({ source: rootId, target: capId, label: 'CAPITAL' });
      }

      // Country properties (population, GDP, TLD, calling code)
      if (!propsSet) {
        const props = { source: 'Wikidata' };
        if (r.population?.value) props.population = r.population.value;
        if (r.gdp?.value) props.gdp = r.gdp.value;
        if (r.tld?.value) props.tld = r.tld.value;
        if (r.callingCode?.value) props.calling_code = r.callingCode.value;
        nodes.push({ id: rootId, label: id, type: 'country', properties: props });
        propsSet = true;
      }

      // Member of (UN, NATO, EU, etc.)
      if (r.memberOfLabel?.value && !seenMembers.has(r.memberOfLabel.value)) {
        seenMembers.add(r.memberOfLabel.value);
        const mid = `company:${r.memberOfLabel.value}`;
        nodes.push({ id: mid, label: r.memberOfLabel.value, type: 'company', properties: { role: 'Organization', source: 'Wikidata' } });
        links.push({ source: rootId, target: mid, label: 'MEMBER OF' });
      }

      // Neighboring countries
      if (r.neighborLabel?.value && !seenNeighbors.has(r.neighborLabel.value)) {
        seenNeighbors.add(r.neighborLabel.value);
        const nid = `country:${r.neighborLabel.value}`;
        nodes.push({ id: nid, label: r.neighborLabel.value, type: 'country', properties: { source: 'Wikidata' } });
        links.push({ source: rootId, target: nid, label: 'NEIGHBOR' });
      }
    }
  } catch (e) { console.warn('[INTEL] Wikidata country error:', e.message); }

  addSanctionsToGraph(id, rootId, nodes, links);
  const result = dedup(nodes, links);
  wdCacheSet(`country:${id}`, result);
  return result;
}

export { resolveCountry };

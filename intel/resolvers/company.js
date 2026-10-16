import { wdCacheGet, wdCacheSet, sparql, wdSearch } from '../lib/wikidata.js';
import { addSanctionsToGraph, dedup } from '../lib/graph.js';

async function resolveCompany(id) {
  const rootId = `company:${id}`;
  const nodes = [], links = [];
  const cached = wdCacheGet(`company:${id}`);
  if (cached) return { ...cached };

  try {
    // Use Wikidata search to find the QID first, then resolve by QID
    const qid = await wdSearch(id);
    const filter = qid
      ? `VALUES ?item { wd:${qid} }`
      : `?item rdfs:label "${id}"@en . { ?item wdt:P31/wdt:P279* wd:Q4830453 . } UNION { ?item wdt:P31/wdt:P279* wd:Q43229 . }`;
    const results = await sparql(`
      SELECT ?item ?itemLabel ?countryLabel ?parentLabel ?ceoLabel ?industryLabel WHERE {
        ${filter}
        OPTIONAL { ?item wdt:P17 ?country . }
        OPTIONAL { ?item wdt:P749 ?parent . }
        OPTIONAL { ?item wdt:P169 ?ceo . }
        OPTIONAL { ?item wdt:P452 ?industry . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      } LIMIT 10`);
    for (const r of results) {
      if (r.countryLabel?.value) {
        const cid = `country:${r.countryLabel.value}`;
        nodes.push({ id: cid, label: r.countryLabel.value, type: 'country', properties: { source: 'Wikidata' } });
        links.push({ source: rootId, target: cid, label: 'HEADQUARTERED' });
      }
      if (r.parentLabel?.value) {
        const pid = `company:${r.parentLabel.value}`;
        nodes.push({ id: pid, label: r.parentLabel.value, type: 'company', properties: { source: 'Wikidata' } });
        links.push({ source: rootId, target: pid, label: 'PARENT ORG' });
      }
      if (r.ceoLabel?.value) {
        const pid = `person:${r.ceoLabel.value}`;
        nodes.push({ id: pid, label: r.ceoLabel.value, type: 'person', properties: { role: 'CEO', source: 'Wikidata' } });
        links.push({ source: rootId, target: pid, label: 'CEO' });
      }
    }
  } catch (e) { console.warn('[INTEL] Wikidata company error:', e.message); }

  addSanctionsToGraph(id, rootId, nodes, links);
  const result = dedup(nodes, links);
  wdCacheSet(`company:${id}`, result);
  return result;
}

export { resolveCompany };

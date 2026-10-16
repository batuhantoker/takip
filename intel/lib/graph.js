import { sanctionsSearch } from './sanctions.js';

function addSanctionsToGraph(query, rootId, nodes, links) {
  const matches = sanctionsSearch(query);
  for (const m of matches) {
    const sid = `sanction:${m.id}`;
    nodes.push({
      id: sid, label: `⚠ ${m.name}`, type: 'sanction',
      properties: {
        schema: m.schema, countries: m.countries.join(', '),
        programs: m.programs.join(', '), sanctions: m.sanctions,
        aliases: m.aliases.slice(0, 5).join('; '),
        first_seen: m.first_seen, sanctioned: true,
      },
    });
    links.push({ source: rootId, target: sid, label: 'SANCTIONS MATCH' });
  }
}

function dedup(nodes, links) {
  const seen = new Set();
  const uNodes = [];
  for (const n of nodes) { if (!seen.has(n.id)) { seen.add(n.id); uNodes.push(n); } }
  const lSeen = new Set();
  const uLinks = [];
  for (const l of links) {
    const k = `${l.source}→${l.target}→${l.label}`;
    if (!lSeen.has(k)) { lSeen.add(k); uLinks.push(l); }
  }
  return { nodes: uNodes, links: uLinks };
}

export { addSanctionsToGraph, dedup };

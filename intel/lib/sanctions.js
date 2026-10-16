// OpenSanctions OFAC SDN, held in memory and refreshed by the server.

import { SDN_CSV_URL } from './config.js';

let sanctionsIndex = {
  entries: [],
  byNorm: new Map(),   // normalised name/alias → [entry]
  fetchedAt: 0,
};

function getSanctionsIndex() {
  return sanctionsIndex;
}

function normName(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function parseCsv(text) {
  const rows = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function loadSanctions() {
  console.log('[INTEL] Loading OpenSanctions OFAC SDN...');
  try {
    const res = await fetch(SDN_CSV_URL, {
      signal: AbortSignal.timeout(30000),
      headers: { Accept: 'text/csv' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('CSV empty');

    const headers = rows[0];
    const idx = (col) => headers.indexOf(col);
    const i = {
      id: idx('id'), schema: idx('schema'), name: idx('name'),
      aliases: idx('aliases'), countries: idx('countries'),
      programs: idx('program_ids'), sanctions: idx('sanctions'),
      first_seen: idx('first_seen'), last_seen: idx('last_seen'),
    };

    const entries = [];
    const byNorm = new Map();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row[i.name]) continue;
      const entry = {
        id: row[i.id] || '',
        schema: row[i.schema] || 'LegalEntity',
        name: row[i.name],
        aliases: (row[i.aliases] || '').split(';').map(s => s.trim()).filter(Boolean),
        countries: (row[i.countries] || '').split(';').map(s => s.trim()).filter(Boolean),
        programs: (row[i.programs] || '').split(';').map(s => s.trim()).filter(Boolean),
        sanctions: row[i.sanctions] || '',
        first_seen: i.first_seen >= 0 ? row[i.first_seen] : undefined,
      };
      entries.push(entry);

      const keys = new Set([entry.name, ...entry.aliases].map(normName));
      for (const key of keys) {
        if (!key) continue;
        if (!byNorm.has(key)) byNorm.set(key, []);
        byNorm.get(key).push(entry);
      }
    }

    sanctionsIndex = { entries, byNorm, fetchedAt: Date.now() };
    console.log(`[INTEL] Sanctions index loaded: ${entries.length} entities, ${byNorm.size} name keys`);
  } catch (e) {
    console.error('[INTEL] Sanctions load failed:', e.message);
    if (sanctionsIndex.entries.length > 0) {
      console.log('[INTEL] Keeping stale index');
    }
  }
}

function sanctionsSearch(query, limit = 5) {
  if (!query || query.length < 3) return [];
  const q = normName(query);
  const exact = sanctionsIndex.byNorm.get(q) || [];
  if (exact.length > 0) return exact.slice(0, limit);

  const results = [];
  const seen = new Set();
  for (const entry of sanctionsIndex.entries) {
    if (results.length >= limit) break;
    if (seen.has(entry.id)) continue;
    const n = normName(entry.name);
    if (n.includes(q) || entry.aliases.some(a => normName(a).includes(q))) {
      seen.add(entry.id);
      results.push(entry);
    }
  }
  return results;
}

export { getSanctionsIndex, loadSanctions, sanctionsSearch };

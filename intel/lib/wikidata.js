import { WIKIDATA_ENDPOINT, WIKIDATA_UA, WIKIDATA_CACHE_TTL, WIKIDATA_CACHE_MAX, ALLOWED_DOMAINS } from './config.js';

// LRU of resolved graphs for every resolver, not only the Wikidata ones.
const wdCache = new Map(); // key → { data, ts }

function wdCacheGet(key) {
  const entry = wdCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > WIKIDATA_CACHE_TTL) { wdCache.delete(key); return null; }
  // Move to end (LRU)
  wdCache.delete(key);
  wdCache.set(key, entry);
  return entry.data;
}

function wdCacheSet(key, data) {
  if (wdCache.size >= WIKIDATA_CACHE_MAX) {
    const oldest = wdCache.keys().next().value;
    wdCache.delete(oldest);
  }
  wdCache.set(key, { data, ts: Date.now() });
}

// Ids are interpolated into SPARQL strings, so this is the injection guard.
function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9 \-._]/g, '').trim();
}

async function sparql(query) {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const parsed = new URL(url);
  if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
    throw new Error(`Blocked domain: ${parsed.hostname}`);
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKIDATA_UA, Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.results?.bindings || [];
}

// Search Wikidata for an entity by name, returns QID or null
async function wdSearch(query, type = 'item') {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=1&format=json`;
  const parsed = new URL(url);
  if (!ALLOWED_DOMAINS.has(parsed.hostname)) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKIDATA_UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.search?.[0]?.id || null;
  } catch { return null; }
}

export { wdCache, wdCacheGet, wdCacheSet, sanitizeId, sparql, wdSearch };

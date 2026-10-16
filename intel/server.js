/**
 * TAKIP Intelligence Layer — takip-intel
 *
 * Centralized ontology engine that ingests, indexes, and correlates entities
 * across open-source intelligence feeds. All other services query this one
 * brain via GET /resolve.
 *
 * Data sources:
 *   - OpenSanctions (OFAC SDN) — bulk CSV, refreshed every 24h
 *   - Wikidata SPARQL — on-demand with aggressive LRU cache
 *
 * Security:
 *   - Outbound requests only to allowlisted domains
 *   - SPARQL inputs sanitized against injection
 *   - Rate-limited per client IP
 */

import express from 'express';
import { SDN_REFRESH_MS } from './lib/config.js';
import { getSanctionsIndex, loadSanctions } from './lib/sanctions.js';
import { wdCache, sanitizeId } from './lib/wikidata.js';
import { resolveAircraft } from './resolvers/aircraft.js';
import { resolveVessel } from './resolvers/vessel.js';
import { resolveCompany } from './resolvers/company.js';
import { resolvePerson } from './resolvers/person.js';
import { resolveIP } from './resolvers/ip.js';
import { resolveCountry } from './resolvers/country.js';

const app = express();
const PORT = process.env.INTEL_PORT || 4000;

const RESOLVERS = { aircraft: resolveAircraft, vessel: resolveVessel, company: resolveCompany, person: resolvePerson, ip: resolveIP, country: resolveCountry };
const ALLOWED_TYPES = new Set(Object.keys(RESOLVERS));

const rateMap = new Map();

function isRateLimited(ip, limit = 30, windowMs = 60000) {
  const now = Date.now();
  for (const [k, v] of rateMap) { if (now > v.resetAt) rateMap.delete(k); }
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + windowMs }); return false; }
  entry.count++;
  return entry.count > limit;
}

app.get('/health', (_req, res) => {
  const sanctionsIndex = getSanctionsIndex();
  res.json({
    status: 'ok',
    sanctions_entries: sanctionsIndex.entries.length,
    sanctions_loaded_at: sanctionsIndex.fetchedAt ? new Date(sanctionsIndex.fetchedAt).toISOString() : null,
    wikidata_cache_size: wdCache.size,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.get('/resolve', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const type = (req.query.type || '').toLowerCase().trim();
  const rawId = (req.query.id || '').trim();

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: `Invalid type. Allowed: ${[...ALLOWED_TYPES].join(', ')}` });
  }
  if (!rawId || rawId.length < 2 || rawId.length > 200) {
    return res.status(400).json({ error: 'Invalid id (2-200 chars)' });
  }

  const id = sanitizeId(rawId);
  if (id.length < 2) return res.status(400).json({ error: 'ID contains too many invalid characters' });

  try {
    const resolver = RESOLVERS[type];
    // Pass extra properties for aircraft resolution (registration, model, etc.)
    const props = {};
    if (req.query.registration) props.registration = sanitizeId(req.query.registration);
    if (req.query.model) props.model = sanitizeId(req.query.model);
    if (req.query.icao24) props.icao24 = sanitizeId(req.query.icao24);
    const result = await resolver(id, props);
    res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.json({
      nodes: result.nodes,
      links: result.links,
      entity: { type, id },
      source: 'TAKIP Intelligence Layer',
      sanctions_index_size: getSanctionsIndex().entries.length,
      wikidata_cache_hits: wdCache.size,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[INTEL] Resolve error:', e);
    res.status(500).json({ error: 'Resolution failed', nodes: [], links: [] });
  }
});

async function boot() {
  console.log('[INTEL] TAKIP Intelligence Layer starting...');
  await loadSanctions();
  // Refresh sanctions every 24h
  setInterval(() => loadSanctions(), SDN_REFRESH_MS);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INTEL] Intelligence Layer ready on port ${PORT}`);
    console.log(`[INTEL] Sanctions: ${getSanctionsIndex().entries.length} entities indexed`);
    console.log(`[INTEL] Resolve endpoint: GET /resolve?type=<type>&id=<id>`);
  });
}

boot().catch(e => { console.error('[INTEL] Fatal:', e); process.exit(1); });

const SDN_CSV_URL = 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.simple.csv';
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_UA = 'TAKIP-Intel/0.1 (https://github.com/batuhantoker/takip; ontology engine)';
const SDN_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h
const WIKIDATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const WIKIDATA_CACHE_MAX = 10_000;

const ALLOWED_DOMAINS = new Set(['query.wikidata.org', 'data.opensanctions.org', 'www.wikidata.org', 'ip-api.com', 'stat.ripe.net']);

export {
  SDN_CSV_URL, WIKIDATA_ENDPOINT, WIKIDATA_UA, SDN_REFRESH_MS,
  WIKIDATA_CACHE_TTL, WIKIDATA_CACHE_MAX, ALLOWED_DOMAINS,
};

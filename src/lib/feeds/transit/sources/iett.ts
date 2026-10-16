import type { RtVehicle } from '../gtfs/realtime';

/**
 * Istanbul's buses from İETT's fleet service (İBB open data): every bus with a fix, ~1 MB a call,
 * refreshed about once a minute. No key; terms are İBB's open-data licence, not checked yet.
 * No route either — that is a separate call per line.
 */
export const IETT_URL = 'https://api.ibb.gov.tr/iett/FiloDurum/SeferGerceklesme.asmx';
export const IETT_SOAP_ACTION = '"http://tempuri.org/GetFiloAracKonum_json"';
export const IETT_BODY = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetFiloAracKonum_json xmlns="http://tempuri.org/" /></soap:Body></soap:Envelope>';

interface IettRow {
  Operator?: string | null;
  KapiNo?: string | null;
  Saat?: string | null;
  Boylam?: string | null;
  Enlem?: string | null;
  Hiz?: string | null;
  Plaka?: string | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m);

// Turkey has kept UTC+3 all year since 2016.
const ISTANBUL_OFFSET_S = 3 * 3600;
const DAY_S = 86_400;

/** `Saat` is Istanbul wall-clock time with no date: the latest such moment not after `now`, allowing for skew. */
export function iettTime(saat: string, nowS: number): number | undefined {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(saat.trim());
  if (!m) return undefined;
  const local = nowS + ISTANBUL_OFFSET_S;
  const midnight = local - (((local % DAY_S) + DAY_S) % DAY_S);
  let t = midnight + Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) - ISTANBUL_OFFSET_S;
  // A few buses report minutes ahead of us; more than that is yesterday evening seen after midnight.
  if (t > nowS + 600) t -= DAY_S;
  return Math.min(t, nowS);
}

export function parseIett(xml: string, nowS = Date.now() / 1000): RtVehicle[] {
  const m = /<GetFiloAracKonum_jsonResult>([\s\S]*?)<\/GetFiloAracKonum_jsonResult>/.exec(xml);
  if (!m) throw new Error('İETT: no result in the SOAP reply');
  const rows = JSON.parse(unescapeXml(m[1])) as IettRow[];
  if (!Array.isArray(rows)) throw new Error('İETT: result is not a list');
  const out: RtVehicle[] = [];
  for (const r of rows) {
    const lat = Number(r.Enlem), lng = Number(r.Boylam);
    const id = r.KapiNo?.trim() || r.Plaka?.trim();
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    const kmh = Number(r.Hiz);
    out.push({
      id,
      lat,
      lng,
      label: r.KapiNo?.trim() || undefined,
      plate: r.Plaka?.trim() || undefined,
      operator: r.Operator?.trim() || undefined,
      speed: Number.isFinite(kmh) ? kmh / 3.6 : undefined,
      t: r.Saat ? iettTime(r.Saat, nowS) : undefined,
    });
  }
  return out;
}

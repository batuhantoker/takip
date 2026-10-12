import type { RawEnvelope } from '@takip/archive/envelope';
import type { Connector, TleObservation } from '../observation';

// Alpha-5 catalogue numbers above 99999: a leading letter (I and O skipped) stands for 10–33.
const ALPHA5 = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function noradId(line1: string): number | undefined {
  const field = line1.substring(2, 7).trim();
  if (/^\d+$/.test(field)) return Number(field);
  const lead = ALPHA5.indexOf(field[0]);
  return lead >= 0 && /^\d{4}$/.test(field.slice(1)) ? (lead + 10) * 10_000 + Number(field.slice(1)) : undefined;
}

/** Element set epoch from line 1 columns 19–32: two-digit year (57–99 → 19xx) and fractional day of year. */
export function tleEpoch(line1: string): number | undefined {
  const yy = Number(line1.substring(18, 20));
  const day = Number(line1.substring(20, 32));
  if (!Number.isFinite(yy) || !Number.isFinite(day) || day < 1) return undefined;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return Math.round(Date.UTC(year, 0, 1) + (day - 1) * 86_400_000);
}

/** Two- or three-line element sets, as CelesTrak's FORMAT=tle serves them. */
export function* parseTleText(text: string): Generator<TleObservation> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const named = !lines[i].startsWith('1 ') && lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ');
    const bare = lines[i].startsWith('1 ') && lines[i + 1]?.startsWith('2 ');
    if (!named && !bare) continue;
    const name = named ? lines[i].replace(/^0\s+/, '').trim() : null;
    const line1 = named ? lines[i + 1] : lines[i];
    const line2 = named ? lines[i + 2] : lines[i + 1];
    i += named ? 2 : 1;
    const norad = noradId(line1);
    const epoch = tleEpoch(line1);
    if (norad !== undefined && epoch !== undefined) yield { shape: 'tle', norad, epoch, line1, line2, name };
  }
}

export const celestrak: Connector = {
  source: 'celestrak',
  *map(env: RawEnvelope) {
    if (typeof env.body === 'string' && (env.status ?? 200) < 300) yield* parseTleText(env.body);
  },
};

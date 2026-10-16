/**
 * NOAA space weather scales (noaa-scales.json): R radio blackouts, S solar radiation storms,
 * G geomagnetic storms, each 0–5. Key "0" is the latest observation, "1".."3" today's and the
 * next two days' forecast (G as a scale, R and S as probabilities). US public domain.
 */

export const SCALES_URL = 'https://services.swpc.noaa.gov/products/noaa-scales.json';

type Raw = Record<string, {
  DateStamp?: string;
  TimeStamp?: string;
  R?: { Scale?: string | null; MinorProb?: string | null; MajorProb?: string | null };
  S?: { Scale?: string | null; Prob?: string | null };
  G?: { Scale?: string | null };
}>;

export interface ScaleForecast {
  date: string;
  G: number | null;
  /** Probability (%) of an R1–R2 and an R3+ radio blackout. */
  radioMinorPct: number | null;
  radioMajorPct: number | null;
  /** Probability (%) of an S1+ radiation storm. */
  radiationPct: number | null;
}

export interface NoaaScales {
  observedAt: string | null;
  current: { R: number | null; S: number | null; G: number | null };
  forecast: ScaleForecast[];
}

const level = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null;
};

const pct = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function parseNoaaScales(json: unknown): NoaaScales {
  const raw = json as Raw | null;
  const now = raw?.['0'];
  if (!now || typeof now !== 'object') throw new Error('NOAA scales: no current entry');
  const observedAt = now.DateStamp && now.TimeStamp ? `${now.DateStamp}T${now.TimeStamp}Z` : null;
  return {
    observedAt,
    current: { R: level(now.R?.Scale), S: level(now.S?.Scale), G: level(now.G?.Scale) },
    forecast: ['1', '2', '3'].flatMap(key => {
      const day = raw?.[key];
      if (!day?.DateStamp) return [];
      return [{
        date: day.DateStamp,
        G: level(day.G?.Scale),
        radioMinorPct: pct(day.R?.MinorProb),
        radioMajorPct: pct(day.R?.MajorProb),
        radiationPct: pct(day.S?.Prob),
      }];
    }),
  };
}

/** One place's row in data/site/topics/iss.json (tools/site/topics/sky.ts): every city has one. */
export interface IssRow {
  /** IANA time zone, from GeoNames. */
  tz: string;
  /** Passes sky-rules.ts's bar for search. */
  index?: true;
}

/** One place's row in data/site/topics/aurora.json: only where the aurora shows in strong storms or more often. */
export interface AuroraRow {
  tz: string;
  /** Corrected geomagnetic latitude, to 0.1°, negative in the south. */
  mlat: number;
  index?: true;
}

/** The field model the magnetic latitudes came from, such as "IGRF-14 at 2026.8". */
export interface AuroraMeta { field: string }

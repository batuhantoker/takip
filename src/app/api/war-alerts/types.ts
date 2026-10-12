export type WarThreat =
  | 'rockets'
  | 'uav'
  | 'infiltration'
  | 'hazmat'
  | 'earthquake'
  | 'tsunami'
  | 'nonconventional'
  | 'radiological'
  | 'general'
  | 'air-raid';

export interface WarAlert {
  id: string;
  country: 'IL' | 'UA';
  place: string;
  lat: number;
  lng: number;
  /** An oblast alert is anchored at its administrative centre, up to a few hundred km from the threat. */
  precision: 'locality' | 'oblast';
  threat: WarThreat;
  label: string;
  /** A siren in the last 10 minutes, or an oblast alert still standing. */
  active: boolean;
  since?: string;
  /** Sirens at this place for this threat inside the window. */
  count?: number;
  provider: 'Tzeva Adom' | 'ubilling.net.ua';
  source: string;
}

export interface WarAlertSource {
  name: WarAlert['provider'];
  ok: boolean;
  /** When the upstream says its data is from, where it says. */
  at?: string;
  error?: string;
}

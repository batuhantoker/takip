/** UNRATED: no baseline to judge the reading against, which is not the same as NORMAL. */
export type RadiationStatus = 'NORMAL' | 'ELEVATED' | 'SPIKE' | 'OFFLINE' | 'UNRATED';

export interface RadiationStation {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  /** Dose-equivalent rate, nSv/h. */
  reading: number;
  /** When the reading was taken (ISO), not when we fetched it. */
  time: string;
  status: RadiationStatus;
  baseline?: number;
  delta?: number;
  z?: number;
  network: 'EPA RadNet' | 'Safecast';
  source: string;
}

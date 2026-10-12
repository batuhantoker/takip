/**
 * TAKIP — the Sun as NASA's Solar Dynamics Observatory and ESA/NASA's SOHO see
 * it, through Helioviewer (NASA GSFC / ESA). A solar disc is a photograph, not
 * a map, so the Sun is shown as the latest frame per channel, with its time.
 */

export type SunChannelKey = 'aia171' | 'aia193' | 'aia304' | 'aia131' | 'hmi-int' | 'hmi-mag' | 'lasco-c3';

export interface SunChannel {
  key: SunChannelKey;
  /** Helioviewer source ID. */
  sourceId: number;
  label: string;
  detail: string;
  instrument: string;
  /** Arcseconds per pixel for a 1024 px frame. */
  imageScale: number;
}

// AIA and HMI at 2.4"/px put the 1,920" disc in a 1024 px frame with a margin.
export const SUN_CHANNELS: SunChannel[] = [
  { key: 'aia171', sourceId: 10, label: '171 Å', detail: 'Quiet corona and coronal loops, about 600,000 °C', instrument: 'SDO/AIA', imageScale: 2.4 },
  { key: 'aia193', sourceId: 11, label: '193 Å', detail: 'Hotter corona; coronal holes show dark', instrument: 'SDO/AIA', imageScale: 2.4 },
  { key: 'aia304', sourceId: 13, label: '304 Å', detail: 'Chromosphere and prominences, about 50,000 °C', instrument: 'SDO/AIA', imageScale: 2.4 },
  { key: 'aia131', sourceId: 9, label: '131 Å', detail: 'Flaring regions, up to 10 million °C', instrument: 'SDO/AIA', imageScale: 2.4 },
  { key: 'hmi-int', sourceId: 18, label: 'Visible', detail: 'The photosphere in visible light: sunspots', instrument: 'SDO/HMI', imageScale: 2.4 },
  { key: 'hmi-mag', sourceId: 19, label: 'Magnetic', detail: 'Line-of-sight magnetic field; white north, black south', instrument: 'SDO/HMI', imageScale: 2.4 },
  { key: 'lasco-c3', sourceId: 5, label: 'Corona', detail: 'Coronagraph out to 30 solar radii: coronal mass ejections', instrument: 'SOHO/LASCO C3', imageScale: 56 },
];

export function sunChannel(key: string): SunChannel | undefined {
  return SUN_CHANNELS.find(c => c.key === key);
}

export interface SunFrame {
  key: SunChannelKey;
  /** ISO time of the frame Helioviewer has closest to now. */
  frameTime: string | null;
}

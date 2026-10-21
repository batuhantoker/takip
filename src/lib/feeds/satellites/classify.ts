/**
 * What a satellite is for, from its name alone: the server's JSON and the browser's decoded element sets
 * (elements.ts) both label it this way, so neither has to send it.
 */

export type SatCategory = 'comms' | 'navigation' | 'earth_obs' | 'military' | 'science' | 'other';

// Mission classification by NORAD name keywords
const MISSION_CLASSIFY: Record<string, { mission: string; color: string }> = {
  'USA': { mission: 'Military Recon', color: '#FF3D3D' },
  'NROL': { mission: 'NRO Classified', color: '#FF3D3D' },
  'LACROSSE': { mission: 'SAR Imaging', color: '#00E5FF' },
  'MENTOR': { mission: 'SIGINT', color: '#FFFFFF' },
  'ORION': { mission: 'SIGINT', color: '#FFFFFF' },
  'TRUMPET': { mission: 'SIGINT', color: '#FFFFFF' },
  'GPS': { mission: 'Navigation', color: '#448AFF' },
  'NAVSTAR': { mission: 'Navigation', color: '#448AFF' },
  'GLONASS': { mission: 'Navigation', color: '#448AFF' },
  'GALILEO': { mission: 'Navigation', color: '#448AFF' },
  'BEIDOU': { mission: 'Navigation', color: '#448AFF' },
  'SBIRS': { mission: 'Early Warning', color: '#FF00FF' },
  'DSP': { mission: 'Early Warning', color: '#FF00FF' },
  'STARLINK': { mission: 'Commercial Comms', color: '#00E676' },
  'ONEWEB': { mission: 'Commercial Comms', color: '#00E676' },
  'PLANET': { mission: 'Earth Imaging', color: '#00E676' },
  'WORLDVIEW': { mission: 'Commercial Imaging', color: '#00E676' },
  'ISS': { mission: 'Space Station', color: '#FFD700' },
  'TIANGONG': { mission: 'Space Station', color: '#FFD700' },
  'COSMOS': { mission: 'Russian Military', color: '#FF6B6B' },
  'YAOGAN': { mission: 'Chinese Recon', color: '#FF6B6B' },
  'FENGYUN': { mission: 'Weather', color: '#87CEEB' },
  'GOES': { mission: 'Weather', color: '#87CEEB' },
  'NOAA': { mission: 'Weather', color: '#87CEEB' },
  'METEOSAT': { mission: 'Weather', color: '#87CEEB' },
  'LANDSAT': { mission: 'Earth Observation', color: '#90EE90' },
  'SENTINEL': { mission: 'Earth Observation', color: '#90EE90' },
  'TERRA': { mission: 'Earth Science', color: '#90EE90' },
  'AQUA': { mission: 'Earth Science', color: '#90EE90' },
  'HUBBLE': { mission: 'Space Telescope', color: '#FFD700' },
  'JAMES WEBB': { mission: 'Space Telescope', color: '#FFD700' },
};

const MILITARY = new Set(['Military Recon', 'NRO Classified', 'SIGINT', 'Early Warning', 'Russian Military', 'Chinese Recon', 'SAR Imaging']);

export function classifySatellite(name: string): { mission: string; color: string; category: SatCategory } {
  const upper = name.toUpperCase();
  let info = { mission: 'Unknown', color: '#00E5FF' };
  for (const [keyword, match] of Object.entries(MISSION_CLASSIFY)) {
    if (upper.includes(keyword)) { info = match; break; }
  }
  const m = info.mission;
  // High-level category for sub-layer filtering; debris and rocket bodies are "other".
  const category: SatCategory = upper.includes(' DEB') || upper.includes('DEBRIS') || upper.includes(' R/B') ? 'other'
    : m === 'Commercial Comms' || m === 'Commercial Imaging' ? 'comms'
    : m === 'Navigation' ? 'navigation'
    : m === 'Weather' || m === 'Earth Observation' || m === 'Earth Science' ? 'earth_obs'
    : MILITARY.has(m) ? 'military'
    : m === 'Space Station' || m === 'Space Telescope' ? 'science'
    : 'other';
  return { ...info, category };
}

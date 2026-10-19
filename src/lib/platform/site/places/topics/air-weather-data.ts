/** One place's row in data/site/topics/flights.json (tools/site/topics/air-weather.ts): airports with scheduled flights within 50 km. */
export interface FlightsRow { airports: { iata: string; icao: string; km: number }[] }

/** One place's row in data/site/topics/weather.json: METAR stations within 30 km as [ICAO, km], and radar coverage. */
export interface WeatherRow {
  metar: [string, number][];
  /** Inside RainViewer's radar coverage; null when its coverage tile couldn't be read. */
  radar: boolean | null;
}

/** Station names by ICAO code, shared by both tables. */
export interface WeatherMeta { stations: Record<string, string> }

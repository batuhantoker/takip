/** One place's row in data/site/topics/flights.json (tools/site/topics/air-weather.ts): airports with scheduled flights within 50 km. */
/** `large`: one of OurAirports' large airports, the hubs; the rest are its medium ones with scheduled flights. */
export interface FlightsRow { airports: { iata: string; icao: string; km: number; large: boolean }[] }

/** One place's row in data/site/topics/weather.json: METAR stations within 30 km as [ICAO, km], and radar coverage. */
export interface WeatherRow {
  metar: [string, number][];
  /** Inside RainViewer's radar coverage; null when its coverage tile couldn't be read. */
  radar: boolean | null;
}

/** Station names by ICAO code, shared by both tables. */
export interface WeatherMeta { stations: Record<string, string> }

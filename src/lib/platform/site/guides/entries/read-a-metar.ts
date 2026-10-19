import type { Guide } from '../types';

export const READ_A_METAR: Guide = {
  slug: 'how-to-read-airport-weather-metar',
  section: 'air',
  title: 'How to read a METAR, the airport weather report',
  description: 'A METAR decoded field by field with a worked example, the VFR, MVFR, IFR and LIFR flight categories and their limits, and how the live map colours each airport.',
  heading: 'How to read a METAR',
  lede: 'A METAR is the weather report an airport issues, usually every hour or half hour, in a compact code pilots learn to read at a glance. Once you know the order of its fields, you can read it too.',
  layers: ['airport-weather', 'turbulence-sigmets'],
  open: { layers: ['airport_weather', 'sigmets'], view: { lat: 50, lon: 10, zoom: 4 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'An example, field by field',
      paragraphs: [
        'A made-up but typical report from New York’s JFK on a wet day:',
        'METAR KJFK 191251Z 04012G22KT 3SM -RA BR OVC008 14/13 A2990 RMK AO2',
        'METAR says it is a routine report; SPECI marks a special one, issued when the weather changes sharply. KJFK is the station’s four-letter ICAO code. 191251Z is the 19th of the month at 12:51 UTC; the Z stands for UTC.',
        '04012G22KT is the wind: from 040°, the north-east, at 12 knots, gusting 22. The direction is where the wind blows from. VRB means variable, and 00000KT means calm.',
        '3SM is the visibility, 3 statute miles. -RA BR is the weather: light rain and mist. A minus means light, a plus heavy, and no sign moderate. Other common codes are SN snow, DZ drizzle, FG fog, HZ haze, SH showers and TS thunderstorm.',
        'OVC008 is the cloud: overcast at 800 feet above the airport. Cover is counted in eighths of the sky: FEW is one or two, SCT three or four, BKN five to seven and OVC all eight, with heights in hundreds of feet. CB after a layer means cumulonimbus, the thunderstorm cloud. VV means the sky is hidden, by fog for instance, and gives how far up the observer can see.',
        '14/13 is the temperature and dew point in °C, with M for minus. When the two are this close, the air is nearly saturated, and fog and low cloud are likely. A2990 is the altimeter setting, 29.90 inches of mercury. Everything after RMK is remarks; AO2 says the station is automated.',
      ],
    },
    {
      heading: 'Outside North America',
      paragraphs: [
        'Most of the world writes a few fields differently. Visibility is in metres, and 9999 means 10 km or more. Pressure is in hectopascals after a Q, as in Q1013. CAVOK, ceiling and visibility OK, replaces visibility, weather and cloud when visibility is 10 km or more, with no cloud below 5,000 feet (or the minimum sector altitude, if higher), no cumulonimbus or towering cumulus, and no significant weather.',
        'TAKIP’s station card gives every visibility in statute miles, as the Aviation Weather Center supplies it, so a report in metres appears converted.',
      ],
    },
    {
      heading: 'Flight categories',
      paragraphs: [
        'Pilots sort conditions into four categories by the ceiling and the visibility, and whichever is worse decides. The ceiling is the lowest broken or overcast layer, or the vertical visibility when the sky is hidden; few and scattered cloud don’t count.',
        'VFR, visual flight rules: ceiling above 3,000 feet and visibility over 5 miles. MVFR, marginal VFR: ceiling 1,000 to 3,000 feet, or visibility 3 to 5 miles. IFR, instrument flight rules: ceiling 500 to below 1,000 feet, or visibility 1 to below 3 miles. LIFR, low IFR: ceiling below 500 feet, or visibility under 1 mile.',
        'In the example, 3 miles of visibility alone would be MVFR, but the 800-foot overcast is a ceiling below 1,000 feet, so the report is IFR.',
      ],
    },
    {
      heading: 'On the map',
      paragraphs: [
        'The category on the map is the one the Aviation Weather Center gives each report; TAKIP doesn’t work it out itself. VFR is green, MVFR blue, IFR red and LIFR violet. VFR dots are drawn fainter and worse weather on top, so the bad weather stands out. A station that sends no category is grey.',
        'Reports are read every 5 minutes. Small airfields without a weather station don’t appear.',
        'A METAR describes one airport at one moment. For weather along the way there are SIGMETs, warnings of severe turbulence, icing, thunderstorms and volcanic ash over an area; the Hazard Airspace layer draws the international ones. Neither layer is for planning a real flight.',
      ],
      steps: [
        'Switch on Airport Weather in the Layers panel. Station codes appear from zoom 7.',
        'Click a station for wind, visibility, ceiling, weather, temperature and dew point, the time it was observed and how many minutes ago that was.',
        'Below them is the raw report, to read with this guide, and a link to the last six hours decoded on aviationweather.gov.',
      ],
    },
  ],
};

import type { Guide } from '../types';

export const RADAR_OR_MODEL: Guide = {
  slug: 'weather-radar-vs-forecast-model',
  section: 'weather',
  title: 'Weather radar vs forecast model: what a map shows',
  description: 'Which weather layers on a live map were measured, by radar, lightning sensors, airports and satellites, and which are model values, and why that matters.',
  heading: 'Weather radar or forecast model?',
  lede: 'Some of the weather on the map was measured minutes ago by a radar, a satellite or an airport. Some of it is a computer model’s best estimate of the atmosphere. They look alike on screen, and they answer different questions.',
  layers: ['rain-radar', 'lightning-map', 'temperature-map', 'wind-map', 'live-satellite-earth', 'cloud-map', 'airport-weather'],
  open: { layers: ['wx_radar', 'wx_wind'], view: { lat: 40, lon: -92, zoom: 4 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'Measured: what instruments saw',
      paragraphs: [
        'Rain Radar is what ground weather radars detected. A radar sends out pulses and times the echoes that come back from raindrops, snowflakes and hail; the strength of the echo stands for how heavy the precipitation is. RainViewer stitches national radar networks into one map, a frame every 10 minutes for the last two hours, played as a loop.',
        'Lightning is strikes detected by the NLDN and GLD360 sensor networks, counted per 15 minutes in 8 km squares, from NOAA nowCOAST. It covers the Americas and the Pacific only.',
        'Airport Weather is METARs: the weather observed at each airport, usually within the last hour.',
        'Satellite Live and Live Clouds are pictures. GOES, Meteosat and Himawari photograph the Earth every 10 minutes, and NOAA’s hourly mosaic of every geostationary weather satellite shows cloud worldwide. The 3D look of Live Clouds is a rendering: the heights are estimated from how cold the cloud tops are.',
      ],
    },
    {
      heading: 'Modelled: what a forecast says now',
      paragraphs: [
        'Temperature and Wind come from NOAA’s Global Forecast System, a computer model of the whole atmosphere on a grid every quarter of a degree, about 28 km apart at the equator. GFS starts each run from observations and steps forward in time. It runs every 6 hours with a step every 3, and the map shows the step nearest to now: a forecast for within about an hour and a half of the present, made some hours before.',
        'Until the GFS field loads, a coarse Open-Meteo grid fills in. Click a temperature reading and it says which of the two it came from. A click on the Wind layer shows Open-Meteo’s forecast at a sample point on a 10° grid: temperature, wind, gusts, rain in the last hour and cloud. Even that rain figure is a model value, not a rain gauge.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'A measurement shows what was there, but only where there was an instrument. There is radar only where there are ground radars, which leaves out the open ocean and much of Africa, central Asia and South America. Lightning stops at the edge of the area NOAA publishes, and METARs come only from airports. A blank radar can mean no radar, not no rain.',
        'Measurements have their own errors. Hills block a radar’s beam, and it can pick up echoes from the ground, birds or insects. Over a few frames real rain moves; echoes from the ground stay put.',
        'A model has no gaps: it gives a value for every point on Earth, over oceans and deserts alike. But each value is an estimate, smoothed over its grid square. Valleys, coasts, cities and single thunderstorms are smaller than that, so the temperature where you stand can differ from the model by several degrees, and a storm can be in the wrong place or missing altogether.',
        'So when the two disagree about the present, trust a measurement for where it was taken, and use the model for the places nothing measures.',
      ],
      spots: [
        { label: 'The US Midwest', view: { lat: 40, lon: -92, zoom: 5 }, note: 'Radar and lightning both cover it, to set against the wind.' },
        { label: 'Western Europe', view: { lat: 49, lon: 5, zoom: 4.5 }, note: 'Dense ground radar, to set against the model’s wind.' },
        { label: 'West Africa', view: { lat: 10, lon: 0, zoom: 4 }, note: 'Little ground radar: satellites and the model carry most of it.' },
        { label: 'The North Atlantic', view: { lat: 45, lon: -35, zoom: 3.5 }, note: 'No radar over open ocean; storms show in satellite images and the model.' },
      ],
    },
    {
      heading: 'How fresh each one is',
      paragraphs: [
        'Go back with Replay and Rain Radar and Lightning follow the time you are watching: the radar over its last two hours, lightning over about six.',
        'Satellite Live frames arrive 30 to 40 minutes after they are taken. Live Clouds is a new mosaic every hour. Airport reports are read every 5 minutes, though most airports issue one only every hour or half hour.',
        'The model layers change in steps: a new 3-hour step or a new run, checked every 15 minutes. Between them, the temperature and wind on the map stay the same while the real weather moves on.',
      ],
    },
  ],
};

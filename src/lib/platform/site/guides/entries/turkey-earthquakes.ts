import type { Guide } from '../types';

export const TURKEY_EARTHQUAKES: Guide = {
  slug: 'turkey-earthquake-history-on-a-map',
  section: 'hazards',
  title: 'Turkey earthquake history: a century of quakes on a map',
  description: 'Türkiye’s earthquake record on a map: the faults behind it, the strongest and deadliest quakes of the last century, and where to watch today’s quakes live.',
  heading: 'Türkiye’s earthquake history on a map',
  lede: 'Türkiye is one of the most earthquake-prone countries in the world. Here is what a century of its significant quakes looks like in NOAA’s record, which were the worst, and how to see them, and today’s quakes, on the map.',
  layers: ['earthquakes', 'history-map'],
  open: { layers: ['earthquakes'], view: { lat: 39, lon: 35, zoom: 5.5 } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'Why Türkiye shakes',
      paragraphs: [
        'Most of Türkiye sits on the Anatolian plate, a block squeezed between the Arabian plate pushing north and the Eurasian plate, and forced out to the west. Two great faults take most of that movement: the North Anatolian Fault, running more than 1,000 km across the north to the Sea of Marmara, and the East Anatolian Fault in the south-east. The Aegean west, around İzmir, is slowly being pulled apart, and shakes too.',
        'From 1939 a run of large quakes broke the North Anatolian Fault section by section, moving broadly west: Erzincan in 1939, Niksar–Erbaa in 1942, Tosya–Ladik in 1943 and Bolu–Gerede in 1944, then, much later, İzmit and Düzce in 1999. The next section west lies under the Sea of Marmara, close to Istanbul.',
      ],
    },
    {
      heading: 'A century in NOAA’s record',
      paragraphs: [
        'TAKIP’s History view draws NOAA’s list of significant earthquakes, kept by its National Centers for Environmental Information. A quake makes the list if it killed people, did moderate damage (about $1 million or more), reached magnitude 7.5, shook at intensity X or more, or caused a tsunami. It is a list of the quakes that mattered, not of every quake.',
        'In the copy TAKIP holds, NOAA files 162 quakes under Turkey in the 100 years to October 2026, 16 of them of magnitude 7 or more, and 22 in the last ten years. The country’s list runs back more than 2,000 years, with 359 entries in all, though places and sizes before about 1900 are estimates worked out from the damage.',
      ],
    },
    {
      heading: 'The strongest and the deadliest',
      paragraphs: [
        'The strongest of the last century, at magnitude 7.8 in NOAA’s list, were Erzincan in December 1939 and the Kahramanmaraş quake of 6 February 2023. The 2023 shock was followed later the same day by a second, of magnitude 7.5, further north. NOAA’s record for the first, which lists places in both Türkiye and Syria, gives 56,697 deaths, the highest of any entry in the century.',
        'NOAA counts 32,700 deaths at Erzincan, and 17,118 at İzmit, where a magnitude 7.6 quake struck on 17 August 1999. Further back, the record holds ancient Antioch, today’s Antakya, wrecked again and again in Roman and Byzantine times; NOAA’s tolls for those run to hundreds of thousands, and are rough estimates.',
        'Each place below opens the live map there, with today’s quakes.',
      ],
      spots: [
        { label: 'Kahramanmaraş', view: { lat: 37.6, lon: 37.1, zoom: 6.5 }, note: 'The 2023 quakes, magnitudes 7.8 and 7.5, on the East Anatolian Fault.' },
        { label: 'İzmit', view: { lat: 40.76, lon: 29.97, zoom: 7 }, note: 'The 1999 quake, magnitude 7.6, at the eastern end of the Sea of Marmara.' },
        { label: 'Sea of Marmara', view: { lat: 40.8, lon: 28.4, zoom: 6.5 }, note: 'The fault south of Istanbul, where a magnitude 6.2 quake struck in April 2025.' },
        { label: 'Antakya', view: { lat: 36.2, lon: 36.16, zoom: 7 }, note: 'Ancient Antioch, struck in Roman and Byzantine times and again in 2023.' },
      ],
    },
    {
      heading: 'Seeing it on the map',
      paragraphs: [
        'The live earthquakes layer marks every quake of magnitude 2.5 or more in the last 24 hours, from USGS and from EMSC, the European-Mediterranean Seismological Centre, whose catalogue is strongest in Europe and the Mediterranean. History draws the long record, each quake appearing as the clock reaches it.',
      ],
      steps: [
        'Open the map. It shows the last day’s quakes over Türkiye; click one for its magnitude, depth and place.',
        'For the record, open the History tab and switch on “Natural hazards” under “On the map”. Switch off “Wars and battles” to see quakes alone.',
        'Use “Go to” for a date, such as 1999-08-17 or 2023-02-06, and press play. Or set the speed to “10 years / s” and play through the century.',
        'Click a quake for its magnitude, the deaths and damage NOAA records, and links to its NOAA page and its Wikipedia article where there is one.',
      ],
    },
    {
      heading: 'What it can’t tell you',
      paragraphs: [
        'NOAA’s list leaves out quakes that did little harm, so it shows where Türkiye was hurt, not how often the ground moves. The counts follow the country NOAA files each quake under, and a quake near a border can be filed under the neighbour.',
        'Magnitudes and death tolls are NOAA’s; other agencies and later studies can differ, and the older the entry, the rougher it is. On the live layer, the first magnitude is often revised within the hour. The live layers pause while History is open.',
      ],
    },
  ],
};

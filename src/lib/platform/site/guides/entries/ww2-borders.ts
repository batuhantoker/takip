import type { Guide } from '../types';

export const WW2_BORDERS: Guide = {
  slug: 'world-war-2-borders-month-by-month',
  section: 'past',
  title: 'World War II borders and occupation, month by month',
  description: 'How Europe’s borders and occupations changed from 1938 to 1945, month by month, and how to play the war through on an interactive historical map.',
  heading: 'World War II borders, month by month',
  lede: 'Between 1938 and 1945 Germany and its allies annexed, carved up and occupied much of Europe, then lost it all. TAKIP’s World War II layer redraws that map at the end of every month, so you can watch it happen.',
  layers: ['world-war-2-map', 'history-map'],
  open: { layers: [], view: { lat: 47, lon: 17, zoom: 3.05 }, mode: { view: 'history', year: 1939, layer: 'ww2-europe' } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'What the layer shows',
      paragraphs: [
        'The layer comes from the Stanford Spatial History Lab’s “European Borders, World War II”, which maps every territory in Europe at the end of each month from February 1938 to May 1945. Each month on the map shows the borders as they stood at its end.',
        'Every territory is coloured by where it stood that month: Axis and aligned, occupied by the Axis, Allies, at war but in neither bloc, neutral, or not at war. These are the source’s judgements, month by month. Click a territory for its status, the months those borders held, its head of state and, where there was one, its government in exile.',
      ],
    },
    {
      heading: 'Borders and occupation are not the same',
      paragraphs: [
        'Borders move only where land was annexed or a new state was set up: Austria joined to Germany in March 1938, or the Protectorate of Bohemia and Moravia a year later. The source records 81 such changes.',
        'Occupation is a status, not a border. An occupied country keeps its outline and is hatched over, so Denmark, the Netherlands and Belgium in 1940 are still drawn as themselves, marked as occupied. Poland in 1939 shows both at once: its west annexed into Germany, its east into the Soviet Union, and the middle left as the German-occupied General Government.',
        'Because a month shows its end-of-month borders for the whole month, a change can appear a few days before its date.',
      ],
    },
    {
      heading: 'Play the war',
      paragraphs: [
        'The History view can play the whole war in about a minute and a half, with the battles appearing where and when they were fought.',
      ],
      steps: [
        'Open the map. It lands in History in 1939, with the World War II borders on.',
        'In the History panel, under “Borders”, press “Play 1938–1945”. The camera moves to Europe, the battles come on, and the war plays at a month a second.',
        'Pause on any month and click a territory for its status and who governed it.',
        'Use “Go to” for a date, such as 1939-09-01, the day Germany invaded Poland.',
        'Switch on “Territorial claims” under “On the map” to add each annexation as a point on its date.',
      ],
    },
    {
      heading: 'Where to watch',
      paragraphs: [
        'A few places where the map changes most as the months go by.',
      ],
      spots: [
        { label: 'Poland', view: { lat: 52, lon: 20, zoom: 5 }, note: 'Divided in autumn 1939 between Germany, the Soviet Union and the General Government.' },
        { label: 'France and the Low Countries', view: { lat: 49, lon: 3.5, zoom: 4.6 }, note: 'Occupied in May and June 1940, with France split between the occupied zone and Vichy.' },
        { label: 'Yugoslavia', view: { lat: 44, lon: 19, zoom: 5.2 }, note: 'Invaded in April 1941 and broken up: Croatia, a rump Serbian state and Montenegro appear.' },
        { label: 'Italy', view: { lat: 42.5, lon: 12.5, zoom: 5 }, note: 'Changes sides in 1943, while the north becomes the Italian Social Republic.' },
      ],
    },
    {
      heading: 'What it doesn’t show',
      paragraphs: [
        'There are no front lines. The layer records who held each territory, by annexation or occupation, at the end of each month, not where the armies stood. A status covers a whole territory, so a country that was partly liberated can stay marked as occupied until the month the source changes it. The battles, from TAKIP’s event records, are the better guide to where the fighting was.',
        'It covers Europe only: the war in Asia and the Pacific has no month-by-month layer yet. One border layer shows at a time, so the world borders are off while this one is on, and the live layers pause while History is open.',
      ],
    },
  ],
};

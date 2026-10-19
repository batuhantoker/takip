import type { Guide } from '../types';

export const WORLD_1914: Guide = {
  slug: 'the-world-in-1914-explained',
  section: 'past',
  title: 'The world in 1914: empires before the First World War',
  description: 'The empires, alliances and borders of 1914, on the eve of the First World War, and how to watch the war unfold year by year on TAKIP’s historical map.',
  heading: 'The world in 1914, explained',
  lede: 'In the summer of 1914 a few European capitals ruled much of the world. Within weeks their war had spread beyond Europe, and within a few years four of their empires were gone. Here is what the map of 1914 shows, and how to explore it.',
  layers: ['world-map-1914', 'history-map'],
  open: { layers: [], view: { lat: 45, lon: 20, zoom: 2.6 }, mode: { view: 'history', year: 1914, layer: 'world-borders' } },
  checked: '2026-10-19',
  sections: [
    {
      heading: 'A world of empires',
      paragraphs: [
        'Europe’s great powers in 1914 were Britain, France, Germany, Russia, Austria-Hungary and Italy. Britain ruled the largest empire, from India to much of Africa, with self-governing dominions such as Canada and Australia. France held much of north and west Africa and Indochina, and Germany, Belgium, Portugal and Italy had African colonies of their own.',
        'Two old empires spanned Europe and Asia. Russia stretched from Poland to the Pacific. The Ottoman Empire had lost almost all its European land in the Balkan wars of 1912–13, but still ruled Anatolia and much of the Arab Middle East.',
        'The powers stood in two camps. Germany and Austria-Hungary were allies; France and Russia were allied, and Britain had settled its old quarrels with both, a grouping known as the Triple Entente. Italy, formally Germany’s ally, stayed out in 1914 and joined the other side in 1915.',
      ],
    },
    {
      heading: 'How it unravelled',
      paragraphs: [
        'On 28 June 1914 Archduke Franz Ferdinand, heir to the Austro-Hungarian throne, was shot in Sarajevo. Austria-Hungary declared war on Serbia on 28 July. Within a week Germany was at war with Russia and France and had invaded Belgium, and Britain had declared war on Germany.',
        'Japan joined the Allies in August, and the Ottoman Empire entered the war on Germany’s side that autumn.',
      ],
    },
    {
      heading: 'Seeing 1914 on the map',
      paragraphs: [
        'TAKIP’s History view draws the world’s borders year by year from Cliopatria, a dataset from the Seshat Global History Databank. Open it in 1914 and the states and empires are drawn as the data has them for that year. Where the data ties a colony to its empire, the colony takes the empire’s colour: British India and Britain’s African colonies share one colour, France’s African colonies and Indochina another.',
        'Zoomed in to 7 or closer, OpenHistoricalMap adds finer dated borders. Wars and battles are switched on from the start, and appear where and when they began.',
      ],
      steps: [
        'Open the map. It lands in History in 1914, with world borders on.',
        'Click an empire for the years its borders held and its Wikipedia article.',
        'In the History panel, under “Jump to”, pick “First World War begins” to go to 28 July 1914.',
        'Press play. At the starting speed of a month a second, the battles appear as they began.',
      ],
    },
    {
      heading: 'Play on into the war',
      paragraphs: [
        'In August 1914 the points crowd into Belgium and north-east France, and into East Prussia and Galicia in the east. Zoom in a little and each battle is named.',
        'The war left Europe within weeks, and the map shows it: fighting in Germany’s colonies of Togoland and Cameroon, the siege of the German port of Tsingtao in China, naval battles off Chile and the Falkland Islands, and the Ottoman front in the Caucasus by December.',
      ],
      spots: [
        { label: 'Sarajevo', view: { lat: 43.86, lon: 18.41, zoom: 6 }, note: 'Where the archduke was shot. Bosnia was then part of Austria-Hungary.' },
        { label: 'The Western Front', view: { lat: 50, lon: 3.4, zoom: 6 }, note: 'Belgium and northern France: Mons, the Marne and Ypres in 1914.' },
        { label: 'East Prussia', view: { lat: 53.8, lon: 20.5, zoom: 6 }, note: 'Germany’s eastern edge, where Russia attacked in August and lost at Tannenberg.' },
        { label: 'The Ottoman Empire', view: { lat: 35, lon: 38, zoom: 4.2 }, note: 'Still ruling Anatolia and much of the Arab Middle East.' },
      ],
    },
    {
      heading: 'After the war, and what the map can’t show',
      paragraphs: [
        'Go to 1920 to see the map the peace treaties drew. Austria and Hungary are separate states, Poland, Czechoslovakia and Yugoslavia have appeared, and Finland, Estonia, Latvia and Lithuania have broken away from Russia. Within a few years of the war’s end four empires were gone: the German, the Austro-Hungarian, the Russian and the Ottoman.',
        'World borders change once a year, so they don’t show the fronts or the land armies held while the war went on: the battles are the guide to where the fighting was. Borders are reconstructions, and where they were vague or disputed the map shows one reading of them. Some battles are placed only roughly, and a hollow point’s place is approximate. The live layers pause while History is open.',
      ],
    },
  ],
};

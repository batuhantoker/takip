/** History measures worth a minute: a country choropleth through the years, past today where the publisher projects. */

export interface MeasurePreset {
  kicker: string;
  /** What the video is about, for the writer. */
  topic: string;
  metric: string;
  source?: string;
  from: number;
  to: number;
  /** The projection metric (`<metric>.proj`) to join after the estimates, and what to call those years on screen. */
  projection?: { label: string };
  /** Shown over the colour key, e.g. "Population". */
  legend: string;
  /** How a value is said: "1.4 billion people", "2.1 births per woman". */
  unit: string;
  digits?: number;
  /** Countries summed make a world figure (people, not rates). */
  sum?: boolean;
  /** A line worth counting countries across: "below 2.1 births per woman". */
  threshold?: { value: number; below: boolean; label: string };
  postTitle: string;
  sources: string[];
  hashtags: string[];
}

const UN = 'UN World Population Prospects 2024';

export const MEASURE_PRESETS: Record<string, MeasurePreset> = {
  population: {
    kicker: 'Population',
    topic: 'how the population of every country changes from 1950 to 2100',
    metric: 'wpp:TPopulation1July', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Population', unit: 'people', sum: true,
    postTitle: 'Every country\'s population, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#Population', '#Demographics', '#DataViz', '#Maps'],
  },
  fertility: {
    kicker: 'Births',
    topic: 'how many children women have, country by country, from 1950 to 2100',
    metric: 'wpp:TFR', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Births per woman', unit: 'births per woman', digits: 1,
    threshold: { value: 2.1, below: true, label: 'below 2.1 births per woman, the level that keeps a population steady without migration' },
    postTitle: 'Births per woman in every country, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#Fertility', '#Demographics', '#DataViz', '#Maps'],
  },
  'median-age': {
    kicker: 'Ageing',
    topic: 'how old the world gets: the median age of every country from 1950 to 2100',
    metric: 'wpp:MedianAgePop', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Median age', unit: 'years', digits: 1,
    threshold: { value: 40, below: false, label: 'with a median age over 40' },
    postTitle: 'The median age of every country, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#Ageing', '#Demographics', '#DataViz', '#Maps'],
  },
  'life-expectancy': {
    kicker: 'Life expectancy',
    topic: 'how long people live, country by country, from 1950 to 2100',
    metric: 'wpp:LEx', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Life expectancy', unit: 'years', digits: 1,
    threshold: { value: 70, below: false, label: 'where people live past 70 on average' },
    postTitle: 'Life expectancy in every country, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#LifeExpectancy', '#Health', '#DataViz', '#Maps'],
  },
  cities: {
    kicker: 'Cities',
    topic: 'how the world moves to cities: the urban share of every country from 1950 to 2050',
    metric: 'wup:UrbanShare', from: 1950, to: 2050,
    projection: { label: 'UN projection' },
    legend: 'Living in cities', unit: 'percent', digits: 0,
    threshold: { value: 50, below: false, label: 'where most people live in cities' },
    postTitle: 'How every country moved to the city, 1950 to 2050',
    sources: ['UN World Urbanization Prospects 2025', 'TAKIP'],
    hashtags: ['#TAKIP', '#Cities', '#Urbanization', '#DataViz', '#Maps'],
  },
  democracy: {
    kicker: 'Democracy',
    topic: 'how electoral democracy spread and receded, country by country, from 1900 to 2025',
    metric: 'owid:electdem_vdem', from: 1900, to: 2025,
    legend: 'Electoral democracy (V-Dem)', unit: 'on the V-Dem electoral democracy index, from 0 to 1', digits: 2,
    threshold: { value: 0.5, below: false, label: 'scoring above 0.5 on the V-Dem electoral democracy index' },
    postTitle: '125 years of democracy, country by country',
    sources: ['V-Dem via Our World in Data', 'TAKIP'],
    hashtags: ['#TAKIP', '#Democracy', '#History', '#DataViz', '#Maps'],
  },
};

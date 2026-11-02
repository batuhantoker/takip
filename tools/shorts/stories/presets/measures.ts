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
  /** Years each told value averages (the map still shows each year's own), for a measure that swings year to year. */
  smooth?: number;
  /** How a value is said where the obvious wording misleads: the words that say it wrong, or words some line must have. */
  phrasing?: { rule: string; wrong?: RegExp; once?: RegExp };
  /** A line worth counting countries across: "below 2.1 births per woman". */
  threshold?: { value: number; below: boolean; label: string };
  postTitle: string;
  sources: string[];
  hashtags: string[];
}

const UN = 'UN World Population Prospects 2024';
/**
 * Life expectancy is an average at birth, pulled down by deaths in childhood and by crisis years: "people lived just 20.5
 * years" reads as if adults died at 20 (Russia, 1920).
 */
const LIFE_EXPECTANCY = {
  rule: 'Say it as life expectancy ("In 1920, Russia\'s life expectancy was just 20.5 years"), never as how long people lived or live, and name the year in every line.',
  wrong: /\b(people|they|everyone|adults?|residents?)\s+(lived|live|living|die|died)\b|\blived\b|\bliving\s+\d|\blive to\b/i,
};

/** Maddison's dollars are 2011 prices: said once, so 8,038 in 1900 isn't heard as that year's money. */
const PRICES_2011 = {
  rule: 'Say once, in the first line, that the money is "in 2011 dollars" or "adjusted for prices"; never "today\'s dollars".',
  wrong: /\btoday'?s dollars\b/i,
  once: /\b(2011 (dollars|prices)|adjusted for (prices|inflation))\b/i,
};

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
    phrasing: LIFE_EXPECTANCY,
    threshold: { value: 70, below: false, label: 'where life expectancy is past 70' },
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
  'child-mortality': {
    kicker: 'Children',
    topic: 'how many children die before their fifth birthday, country by country, from 1950 to 2100',
    metric: 'wpp:Q5', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Deaths before age 5', unit: 'deaths before age five per 1,000 births', digits: 1,
    threshold: { value: 25, below: true, label: 'below 25 deaths before age five per 1,000 births, the UN goal for 2030' },
    postTitle: 'Child deaths in every country, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#ChildHealth', '#GlobalHealth', '#DataViz', '#Maps'],
  },
  'infant-mortality': {
    kicker: 'Babies',
    topic: 'how many babies die before their first birthday, country by country, from 1950 to 2100',
    metric: 'wpp:IMR', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Infant deaths', unit: 'infant deaths per 1,000 births', digits: 1,
    threshold: { value: 10, below: true, label: 'below 10 infant deaths per 1,000 births' },
    postTitle: 'Infant deaths in every country, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#GlobalHealth', '#Babies', '#DataViz', '#Maps'],
  },
  'aged-65': {
    kicker: 'Getting older',
    topic: 'the share of people aged 65 or over, country by country, from 1950 to 2100',
    metric: 'wpp:Share65', source: 'wpp-2024', from: 1950, to: 2100,
    projection: { label: 'UN projection' },
    legend: 'Aged 65 or over', unit: 'percent aged 65 or over', digits: 0,
    threshold: { value: 20, below: false, label: 'where at least one person in five is 65 or older' },
    postTitle: 'How old every country gets, 1950 to 2100',
    sources: [UN, 'TAKIP'],
    hashtags: ['#TAKIP', '#Ageing', '#Demographics', '#DataViz', '#Maps'],
  },
  // records before 1950 cover a few dozen countries; the rest of the map is grey until then
  'life-expectancy-long': {
    kicker: 'Life expectancy',
    topic: 'how long people lived, country by country, from 1900 to 2021; before 1950 only some countries have records, and the rest of the map is grey',
    metric: 'owid:le_0', from: 1900, to: 2021,
    legend: 'Life expectancy', unit: 'years', digits: 1,
    phrasing: LIFE_EXPECTANCY,
    threshold: { value: 60, below: false, label: 'where life expectancy was past 60' },
    postTitle: 'How long people lived, 1900 to 2021',
    sources: ['Riley, Zijdeman and UN WPP via Our World in Data', 'TAKIP'],
    hashtags: ['#TAKIP', '#LifeExpectancy', '#History', '#DataViz', '#Maps'],
  },
  'gdp-long': {
    kicker: 'Wealth',
    topic: 'how rich the average person was, country by country, from 1870 to 2022, in 2011 prices; before 1950 only some countries have records',
    metric: 'owid:gdp_pc_maddison', from: 1870, to: 2022,
    legend: 'GDP per person (2011 $)', unit: 'dollars a person, in 2011 prices', digits: 0,
    phrasing: PRICES_2011,
    postTitle: '150 years of getting richer, country by country',
    sources: ['Maddison Project Database via Our World in Data', 'TAKIP'],
    hashtags: ['#TAKIP', '#Economy', '#EconomicHistory', '#DataViz', '#Maps'],
  },
  gdp: {
    kicker: 'Wealth',
    topic: 'GDP per person in US dollars at the prices of each year, country by country, from 1980 to 2031',
    metric: 'imf:NGDPDPC', from: 1980, to: 2031,
    projection: { label: 'IMF projection' },
    legend: 'GDP per person (US$)', unit: 'US dollars a person', digits: 0,
    postTitle: 'GDP per person in every country, 1980 to 2031',
    sources: ['IMF World Economic Outlook', 'TAKIP'],
    hashtags: ['#TAKIP', '#Economy', '#GDP', '#DataViz', '#Maps'],
  },
  internet: {
    kicker: 'Online',
    topic: 'the share of people using the internet, country by country, from 1990 to 2024',
    metric: 'wdi:IT.NET.USER.ZS', from: 1990, to: 2024,
    legend: 'Using the internet', unit: 'percent online', digits: 0,
    threshold: { value: 50, below: false, label: 'where most people are online' },
    postTitle: 'How the world got online, 1990 to 2024',
    sources: ['World Bank (ITU)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Internet', '#Tech', '#DataViz', '#Maps'],
  },
  electricity: {
    kicker: 'Power',
    topic: 'the share of people with electricity at home, country by country, from 2000 to 2024',
    metric: 'wdi:EG.ELC.ACCS.ZS', from: 2000, to: 2024,
    legend: 'With electricity', unit: 'percent with electricity', digits: 0,
    threshold: { value: 99, below: false, label: 'where over 99 percent of people have electricity' },
    postTitle: 'Who has electricity, 2000 to 2024',
    sources: ['World Bank', 'TAKIP'],
    hashtags: ['#TAKIP', '#Energy', '#Electricity', '#DataViz', '#Maps'],
  },
  'human-rights': {
    kicker: 'Human rights',
    topic: 'how well human rights were respected, country by country, from 1900 to 2025, on the V-Dem index from 0 to 1',
    metric: 'owid:civlibs_vdem', from: 1900, to: 2025,
    legend: 'Human rights (V-Dem)', unit: 'on the V-Dem human rights index, from 0 to 1', digits: 2,
    threshold: { value: 0.8, below: false, label: 'scoring above 0.8 on the V-Dem human rights index' },
    postTitle: '125 years of human rights, country by country',
    sources: ['V-Dem via Our World in Data', 'TAKIP'],
    hashtags: ['#TAKIP', '#HumanRights', '#History', '#DataViz', '#Maps'],
  },
  'temperature-observed': {
    kicker: 'Warming',
    topic: "each country's average temperature, measured, from 1965 to 2025; every number told is the mean of the five years up to it, so one warm or cold year doesn't count as a change",
    // the series has only 1950 and 1955 before 1960, so earlier five-year means are one year's value
    metric: 'era5:tas', from: 1965, to: 2025, smooth: 5,
    legend: 'Mean temperature (°C)', unit: 'degrees Celsius, five-year average', digits: 1,
    postTitle: '60 years of warming, country by country',
    sources: ['Copernicus ERA5 via World Bank CCKP', 'TAKIP'],
    hashtags: ['#TAKIP', '#Climate', '#ClimateChange', '#DataViz', '#Maps'],
  },
  'girls-in-school': {
    kicker: 'Girls in school',
    topic: 'how many girls go to secondary school for every boy, country by country, from 1980 to 2020',
    metric: 'wdi:SE.ENR.SECO.FM.ZS', from: 1980, to: 2020,
    legend: 'Girls for every boy', unit: 'girls in secondary school for every boy', digits: 2,
    threshold: { value: 0.97, below: false, label: 'where as many girls as boys are in secondary school (0.97 or more for every boy)' },
    postTitle: 'Girls in school, 1980 to 2020',
    sources: ['World Bank (UNESCO)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Education', '#GirlsEducation', '#DataViz', '#Maps'],
  },
  // in place of literacy, whose country records are too sparse to colour a map
  schooling: {
    kicker: 'School',
    topic: 'how many years adults aged 15 to 64 spent in school on average, country by country, from 1870 to 2020',
    metric: 'owid:schooling_years', from: 1870, to: 2020,
    legend: 'Years of school', unit: 'years of school', digits: 1,
    postTitle: '150 years of going to school, country by country',
    sources: ['Lee and Lee, Barro and Lee via Our World in Data', 'TAKIP'],
    hashtags: ['#TAKIP', '#Education', '#History', '#DataViz', '#Maps'],
  },
  'co2-per-person': {
    kicker: 'CO₂',
    topic: 'carbon dioxide emitted per person each year, country by country, from 1950 to 2024',
    metric: 'owid:co2_pc', from: 1950, to: 2024,
    legend: 'CO₂ per person (t)', unit: 'tonnes of CO₂ a person', digits: 1,
    postTitle: 'CO₂ per person in every country, 1950 to 2024',
    sources: ['Global Carbon Project via Our World in Data', 'TAKIP'],
    hashtags: ['#TAKIP', '#Climate', '#CO2', '#DataViz', '#Maps'],
  },
  forests: {
    kicker: 'Forests',
    topic: 'the share of land covered by forest, country by country, from 1990 to 2023',
    metric: 'wdi:AG.LND.FRST.ZS', from: 1990, to: 2023,
    legend: 'Forest (% of land)', unit: 'percent forest', digits: 0,
    postTitle: 'Forests in every country, 1990 to 2023',
    sources: ['World Bank (FAO)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Forests', '#Nature', '#DataViz', '#Maps'],
  },
  renewables: {
    kicker: 'Clean power',
    topic: 'the share of electricity made from renewable sources, country by country, from 2000 to 2021',
    metric: 'wdi:EG.ELC.RNEW.ZS', from: 2000, to: 2021,
    legend: 'Renewable electricity', unit: 'percent of electricity from renewables', digits: 0,
    threshold: { value: 50, below: false, label: 'where most electricity is renewable' },
    postTitle: 'Who runs on renewables, 2000 to 2021',
    sources: ['World Bank (IEA)', 'TAKIP'],
    hashtags: ['#TAKIP', '#RenewableEnergy', '#Climate', '#DataViz', '#Maps'],
  },
  'women-in-parliament': {
    kicker: 'Women in power',
    topic: 'the share of seats in national parliaments held by women, country by country, from 1997 to 2024',
    metric: 'wdi:SG.GEN.PARL.ZS', from: 1997, to: 2024,
    legend: 'Women in parliament', unit: 'percent of seats held by women', digits: 0,
    threshold: { value: 30, below: false, label: 'where women hold at least 30 percent of seats' },
    postTitle: 'Women in parliament, 1997 to 2024',
    sources: ['World Bank (Inter-Parliamentary Union)', 'TAKIP'],
    hashtags: ['#TAKIP', '#WomenInPolitics', '#Equality', '#DataViz', '#Maps'],
  },
  'mobile-phones': {
    kicker: 'Mobile phones',
    topic: 'mobile phone subscriptions for every 100 people, country by country, from 1990 to 2022',
    metric: 'wdi:IT.CEL.SETS.P2', from: 1990, to: 2022,
    legend: 'Mobile subscriptions per 100', unit: 'mobile subscriptions per 100 people', digits: 0,
    threshold: { value: 100, below: false, label: 'with more mobile subscriptions than people' },
    postTitle: 'How the world went mobile, 1990 to 2022',
    sources: ['World Bank (ITU)', 'TAKIP'],
    hashtags: ['#TAKIP', '#Mobile', '#Tech', '#DataViz', '#Maps'],
  },
};

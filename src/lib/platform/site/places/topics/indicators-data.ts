import { msg } from '@/lib/core/i18n/translator';

/**
 * The History indicators a country page charts, in the order every list of them uses (a country's statistics hub,
 * comparisons, a measure's world page), and the table tools/site/topics/indicators.ts writes from data/db/history.db:
 * data/site/topics/indicators.json, keyed by GeoNames id. Labels reuse History's own (lib/history/countries/view.ts).
 */

export type IndicatorGroup = 'health' | 'people' | 'economy' | 'education' | 'politics' | 'conflict' | 'military' | 'climate' | 'technology';

export const INDICATOR_GROUPS: readonly { id: IndicatorGroup; label: string }[] = [
  { id: 'health', label: msg('Health') },
  { id: 'people', label: msg('People') },
  { id: 'economy', label: msg('Economy') },
  { id: 'education', label: msg('Education') },
  { id: 'politics', label: msg('Politics') },
  { id: 'conflict', label: msg('Conflict') },
  { id: 'military', label: msg('Military') },
  { id: 'climate', label: msg('Climate') },
  { id: 'technology', label: msg('Technology and environment') },
];

/** How a value reads: a number to `digits` places, US dollars, or a count that turns into words past a million ("85.3 million"). */
export type ValueStyle = 'number' | 'usd' | 'count';

/** A metric in history.db and the source publishing it there (meta_source.code): two sources can share a code. */
export interface SeriesRef { code: string; source: string }

/** What a projection is called: its publisher, its scenario, and what its published range spans. */
export interface Projector { name: string; scenario?: string; range?: string }

export interface IndicatorSpec {
  /** The page's URL segment, /country/<place>/<slug>, and the key in the table. */
  slug: string;
  group: IndicatorGroup;
  label: string;
  /** A shorter label for where room is tight (a comparison's title between two long names). */
  short?: string;
  /** One sentence on what it measures. */
  about: string;
  /** The value axis and the table's column. */
  unit: string;
  /** A value in a sentence, {v} formatted by `style`. */
  value: string;
  style: ValueStyle;
  digits: number;
  /** The series the page is about: estimates or measurements, or a climate model's run where `modelled`. */
  main: SeriesRef;
  /** A country's total, which the World's sums: drawn beside a country, the World's line flattens it. */
  total?: true;
  /** Every value is a climate model's (CMIP6's median), its historical run and then its projection. */
  modelled?: true;
  /** Measurements rather than estimates (ERA5's reanalysis of observations). */
  observed?: true;
  /** The source marks its own estimates and its highly uncertain figures in the points' flags (SIPRI's blue and red). */
  marks?: true;
  /** A climate model's run beside the measurements; the projection extends it rather than `main`. */
  model?: SeriesRef;
  /** `<code>.proj` (and `.proj.lo`, `.proj.hi`) of `model ?? main`, where the source publishes one. */
  projection?: Projector;
  /** Older values in the same unit from another source, drawn before `main` begins. */
  earlier?: SeriesRef & { since: number; credit: string; by: string };
  /** A longer run in another unit, charted on its own: one axis never carries two units. */
  longRun?: SeriesRef & { since: number; unit: string; value: string; credit: string; by: string };
  /** What History colours the map by; the series API picks the source with the most points unless told. */
  map: { code: string; source?: string };
  /** Who published it, as they name themselves: not translated. */
  credit: string;
  /** Its short name inside a sentence, as an adjective: "UN estimates", "ERA5 observations". */
  by: string;
}

const UN: Projector = { name: msg('UN projection'), scenario: msg('medium variant'), range: msg('95% prediction interval') };
const UN_URBAN: Projector = { name: msg('UN projection'), scenario: 'World Urbanization Prospects 2025' };
const CMIP6: Projector = { name: msg('CMIP6 model median'), scenario: msg('SSP2-4.5, middle of the road'), range: msg('models’ 10th–90th percentile') };
// IMF terms: commercial reuse needs the IMF's permission (data/db's imf-terms licence).
const IMF: Projector = { name: msg('IMF projection'), scenario: 'World Economic Outlook, October 2026' };

const WPP = 'UN DESA, World Population Prospects 2024';
const WPP_SOURCE = 'wpp-2024';
const CCKP = 'World Bank Climate Change Knowledge Portal, CMIP6 multi-model median';
const SIPRI = 'Information from the Stockholm International Peace Research Institute (SIPRI) Military Expenditure Database, https://doi.org/10.55163/CQGC9685';
const SIPRI_SOURCE = 'sipri-milex';
const IISS = 'IISS, The Military Balance, via the World Bank';
const COW = 'Correlates of War Project, National Material Capabilities v7.0; Singer, Bremer and Stuckey (1972), “Capability Distribution, Uncertainty, and Major Power War, 1820–1965”, in Bruce Russett (ed.), Peace, War, and Numbers, Sage, 19–48';
const SIPRI_ARMS = 'SIPRI Arms Transfers Database, via the World Bank';

const wpp = (code: string, rest: Omit<IndicatorSpec, 'main' | 'map' | 'credit' | 'by' | 'projection'>): IndicatorSpec =>
  ({ ...rest, main: { code, source: WPP_SOURCE }, map: { code }, credit: WPP, by: 'UN', projection: UN });

export const INDICATORS: readonly IndicatorSpec[] = [
  wpp('wpp:LEx', {
    slug: 'life-expectancy', group: 'health', label: msg('Life expectancy'),
    about: msg('How long a newborn would live on average if the year’s death rates held all its life.'),
    unit: msg('years'), value: msg('{v} years'), style: 'number', digits: 1,
    earlier: { code: 'owid:le_0', source: 'owid-le', since: 1800, credit: 'Our World in Data, long-run life expectancy', by: 'Our World in Data' },
  }),
  {
    slug: 'child-mortality', group: 'health', label: msg('Child mortality'),
    about: msg('The share of children who die before their fifth birthday.'),
    unit: msg('deaths before age 5 per 100 live births'), value: msg('{v} per 100 live births'), style: 'number', digits: 1,
    main: { code: 'owid:child_mortality', source: 'owid-longrun' }, map: { code: 'owid:child_mortality' },
    credit: 'Gapminder (2015) and UN IGME (2025), via Our World in Data', by: 'Gapminder and UN IGME',
  },
  wpp('wpp:IMR', {
    slug: 'infant-mortality', group: 'health', label: msg('Infant mortality'),
    about: msg('Babies who die before their first birthday, per 1,000 born alive.'),
    unit: msg('deaths per 1,000 live births'), value: msg('{v} per 1,000 live births'), style: 'number', digits: 1,
  }),
  {
    slug: 'safe-drinking-water', group: 'health', label: msg('Safe drinking water'),
    about: msg('The share of people whose drinking water comes from an improved source at home, there when needed and free of contamination.'),
    unit: msg('% of people'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'owid:water_safely_managed', source: 'owid-water' }, map: { code: 'owid:water_safely_managed' },
    credit: 'WHO/UNICEF Joint Monitoring Programme, via Our World in Data', by: 'WHO/UNICEF',
  },
  // IHME's Global Burden of Disease terms are non-commercial.
  {
    slug: 'depression', group: 'health', label: msg('Depression'),
    about: msg('The share of people living with a depressive disorder, as the Global Burden of Disease study estimates it.'),
    unit: msg('% of people'), value: msg('{v}%'), style: 'number', digits: 2,
    main: { code: 'owid:prev_depression', source: 'owid-mental' }, map: { code: 'owid:prev_depression' },
    credit: 'IHME, Global Burden of Disease, via Our World in Data', by: 'IHME',
  },
  {
    slug: 'suicide-rate', group: 'health', label: msg('Suicide rate'),
    about: msg('Deaths by suicide in a year, per 100,000 people.'),
    unit: msg('deaths per 100,000 people'), value: msg('{v} per 100,000 people'), style: 'number', digits: 1,
    main: { code: 'owid:suicide_rate', source: 'owid-mental' }, map: { code: 'owid:suicide_rate' },
    credit: 'IHME, Global Burden of Disease, via Our World in Data', by: 'IHME',
  },
  wpp('wpp:TPopulation1July', {
    slug: 'population', group: 'people', label: msg('Population'), total: true,
    about: msg('Everyone living in the country on 1 July of each year.'),
    unit: msg('people'), value: msg('{v} people'), style: 'count', digits: 0,
    earlier: { code: 'owid:population', source: 'owid-longrun', since: 1800, credit: 'HYDE (2023), Gapminder (2022) and UN WPP (2024), via Our World in Data', by: 'HYDE and Gapminder' },
  }),
  wpp('wpp:PopGrowthRate', {
    slug: 'population-growth', group: 'people', label: msg('Population growth'),
    about: msg('How fast the population grew or shrank in a year: births minus deaths, plus people moving in minus people moving out.'),
    unit: msg('% a year'), value: msg('{v}% a year'), style: 'number', digits: 2,
  }),
  wpp('wpp:TFR', {
    slug: 'fertility-rate', group: 'people', label: msg('Fertility rate'),
    about: msg('The children a woman would have over her life at the year’s birth rates for each age.'),
    unit: msg('births per woman'), value: msg('{v} births per woman'), style: 'number', digits: 2,
  }),
  {
    slug: 'urban-population', group: 'people', label: msg('Urban population'),
    about: msg('The share of people living in places the country itself counts as urban.'),
    unit: msg('% of people'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'wup:UrbanShare', source: 'wup-2025' }, map: { code: 'wup:UrbanShare' }, projection: UN_URBAN,
    credit: 'UN DESA, World Urbanization Prospects 2025', by: 'UN',
  },
  wpp('wpp:MedianAgePop', {
    slug: 'median-age', group: 'people', label: msg('Median age'),
    about: msg('Half the people are older than this age and half are younger.'),
    unit: msg('years'), value: msg('{v} years'), style: 'number', digits: 1,
  }),
  wpp('wpp:Share65', {
    slug: 'people-aged-65-and-over', group: 'people', label: msg('People aged 65 and over'), short: msg('Aged 65 and over'),
    about: msg('The share of the population aged 65 or older.'),
    unit: msg('% of people'), value: msg('{v}%'), style: 'number', digits: 1,
  }),
  wpp('wpp:CNMR', {
    slug: 'net-migration', group: 'people', label: msg('Net migration rate'),
    about: msg('People moving in minus people moving out in a year, per 1,000 residents; below zero, more left than arrived.'),
    unit: msg('per 1,000 people'), value: msg('{v} per 1,000 people'), style: 'number', digits: 1,
  }),
  {
    slug: 'gdp-per-person', group: 'economy', label: msg('GDP per person'),
    about: msg('The value of everything produced in the country in a year, divided by its people, in 2015 US dollars so that years compare.'),
    unit: msg('US dollars at 2015 prices'), value: '{v}', style: 'usd', digits: 0,
    main: { code: 'wdi:NY.GDP.PCAP.KD', source: 'wdi' }, map: { code: 'wdi:NY.GDP.PCAP.KD' },
    credit: 'World Bank, World Development Indicators', by: 'World Bank',
    longRun: {
      code: 'owid:gdp_pc_maddison', source: 'owid-longrun', since: 1820,
      unit: msg('international dollars at 2011 prices'), value: msg('{v} international dollars at 2011 prices'), by: 'Maddison',
      // Maddison asks to be cited in this form wherever its data is shown.
      credit: 'Maddison Project Database, version 2023 by Bolt, Jutta and Jan Luiten van Zanden (2024), “Maddison style estimates of the evolution of the world economy: A new 2023 update”, Journal of Economic Surveys, 1–41. DOI: 10.1111/joes.12618',
    },
  },
  {
    slug: 'gdp-growth', group: 'economy', label: msg('GDP growth'),
    about: msg('How much the economy grew or shrank in a year, after inflation.'),
    unit: msg('% a year'), value: msg('{v}% a year'), style: 'number', digits: 1,
    main: { code: 'imf:NGDP_RPCH', source: 'imf-weo' }, map: { code: 'imf:NGDP_RPCH' }, projection: IMF,
    credit: 'IMF, World Economic Outlook, October 2026', by: 'IMF',
  },
  {
    slug: 'inflation', group: 'economy', label: msg('Inflation'),
    about: msg('How much consumer prices rose in a year, on average.'),
    unit: msg('% a year'), value: msg('{v}% a year'), style: 'number', digits: 1,
    main: { code: 'imf:PCPIPCH', source: 'imf-weo' }, map: { code: 'imf:PCPIPCH' }, projection: IMF,
    credit: 'IMF, World Economic Outlook, October 2026', by: 'IMF',
  },
  {
    slug: 'government-debt', group: 'economy', label: msg('Government debt'),
    about: msg('What the government owes, as a share of the economy’s yearly output.'),
    unit: msg('% of GDP'), value: msg('{v}% of GDP'), style: 'number', digits: 1,
    main: { code: 'imf:GGXWDG_NGDP', source: 'imf-weo' }, map: { code: 'imf:GGXWDG_NGDP' }, projection: IMF,
    credit: 'IMF, World Economic Outlook, October 2026', by: 'IMF',
  },
  {
    slug: 'schooling', group: 'education', label: msg('Learning-adjusted schooling'), short: msg('Schooling'),
    about: msg('The years of school a child can expect by 18, cut to what students actually learn: the World Bank’s learning-adjusted years of school.'),
    unit: msg('years'), value: msg('{v} years'), style: 'number', digits: 1,
    main: { code: 'owid:lays', source: 'owid-edu' }, map: { code: 'owid:lays' },
    credit: 'World Bank Human Capital Index, via Our World in Data', by: 'World Bank',
  },
  {
    slug: 'literacy', group: 'education', label: msg('Adult literacy'),
    about: msg('The share of people aged 15 and over who can read and write a short, simple statement about their everyday life.'),
    unit: msg('% of adults'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'wdi:SE.ADT.LITR.ZS', source: 'wdi' }, map: { code: 'wdi:SE.ADT.LITR.ZS' },
    credit: 'UNESCO Institute for Statistics, via the World Bank', by: 'UNESCO',
  },
  {
    slug: 'girls-in-primary-school', group: 'education', label: msg('Girls in primary school'), short: msg('Girls in school'),
    about: msg('The share of girls of primary-school age who are enrolled in school.'),
    unit: msg('% of girls of primary-school age'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'owid:ner_primary_f', source: 'owid-edu' }, map: { code: 'owid:ner_primary_f' },
    credit: 'Our World in Data, joining historical estimates to the World Bank’s', by: 'Our World in Data',
  },
  {
    slug: 'democracy', group: 'politics', label: msg('Electoral democracy'),
    about: msg('V-Dem’s electoral democracy index: how far rulers answer to voters through free and fair elections, with free speech and association, from 0 to 1.'),
    unit: msg('index, 0 to 1'), value: msg('{v} of 1'), style: 'number', digits: 2,
    main: { code: 'owid:electdem_vdem', source: 'owid-longrun' }, map: { code: 'owid:electdem_vdem' },
    credit: 'V-Dem (2026), via Our World in Data', by: 'V-Dem',
  },
  {
    slug: 'human-rights', group: 'politics', label: msg('Human rights'),
    about: msg('V-Dem’s civil liberties index: how free people are from government violence and how far they hold private and political liberties, from 0 to 1.'),
    unit: msg('index, 0 to 1'), value: msg('{v} of 1'), style: 'number', digits: 2,
    main: { code: 'owid:civlibs_vdem', source: 'owid-longrun' }, map: { code: 'owid:civlibs_vdem' },
    credit: 'V-Dem (2026), via Our World in Data', by: 'V-Dem',
  },
  {
    slug: 'conflict-deaths', group: 'conflict', label: msg('Deaths in conflicts'), total: true,
    about: msg('Soldiers and civilians killed in the year’s armed conflicts fought in the country, by the Uppsala Conflict Data Program’s best estimate.'),
    unit: msg('deaths a year'), value: msg('{v} deaths'), style: 'count', digits: 0,
    main: { code: 'owid:conflict_deaths_all', source: 'owid-conflict' }, map: { code: 'owid:conflict_deaths_all' },
    credit: 'Uppsala Conflict Data Program, via Our World in Data', by: 'UCDP',
  },
  // SIPRI's terms: free to chart with its credit line; reproducing over 10% of the data, or any commercial use, needs its authorisation.
  {
    slug: 'military-spending', group: 'military', label: msg('Military spending'),
    about: msg('What the country spends on its armed forces and defence, as a share of its economy, by SIPRI’s count.'),
    unit: msg('% of GDP'), value: msg('{v}% of GDP'), style: 'number', digits: 2,
    main: { code: 'sipri:milex_gdp', source: SIPRI_SOURCE }, marks: true, map: { code: 'sipri:milex_gdp' }, credit: SIPRI, by: 'SIPRI',
  },
  {
    slug: 'military-spending-in-dollars', group: 'military', label: msg('Military spending in US dollars'), short: msg('Military spending, US$'), total: true,
    about: msg('What the country spends on its armed forces and defence, in constant 2024 US dollars so that years compare, by SIPRI’s count.'),
    unit: msg('US dollars at 2024 prices'), value: '{v}', style: 'usd', digits: 0,
    main: { code: 'sipri:milex_const_usd', source: SIPRI_SOURCE }, marks: true, map: { code: 'sipri:milex_const_usd' }, credit: SIPRI, by: 'SIPRI',
  },
  {
    slug: 'military-spending-per-person', group: 'military', label: msg('Military spending per person'), short: msg('Military $ per person'),
    about: msg('What the country spends on its armed forces and defence for each person living there, in US dollars of each year, not adjusted for inflation.'),
    unit: msg('US dollars per person'), value: '{v}', style: 'usd', digits: 0,
    main: { code: 'sipri:milex_pc', source: SIPRI_SOURCE }, marks: true, map: { code: 'sipri:milex_pc' }, credit: SIPRI, by: 'SIPRI',
  },
  {
    slug: 'military-share-of-government-spending', group: 'military', label: msg('Military share of state spending'), short: msg('Military, % of budget'),
    about: msg('The part of everything the government spends that goes on its armed forces and defence, by SIPRI’s count.'),
    unit: msg('% of government spending'), value: msg('{v}% of government spending'), style: 'number', digits: 1,
    main: { code: 'sipri:milex_gov', source: SIPRI_SOURCE }, marks: true, map: { code: 'sipri:milex_gov' }, credit: SIPRI, by: 'SIPRI',
  },
  // IISS's Military Balance figures, republished by the World Bank under its CC BY 4.0; COW's are free to use, cited as COW asks.
  {
    slug: 'armed-forces', group: 'military', label: msg('Armed forces personnel'), short: msg('Armed forces'), total: true,
    about: msg('Active-duty military personnel, with paramilitary forces where they are trained and equipped like soldiers, by the IISS Military Balance.'),
    unit: msg('people'), value: msg('{v} people'), style: 'count', digits: 0,
    main: { code: 'wdi:MS.MIL.TOTL.P1', source: 'wdi' }, map: { code: 'wdi:MS.MIL.TOTL.P1' }, credit: IISS, by: 'IISS',
    earlier: { code: 'cow-nmc:milper', source: 'cow-nmc', since: 1816, credit: COW, by: 'Correlates of War' },
  },
  {
    slug: 'national-power', group: 'military', label: msg('National power'),
    about: msg('The Correlates of War’s Composite Index of National Capability: the country’s share of the world’s military spending, soldiers, iron and steel, energy use, people and city dwellers, averaged.'),
    unit: msg('% of world capability'), value: msg('{v}% of world capability'), style: 'number', digits: 2,
    main: { code: 'cow-nmc:cinc', source: 'cow-nmc' }, map: { code: 'cow-nmc:cinc' }, credit: COW, by: 'Correlates of War',
  },
  {
    slug: 'armed-forces-share', group: 'military', label: msg('Armed forces, share of workers'), short: msg('Troops, % of workers'),
    about: msg('Active-duty military personnel as a share of everyone working or looking for work, by the IISS Military Balance.'),
    unit: msg('% of the labour force'), value: msg('{v}% of the labour force'), style: 'number', digits: 2,
    main: { code: 'wdi:MS.MIL.TOTL.TF.ZS', source: 'wdi' }, map: { code: 'wdi:MS.MIL.TOTL.TF.ZS' }, credit: IISS, by: 'IISS',
  },
  {
    slug: 'arms-imports', group: 'military', label: msg('Arms imports'), total: true,
    about: msg('Major weapons the country received, in SIPRI trend-indicator values (TIV): what the arms are worth as military capability, priced by their production cost, not what was paid.'),
    unit: msg('SIPRI trend-indicator values'), value: msg('{v} TIV'), style: 'count', digits: 0,
    main: { code: 'wdi:MS.MIL.MPRT.KD', source: 'wdi' }, map: { code: 'wdi:MS.MIL.MPRT.KD' }, credit: SIPRI_ARMS, by: 'SIPRI',
  },
  {
    slug: 'arms-exports', group: 'military', label: msg('Arms exports'), total: true,
    about: msg('Major weapons the country sent abroad, in SIPRI trend-indicator values (TIV): what the arms are worth as military capability, priced by their production cost, not what was paid.'),
    unit: msg('SIPRI trend-indicator values'), value: msg('{v} TIV'), style: 'count', digits: 0,
    main: { code: 'wdi:MS.MIL.XPRT.KD', source: 'wdi' }, map: { code: 'wdi:MS.MIL.XPRT.KD' }, credit: SIPRI_ARMS, by: 'SIPRI',
  },
  {
    slug: 'temperature', group: 'climate', label: msg('Temperature'),
    about: msg('The average air temperature near the ground, over the whole country and the whole year.'),
    unit: '°C', value: '{v} °C', style: 'number', digits: 1,
    main: { code: 'era5:tas', source: 'wb-cckp' }, observed: true, model: { code: 'cckp:tas', source: 'wb-cckp' }, projection: CMIP6,
    map: { code: 'era5:tas' }, credit: 'ERA5 reanalysis (Copernicus, ECMWF) and CMIP6, via the World Bank Climate Change Knowledge Portal', by: 'ERA5',
  },
  {
    slug: 'hot-days', group: 'climate', label: msg('Days above 35 °C'),
    about: msg('Days in a year whose highest temperature passes 35 °C, averaged over the country.'),
    unit: msg('days a year'), value: msg('{v} days'), style: 'number', digits: 1,
    main: { code: 'cckp:hd35', source: 'wb-cckp' }, modelled: true, projection: CMIP6, map: { code: 'cckp:hd35' }, credit: CCKP, by: 'CMIP6',
  },
  {
    slug: 'tropical-nights', group: 'climate', label: msg('Tropical nights'),
    about: msg('Nights in a year when the temperature stays above 20 °C, averaged over the country.'),
    unit: msg('nights a year'), value: msg('{v} nights'), style: 'number', digits: 1,
    main: { code: 'cckp:tr', source: 'wb-cckp' }, modelled: true, projection: CMIP6, map: { code: 'cckp:tr' }, credit: CCKP, by: 'CMIP6',
  },
  {
    slug: 'co2-per-person', group: 'technology', label: msg('CO₂ per person'),
    about: msg('Carbon dioxide from energy, industry, farming and waste, divided by the population; land use and forests are left out.'),
    unit: msg('tonnes per person'), value: msg('{v} tonnes'), style: 'number', digits: 2,
    main: { code: 'wdi:EN.GHG.CO2.PC.CE.AR5', source: 'wdi' }, map: { code: 'wdi:EN.GHG.CO2.PC.CE.AR5' },
    credit: 'EDGAR (European Commission JRC) and the IEA, via the World Bank', by: 'EDGAR',
  },
  {
    slug: 'internet-users', group: 'technology', label: msg('Internet users'),
    about: msg('The share of people who used the internet in the last three months, from anywhere.'),
    unit: msg('% of people'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'wdi:IT.NET.USER.ZS', source: 'wdi' }, map: { code: 'wdi:IT.NET.USER.ZS' }, credit: 'ITU, via the World Bank', by: 'ITU',
  },
  {
    slug: 'electricity-access', group: 'technology', label: msg('Access to electricity'),
    about: msg('The share of people with access to electricity, from national surveys and the power industry.'),
    unit: msg('% of people'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'wdi:EG.ELC.ACCS.ZS', source: 'wdi' }, map: { code: 'wdi:EG.ELC.ACCS.ZS' }, credit: 'Tracking SDG 7 (World Bank ESMAP), via the World Bank', by: 'World Bank',
  },
  {
    slug: 'forest-area', group: 'technology', label: msg('Forest area'),
    about: msg('The share of land under trees at least 5 metres tall, natural or planted, leaving out orchards and city parks.'),
    unit: msg('% of land'), value: msg('{v}%'), style: 'number', digits: 1,
    main: { code: 'wdi:AG.LND.FRST.ZS', source: 'wdi' }, map: { code: 'wdi:AG.LND.FRST.ZS' }, credit: 'FAO, via the World Bank', by: 'FAO',
  },
];

export const indicatorSpec = (slug: string) => INDICATORS.find(s => s.slug === slug);

/** Yearly values from a first year: values[i] is year from + i, null where the source has none. */
export type Yearly = [from: number, values: (number | null)[]];

/**
 * What the copy says about one series, worked out by the builder. Points are [year, value]. `rank` is
 * [place, of how many] among the countries with a value in the metric's `rankYear` (IndicatorMeta), highest first;
 * `world` is the World's value in `last`'s year; `proj` the last projected year, its value and its range.
 */
export interface IndicatorFacts {
  n: number;
  first: [number, number];
  last: [number, number];
  max: [number, number];
  min: [number, number];
  /** With how many share the place, where more than one does. */
  rank?: [number, number] | [number, number, number];
  world?: number;
  proj?: [number, number] | [number, number, number, number];
  /** The first point of `earlier` or `longRun`. */
  before?: [number, number];
}

/** One country's series for one indicator. */
export interface IndicatorSeries {
  /** `main`: estimates or measurements, or a model's run where the spec is `modelled`. */
  e: Yearly;
  /** `model`'s run beside the measurements. */
  m?: Yearly;
  /** The projection and its range. */
  p?: Yearly;
  lo?: Yearly;
  hi?: Yearly;
  /** `earlier` or `longRun`, from its `since`. */
  l?: Yearly;
  /** Years of `e` the source gives as its own estimate, and as highly uncertain (`marks`). */
  est?: number[];
  unc?: number[];
  f: IndicatorFacts;
}

export interface IndicatorRow {
  cc: string;
  /** The country's shape on History's map (countries.json `id`), for its chart. */
  key?: string;
  m: Record<string, IndicatorSeries>;
}

export interface IndicatorMetricMeta {
  /** The latest year in which at least half the countries with this metric have a value; ranks are for it. */
  rankYear?: number;
  ranked?: number;
  /** As history.db names the source and its licence. */
  source: string;
  licence: string;
  /** The World's series, for the comparison line: estimates and projection, no range. */
  world?: { e: Yearly; p?: Yearly; m?: Yearly };
}

export interface IndicatorMeta {
  /** The year counted to: a page is indexed only if its latest point is recent against it. */
  year: number;
  metrics: Record<string, IndicatorMetricMeta>;
}

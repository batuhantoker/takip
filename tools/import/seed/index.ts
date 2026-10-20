import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOREVER_LO } from '@takip/core/time';
import type { EventKindInput } from '@takip/db';
import { batched, type Ctx, REPO, sourceId } from '../context';
import { readCsv } from '../csv';
import { normName } from '../names';
import { KEY_SCHEME, Resolver } from '../resolver';

const here = (f: string) => join(REPO, 'tools/import/seed', f);

/** High ids so they never collide with the fixed ids catalog.db migrations hand out. */
const SCHEMES: [number, string][] = [
  [1000, KEY_SCHEME],
  [1001, 'native:gtd'],
  [1003, 'unesco'],
  [1004, 'glwd'],
];

/*
 * Licence terms are mostly unverified (docs/data-sources.md). Per the standing rule, every source is visible to every
 * tier while terms are pending; can_export stays 0. GTD is non-commercial and forbids redistribution; GLWD v1 is
 * free for non-commercial use; the Kaggle compilations (WAC, trade war, IQ) state no licence.
 */
export const LICENCES = [
  { code: 'cc-by-4.0', name: 'Creative Commons Attribution 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', commercial: null, redistribution: 'attribution' },
  { code: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', commercial: null, redistribution: 'share_alike' },
  { code: 'cc-by-3.0-igo', name: 'Creative Commons Attribution 3.0 IGO', url: 'https://creativecommons.org/licenses/by/3.0/igo/', commercial: 1, redistribution: 'attribution' },
  { code: 'cc-by-sa-3.0-igo', name: 'Creative Commons Attribution-ShareAlike 3.0 IGO', url: 'https://creativecommons.org/licenses/by-sa/3.0/igo/', commercial: null, redistribution: 'share_alike' },
  { code: 'cow-terms', name: 'Correlates of War: free use with citation', url: 'https://correlatesofwar.org/data-sets/', commercial: null, redistribution: 'attribution' },
  { code: 'gtd-terms', name: 'GTD terms of use: non-commercial, no redistribution', url: 'https://www.start.umd.edu/gtd/terms-of-use/', commercial: 0, redistribution: 'none' },
  { code: 'glwd-terms', name: 'GLWD: free for non-commercial use', url: 'https://www.worldwildlife.org/pages/global-lakes-and-wetlands-database', commercial: 0, redistribution: 'attribution' },
  // "Reuse and adaptation encouraged for scholarly work; commercial use strictly prohibited; inform the authors of changes."
  { code: 'stanford-shl-nc', name: 'Stanford Spatial History Lab: scholarly reuse, no commercial use', url: 'https://web.stanford.edu/group/spatialhistory/static/publications/pub51.html', commercial: 0, redistribution: 'attribution' },
  { code: 'gpl-3.0', name: 'GNU General Public License v3.0', url: 'https://www.gnu.org/licenses/gpl-3.0.html', commercial: 1, redistribution: 'share_alike' },
  { code: 'cc0-1.0', name: 'Creative Commons CC0 1.0 (public domain dedication)', url: 'https://creativecommons.org/publicdomain/zero/1.0/', commercial: 1, redistribution: 'public_domain' },
  { code: 'odbl-1.0', name: 'Open Data Commons Open Database License 1.0', url: 'https://opendatacommons.org/licenses/odbl/1-0/', commercial: 1, redistribution: 'share_alike' },
  { code: 'unknown', name: 'No licence stated', url: null, commercial: null, redistribution: 'unknown' },
  { code: 'oecd-terms', name: 'OECD terms: any use, commercial included, with attribution carried into sub-licences', url: 'https://www.oecd.org/en/about/terms-conditions.html', commercial: 1, redistribution: 'attribution' },
  { code: 'imf-terms', name: 'IMF copyright and terms: attribution; commercial reuse and systematic download need written permission', url: 'https://www.imf.org/en/About/copyright-and-terms', commercial: 0, redistribution: 'attribution' },
  // Charts and citations need only the credit line; reproducing over 10% of a dataset, or any commercial use, needs SIPRI's permission.
  {
    code: 'sipri-terms', name: 'SIPRI terms; commercial use needs authorisation', url: 'https://www.sipri.org/databases/terms', commercial: 0, redistribution: 'display',
    attribution: 'Information from the Stockholm International Peace Research Institute (SIPRI) Military Expenditure Database, https://doi.org/10.55163/CQGC9685',
  },
  // GVP's terms page: personal, educational and other non-commercial use, crediting the Smithsonian; www.si.edu/termsofuse 403s to scripts. Agreement pending.
  {
    code: 'smithsonian-terms', name: 'Smithsonian terms of use: personal, educational and non-commercial use, with credit', url: 'https://volcano.si.edu/gvp_termsofuse.cfm', commercial: 0, redistribution: 'attribution',
    attribution: 'Global Volcanism Program, Smithsonian Institution: Volcanoes of the World v5.3, https://doi.org/10.5479/si.GVP.VOTW5-2025.5.3',
  },
  // PA-X terms of use (v1, 2023): CC BY-NC-SA 4.0, research/teaching use, no fee and no commercial use, no re-use of the database
  // whole or a substantial part as a similar database, and data produced from it should be notified to peacerep@ed.ac.uk.
  {
    code: 'pax-terms', name: 'PA-X terms of use: CC BY-NC-SA 4.0, non-commercial, no wholesale re-use of the database', url: 'https://www.peaceagreements.org/media/documents/Terms_of_Use.pdf', commercial: 0, redistribution: 'share_alike',
    attribution: 'PA-X Peace Agreements Database v10 (Bell & Badanjak 2019), www.peaceagreements.org; copyright and database right University of Edinburgh',
  },
  // SlaveVoyages' Legal page: data from historical documents is public domain; imputed data (the site's asterisked
  // variables, which place, date and count most voyages here) is CC BY-NC 3.0 US. Cite the database, year and site.
  {
    code: 'slavevoyages-terms', name: 'SlaveVoyages: historical data public domain, imputed data CC BY-NC 3.0 US', url: 'https://creativecommons.org/licenses/by-nc/3.0/us/', commercial: 0, redistribution: 'attribution',
  },
] as const;

type SourceSeed = { code: string; name: string; owner: string; url?: string; licence: string; events?: boolean; attribution?: string };

export const SOURCES: SourceSeed[] = [
  { code: 'naturalearth', name: 'Natural Earth admin-0', owner: 'Natural Earth', url: 'https://www.naturalearthdata.com/', licence: 'public-domain' },
  { code: 'takip-seed', name: 'TAKIP code crosswalk and aliases', owner: 'TAKIP', licence: 'public-domain' },
  { code: 'wac1914', name: 'Global Wars & Armed Conflicts, 1914–2026', owner: 'Kaggle compilation', licence: 'unknown', events: true },
  { code: 'cow-interstate', name: 'COW Inter-State War Data v4.0', owner: 'Correlates of War Project', url: 'https://correlatesofwar.org/data-sets/cow-war/', licence: 'cow-terms', events: true },
  { code: 'cow-extra', name: 'COW war list: rows added by the compiler', owner: 'Kaggle compilation', licence: 'unknown', events: true },
  { code: 'cow-territorial', name: 'COW Territorial Change v6', owner: 'Correlates of War Project', url: 'https://correlatesofwar.org/data-sets/territorial-change/', licence: 'cow-terms', events: true },
  { code: 'icow', name: 'ICOW Territorial Claims 1816–2001', owner: 'Issue Correlates of War', url: 'http://www.paulhensel.org/icowterr.html', licence: 'cow-terms', events: true },
  { code: 'ucdp-brd', name: 'UCDP Battle-Related Deaths', owner: 'Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/downloads/', licence: 'cc-by-4.0', events: true },
  { code: 'gtd', name: 'Global Terrorism Database', owner: 'START, University of Maryland', url: 'https://www.start.umd.edu/gtd/', licence: 'gtd-terms', events: true },
  { code: 'ww1-wiki', name: 'World War I battles (Wikipedia)', owner: 'Wikipedia contributors', url: 'https://en.wikipedia.org/', licence: 'cc-by-sa-4.0', events: true },
  { code: 'wdi', name: 'World Development Indicators', owner: 'World Bank', url: 'https://datacatalog.worldbank.org/', licence: 'cc-by-4.0' },
  { code: 'owid-conflict', name: 'OWID: deaths in ongoing conflicts', owner: 'Our World in Data', url: 'https://ourworldindata.org/war-and-peace', licence: 'cc-by-4.0' },
  { code: 'owid-le', name: 'OWID: life expectancy at different ages', owner: 'Our World in Data', url: 'https://ourworldindata.org/life-expectancy', licence: 'cc-by-4.0' },
  { code: 'owid-le-hmd', name: 'OWID: life expectancy (HMD + UN WPP)', owner: 'Our World in Data', url: 'https://ourworldindata.org/life-expectancy', licence: 'cc-by-4.0' },
  { code: 'owid-edu', name: 'OWID: global education', owner: 'Our World in Data', url: 'https://ourworldindata.org/global-education', licence: 'cc-by-4.0' },
  { code: 'owid-water', name: 'OWID: safely managed drinking water', owner: 'Our World in Data', url: 'https://ourworldindata.org/water-access', licence: 'cc-by-4.0' },
  { code: 'owid-mental', name: 'OWID: mental health', owner: 'Our World in Data', url: 'https://ourworldindata.org/mental-health', licence: 'cc-by-4.0' },
  { code: 'iq-2023', name: 'International IQ (2023 compilation)', owner: 'Kaggle compilation', licence: 'unknown' },
  { code: 'unesco-whc', name: 'UNESCO World Heritage List 2021', owner: 'UNESCO World Heritage Centre', url: 'https://whc.unesco.org/en/syndication', licence: 'cc-by-sa-3.0-igo' },
  { code: 'glwd', name: 'Global Lakes and Wetlands Database, level 1', owner: 'WWF / University of Kassel', url: 'https://www.worldwildlife.org/pages/global-lakes-and-wetlands-database', licence: 'glwd-terms' },
  { code: 'ww2-borders', name: 'European Borders, World War II (1938–1945)', owner: 'Stanford Spatial History Lab (M. De Groot)', url: 'https://web.stanford.edu/group/spatialhistory/static/publications/pub51.html', licence: 'stanford-shl-nc', events: true },
  { code: 'owid-covid', name: 'OWID: COVID-19 cases, deaths and vaccinations (weekly)', owner: 'World Health Organization via Our World in Data', url: 'https://ourworldindata.org/coronavirus', licence: 'cc-by-4.0' },
  { code: 'noaa-hazards', name: 'NCEI significant earthquakes, tsunamis and volcanic eruptions', owner: 'NOAA National Centers for Environmental Information', url: 'https://www.ngdc.noaa.gov/hazel/', licence: 'public-domain', events: true },
  { code: 'wikidata-battles', name: 'Wikidata: battles and sieges', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q178561', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-politics', name: 'Wikidata: treaties and coups', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q131569', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-attacks', name: 'Wikidata: terrorist attacks outside GTD’s years', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q2223653', licence: 'cc0-1.0', events: true },
  { code: 'wpp-2024', name: 'UN World Population Prospects 2024 (estimates 1950–2023, projections to 2100)', owner: 'UN DESA, Population Division', url: 'https://population.un.org/wpp/', licence: 'cc-by-3.0-igo' },
  { code: 'wup-2025', name: 'UN World Urbanization Prospects 2025 (estimates 1950–2025, projections to 2050)', owner: 'UN DESA, Population Division', url: 'https://population.un.org/wup/', licence: 'cc-by-3.0-igo' },
  // CC0 per the IDB API's metadata; API users must also say it "uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau".
  { code: 'census-idb', name: 'US Census Bureau International Database (December 2025)', owner: 'U.S. Census Bureau', url: 'https://www.census.gov/programs-surveys/international-programs/about/idb.html', licence: 'cc0-1.0' },
  { code: 'wb-gep', name: 'World Bank Global Economic Prospects (June 2026)', owner: 'World Bank Group', url: 'https://www.worldbank.org/en/publication/global-economic-prospects', licence: 'cc-by-4.0' },
  { code: 'oecd-lt-eo117', name: 'OECD Economic Outlook 117 long-term scenarios', owner: 'OECD Economics Department', url: 'https://www.oecd.org/en/data/datasets/long-term-baseline-projections.html', licence: 'oecd-terms' },
  // Shown for personal use while commercial reuse waits on the IMF's written permission (copyright@imf.org).
  { code: 'imf-weo', name: 'IMF World Economic Outlook (October 2026)', owner: 'International Monetary Fund', url: 'https://data.imf.org/en/datasets/IMF.RES:WEO', licence: 'imf-terms' },
  // CCKP's metadata page: "All CCKP data adhere to CC-BY 4.0" (the AWS registry's ODbL listing is not the portal's own).
  { code: 'wb-cckp', name: 'World Bank Climate Change Knowledge Portal (CMIP6 models 1950–2100, ERA5 observed 1950–2025)', owner: 'World Bank Group', url: 'https://climateknowledgeportal.worldbank.org/', licence: 'cc-by-4.0' },
  { code: 'wikidata-wars', name: 'Wikidata: wars and rebellions', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q198', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-revolutions', name: 'Wikidata: revolutions and assassinations', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q10931', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-massacres', name: 'Wikidata: massacres and genocides', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q3199915', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-displacements', name: 'Wikidata: expulsions and deportations', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q837556', licence: 'cc0-1.0', events: true },
  // SIPRI report (Bergkvist and Ferm, 2000) via TidyTuesday; no licence stated, shown while terms are pending.
  { code: 'sipri-nuclear', name: 'Nuclear explosions 1945–1998', owner: 'SIPRI / FOA, via TidyTuesday', url: 'https://github.com/rfordatascience/tidytuesday/tree/master/data/2019/2019-08-20', licence: 'unknown', events: true },
  { code: 'owid-longrun', name: 'OWID: long-run country indicators (Maddison, V-Dem, Gapminder, UNESCO, GCB)', owner: 'Our World in Data', url: 'https://ourworldindata.org/', licence: 'cc-by-4.0' },
  { code: 'cliopatria', name: 'Cliopatria: world polities 3400 BCE – 2024', owner: 'Seshat Global History Databank', url: 'https://github.com/Seshat-Global-History-Databank/cliopatria', licence: 'cc-by-4.0' },
  // NASA's catalogue: "openly shared, without restriction"; the codebook asks for a citation of the data descriptor.
  { code: 'gdis', name: 'Geocoded Disasters (GDIS) 1960–2018', owner: 'Rosvold & Buhaug (PRIO), NASA SEDAC; disasters from EM-DAT (CRED)', url: 'https://doi.org/10.7927/zz3b-8y61', licence: 'cc-by-4.0', events: true },
  { code: 'us-counties', name: 'US counties: 2024 boundaries, gazetteer and population estimates', owner: 'US Census Bureau', url: 'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html', licence: 'public-domain' },
  { code: 'us-places', name: 'US places: 2024 boundaries, gazetteer and population estimates for incorporated places and CDPs', owner: 'US Census Bureau', url: 'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html', licence: 'public-domain' },
  { code: 'deflock-alpr', name: 'Licence-plate readers mapped on OpenStreetMap', owner: 'OpenStreetMap contributors, via DeFlock', url: 'https://deflock.me', licence: 'odbl-1.0' },
  { code: 'sipri-milex', name: 'SIPRI Military Expenditure Database', owner: 'Stockholm International Peace Research Institute (SIPRI)', url: 'https://www.sipri.org/databases/milex', licence: 'sipri-terms' },
  // COW asks users to give the version number and cite Singer, Bremer & Stuckey (1972).
  { code: 'cow-nmc', name: 'COW National Material Capabilities v7.0', owner: 'Correlates of War Project', url: 'https://correlatesofwar.org/data-sets/national-material-capabilities/', licence: 'cow-terms' },
  { code: 'wikidata-disasters', name: 'Wikidata: famines, epidemics and fires', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q168247', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-unrest', name: 'Wikidata: riots, protests, strikes and revolts', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q124757', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-accidents', name: 'Wikidata: air, rail, road, mining and industrial accidents', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q744913', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-operations', name: 'Wikidata: military operations, raids and air strikes', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q645883', licence: 'cc0-1.0', events: true },
  { code: 'wikidata-crimes', name: 'Wikidata: shootings and murders', owner: 'Wikidata contributors', url: 'https://www.wikidata.org/wiki/Q132821', licence: 'cc0-1.0', events: true },
  // The live WFS layer, newer than the v5.3.1 the DOI names (current eruptions run to March 2026).
  { code: 'gvp-eruptions', name: 'Smithsonian GVP Volcanoes of the World: Holocene eruptions', owner: 'Global Volcanism Program, Smithsonian Institution', url: 'https://doi.org/10.5479/si.GVP.VOTW5-2025.5.3', licence: 'smithsonian-terms', events: true },
  // Outbreaks someone recorded, not every outbreak: Roosen & Curtis (2018) find France over-represented and some places imprecise.
  { code: 'plague-outbreaks', name: 'Plague outbreaks 1347–1900 by town (Biraben’s list, digitised by Büntgen et al. 2012)', owner: 'Büntgen et al. 2012, WSL; data from J.-N. Biraben (1975–76)', url: 'https://doi.org/10.16904/envidat.181', licence: 'odbl-1.0', events: true },
  // GCAT is CC BY and asks for the credit 'data from GCAT (J. McDowell, planet4589.org/space/gcat)', so the name carries it.
  { code: 'gcat-launches', name: 'GCAT launch log (J. McDowell, planet4589.org/space/gcat)', owner: 'Jonathan C. McDowell', url: 'https://planet4589.org/space/gcat/', licence: 'cc-by-4.0', events: true },
  { code: 'cneos-fireballs', name: 'CNEOS fireball and bolide reports', owner: 'NASA JPL Center for Near Earth Object Studies', url: 'https://cneos.jpl.nasa.gov/fireballs/', licence: 'public-domain', events: true },
  { code: 'epica', name: 'EPICA v1.1, European preinstrumental earthquakes 1000–1899 (Rovida & Antonucci 2021)', owner: 'INGV', url: 'https://doi.org/10.13127/epica.1.1', licence: 'cc-by-4.0', events: true },
  // No licence stated; the page asks for the citation "J. Strauss, A. I. Wilson, M. Flohr (2017). OxREP Shipwrecks Database. Version 2.1".
  { code: 'oxrep-shipwrecks', name: 'OxREP Shipwrecks Database v2.1 (Strauss, Wilson & Flohr 2017)', owner: 'Oxford Roman Economy Project', url: 'https://oxrep.web.ox.ac.uk/shipwrecks-database', licence: 'unknown', events: true },
  // Cline asks for the citation: Peyton, Bajjalieh, Martin & Gerald (2026), Cline Center Coup d'État Project Dataset v2.2.2, doi:10.13012/B2IDB-9651987_V10.
  { code: 'cline-coups', name: 'Cline Center Coup d’État Project v2.2.2', owner: 'Cline Center for Advanced Social Research, University of Illinois', url: 'https://doi.org/10.13012/B2IDB-9651987_V10', licence: 'cc-by-4.0', events: true },
  { code: 'pax', name: 'PA-X Peace Agreements Database v10', owner: 'PeaceRep, University of Edinburgh', url: 'https://www.peaceagreements.org/', licence: 'pax-terms', events: true },
  { code: 'ibtracs', name: 'IBTrACS v04r01: tropical cyclone best tracks since 1842', owner: 'NOAA National Centers for Environmental Information', url: 'https://doi.org/10.25921/82ty-9e16', licence: 'public-domain', events: true },
  { code: 'mass-mobilization', name: 'Mass Mobilization Project v5.1: protests against governments, 1990–2020 (Clark & Regan)', owner: 'David Clark and Patrick Regan', url: 'https://doi.org/10.7910/DVN/HTTWYL', licence: 'cc0-1.0', events: true },
  { code: 'slave-voyages', name: 'The Trans-Atlantic Slave Trade Database (2019), SlaveVoyages, slavevoyages.org', owner: 'SlaveVoyages Consortium', url: 'https://www.slavevoyages.org/voyage/database', licence: 'slavevoyages-terms', events: true },
  { code: 'slave-voyages-intra', name: 'The Intra-American Slave Trade Database (1.0), SlaveVoyages, slavevoyages.org', owner: 'SlaveVoyages Consortium', url: 'https://www.slavevoyages.org/voyage/database', licence: 'slavevoyages-terms', events: true },
  // One per language: the Events sections of each year page, and English's Current events days.
  ...([['en', 'English'], ['tr', 'Turkish'], ['de', 'German'], ['fr', 'French'], ['ru', 'Russian'], ['es', 'Spanish'], ['ar', 'Arabic'], ['fa', 'Persian'], ['zh', 'Chinese'], ['ja', 'Japanese']] as const).map(([lang, name]) => ({
    code: `wikipedia-years-${lang}`, name: `Wikipedia year pages (${name}), by Wikipedia contributors`, owner: 'Wikipedia contributors', url: `https://${lang}.wikipedia.org/`, licence: 'cc-by-sa-4.0', events: true,
  })),
];

const TIERS = ['anon', 'free', 'paid', 'internal'] as const;

/** Event kinds for every source in the design, so live and imported writers agree on codes and families. */
export const KINDS: EventKindInput[] = [
  { code: 'war', family: 'conflict' },
  { code: 'war.interstate', family: 'conflict', parent: 'war' },
  { code: 'war.civil', family: 'conflict', parent: 'war' },
  { code: 'war.world', family: 'conflict', parent: 'war' },
  { code: 'war.independence', family: 'conflict', parent: 'war' },
  { code: 'conflict.armed', family: 'conflict' },
  { code: 'battle', family: 'conflict' },
  { code: 'attack.terror', family: 'terror' },
  { code: 'claim.territorial', family: 'territorial' },
  { code: 'change.territorial', family: 'territorial' },
  { code: 'econ.tariff', family: 'econ' },
  { code: 'status.in_danger', family: 'heritage' },
  { code: 'hazard.quake', family: 'hazard' },
  { code: 'hazard.fire', family: 'hazard' },
  { code: 'alert.weather', family: 'alert' },
  { code: 'outage.internet', family: 'cyber' },
  { code: 'cyber.c2', family: 'cyber' },
  { code: 'news.report', family: 'news' },
  { code: 'gdelt.event', family: 'news' },
  { code: 'battle.siege', family: 'conflict', parent: 'battle' },
  { code: 'hazard.tsunami', family: 'hazard' },
  { code: 'hazard.volcano', family: 'hazard' },
  { code: 'politics.treaty', family: 'politics' },
  { code: 'politics.coup', family: 'politics' },
  { code: 'politics.revolution', family: 'politics' },
  { code: 'politics.assassination', family: 'politics' },
  { code: 'conflict.rebellion', family: 'conflict' },
  { code: 'conflict.massacre', family: 'conflict' },
  { code: 'conflict.genocide', family: 'conflict' },
  { code: 'conflict.pogrom', family: 'conflict' },
  { code: 'conflict.expulsion', family: 'conflict' },
  { code: 'nuclear.test', family: 'nuclear' },
  { code: 'nuclear.combat', family: 'nuclear' },
  // Where a disaster struck (EM-DAT's affected places), as opposed to hazard.*, the physical event.
  { code: 'disaster.flood', family: 'disaster' },
  { code: 'disaster.storm', family: 'disaster' },
  { code: 'disaster.temperature', family: 'disaster' },
  { code: 'disaster.drought', family: 'disaster' },
  { code: 'disaster.quake', family: 'disaster' },
  { code: 'disaster.landslide', family: 'disaster' },
  { code: 'disaster.mass_movement', family: 'disaster' },
  { code: 'disaster.volcano', family: 'disaster' },
  // Wikidata's famines, epidemics, fires and accidents: one event at its own place, not the places a hazard hit.
  { code: 'disaster.famine', family: 'disaster' },
  { code: 'disaster.epidemic', family: 'disaster' },
  { code: 'disaster.fire', family: 'disaster' },
  { code: 'disaster.wildfire', family: 'disaster' },
  { code: 'accident.aviation', family: 'disaster' },
  { code: 'accident.rail', family: 'disaster' },
  { code: 'accident.road', family: 'disaster' },
  { code: 'accident.mining', family: 'disaster' },
  { code: 'accident.explosion', family: 'disaster' },
  { code: 'accident.crowd', family: 'disaster' },
  { code: 'accident.industrial', family: 'disaster' },
  { code: 'politics.riot', family: 'politics' },
  { code: 'politics.protest', family: 'politics' },
  { code: 'politics.strike', family: 'politics' },
  { code: 'battle.operation', family: 'conflict', parent: 'battle' },
  { code: 'crime.shooting', family: 'crime' },
  { code: 'crime.murder', family: 'crime' },
  { code: 'hazard.fireball', family: 'hazard' },
  { code: 'accident.shipwreck', family: 'disaster' },
  { code: 'space.launch', family: 'space' },
  { code: 'space.suborbital', family: 'space' },
  { code: 'missile.test', family: 'missile' },
  // Cline's unrealized coups: action taken that failed, and plots stopped before any attempt.
  { code: 'politics.coup.attempt', family: 'politics', parent: 'politics.coup' },
  { code: 'politics.coup.conspiracy', family: 'politics', parent: 'politics.coup' },
  // PA-X: ceasefires, framework and implementation texts, joint statements; most are not treaties.
  { code: 'politics.peace_agreement', family: 'politics' },
  // A tropical cyclone's track (IBTrACS), placed at its peak.
  { code: 'hazard.storm', family: 'hazard' },
  // A slave-trade voyage (SlaveVoyages), placed where the captives were bought; the port sequence is its geom.
  { code: 'slavery.voyage', family: 'slavery' },
  // A dated event from a Wikipedia year page whose linked article has no class TAKIP maps to a kind.
  { code: 'event.general', family: 'events' },
];

export const ROLES = [
  'participant', 'side_a', 'side_b', 'supporter', 'initiator', 'location', 'perpetrator', 'target', 'target_nationality',
  'gaining', 'losing', 'imposing', 'targeted', 'claimant', 'subject',
];

const DEPENDENCIES = new Set(
  'MNP VIR GUM ASM PRI SGS IOT SHN PCN AIA FLK CYM BMU VGB TCA MSR JEY GGY IMN NIU COK ABW CUW SPM WLF MAF BLM PYF NCL ATF ALD GRL FRO MAC HKG HMD NFK SXM IOA ATC'.split(' '),
);
const DISPUTED = new Set('SOL CYN SAH KOS PSX KAS ATA'.split(' '));
/** Shapes that carry another polity's codes in countries.json. */
const NO_CODES = new Set(['IOA', 'ATC']);

const date = (s: string) => (s ? Date.parse(`${s}T00:00:00Z`) : null);

type Feature = { properties: { id: string; name: string; iso2?: string; iso3?: string; label: [number, number] } };

export async function seed(ctx: Ctx) {
  const db = ctx.catalog;
  db.prepare(`UPDATE core_id_scheme SET code = ? WHERE scheme_id = 1000 AND code = 'osiris'`).run(KEY_SCHEME);
  db.prepare(`UPDATE meta_source SET code = 'takip-seed' WHERE code = 'osiris-seed'`).run();
  const ins = db.prepare(`INSERT OR IGNORE INTO core_id_scheme (scheme_id, code) VALUES (?, ?)`);
  for (const [id, code] of SCHEMES) ins.run(id, code);

  db.transaction(() => {
    const lic = db.prepare(`
      INSERT INTO meta_licence (code, name, url, commercial_use, redistribution, attribution) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (code) DO UPDATE SET name = excluded.name, url = excluded.url, commercial_use = excluded.commercial_use,
        redistribution = excluded.redistribution, attribution = excluded.attribution
    `);
    for (const l of LICENCES) lic.run(l.code, l.name, l.url, l.commercial, l.redistribution, 'attribution' in l ? l.attribution : null);
    const src = db.prepare(`
      INSERT INTO meta_source (code, name, owner, url, licence_id, delivery, event_table)
      VALUES (?, ?, ?, ?, (SELECT licence_id FROM meta_licence WHERE code = ?), 'bulk', ?)
      ON CONFLICT (code) DO UPDATE SET name = excluded.name, owner = excluded.owner, url = excluded.url,
        licence_id = excluded.licence_id, event_table = excluded.event_table
    `);
    for (const s of SOURCES) src.run(s.code, s.name, s.owner, s.url ?? null, s.licence, s.events ? 'event' : null);
    const policy = db.prepare(`
      INSERT OR IGNORE INTO meta_access_policy (tier, licence_id, can_view, can_export)
      SELECT ?, licence_id, 1, 0 FROM meta_licence WHERE code = ?
    `);
    for (const l of LICENCES) for (const t of TIERS) policy.run(t, l.code);
  })();

  ctx.events.ensureKinds(KINDS);
  ctx.events.ensureRoles(ROLES);

  const ne = sourceId(ctx, 'naturalearth');
  const seedSrc = sourceId(ctx, 'takip-seed');
  const r = new Resolver(ctx);
  const polityType = r.typeId('polity');
  const keyScheme = r.schemeId(KEY_SCHEME);
  const now = Date.now();

  const newEntity = db.prepare(`INSERT INTO core_entity (type_id, name, lon, lat, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING entity_id`).pluck();
  const updEntity = db.prepare(`UPDATE core_entity SET name = ?, lon = ?, lat = ?, updated_at = ? WHERE entity_id = ? AND (name IS NOT ? OR lon IS NOT ? OR lat IS NOT ?)`);
  const polity = db.prepare(`
    INSERT INTO core_polity (entity_id, kind, valid_lo, valid_hi) VALUES (?, ?, ?, ?)
    ON CONFLICT (entity_id) DO UPDATE SET kind = excluded.kind, valid_lo = excluded.valid_lo, valid_hi = excluded.valid_hi
  `);
  const ident = db.prepare(`
    INSERT INTO core_entity_identifier (scheme_id, value, valid_lo, valid_hi, entity_id, source_id) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (scheme_id, value, valid_lo) DO UPDATE SET valid_hi = excluded.valid_hi, entity_id = excluded.entity_id, source_id = excluded.source_id
  `);
  const hasName = db.prepare(`SELECT 1 FROM core_entity_name WHERE entity_id = ? AND norm = ? AND valid_lo = ? AND valid_hi IS ?`).pluck();
  const name = db.prepare(`INSERT INTO core_entity_name (entity_id, name, norm, kind, valid_lo, valid_hi, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const addName = (entityId: number, n: string, kind: string, lo: number, hi: number | null, src: number) => {
    if (!hasName.get(entityId, normName(n), lo, hi)) name.run(entityId, n, normName(n), kind, lo, hi, src);
  };

  const keys = new Map<string, number>();
  const upsertPolity = (key: string, n: string, lon: number, lat: number, kind: string, lo: number, hi: number | null, src: number) => {
    let id = r.key(key);
    if (id === undefined) {
      id = newEntity.get(polityType, n, lon, lat, now) as number;
      ident.run(keyScheme, key, FOREVER_LO, null, id, src);
    } else updEntity.run(n, lon, lat, now, id, n, lon, lat);
    polity.run(id, kind, lo, hi);
    addName(id, n, 'official', lo, hi, src);
    keys.set(key, id);
    return id;
  };

  const features = (JSON.parse(readFileSync(join(REPO, 'public/data/boundaries/countries.json'), 'utf8')) as { features: Feature[] }).features;
  batched(db, features, f => {
    const p = f.properties;
    const kind = DISPUTED.has(p.id) ? 'disputed' : DEPENDENCIES.has(p.id) ? 'dependency' : 'sovereign';
    const id = upsertPolity(p.id, p.name, p.label[0], p.label[1], kind, FOREVER_LO, null, ne);
    if (NO_CODES.has(p.id)) return;
    if (p.iso3) ident.run(r.schemeId('iso3'), p.iso3, FOREVER_LO, null, id, ne);
    if (p.iso2) ident.run(r.schemeId('iso2'), p.iso2, FOREVER_LO, null, id, ne);
  });

  const extra = await readCsv(here('polities.csv'));
  const render = db.prepare(`INSERT OR IGNORE INTO core_polity_render (polity_id, render_polity_id, valid_lo, valid_hi) VALUES (?, ?, ?, ?)`);
  const successor = db.prepare(`
    INSERT OR IGNORE INTO core_entity_link (from_id, rel_id, to_id, valid_lo, source_id)
    SELECT ?, rel_id, ?, ?, ? FROM core_link_rel WHERE code = 'successor_of'
  `);
  batched(db, extra, p => {
    const lo = date(p.from) ?? FOREVER_LO;
    const hi = date(p.to);
    const id = upsertPolity(p.key, p.name, Number(p.lon), Number(p.lat), p.kind, lo, hi, seedSrc);
    if (/^[A-Z]{3}$/.test(p.key)) ident.run(r.schemeId('iso3'), p.key, FOREVER_LO, null, id, seedSrc);
    for (const target of p.render ? p.render.split('|') : []) {
      const to = keys.get(target);
      if (to === undefined) throw new Error(`polities.csv: ${p.key} renders as unknown ${target}`);
      render.run(id, to, lo, hi);
      if (p.kind === 'historical' && hi !== null) successor.run(to, id, hi, seedSrc);
    }
  });

  const ids = await readCsv(here('identifiers.csv'));
  batched(db, ids, i => {
    const id = keys.get(i.key);
    if (id === undefined) throw new Error(`identifiers.csv: unknown key ${i.key} for ${i.scheme}:${i.value}`);
    ident.run(r.schemeId(i.scheme), i.value, date(i.from) ?? FOREVER_LO, date(i.to), id, seedSrc);
  });

  const aliases = await readCsv(here('aliases.csv'));
  batched(db, aliases, a => {
    const id = keys.get(a.key);
    if (id === undefined) throw new Error(`aliases.csv: unknown key ${a.key} for ${a.name}`);
    addName(id, a.name, 'alias', date(a.from) ?? FOREVER_LO, date(a.to), seedSrc);
  });

  r.reload();
  const world = r.region('world', 'World', seedSrc);
  const eu27 = r.region('eu27', 'European Union (27)', seedSrc);
  const international = r.region('international', 'International', seedSrc);
  const cis = r.region('cis', 'Commonwealth of Independent States', seedSrc);
  // Anchors for events whose only party is a group ("EU" or "ALL").
  db.prepare(`UPDATE core_entity SET lon = ?, lat = ? WHERE entity_id = ? AND lon IS NULL`).run(4.35, 50.85, eu27);
  db.transaction(() => {
    for (const n of ['Global', 'ALL', 'World (WB)']) addName(world, n, 'alias', FOREVER_LO, null, seedSrc);
    for (const n of ['EU', 'EU27', 'EU (27)', 'European Union']) addName(eu27, n, 'alias', FOREVER_LO, null, seedSrc);
    addName(international, 'Multinational', 'alias', FOREVER_LO, null, seedSrc);
    addName(cis, 'CIS', 'alias', FOREVER_LO, null, seedSrc);
    ident.run(r.schemeId('owid'), 'OWID_WRL', FOREVER_LO, null, world, seedSrc);
    ident.run(r.schemeId('wb'), 'WLD', FOREVER_LO, null, world, seedSrc);
    ident.run(r.schemeId('wb'), 'EUU', FOREVER_LO, null, eu27, seedSrc);
  })();

  const overlaps = checkOverlaps(ctx);
  if (overlaps.length) throw new Error(`overlapping identifier validity:\n${overlaps.join('\n')}`);
  ctx.log(`seed: ${features.length} admin-0 polities, ${extra.length} extra, ${ids.length} identifiers, ${aliases.length} aliases`);
}

/** Schemes the importers write; the worker's (mmsi, icao24, norad, …) are its own to check. */
const IMPORT_SCHEMES = [KEY_SCHEME, 'iso3', 'iso2', 'isonum', 'wb', 'cow', 'gw', 'gtd', 'owid', 'ucdp_actor', 'wac', 'ticker', 'iso4217', ...SCHEMES.map(([, c]) => c)];

/** db:check's identifier rule (§6): no two validity periods of one (scheme, value) may overlap. */
export function checkOverlaps(ctx: Ctx) {
  return (ctx.catalog.prepare(`
    SELECT s.code || ':' || a.value || ' ' || a.valid_lo || '..' || coalesce(a.valid_hi, '') || ' vs ' || b.valid_lo AS msg
    FROM core_entity_identifier a JOIN core_entity_identifier b ON a.scheme_id = b.scheme_id AND a.value = b.value AND a.valid_lo < b.valid_lo
    JOIN core_id_scheme s ON s.scheme_id = a.scheme_id
    WHERE coalesce(a.valid_hi, 8640000000000000) > b.valid_lo AND s.code IN (SELECT value FROM json_each(?))
  `).pluck().all(JSON.stringify([...new Set(IMPORT_SCHEMES)])) as string[]);
}


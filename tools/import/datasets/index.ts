import type { Ctx } from '../context';
import { importCowInterstate } from './cow';
import { importCowNmc } from './cow-nmc';
import { importCowTerritorial } from './cow-territorial';
import { importDeflock } from './deflock';
import { importAdmin0, importGlwd, importUnesco } from './geo';
import { importGtd } from './gtd';
import { importIcow } from './icow';
import {
  importIq,
  importOwidConflict,
  importOwidEducation,
  importOwidLifeExpectancy,
  importOwidLifeExpectancyHmd,
  importOwidLongRun,
  importOwidMental,
  importOwidWater,
} from './owid';
import { importSipri } from './sipri';
import { importUcdp } from './ucdp';
import { importWac1914 } from './wac1914';
import { importWdi } from './wdi';
import { importWpp } from './wpp';
import { importCckp } from './cckp';
import { importWup } from './wup';
import { importIdb } from './idb';
import { importGep } from './gep';
import { importImf } from './imf';
import { importOecdLt } from './oecd-lt';
import { importWw1 } from './ww1';
import { importNoaa } from './noaa';
import { importNuclear } from './nuclear';
import { importWikidataAttacks, importWikidataBattles, importWikidataPolitics } from './wikidata';
import { importWikidataMassacres, importWikidataRevolutions, importWikidataWars } from './wikidata-conflict';
import { importWikidataDisplacements } from './wikidata-displacement';
import { importWikidataAccidents, importWikidataCrimes, importWikidataDisasters, importWikidataOperations, importWikidataUnrest } from './wikidata-events';
import { importWw2Borders } from './ww2';
import { importOwidCovid } from './owid-covid';
import { importCliopatria } from './cliopatria';
import { importGdis } from './gdis';
import { importUsCounties } from './us-counties';
import { importUsPlaces } from './us-places';
import { importGcat } from './gcat';
import { importFireballs } from './fireballs';
import { importEpica } from './epica';
import { importOxrep } from './oxrep';
import { importGvp } from './gvp';
import { importPlague } from './plague';
import { importCline } from './cline';
import { importPax } from './pax';
import { importIbtracs } from './ibtracs';
import { importMassMobilization } from './mass-mobilization';
import { importSlaveVoyages, importSlaveVoyagesIntra } from './slave-voyages';
import { importWikipediaYears } from './wikipedia-years';

/**
 * Run order matters: later importers link to events earlier ones loaded (COW → WAC same_as, UCDP → WAC/COW,
 * COW territorial → WW2, WW1 → WAC part_of).
 */
export const DATASETS: Record<string, (ctx: Ctx) => Promise<void>> = {
  wac1914: importWac1914,
  'cow-interstate': importCowInterstate,
  'ww2-borders': importWw2Borders,
  'cow-territorial': importCowTerritorial,
  icow: importIcow,
  'ucdp-brd': importUcdp,
  gtd: importGtd,
  'ww1-wiki': importWw1,
  wdi: importWdi,
  'wpp-2024': importWpp,
  'wb-cckp': importCckp,
  'wup-2025': importWup,
  'census-idb': importIdb,
  'wb-gep': importGep,
  'imf-weo': importImf,
  'oecd-lt-eo117': importOecdLt,
  'sipri-milex': importSipri,
  'cow-nmc': importCowNmc,
  'owid-conflict': importOwidConflict,
  'owid-le': importOwidLifeExpectancy,
  'owid-le-hmd': importOwidLifeExpectancyHmd,
  'owid-edu': importOwidEducation,
  'owid-water': importOwidWater,
  'owid-mental': importOwidMental,
  'iq-2023': importIq,
  admin0: importAdmin0,
  'unesco-whc': importUnesco,
  glwd: importGlwd,
  'owid-covid': importOwidCovid,
  'wikidata-battles': importWikidataBattles,
  'wikidata-politics': importWikidataPolitics,
  'wikidata-attacks': importWikidataAttacks,
  // After the battles, which they link to, and in this order: each drops what the ones before hold.
  'wikidata-wars': importWikidataWars,
  'wikidata-revolutions': importWikidataRevolutions,
  'wikidata-massacres': importWikidataMassacres,
  'wikidata-displacements': importWikidataDisplacements,
  // After gtd, whose attacks the accidents and crimes leave alone; each drops the items the Wikidata files before it hold.
  'wikidata-disasters': importWikidataDisasters,
  'wikidata-unrest': importWikidataUnrest,
  'wikidata-accidents': importWikidataAccidents,
  'wikidata-operations': importWikidataOperations,
  'wikidata-crimes': importWikidataCrimes,
  'noaa-hazards': importNoaa,
  'sipri-nuclear': importNuclear,
  'owid-longrun': importOwidLongRun,
  cliopatria: importCliopatria,
  gdis: importGdis,
  'us-counties': importUsCounties,
  'us-places': importUsPlaces,
  // After us-counties and us-places: each reader in the US gets its county and place.
  'deflock-alpr': importDeflock,
  // After noaa-hazards, whose eruptions it links to.
  'gvp-eruptions': importGvp,
  'plague-outbreaks': importPlague,
  'gcat-launches': importGcat,
  'cneos-fireballs': importFireballs,
  // After noaa-hazards: its quakes link same_as to NOAA's.
  epica: importEpica,
  'oxrep-shipwrecks': importOxrep,
  // After wikidata-politics, whose coups and treaties they link same_as to, and pax after ucdp-brd, whose conflicts place it.
  'cline-coups': importCline,
  pax: importPax,
  ibtracs: importIbtracs,
  // After wikidata-unrest, whose protests, riots and strikes it links same_as to.
  'mass-mobilization': importMassMobilization,
  'slave-voyages': importSlaveVoyages,
  'slave-voyages-intra': importSlaveVoyagesIntra,
  // Last, so their bullets link same_as to every event loaded before; English first, so it leads the other languages.
  'wikipedia-years-en': importWikipediaYears('en'),
  'wikipedia-years-tr': importWikipediaYears('tr'),
  'wikipedia-years-de': importWikipediaYears('de'),
  'wikipedia-years-fr': importWikipediaYears('fr'),
  'wikipedia-years-ru': importWikipediaYears('ru'),
  'wikipedia-years-es': importWikipediaYears('es'),
  'wikipedia-years-ar': importWikipediaYears('ar'),
  'wikipedia-years-fa': importWikipediaYears('fa'),
  'wikipedia-years-zh': importWikipediaYears('zh'),
  'wikipedia-years-ja': importWikipediaYears('ja'),
};

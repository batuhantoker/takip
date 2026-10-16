import type { Ctx } from '../context';
import { importCowInterstate, importCowTerritorial } from './cow';
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
import { importUcdp } from './ucdp';
import { importWac1914 } from './wac1914';
import { importWdi } from './wdi';
import { importWw1 } from './ww1';
import { importNoaa } from './noaa';
import { importNuclear } from './nuclear';
import { importWikidataAttacks, importWikidataBattles, importWikidataPolitics } from './wikidata';
import { importWw2Borders } from './ww2';
import { importOwidCovid } from './owid-covid';
import { importCliopatria } from './cliopatria';
import { importGdis } from './gdis';
import { importWikidataMassacres, importWikidataRevolutions, importWikidataWars } from './wikidata-conflict';

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
  'noaa-hazards': importNoaa,
  'sipri-nuclear': importNuclear,
  'owid-longrun': importOwidLongRun,
  cliopatria: importCliopatria,
  gdis: importGdis,
};

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
  importOwidMental,
  importOwidWater,
} from './owid';
import { importTradewar } from './tradewar';
import { importUcdp } from './ucdp';
import { importWac1914 } from './wac1914';
import { importWdi } from './wdi';
import { importWw1 } from './ww1';

/** Run order matters: later importers link to events earlier ones loaded (COW → WAC same_as, WW1 → WAC part_of). */
export const DATASETS: Record<string, (ctx: Ctx) => Promise<void>> = {
  wac1914: importWac1914,
  'cow-interstate': importCowInterstate,
  'cow-territorial': importCowTerritorial,
  icow: importIcow,
  'ucdp-brd': importUcdp,
  gtd: importGtd,
  'ww1-wiki': importWw1,
  tradewar: importTradewar,
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
};

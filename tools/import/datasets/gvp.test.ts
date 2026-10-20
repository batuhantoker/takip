import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { Reporter } from '../context';
import { utc } from '../dates';
import { type GvpFeature, type GvpProps, gvpDate, gvpEvents, planNoaaLinks, uninvert } from './gvp';

const feature = (p: Partial<GvpProps>, at: number[] = [14.999, 37.748]): GvpFeature => ({
  geometry: { coordinates: at },
  properties: {
    Volcano_Number: 211060, Volcano_Name: 'Etna', Eruption_Number: 1, Activity_Type: 'Confirmed Eruption', ExplosivityIndexMax: 2,
    ExplosivityIndexModifier: null, ActivityArea: null, ActivityUnit: null, StartEvidenceMethod: 'Observations: Reported',
    StartDateYearModifier: null, StartDateYear: 1669, StartDateYearUncertainty: null, StartDateMonth: 3, StartDateDay: 11, StartDateDayUncertainty: null,
    EndDateYear: null, EndDateYearUncertainty: null, EndDateMonth: null, EndDateDay: null, EndDateDayUncertainty: null, ...p,
  },
});

const noaa = (id: number, year: number, month?: number, day?: number, gvp: number | null = 211060) =>
  ({ id, year, month, day, volcanoLocationNewNum: gvp, longitude: 15.0, latitude: 37.75 });

describe('gvpDate', () => {
  it("reads GVP's midpoint placeholders as the year or month they stand for", () => {
    expect(gvpDate(1690, 7, 2, 182)).toEqual({ t: utc(1690), prec: Prec.year });
    expect(gvpDate(1850, 12, 31, 365)).toEqual({ t: utc(1850), prec: Prec.year });
    expect(gvpDate(1902, 5, 16, 15)).toEqual({ t: utc(1902, 5), prec: Prec.month });
    expect(gvpDate(1699, 6, 29, null)).toEqual({ t: utc(1699, 6, 29), prec: Prec.day });
    expect(gvpDate(1690, 0, 0, null)).toEqual({ t: utc(1690), prec: Prec.year });
  });

  it('turns BCE into astronomical years and coarsens by the ± in years', () => {
    expect(new Date(gvpDate(-122, 0, 0, null)!.t).getUTCFullYear()).toBe(-121);
    expect(gvpDate(1765, 0, 0, null, 14)!.prec).toBe(Prec.decade);
    expect(gvpDate(-1610, null, null, null, 75)!.prec).toBe(Prec.century);
    expect(gvpDate(-7050, null, null, null, 500)!.prec).toBe(Prec.millennium);
    expect(gvpDate(1942, 0, 0, null, 2)!.prec).toBe(Prec.year);
    expect(gvpDate(null, 1, 1, null)).toBeNull();
  });
});

describe('gvpEvents', () => {
  it('builds an eruption with its end, VEI in attrs and no magnitude', () => {
    const rep = new Reporter();
    const [e] = gvpEvents([feature({ ExplosivityIndexMax: 3, EndDateYear: 1669, EndDateMonth: 7, EndDateDay: 11, ActivityArea: 'S flank' })], rep);
    expect(e).toMatchObject({ kind: 'hazard.volcano', sourceRecordId: 'er:1', title: 'Eruption of Etna', tStartPrec: Prec.day, tEndPrec: Prec.day, confidence: 1, lon: 14.999 });
    expect(e.tEnd).toBe(utc(1669, 7, 11));
    expect(e.magnitude).toBeUndefined();
    expect(e.attrs).toMatchObject({ vei: 3, vent: 'S flank', volcano_number: 211060, uncertain: null });
    expect(rep.rows).toBe(1);
  });

  it('marks uncertain eruptions, un-inverts names and rejects a missing point', () => {
    const rep = new Reporter();
    const events = gvpEvents([
      feature({ Activity_Type: 'Uncertain Eruption', Volcano_Name: 'Fournaise, Piton de la', StartDateYearModifier: '?', StartDateYearUncertainty: 50 }),
      { ...feature({ Eruption_Number: 2 }), geometry: null },
    ], rep);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: 'Uncertain eruption of Piton de la Fournaise', confidence: 0.5, tStartPrec: Prec.century });
    expect(events[0].attrs).toMatchObject({ uncertain: true, date_uncertainty: 'year uncertain, ± 50 years' });
    expect(rep.toJSON().rejects).toEqual([{ reason: 'no point', n: 1, sample: ['2'] }]);
    expect(uninvert('Sawad, Harra Es-')).toBe('Harra Es-Sawad');
    expect(uninvert('Etna')).toBe('Etna');
  });
});

describe('planNoaaLinks', () => {
  const short = feature({ Eruption_Number: 10, StartDateYear: 1902, StartDateMonth: 5, StartDateDay: 1, EndDateYear: 1902, EndDateMonth: 7, EndDateDay: 30 });

  it('makes one NCEI row in a short eruption the same event', () => {
    const plan = planNoaaLinks([short], [noaa(1, 1902, 5, 8)]);
    expect(plan.sameAs).toEqual([['er:10', 'vo:1']]);
    expect(plan.partOf).toEqual([]);
  });

  it('makes two NCEI rows in one eruption its parts, so neither hides the other', () => {
    const plan = planNoaaLinks([short], [noaa(1, 1902, 5, 8), noaa(2, 1902, 6, 20)]);
    expect(plan.sameAs).toEqual([]);
    expect(plan.partOf).toEqual([['vo:1', 'er:10'], ['vo:2', 'er:10']]);
  });

  it('makes an NCEI row in a ten-year eruption its part', () => {
    const long = feature({ Eruption_Number: 11, StartDateYear: 1770, StartDateMonth: 0, StartDateDay: 0, EndDateYear: 1779, EndDateMonth: 8, EndDateDay: 15 });
    const plan = planNoaaLinks([long], [noaa(1, 1779, 8, 8)]);
    expect(plan.partOf).toEqual([['vo:1', 'er:11']]);
  });

  it('prefers the eruption under way, matches BCE years alike and falls back to place', () => {
    const plan = planNoaaLinks([
      feature({ Eruption_Number: 20, StartDateYear: 1790, StartDateMonth: 0, StartDateDay: 0 }),
      feature({ Eruption_Number: 21, StartDateYear: 1790, StartDateMonth: 11, StartDateDay: 0 }),
      feature({ Eruption_Number: 22, StartDateYear: -197, StartDateMonth: null, StartDateDay: null }),
    ], [noaa(1, 1790, 12, 1), noaa(2, -197), noaa(3, 1950, undefined, undefined, null), noaa(4, -197, undefined, undefined, 999999)]);
    expect(plan.sameAs).toEqual([['er:21', 'vo:1']]);
    expect(plan.partOf).toEqual([['vo:2', 'er:22'], ['vo:4', 'er:22']]);
    expect(plan).toMatchObject({ byPlace: 1, noNumber: 2, unmatched: ['vo:3'] });
  });
});

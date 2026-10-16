import { describe, expect, it } from 'vitest';
import { LICENCES, SOURCES } from '../seed';
import { LAST_HISTORY, OECD_LT_METRICS, scenarioCode } from './oecd-lt';

describe('oecd-lt', () => {
  it('marks every year from 2024 as the scenario', () => {
    expect(LAST_HISTORY).toBe(2023);
  });

  it('keeps BAU1 as the main projection and the other scenarios beside it', () => {
    const gdp = OECD_LT_METRICS[0];
    expect(scenarioCode(gdp, 'BAU1')).toBe('oecd-lt:GDPVD_CAP.proj');
    expect(scenarioCode(gdp, 'ET4')).toBe('oecd-lt:GDPVD_CAP.proj.et4');
  });

  it('is seeded under the OECD’s data terms, which allow commercial use', () => {
    const source = SOURCES.find(s => s.code === 'oecd-lt-eo117');
    expect(LICENCES.find(l => l.code === source?.licence)?.commercial).toBe(1);
  });
});

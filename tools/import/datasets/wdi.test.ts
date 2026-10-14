import { describe, expect, it } from 'vitest';
import { isOpenLicence, noteYear, wdiUnit } from './wdi';

describe('wdi', () => {
  it('takes the unit from the trailing parenthetical, past qualifiers', () => {
    expect(wdiUnit('GDP (current US$)')).toBe('current US$');
    expect(wdiUnit('Foreign direct investment, net (BoP, current US$)')).toBe('current US$');
    expect(wdiUnit('Maternal mortality ratio (modeled estimate, per 100,000 live births)')).toBe('per 100,000 live births');
    expect(wdiUnit('Interest rate spread (lending rate minus deposit rate, %)')).toBe('%');
    expect(wdiUnit('Life expectancy at birth, total (years)')).toBe('years');
    expect(wdiUnit('Rail lines (total route-km)')).toBe('total route-km');
    expect(wdiUnit('Unemployment, total (% of total labor force) (modeled ILO estimate)')).toBe('% of total labor force');
    expect(wdiUnit('Overall level of statistical capacity (scale 0 - 100)')).toBe('scale 0 - 100');
    expect(wdiUnit('Carbon dioxide (CO2) emissions excluding LULUCF per capita (t CO2e/capita)')).toBe('t CO2e/capita');
  });

  it('leaves non-units and unparenthesised names alone', () => {
    expect(wdiUnit('Population, total')).toBeNull();
    expect(wdiUnit('Lifetime risk of maternal death (1 in: rate varies by country)')).toBeNull();
    expect(wdiUnit('Arms imports (SIPRI trend indicator values)')).toBeNull();
    expect(wdiUnit('Children (0-14) living with HIV')).toBeNull();
    expect(wdiUnit('School enrollment, primary (gross), gender parity index (GPI)')).toBeNull();
  });

  it('counts CC BY in any spelling as open, and other terms as not', () => {
    expect(isOpenLicence('CC BY-4.0')).toBe(true);
    expect(isOpenLicence('CC BY 3.0 IGO')).toBe(true);
    expect(isOpenLicence('Open')).toBe(true);
    expect(isOpenLicence('SIPRI terms and conditions')).toBe(false);
    expect(isOpenLicence('Restricted')).toBe(false);
    expect(isOpenLicence(undefined)).toBe(false);
  });

  it('reads note years in either case', () => {
    expect(noteYear('YR2012')).toBe(2012);
    expect(noteYear('yr1990')).toBe(1990);
    expect(noteYear('2012')).toBeNull();
  });
});

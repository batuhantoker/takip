import { describe, expect, it } from 'vitest';
import { parseCountryList, resolvePlace } from './places';

const codes = (p: { countries: { iso2: string }[] }) => p.countries.map(c => c.iso2);

describe('resolvePlace', () => {
  it('reads one country, with or without a leading article', () => {
    expect(resolvePlace('the Russian Federation')).toEqual({ countries: [{ iso2: 'RU', name: 'Russian Federation' }], unmatched: [] });
    expect(codes(resolvePlace('Bosnia and Herzegovina'))).toEqual(['BA']);
  });

  it('splits WHO-style lists on "&"', () => {
    expect(codes(resolvePlace('Democratic Republic of the Congo & Uganda'))).toEqual(['CD', 'UG']);
  });

  it('finds the country inside a sub-national phrase', () => {
    expect(resolvePlace('Ituri and Nord-Kivu Provinces of the Democratic Republic of the Congo'))
      .toEqual({ countries: [{ iso2: 'CD', name: 'Democratic Republic of the Congo' }], unmatched: [] });
  });

  it('skips regional scopes and reports unknown names', () => {
    for (const scope of ['Global', 'Global situation', 'Multi-country', 'Multi-locations', 'Sub-Saharan Africa', 'EU/EEA']) {
      expect(resolvePlace(scope)).toEqual({ countries: [], unmatched: [] });
    }
    expect(resolvePlace('Narnia')).toEqual({ countries: [], unmatched: ['Narnia'] });
  });
});

describe('parseCountryList', () => {
  it('reads the 2026-09-23 CDC polio list', () => {
    const list = "Afghanistan, Algeria, Benin, Cameroon, Chad, Côte d'Ivoire (Ivory Coast), Democratic Republic of the Congo, "
      + 'Niger, Nigeria, Pakistan, Somalia, Yemen, Sudan, Angola, Ethiopia, Republic of South Sudan, Djibouti, Germany, '
      + 'United Kingdom, including England, Scotland, Wales, and Northern Ireland, Papua New Guinea, Central African Republic, '
      + 'Tanzania, including Zanzibar, Laos, Namibia, Mali, Malawi, Zambia, Togo, Israel, the West Bank and Gaza';
    const out = parseCountryList(list);
    expect(out.unmatched).toEqual([]);
    expect(codes(out)).toEqual([
      'AF', 'DZ', 'BJ', 'CM', 'TD', 'CI', 'CD', 'NE', 'NG', 'PK', 'SO', 'YE', 'SD', 'AO', 'ET', 'SS', 'DJ', 'DE',
      'GB', 'PG', 'CF', 'TZ', 'LA', 'NA', 'ML', 'MW', 'ZM', 'TG', 'IL', 'PS',
    ]);
    expect(out.countries.find(c => c.iso2 === 'CI')?.name).toBe("Côte d'Ivoire");
  });

  it('handles clauses with bracketed commas and trailing sovereignty tags (CDC measles list, 2025-05-28)', () => {
    const list = 'Cook Islands (New Zealand), Costa Rica, Easter Island (Chile), Ecuador, including the Galápagos Islands, Egypt, '
      + 'French Polynesia, including the island groups of Society Islands (Tahiti, Moorea, and Bora-Bora), Marquesas Islands '
      + '(Hiva Oa and Ua Huka), and Austral Islands (Tubuai and Rurutu), Gabon, Haiti, , Honduras, Italy, including Holy See '
      + 'and Vatican City, Jamaica, Kiribati (formerly Gilbert Islands), includes Tarawa, Tabuaeran (Fanning Island), and '
      + 'Banaba (Ocean Island), Kosovo, Republic of the Congo , Türkiye (Turkey), Wake Island, U.S., Zambia';
    const out = parseCountryList(list);
    expect(codes(out)).toEqual(['CK', 'CR', 'CL', 'EC', 'EG', 'PF', 'GA', 'HT', 'HN', 'IT', 'JM', 'KI', 'XK', 'CG', 'TR', 'ZM']);
    expect(out.unmatched).toEqual(['Wake Island']);
  });

  it('reads only what is there when the list is cut short', () => {
    expect(parseCountryList('Chad, Guinea, Senega')).toEqual({
      countries: [{ iso2: 'TD', name: 'Chad' }, { iso2: 'GN', name: 'Guinea' }],
      unmatched: ['Senega'],
    });
  });
});

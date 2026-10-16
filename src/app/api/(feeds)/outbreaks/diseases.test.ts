import { describe, expect, it } from 'vitest';
import { blankDiseases, matchDisease } from './diseases';

describe('matchDisease', () => {
  it('names the disease in real WHO, CDC and ECDC titles', () => {
    const cases: Record<string, string | null> = {
      'Ebola disease caused by Bundibugyo virus': 'Ebola',
      'Pneumonia of undetermined etiology': 'Undiagnosed illness',
      'Avian Influenza A(H9N2)': 'Avian influenza',
      'Influenza A(H5N1)': 'Avian influenza',
      'Marburg virus disease': 'Marburg',
      'Middle East respiratory syndrome coronavirus': 'MERS',
      'MERS-CoV worldwide overview': 'MERS',
      'Mpox: recombinant virus with genomic elements of clades Ib and IIb': 'Mpox',
      'Paratyphoid Fever in Yemen': 'Paratyphoid fever',
      'Ebola Bundibugyo Virus Disease in Haut-Uélé and Tshopo Provinces': 'Ebola',
      'Rocky Mountain Spotted Fever in Mexico ': 'Rocky Mountain spotted fever',
      'Meningococcal Disease in the Democratic Republic of the Congo': 'Meningococcal disease',
      'Hepatitis A in Canada': 'Hepatitis A',
      'Seasonal surveillance of Crimean-Congo haemorrhagic fever (CCHF) in the EU/EEA': 'Crimean-Congo haemorrhagic fever',
      'Swine influenza A(H1N2)v': 'Swine influenza',
    };
    for (const [title, disease] of Object.entries(cases)) expect([title, matchDisease(title)]).toEqual([title, disease]);
  });

  it('takes the disease named first', () => {
    expect(matchDisease('Shigellosis and other gastrointestinal infections, including salmonellosis')).toBe('Shigellosis');
  });

  it('names nothing in items that are not about a disease', () => {
    expect(matchDisease('International food safety event: Infant formula contaminated with cereulide toxin')).toBeNull();
    expect(matchDisease('Communicable disease threats report, 3 - 9 October, week 41')).toBeNull();
    expect(matchDisease('EU-led assessment to Albania will strengthen cross-sector response to antimicrobial resistance')).toBeNull();
    expect(matchDisease('New hepatitis surveillance report')).toBeNull();
  });
});

describe('blankDiseases', () => {
  it('removes disease names that contain a place, keeping offsets', () => {
    const title = 'Sudan virus disease and Crimean-Congo haemorrhagic fever in Uganda';
    const blank = blankDiseases(title);
    expect(blank).toHaveLength(title.length);
    expect(blank).not.toMatch(/Sudan|Congo/);
    expect(blank).toMatch(/in Uganda$/);
  });
});

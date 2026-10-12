import { describe, expect, it } from 'vitest';
import { findCountries, iso2ForName, knownCountryCodes } from './country-codes';

// Every destination title in the State Department feed, 2026-10-12.
const US_NAMES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Anguilla', 'Antarctica', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Aruba', 'Australia', 'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bolivia', 'Bonaire',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'British Virgin Islands', 'Brunei', 'Bulgaria',
  'Burkina Faso', 'Burma', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Cayman Islands',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Costa Rica', 'Croatia',
  'Cuba', 'Curaçao', 'Cyprus', 'Czechia', 'Côte d’Ivoire', 'Democratic Republic of the Congo', 'Djibouti',
  'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
  'Estonia', 'Eswatini', 'Ethiopia', 'Federated States of Micronesia', 'Fiji', 'Finland', 'France',
  'French Guiana', 'French Polynesia', 'French Saint Martin', 'Gabon', 'Gaza',
  'Georgia', 'Germany', 'Ghana', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe', 'Guatemala', 'Guinea',
  'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kingdom of Denmark', 'Kiribati', 'Kosovo', 'Kuwait', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Malaysia',
  'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Martinique', 'Mauritania', 'Mauritius', 'Mexico',
  'Moldova', 'Mongolia', 'Montenegro', 'Montserrat', 'Morocco', 'Mozambique', 'Namibia', 'Nauru', 'Nepal',
  'Netherlands', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Republic of Congo', 'Romania', 'Russia', 'Rwanda',
  'Saba and Sint Eustatius', 'Saint Barthelemy', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
  'Sierra Leone', 'Singapore', 'Sint Maarten', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden',
  'Switzerland', 'Syria', 'São Tomé and Príncipe', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
  'The Bahamas', 'The Gambia', 'The Kyrgyz Republic', 'Timor-Leste', 'Togo', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Turks and Caicos Islands', 'Tuvalu', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam',
  'West Bank', 'Yemen', 'Zambia', 'Zimbabwe',
];

// Every destination title in the Smartraveller feed (Wayback copy of 2026-10-01), placeholders left out.
const AU_NAMES = [
  'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia', 'Austria', 'Azerbaijan', 'Bahrain',
  'Bangladesh', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei Darussalam', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Cook Islands', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', "Côte d'Ivoire (Ivory Coast)",
  'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Federated States of Micronesia', 'Fiji',
  'Finland', 'France', 'French Polynesia', 'Gabon', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guam',
  'Guatemala', 'Guinea', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kosovo', 'Kuwait', 'Kyrgyz Republic', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Lithuania', 'Macau', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Moldova', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
  'Myanmar', 'Namibia', 'Nepal', 'Netherlands', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'Niue', "North Korea (Democratic People's Republic of Korea)", 'North Macedonia', 'Norway',
  'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Samoa', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Korea (Republic of Korea)', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden',
  'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'The Bahamas', 'The Gambia',
  'Timor-Leste', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkmenistan', 'Türkiye', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

describe('iso2ForName', () => {
  it('resolves every destination name in both advisory feeds', () => {
    expect([...US_NAMES, ...AU_NAMES].filter(n => !iso2ForName(n))).toEqual([]);
  });

  it('maps the aliases the feeds use', () => {
    const cases: Record<string, string> = {
      Burma: 'MM', 'Myanmar (Burma)': 'MM', "Côte d'Ivoire": 'CI', 'Côte d’Ivoire': 'CI', "Cote d'Ivoire": 'CI',
      'Congo, Democratic Republic': 'CD', 'Democratic Republic of the Congo': 'CD', 'Republic of Congo': 'CG',
      'Republic of the Congo ': 'CG', 'Holy See': 'VA', Türkiye: 'TR', 'Türkiye (Turkey)': 'TR', Turkey: 'TR',
      'the Russian Federation': 'RU', 'St. Kitts & Nevis': 'KN', 'Saint Vincent and the Grenadines': 'VC',
      'São Tomé and Príncipe': 'ST', 'Kingdom of Denmark': 'DK', 'The Kyrgyz Republic': 'KG', Gaza: 'PS',
      'the West Bank and Gaza': 'PS', 'Republic of South Sudan': 'SS', Kosovo: 'XK', 'Hong Kong (China)': 'HK',
      Bonaire: 'BQ', 'Saba and Sint Eustatius': 'BQ', 'French Saint Martin': 'MF', 'Saint Barthelemy': 'BL',
    };
    for (const [name, code] of Object.entries(cases)) expect([name, iso2ForName(name)]).toEqual([name, code]);
  });

  it('falls back to the bracketed sovereign', () => {
    expect(iso2ForName('Azores (Portugal)')).toBe('PT');
    expect(iso2ForName('Easter Island (Chile)')).toBe('CL');
    expect(iso2ForName('Anguilla (U.K.)')).toBe('AI');
  });

  it('returns null for regions and nonsense', () => {
    expect(iso2ForName('French West Indies')).toBeNull();
    expect(iso2ForName('Global')).toBeNull();
    expect(iso2ForName('')).toBeNull();
    expect(iso2ForName(null)).toBeNull();
  });

  it('never yields retired or non-country codes', () => {
    const codes = knownCountryCodes();
    for (const retired of ['BU', 'ZR', 'YU', 'SU', 'UK', 'EU', 'UN', 'ZZ']) expect(codes.has(retired)).toBe(false);
    expect(codes.has('XK')).toBe(true);
    expect(codes.size).toBe(250);
  });
});

describe('findCountries', () => {
  it('prefers the longest name and keeps the text as written', () => {
    expect(findCountries('Ebola Bundibugyo Virus Disease in Ituri and Nord-Kivu Provinces of the Democratic Republic of the Congo'))
      .toEqual([{ iso2: 'CD', name: 'Democratic Republic of the Congo' }]);
    expect(findCountries('Diphtheria in Equatorial Guinea and Guinea-Bissau').map(m => m.iso2)).toEqual(['GQ', 'GW']);
  });

  it('lists each country once, in order', () => {
    expect(findCountries('Threat assessment brief – Ebola – Democratic Republic of the Congo and Uganda – Uganda'))
      .toEqual([{ iso2: 'CD', name: 'Democratic Republic of the Congo' }, { iso2: 'UG', name: 'Uganda' }]);
  });

  it('respects word edges and capitals', () => {
    expect(findCountries('Cases in Nigeria')).toEqual([{ iso2: 'NG', name: 'Nigeria' }]);
    expect(findCountries('Somalia').map(m => m.iso2)).toEqual(['SO']);
    expect(findCountries('avian influenza in turkey farms')).toEqual([]);
    expect(findCountries('travellers returning from Cabo Verde')).toEqual([{ iso2: 'CV', name: 'Cabo Verde' }]);
    expect(findCountries('ECDC deploys experts to DRC')).toEqual([{ iso2: 'CD', name: 'DRC' }]);
  });

  it('finds nothing in regional scopes', () => {
    expect(findCountries('Imported case of Andes hantavirus in the EU/EEA')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { warningHeadline, warningPlace } from './warning-copy';

const h = (title: string, type: string) => warningHeadline({ title, type });

describe('warningHeadline', () => {
  it('puts the hazard before the level', () => {
    expect(h('Warning, Heavy rain', 'Heavy rain')).toBe('Heavy rain warning');
    expect(h('Advanced Watch, Moderate rains', 'Moderate rains')).toBe('Moderate rains watch');
  });

  it('prefers the type over a generic title', () => {
    expect(h('CAP Alert', 'Landslide warning')).toBe('Landslide warning');
  });

  it('drops what follows the type in NWS and ECCC titles', () => {
    expect(h('Flood Warning issued October 12 at 10:33PM CDT until October 13 at 11:00PM CDT by NWS Mobile AL', 'Flood Warning')).toBe('Flood warning');
    expect(h('Rainfall warning — Saint-Hyacinthe - Acton Vale area', 'Rainfall warning')).toBe('Rainfall warning');
  });

  it('drops the GDACS alert colour, which the dot already shows', () => {
    expect(h('Green flood alert in Nepal', 'Flood')).toBe('Flood alert in Nepal');
    expect(h('Orange notification for tropical cyclone SIMON-26. Population affected by Category 1 (120 km/h) wind speeds or higher is 0.1 million.', 'Tropical Cyclone'))
      .toBe('Tropical cyclone SIMON-26');
    expect(h('Drought is on going in Venezuela', 'Drought')).toBe('Drought in Venezuela');
  });

  it('stops shouting', () => {
    expect(h('LLUVIAS Y TORMENTAS ELÉCTRICAS', 'lluvia tormenta eléctrica')).toBe('Lluvias y tormentas eléctricas');
    expect(h('Avertissement de PLUIE Sévère pour la wilaya : BÉCHAR', 'PLUIE')).toBe('Avertissement de Pluie Sévère pour la wilaya : Béchar');
    expect(h('Forestfire', 'Forestfire')).toBe('Forest fire');
  });

  it('leaves good titles alone', () => {
    expect(h('Hurricane Simon, Category 2 — 85 kt, 969 mb, moving WNW at 3 kt', 'Hurricane (Category 2)')).toBe('Hurricane Simon, Category 2 — 85 kt, 969 mb, moving WNW at 3 kt');
    expect(h('China: 42 severe weather warnings — Dense fog', 'Severe weather warnings')).toBe('China: 42 severe weather warnings — Dense fog');
  });
});

describe('warningPlace', () => {
  it('reads the WMO governorate list as regions', () => {
    const p = warningPlace('Jazan region - Ad Darb : The entire governorate; Jazan region - Baysh : The entire governorate — Saudi Arabia');
    expect(p.short).toBe('Jazan, Saudi Arabia');
    expect(p.parts).toEqual(['Jazan: Ad Darb, Baysh']);
    expect(p.country).toBe('Saudi Arabia');
  });

  it('counts the regions it cannot show', () => {
    const p = warningPlace('Bahah region - Hajrah : The entire governorate; Asir region - Abha : The entire — Saudi Arabia');
    expect(p.short).toBe('Bahah and Asir, Saudi Arabia');
    expect(p.parts).toEqual(['Bahah: Hajrah', 'Asir: Abha']);
  });

  it('names the country for country-level warnings', () => {
    const p = warningPlace('Country-level, areas not mapped: Calabria; Sicilia', 'Italy: 2 severe weather warnings — Orange Thunderstorm Warning');
    expect(p.short).toBe('Italy');
    expect(p.parts).toEqual(['Calabria', 'Sicilia']);
  });

  it('decodes entities and folds long lists', () => {
    expect(warningPlace('Austria, Bosnia &amp; Herzegovina, Belgium, Belarus').short).toBe('Austria and 3 more');
    expect(warningPlace('Alexander, NC; Catawba, NC; Iredell, NC').short).toBe('Alexander, NC and 2 more');
    expect(warningPlace('Mexico, United States').short).toBe('Mexico, United States');
  });

  it('keeps the place short and the detail whole', () => {
    const p = warningPlace('Antioquia (Abejorral, Abriaquí, Amalfi)');
    expect(p.short).toBe('Antioquia');
    expect(p.parts).toEqual(['Antioquia (Abejorral, Abriaquí, Amalfi)']);
  });

  it('calms capitals and skips a country already named', () => {
    expect(warningPlace('BÉCHAR — Algeria').short).toBe('Béchar, Algeria');
    expect(warningPlace('Huila (Gigante, Paicol), La Guajira (Manaure) — Colombia').short).toBe('Huila, La Guajira, Colombia');
    expect(warningPlace('Northwest Iceland — Iceland').short).toBe('Northwest Iceland');
    expect(warningPlace(null)).toEqual({ short: null, parts: [], country: null });
  });
});

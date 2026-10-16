import { describe, expect, it } from 'vitest';
import { parseMetarCsv, splitCsvLine } from './metar';
import { flightLevel, parseIsigmets, sigmetTitle, unwrapRing } from './sigmet';
import { airportWxFeatures, sigmetFeatures } from './layers';

// Rows from the live cache file, 2026-10-15; the header is the file's own, repeated sky columns and all.
const HEADER = 'raw_text,station_id,observation_time,latitude,longitude,temp_c,dewpoint_c,wind_dir_degrees,wind_speed_kt,wind_gust_kt,visibility_statute_mi,altim_in_hg,sea_level_pressure_mb,corrected,auto,auto_station,maintenance_indicator_on,no_signal,lightning_sensor_off,freezing_rain_sensor_off,present_weather_sensor_off,wx_string,sky_cover,cloud_base_ft_agl,sky_cover,cloud_base_ft_agl,sky_cover,cloud_base_ft_agl,sky_cover,cloud_base_ft_agl,flight_category,three_hr_pressure_tendency_mb,maxT_c,minT_c,maxT24hr_c,minT24hr_c,precip_in,pcp3hr_in,pcp6hr_in,pcp24hr_in,snow_in,vert_vis_ft,metar_type,elevation_m';
const UUEE = '"SPECI UUEE 151714Z VRB03MPS 8000 OVC002 08/07 Q1024 R06R/290145 R06C/290145 BECMG 0300 FG",UUEE,2026-10-15T17:14:00.000Z,55.9730,37.4150,8,7,0,6,,4.97,30.24,,,,,,,,,,,OVC,200,,,,,,,LIFR,,,,,,,,,,,,SPECI,186';
const KJCT = '"SPECI KJCT 151713Z AUTO 20008KT 10SM BKN028 OVC036 26/21 A3004 RMK AO2 T02610206 ",KJCT,2026-10-15T17:13:00.000Z,30.5105,-99.7665,26.1,20.6,200,8,,10+,30.04,,,TRUE,TRUE,,,,,,,BKN,2800,OVC,3600,,,,,MVFR,,,,,,,,,,,,SPECI,522';
const KJCT_OLDER = '"METAR KJCT 151653Z AUTO 20009KT 10SM SCT028 26/21 A3004",KJCT,2026-10-15T16:53:00.000Z,30.5105,-99.7665,26,21,200,9,,10+,30.04,,,TRUE,TRUE,,,,,,,SCT,2800,,,,,,,VFR,,,,,,,,,,,,METAR,522';
const NOCAT = '"METAR XXXX 151700Z 00000KT",XXXX,2026-10-15T17:00:00.000Z,10,20,,,0,0,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,METAR,1';

describe('METAR cache', () => {
  it('keeps quoted commas inside a field', () => {
    expect(splitCsvLine('"a,b",c,,"d ""e"""')).toEqual(['a,b', 'c', '', 'd "e"']);
  });

  it('reads each station once, at its latest report, with the lowest ceiling', () => {
    const rows = parseMetarCsv([HEADER, KJCT_OLDER, UUEE, KJCT, NOCAT, ''].join('\n'));
    expect(rows.map(r => r.id).sort()).toEqual(['KJCT', 'UUEE', 'XXXX']);
    const kjct = rows.find(r => r.id === 'KJCT')!;
    expect(kjct).toMatchObject({ cat: 'MVFR', ceilingFt: 2800, windDir: 200, windKt: 8, visSm: '10+', tempC: 26.1, lat: 30.5105, lng: -99.7665 });
    expect(kjct.raw.startsWith('SPECI KJCT')).toBe(true);
    expect(rows.find(r => r.id === 'UUEE')).toMatchObject({ cat: 'LIFR', ceilingFt: 200 });
    expect(rows.find(r => r.id === 'XXXX')!.cat).toBeNull();
  });

  it('skips status lines above the header', () => {
    expect(parseMetarCsv(['No errors', 'No warnings', '5 ms', HEADER, UUEE].join('\n'))).toHaveLength(1);
  });

  it('draws good weather behind bad', () => {
    const [f] = airportWxFeatures(parseMetarCsv([HEADER, UUEE].join('\n')));
    expect(f.geometry.coordinates).toEqual([37.415, 55.973]);
    expect(f.properties).toMatchObject({ id: 'UUEE', rank: 4 });
    expect(f.properties).not.toHaveProperty('gustKt');
  });
});

const NOW = Date.parse('2026-10-15T14:00:00Z');
const VA = {
  icaoId: 'WAAA', firId: 'WAAF', firName: 'WAAF UJUNG PANDANG', seriesId: '08', validTimeFrom: 1792065600, validTimeTo: 1792087200,
  hazard: 'VA', qualifier: 'ERUPTION MT SEMERU', base: 0, top: 14000, geom: 'AREA',
  coords: [{ lon: 112.967, lat: -8.033 }, { lon: 112.967, lat: -8.2 }, { lon: 111.833, lat: -8.35 }, { lon: 111.9, lat: -7.767 }, { lon: 112.967, lat: -8.033 }],
  dir: 'W', spd: '15', chng: 'NC', rawSigmet: 'WAAF SIGMET 08 VALID 151200/151800',
};
const AREAS = {
  ...VA, firId: 'FCCC', firName: 'FCCC BRAZZAVILLE', seriesId: 'K1', hazard: 'TS', qualifier: 'EMBD', geom: 'AREAS',
  coords: [
    [{ lon: 15.133, lat: 8 }, { lon: 14.033, lat: 4.5 }, { lon: 16.033, lat: 4.5 }, { lon: 15.133, lat: 8 }],
    [{ lon: 14.133, lat: 8 }, { lon: 14.017, lat: 4.433 }, { lon: 12.017, lat: 4.433 }],
  ],
};
// A Pacific area across the antimeridian, open as some offices send it.
const PACIFIC = {
  ...VA, firId: 'NZZO', firName: 'NZZO AUCKLAND OCEANIC', seriesId: '3', hazard: 'TURB', qualifier: 'SEV',
  coords: [{ lon: 178, lat: -30 }, { lon: -178, lat: -30 }, { lon: -178, lat: -34 }, { lon: 178, lat: -34 }],
};

describe('international SIGMETs', () => {
  it('reads areas, multi-areas and closes open rings', () => {
    const rows = parseIsigmets([VA, AREAS, PACIFIC, {}, { ...VA, coords: null }], NOW);
    expect(rows.map(r => r.fir)).toEqual(['WAAF', 'FCCC', 'NZZO']);
    expect(rows[0]).toMatchObject({ firName: 'UJUNG PANDANG', baseFt: 0, topFt: 14000, move: 'W 15 kt', change: 'NC' });
    expect(rows[1].rings).toHaveLength(2);
    expect(rows[1].rings[1]).toHaveLength(4);
    expect(rows[2].rings[0].map(([x]) => x)).toEqual([178, 182, 182, 178, 178]);
  });

  it('drops what is no longer in force', () => {
    expect(parseIsigmets([VA], 1792087200 * 1000 + 1)).toEqual([]);
  });

  it('unwraps either way across ±180°', () => {
    expect(unwrapRing([[-179, 0], [179, 0], [179, 1]]).map(([x]) => x)).toEqual([-179, -181, -181]);
  });

  it('names the hazard the way a briefing would', () => {
    expect(sigmetTitle('TURB', 'SEV')).toBe('Severe turbulence');
    expect(sigmetTitle('TS', 'EMBD')).toBe('Embedded thunderstorms');
    expect(sigmetTitle('TURB', 'SEV MTW')).toBe('Severe mountain waves');
    expect(sigmetTitle('VA', 'ERUPTION MT SEMERU')).toBe('Volcanic ash · Eruption Mt Semeru');
    expect(sigmetTitle('TC', 'TRUDY')).toBe('Tropical cyclone Trudy');
    expect(sigmetTitle('ICE')).toBe('Icing');
  });

  it('writes flight levels', () => {
    expect(flightLevel(0)).toBe('SFC');
    expect(flightLevel(14000)).toBe('FL140');
    expect(flightLevel(4500)).toBe('FL045');
  });

  it('makes one polygon per area and a multipolygon for several', () => {
    const [one, many] = sigmetFeatures(parseIsigmets([VA, AREAS], NOW));
    expect(one.geometry.type).toBe('Polygon');
    expect(many.geometry.type).toBe('MultiPolygon');
    expect(one.properties).toMatchObject({ title: 'Volcanic ash · Eruption Mt Semeru', hazard: 'VA' });
  });
});

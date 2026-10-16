import { describe, expect, it } from 'vitest';
import {
  centreOf, classifyWarning, extractCoordinates, MAX_POINTS, NGA_BROADCAST_WARN_URL, parseBroadcastWarn,
  parseNgaDate, regionOf, toNavWarning, toNavWarnings, vesselOf, type NgaWarning,
} from './nga-msi';

// Verbatim from broadcast-warn?output=json&status=A, fetched 2026-10-12 (unused fields dropped).
const IRAN_CABLE: NgaWarning = {
  msgYear: 2023, msgNumber: 2918, navArea: 'P', subregion: '62', issueDate: '111948Z SEP 2023',
  text: 'PERSIAN GULF.\nIRAN.\nCABLE OPERATIONS IN PROGRESS UNTIL\nFURTHER NOTICE IN VICINITY\n29-19.68N 048-06.18E.\nWIDE BERTH REQUESTED.\n',
};
const ARUBA_CABLE: NgaWarning = {
  msgYear: 2024, msgNumber: 127, navArea: '4', subregion: '24,25', issueDate: '051805Z FEB 2024',
  text: 'CARIBBEAN SEA.\nARUBA.\nCABLE OPERATIONS IN PROGRESS UNTIL FURTHER NOTICE\nBY CABLESHIP PANAM ALONG TRACKLINES JOINING:\nA. 13-10.34N 069-51.47W, 12-55.78N 069-48.86W,\n   12-43.47N 069-46.66W, 12-39.79N 069-46.00W.\nB. 13-47.75N 069-55.00W, 13-30.00N 069-55.00W,\n   13-22.30N 069-53.62W.\nWIDE BERTH REQUESTED.\n',
};
const NIGERIA_CABLE: NgaWarning = {
  msgYear: 2024, msgNumber: 950, navArea: 'A', subregion: '57', issueDate: '041229Z MAY 2024',
  text: 'GULF OF GUINEA.\nNIGERIA.\nDNC 01.\nCABLE OPERATIONS IN PROGRESS UNTIL FURTHER\nNOTICE BY CABLESHIP ILE DE SEIN\nALONG TRACKLINE JOINING\n03-00.70N 006-57.40E, 03-35.20N 007-13.90E,\n03-48.50N 007-33.10E, 04-02.40N 007-39.00E,\n04-14.90N 007-40.70E, 04-18.60N 007-44.20E,\n04-27.20N 007-59.50E, 04-32.40N 008-00.50E.\nWIDE BERTH REQUESTED.\n',
};
// No cable fault is in force upstream, so this one is HYDROLANT 950/24 with a fault named.
const NIGERIA_FAULT: NgaWarning = {
  ...NIGERIA_CABLE,
  text: NIGERIA_CABLE.text.replace('CABLE OPERATIONS IN PROGRESS', 'CABLE FAULT REPAIR OPERATIONS IN PROGRESS'),
};
const MADAGASCAR_CABLES: NgaWarning = {
  msgYear: 2024, msgNumber: 864, navArea: 'P', subregion: '61', issueDate: '150309Z MAR 2024',
  text: 'WESTERN INDIAN OCEAN.\nMADAGASCAR.\nDNC 02.\nNAVIGATION PROHIBITED UNTIL FURTHER NOTICE\nDUE TO UNDERWATER CABLES ESTABLISHED\nIN AREA BOUND BY\n25-23.24S 047-05.93E, 25-23.24S 046-59.01E,\n25-57.49S 046-59.01E, 25-57.49S 047-05.93E.\n',
};
const PMRF_MISSILES: NgaWarning = {
  msgYear: 2023, msgNumber: 93, navArea: '12', subregion: '19', issueDate: '282251Z FEB 2023',
  text: 'NORTH PACIFIC.\nHAWAII.\n1. INTERMITTENT MISSILE FIRING OPERATIONS CONDUCTED\n   BY THE PACIFIC MISSILE RANGE FACILITY (PMRF),\n   BARKING SANDS, KAUAI, HAWAII, IN WHISKEY\n   188 (W-188) OPERATING AREA. OPERATIONS ARE\n   CONDUCTED PERIODICALLY THROUGHOUT EACH WEEK\n   IN AREA BOUND BY\n   22-00.0N 159-51.0W, 22-00.0N 160-00.0W,\n   22-04.0N 160-06.0W, 21-59.5N 160-21.0W,\n   22-05.0N 161-35.0W, 22-45.0N 161-25.0W,\n   22-56.0N 161-49.0W, 23-34.0N 161-18.6W,\n   23-57.0N 160-41.0W, 25-41.0N 161-36.0W,\n   26-00.0N 159-58.0W, 25-47.0N 158-15.0W,\n   23-54.0N 158-15.0W, 22-20.0N 159-09.0W,\n   22-21.0N 159-30.0W, 22-13.0N 159-42.0W,\n   22-00.0N 159-51.0W.\n2. VESSELS MAY BE REQUESTED TO ALTER COURSE DUE TO\n   FIRING OPERATIONS AND ARE REQUESTED TO CONTACT\n   "PACIFIC MISSILE RANGE BARKING SANDS" ON VHF\n   MARINE BAND CHANNEL 16 PRIOR\n   TO ENTERING THE ABOVE BOUNDARIES. IF UNABLE\n   TO CONTACT PMRF PRIOR TO ENTERING OR WHILE IN\n   THE WARNING AREA, RELAY MESSAGES THROUGH\n   U.S. COAST GUARD HONOLULU.\n3. VESSELS INBOUND AND OUTBOUND FOR HAWAIIAN PORTS\n   WILL CREATE THE LEAST INTERFERENCE TO FIRING\n   OPERATIONS AS WELL AS ENHANCE VESSEL SAFETY\n   BY PASSING SOUTH OF THE ISLANDS OF KAUAI\n   AND NIIHAU DURING SPECIFIED TIMES.\n4. CANCEL NAVAREA XII 269/21.\n',
};
const BLACK_SEA_HAZOPS: NgaWarning = {
  msgYear: 2022, msgNumber: 838, navArea: 'A', subregion: '55', issueDate: '231417Z MAR 2022',
  text: 'BLACK SEA.\nUKRAINE.\nDNC 10.\n1. HAZARDOUS OPERATIONS IN PROGRESS UNTIL FURTHER\n   NOTICE IN AREA BOUND BY\n   45-05N 033-33E, 45-59N 033-51E,\n   47-00N 031-43E, 46-19N 029-55E,\n   45-05N 029-17E.\n2. CANCEL HYDROLANT 814/22.\n',
};
const BLACK_SEA_MINES: NgaWarning = {
  msgYear: 2022, msgNumber: 789, navArea: 'A', subregion: '55', issueDate: '181218Z MAR 2022',
  text: 'BLACK SEA.\nDNC 10.\nMINES ADRIFT REPORTED IN NORTHWESTERN, WESTERN\nAND SOUTHWESTERN BLACK SEA. VESSELS IN VICINITY\nARE ADVISED TO EXERCISE EXTREME CAUTION.\n',
};
const SEISMIC_SURVEY: NgaWarning = {
  msgYear: 2024, msgNumber: 64, navArea: 'C', subregion: '43', issueDate: '262115Z APR 2024',
  text: 'NORWEGIAN SEA.\nDNC 20, DNC 21.\nSURVEY OPERATIONS IN PROGRESS UNTIL FURTHER NOTICE\nBY M/V RAMFORM HYPERION TOWING 14 SIX MILE LONG\nCABLES IN AREA BOUND BY\n67-29.10N 004-41.80E, 67-21.00N 003-59.90E,\n67-03.40N 003-53.50E, 66-41.30N 002-07.40E,\n66-00.60N 003-40.20E, 66-34.20N 006-32.10E.\nSEVEN MILE BERTH REQUESTED.\n',
};
const CABLESHIP_OVERBOARD: NgaWarning = {
  msgYear: 2024, msgNumber: 1565, navArea: 'P', subregion: '61', issueDate: '100830Z MAY 2024',
  text: 'SOUTHWESTERN INDIAN OCEAN.\nDNC 02.\nMAN OVERBOARD FROM CABLESHIP RUI NING 21\nIN VICINITY 30-49.5S 037-35.6E.\nVESSELS IN VICINITY REQUESTED TO KEEP A SHARP\nLOOKOUT, ASSIST IF POSSIBLE.\nREPORTS TO ANY COASTAL RADIO STATION.\n',
};
const HAITI_LIGHT: NgaWarning = {
  msgYear: 2021, msgNumber: 1157, navArea: '4', subregion: '26', issueDate: '281021Z DEC 2021',
  text: 'WESTERN NORTH ATLANTIC.\nHAITI.\nCHART 26141.\nILE DE LA TORTUE W. POINT LIGHT\n20-03-44N 072-58-02W UNLIT.\n',
};
const CAYO_ARENA: NgaWarning = {
  msgYear: 2023, msgNumber: 1404, navArea: '4', subregion: '28', issueDate: '041256Z DEC 2023',
  text: 'GULF OF MEXICO.\nCAYO ARENA LIGHTHOUSE 22-06.90N 91-23.90W UNLIT.\n',
};
const GUAM_CABLE: NgaWarning = {
  msgYear: 2024, msgNumber: 1519, navArea: 'P', subregion: '81', issueDate: '070316Z MAY 2024',
  text: 'PHILIPPINE SEA.\nWESTERN NORTH PACIFIC.\nGUAM.\nDNC 12.\nCABLE OPERATIONS IN PROGRESS UNTIL FURTHER\nNOTICE BY CABLESHIP ILE DE BREHAT\nALONG TRACKLINE JOINING\n13-47.5N 143.46.0E, 13-34.2N 144-27.3E,\n13-29.9N 144-45.5E.\nWIDE BERTH REQUESTED.\n',
};
const MAURITIUS_WORKS: NgaWarning = {
  msgYear: 2023, msgNumber: 630, navArea: 'P', subregion: '61', issueDate: '241202Z FEB 2023',
  text: 'WESTERN INDIAN OCEAN.\nMAURITIUS.\nDNC 02.\n1. UNDERWATER OPERATIONS IN PROGRESS UNTIL\n   FURTHER NOTICE:\n   A. IN AREA BOUND BY\n      20-26.10S 057-43.1E0, 20-25.10S 057-44.00E,\n      20-24.00S 057-45.50E.\n   B. IN VICINITY 20-26.60S 057-44.60E.\n   TWO MILE BERTH REQUESTED.\n2. CANCEL HYDROPAC 536/23.\n',
};
const BAD_MINUTES: NgaWarning = {
  msgYear: 2023, msgNumber: 243, navArea: '12', subregion: '83', issueDate: '261142Z APR 2023',
  text: 'EASTERN NORTH PACIFIC.\nMAN OVERBOARD IN VICINITY 10-52.0N 154-84.0W\n500 NAUTICAL MILES SOUTH OF BIG ISLAND HAWAII\nAT 260903Z APR, PERSON DRESSED IN GREEN SHORTS\nAND WHITE HOODIE. VESSELS IN VICINITY REQUESTED\nTO KEEP A SHARP LOOKOUT, ASSIST IF POSSIBLE.\nREPORTS TO JRCC HONOLULU,\nTELEX: 392401,\nPHONE: 808 535 3333,\nFAX: 808 535 3338,\nE-MAIL: JRCCHONOLULU@USCG.MIL.\n',
};
// Number list abridged.
const IN_FORCE_LIST: NgaWarning = {
  msgYear: 2024, msgNumber: 498, navArea: '4', subregion: 'GEN', issueDate: '031637Z MAY 2024',
  text: '1. NAVAREA IV WARNINGS IN FORCE AS OF 031554Z MAY.\n   ALL THE INFORCE WARNINGS ARE LISTED HERE.\n   496/2024, 495/2024, 493/2024, 490/2024, 489/2024,\n   12/2024, 9/2024.\n   1157/2021, 1003/2021, 778/2021, 346/2021,\n   278/2021, 277/2021, 144/2021.\n2. THE COMPLETE TEXT OF ALL IN-FORCE NAVAREA IV\n   BROADCAST WARNINGS ARE AVAILABLE ON THE NGA\n   MARITIME SAFETY INFORMATION WEBSITE AT:\n   MSI.NGA.MIL/NAVWARNINGS.\n3. CANCEL NAVAREA IV 429/24, 470/24.\n',
};
const REEF_RACON: NgaWarning = {
  msgYear: 2024, msgNumber: 1434, navArea: 'P', subregion: '74', issueDate: '010654Z MAY 2024',
  text: 'EASTERN INDIAN OCEAN.\nDNC 04.\nRACON AT IMPERIEUSE REEF LIGHT\n17-31.32S 118-57.18E INOPERATIVE.\n',
};
const BREAKWATER_LIGHT: NgaWarning = {
  msgYear: 2024, msgNumber: 1507, navArea: 'P', subregion: '76', issueDate: '060720Z MAY 2024',
  text: 'TASMAN SEA.\nNEW ZEALAND.\nDNC 06.\nSOUTH BREAKWATER LIGHT 42-26.40S 171-11.43E\nUNRELIABLE.\n',
};

describe('extractCoordinates', () => {
  it('reads degrees and decimal minutes in every hemisphere', () => {
    expect(extractCoordinates(IRAN_CABLE.text)).toEqual([[29.328, 48.103]]);
    expect(extractCoordinates(CABLESHIP_OVERBOARD.text)).toEqual([[-30.825, 37.59333]]);
    expect(extractCoordinates(ARUBA_CABLE.text)).toHaveLength(7);
  });

  it('reads whole minutes, seconds and two-digit longitudes', () => {
    expect(extractCoordinates(BLACK_SEA_HAZOPS.text)).toEqual([
      [45.08333, 33.55], [45.98333, 33.85], [47, 31.71667], [46.31667, 29.91667], [45.08333, 29.28333],
    ]);
    expect(extractCoordinates(HAITI_LIGHT.text)).toEqual([[20.06222, -72.96722]]);
    expect(extractCoordinates(CAYO_ARENA.text)).toEqual([[22.115, -91.39833]]);
  });

  it('tolerates the typos NGA has published', () => {
    expect(extractCoordinates(GUAM_CABLE.text)).toEqual([[13.79167, 143.76667], [13.57, 144.455], [13.49833, 144.75833]]);
    expect(extractCoordinates(MAURITIUS_WORKS.text)).toEqual([
      [-20.435, 57.71833], [-20.41833, 57.73333], [-20.4, 57.75833], [-20.44333, 57.74333],
    ]);
  });

  it('skips impossible values and message references', () => {
    expect(extractCoordinates(BAD_MINUTES.text)).toEqual([]);
    expect(extractCoordinates(IN_FORCE_LIST.text)).toEqual([]);
    expect(extractCoordinates('95-00.0N 010-00.0E, 10-00.0N 181-00.0E')).toEqual([]);
  });
});

describe('classifyWarning', () => {
  it('separates cable faults from cable operations', () => {
    expect(classifyWarning(NIGERIA_CABLE.text)).toEqual({ kind: 'cable', cable: 'operations' });
    expect(classifyWarning(NIGERIA_FAULT.text)).toEqual({ kind: 'cable', cable: 'fault' });
    expect(classifyWarning(MADAGASCAR_CABLES.text)).toEqual({ kind: 'cable', cable: 'operations' });
    expect(classifyWarning(`${IRAN_CABLE.text}NEAR SOUTH BREAKWATER LIGHT.`).cable).toBe('operations');
  });

  it('does not take seismic streamers or a cable ship in distress for cable work', () => {
    expect(classifyWarning(SEISMIC_SURVEY.text).kind).toBe('other');
    expect(classifyWarning(CABLESHIP_OVERBOARD.text).kind).toBe('distress');
  });

  it('finds firing ranges and hazardous operations, but not "exercise caution"', () => {
    expect(classifyWarning(PMRF_MISSILES.text).kind).toBe('firing');
    expect(classifyWarning(BLACK_SEA_HAZOPS.text).kind).toBe('firing');
    expect(classifyWarning(BLACK_SEA_MINES.text).kind).toBe('hazard');
  });

  it('files light and racon outages as navaids, even at a place named for a reef', () => {
    expect(classifyWarning(HAITI_LIGHT.text).kind).toBe('navaid');
    expect(classifyWarning(REEF_RACON.text).kind).toBe('navaid');
    expect(classifyWarning(BREAKWATER_LIGHT.text).kind).toBe('navaid');
  });
});

describe('vesselOf / regionOf', () => {
  it('names the cable ship', () => {
    expect(vesselOf(ARUBA_CABLE.text)).toBe('PANAM');
    expect(vesselOf(NIGERIA_CABLE.text)).toBe('ILE DE SEIN');
    expect(vesselOf(IRAN_CABLE.text)).toBeUndefined();
  });

  it('keeps the sea and the country from the leading place lines', () => {
    expect(regionOf(GUAM_CABLE.text)).toBe('PHILIPPINE SEA, GUAM');
    expect(regionOf(BLACK_SEA_MINES.text)).toBe('BLACK SEA');
    expect(regionOf(IN_FORCE_LIST.text)).toBeUndefined();
  });
});

describe('parseNgaDate', () => {
  it('reads DDHHMMZ MON YYYY as UTC', () => {
    expect(parseNgaDate('081653Z MAY 2024')).toBe('2024-05-08T16:53:00.000Z');
  });

  it('rejects malformed or impossible stamps', () => {
    for (const s of ['151555 DEC', '311200Z FEB 2024', '001200Z MAY 2024', '082460Z MAY 2024', '081653Z MAI 2024', null]) {
      expect(parseNgaDate(s)).toBeNull();
    }
  });
});

describe('centreOf', () => {
  it('averages the vertices', () => {
    expect(centreOf([[0, 10], [2, 20]])).toEqual([1, 15]);
  });

  it('keeps a set straddling 180° on its own side of the globe', () => {
    expect(centreOf([[-17, 179], [-17, -178]])).toEqual([-17, -179.5]);
  });
});

describe('toNavWarning', () => {
  it('maps a warning to a map event', () => {
    expect(toNavWarning(IRAN_CABLE)).toEqual({
      id: 'nga-P-2023-2918',
      ref: 'HYDROPAC 2918/23',
      title: 'Cable operations — PERSIAN GULF, IRAN',
      kind: 'cable',
      cable: 'operations',
      lat: 29.328,
      lng: 48.103,
      points: [[29.328, 48.103]],
      area: 'HYDROPAC, subregion 62',
      issued: '2023-09-11T19:48:00.000Z',
      text: 'PERSIAN GULF.\nIRAN.\nCABLE OPERATIONS IN PROGRESS UNTIL\nFURTHER NOTICE IN VICINITY\n29-19.68N 048-06.18E.\nWIDE BERTH REQUESTED.',
      source: 'https://msi.nga.mil/NavWarnings',
    });
  });

  it('titles a fault and names the ship', () => {
    expect(toNavWarning(NIGERIA_FAULT)).toMatchObject({
      title: 'Cable fault — GULF OF GUINEA, NIGERIA', cable: 'fault', vessel: 'ILE DE SEIN', lat: 3.99979, lng: 7.60063,
    });
  });

  it('centres an area once, without counting the closing vertex twice', () => {
    const e = toNavWarning(PMRF_MISSILES);
    expect(e).toMatchObject({ kind: 'firing', area: 'NAVAREA XII, subregion 19', lat: 23.22552, lng: -160.22042 });
    expect(e?.points).toHaveLength(16);
  });

  it('caps the points but centres on all of them', () => {
    const text = Array.from({ length: 60 }, (_, i) => `${String(i).padStart(2, '0')}-00.0N 010-00.0E`).join(', ');
    const e = toNavWarning({ ...IRAN_CABLE, text });
    expect(e?.points).toHaveLength(MAX_POINTS);
    expect([e?.lat, e?.lng]).toEqual([29.5, 10]);
  });

  it('returns null when the text has no position', () => {
    expect(toNavWarning(IN_FORCE_LIST)).toBeNull();
    expect(toNavWarning(BLACK_SEA_MINES)).toBeNull();
  });
});

describe('toNavWarnings', () => {
  it('counts unplaced warnings instead of dropping them silently', () => {
    const { warnings, unplaced } = toNavWarnings([IRAN_CABLE, IN_FORCE_LIST, BAD_MINUTES]);
    expect(warnings.map(w => w.id)).toEqual(['nga-P-2023-2918']);
    expect(unplaced).toBe(2);
  });
});

describe('parseBroadcastWarn', () => {
  it('keeps well-formed records and drops malformed ones', () => {
    expect(parseBroadcastWarn({ 'broadcast-warn': [IRAN_CABLE, { text: 1 }, null] })).toEqual([IRAN_CABLE]);
  });

  it('throws on an unexpected body', () => {
    for (const body of [{}, null, '<html>maintenance</html>', { 'broadcast-warn': {} }]) {
      expect(() => parseBroadcastWarn(body)).toThrow(/broadcast-warn/);
    }
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live NGA MSI feed', async () => {
  const res = await fetch(NGA_BROADCAST_WARN_URL, { signal: AbortSignal.timeout(30_000) });
  expect(res.ok).toBe(true);
  const { warnings } = toNavWarnings(parseBroadcastWarn(await res.json()));
  expect(warnings.length).toBeGreaterThan(0);
  for (const w of warnings) expect(Math.abs(w.lat)).toBeLessThanOrEqual(90);
});

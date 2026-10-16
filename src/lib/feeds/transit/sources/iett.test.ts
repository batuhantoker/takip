import { describe, expect, it } from 'vitest';
import { iettTime, parseIett } from './iett';

// 2026-10-15 16:27:00 UTC = 19:27:00 in Istanbul.
const NOW = Date.UTC(2026, 9, 15, 16, 27, 0) / 1000;

const soap = (json: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetFiloAracKonum_jsonResponse xmlns="http://tempuri.org/"><GetFiloAracKonum_jsonResult>${json}</GetFiloAracKonum_jsonResult></GetFiloAracKonum_jsonResponse></soap:Body></soap:Envelope>`;

describe('iettTime', () => {
  it('reads Istanbul wall-clock time', () => {
    expect(iettTime('19:26:00', NOW)).toBe(NOW - 60);
  });

  it('puts a late-evening stamp seen after midnight on the day before', () => {
    const justAfterMidnight = Date.UTC(2026, 9, 15, 21, 2, 0) / 1000; // 00:02 on the 16th
    expect(iettTime('23:59:00', justAfterMidnight)).toBe(justAfterMidnight - 180);
  });

  it('treats a stamp a few minutes ahead as now', () => {
    expect(iettTime('19:30:00', NOW)).toBe(NOW);
  });

  it('ignores anything that is not HH:MM:SS', () => {
    expect(iettTime('', NOW)).toBeUndefined();
    expect(iettTime('7 pm', NOW)).toBeUndefined();
  });
});

describe('parseIett', () => {
  it('reads buses out of the SOAP envelope, unescaping the XML text', () => {
    const rows = [
      { Operator: 'Özel Halk Otobüsleri & Co', Garaj: null, KapiNo: 'A-001', Saat: '19:26:30', Boylam: '29.0509', Enlem: '41.0882', Hiz: '36', Plaka: '34 HO 1000' },
      { Operator: 'İETT', KapiNo: '', Saat: '19:26:00', Boylam: '28.9', Enlem: '41.0', Hiz: '0', Plaka: '34 XY 9' },
      { Operator: 'İETT', KapiNo: 'B-1', Saat: '19:26:00', Boylam: '0', Enlem: '0', Hiz: '0', Plaka: '' },
      { Operator: 'İETT', KapiNo: 'B-2', Saat: 'x', Boylam: 'n/a', Enlem: '41', Hiz: '0', Plaka: '' },
    ];
    const json = JSON.stringify(rows).replace(/&/g, '&amp;');
    const out = parseIett(soap(json), NOW);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'A-001', label: 'A-001', plate: '34 HO 1000', operator: 'Özel Halk Otobüsleri & Co', lat: 41.0882, lng: 29.0509, t: NOW - 30 });
    expect(out[0].speed).toBeCloseTo(10, 5);
    expect(out[1]).toMatchObject({ id: '34 XY 9', label: undefined });
  });

  it('throws when the reply has no result', () => {
    expect(() => parseIett('<soap:Fault>Server busy</soap:Fault>', NOW)).toThrow(/no result/);
  });
});

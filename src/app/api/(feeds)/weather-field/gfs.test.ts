import { afterEach, describe, expect, it, vi } from 'vitest';
import { dodsArrays, fetchGfsTemperature, fetchGfsWind, nearestStep } from './gfs';

/** A DAP2 `.dods` reply: a DDS declaring the arrays, the marker, then each array as XDR. */
function dods(arrays: { name: string; type: 'Float32' | 'Float64'; values: number[] }[]): ArrayBuffer {
  const decls = arrays.map(a => `    ${a.type} ${a.name}[${a.name} = ${a.values.length}];\n`).join('');
  const head = new TextEncoder().encode(`Dataset {\n${decls}} x;\n\nData:\n`);
  const size = arrays.reduce((n, a) => n + 8 + a.values.length * (a.type === 'Float64' ? 8 : 4), head.length);
  const buf = new ArrayBuffer(size);
  new Uint8Array(buf).set(head);
  const view = new DataView(buf);
  let o = head.length;
  for (const { type, values } of arrays) {
    view.setUint32(o, values.length); view.setUint32(o + 4, values.length); o += 8;
    for (const v of values) {
      if (type === 'Float64') { view.setFloat64(o, v); o += 8; } else { view.setFloat32(o, v); o += 4; }
    }
  }
  return buf;
}

describe('dodsArrays', () => {
  it('reads each declared array by name, in the order the reply gives them', () => {
    const { time, h } = dodsArrays(dods([{ name: 'h', type: 'Float32', values: [2, 80] }, { name: 'time', type: 'Float64', values: [0, 3, 6] }]));
    expect([...time]).toEqual([0, 3, 6]);
    expect([...h]).toEqual([2, 80]);
  });

  it('refuses a reply cut short', () => {
    const buf = dods([{ name: 'v', type: 'Float32', values: [1, 2, 3] }]);
    expect(() => dodsArrays(buf.slice(0, buf.byteLength - 4))).toThrow(/cut short/);
  });
});

describe('nearestStep', () => {
  it('picks the nearest step and gives up past one step either side', () => {
    expect(nearestStep([0, 3, 6], 4.4)).toBe(1);
    expect(nearestStep([0, 3, 6], 9)).toBe(2);
    expect(nearestStep([0, 3, 6], 9.5)).toBe(-1);
  });
});

describe('fetchGfsTemperature', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the 2 m level at the step nearest now and converts to °C, north row first', async () => {
    const dds = 'Float32 Temperature_height_above_ground[time = 3][height_above_ground3 = 3][lat = 2][lon = 3];';
    const das = 'Attributes {\n    time {\n        String units "Hour since 2026-10-12T00:00:00Z";\n    }\n}';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('.dds')) return new Response(dds);
      if (url.endsWith('.das')) return new Response(das);
      if (url.includes('.dods?time,')) {
        // Dataset order, not query order.
        return new Response(dods([
          { name: 'lat', type: 'Float32', values: [90, -90] }, { name: 'lon', type: 'Float32', values: [0, 120] },
          { name: 'time', type: 'Float64', values: [9, 12, 15] }, { name: 'height_above_ground3', type: 'Float32', values: [80, 2, 100] },
        ]));
      }
      return new Response(dods([{ name: 'Temperature_height_above_ground', type: 'Float32', values: [273.15, 283.15, 293.15, 263.15, 253.15, 243.15] }]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const field = await fetchGfsTemperature(Date.parse('2026-10-12T13:10:00Z'));

    expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/\[1\]\[1\]\[0:1:1\]\[0:1:2\]$/);
    expect(field).toMatchObject({ time: '2026-10-12T12:00:00.000Z', lat0: 90, dLat: -180, lng0: 0, dLng: 120, rows: 2, cols: 3 });
    expect([...field.values]).toEqual([0, 10, 20, -10, -20, -30].map(t => expect.closeTo(t, 3)));
  });
});

describe('fetchGfsWind', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for both components at 10 m, every second cell, in one request', async () => {
    const U = 'u-component_of_wind_height_above_ground', V = 'v-component_of_wind_height_above_ground';
    const dds = `Float32 ${U}[time1 = 3][height_above_ground2 = 7][lat = 3][lon = 4];\nFloat32 ${V}[time1 = 3][height_above_ground2 = 7][lat = 3][lon = 4];`;
    const das = 'Attributes {\n    time1 {\n        String units "Hour since 2026-10-12T00:00:00Z";\n    }\n}';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('.dds')) return new Response(dds);
      if (url.endsWith('.das')) return new Response(das);
      if (url.includes('.dods?time1,')) {
        return new Response(dods([
          { name: 'lat', type: 'Float32', values: [90, 0] }, { name: 'lon', type: 'Float32', values: [0, 90] },
          { name: 'time1', type: 'Float64', values: [9, 12, 15] }, { name: 'height_above_ground2', type: 'Float32', values: [10, 20, 30, 40, 50, 80, 100] },
        ]));
      }
      return new Response(dods([
        { name: U, type: 'Float32', values: [1, 2, 3, 4] }, { name: V, type: 'Float32', values: [-1, -2, -3, -4] },
      ]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const field = await fetchGfsWind(Date.parse('2026-10-12T13:10:00Z'));

    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain(`${U}.${U}[1][0][0:2:2][0:2:3],${V}.${V}[1][0][0:2:2][0:2:3]`);
    expect(field).toMatchObject({ time: '2026-10-12T12:00:00.000Z', lat0: 90, dLat: -180, lng0: 0, dLng: 180, rows: 2, cols: 2 });
    expect([...field.u]).toEqual([1, 2, 3, 4]);
    expect([...field.v]).toEqual([-1, -2, -3, -4]);
  });
});

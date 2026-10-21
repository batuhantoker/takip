import { afterEach, expect, it, vi } from 'vitest';
import { clearIpCache } from '@/lib/places/ip-location/ask-providers';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearIpCache();
});

const request = (headers: Record<string, string> = {}, query = '') =>
  new Request(`http://localhost/api/geo${query}`, { headers });

/** Answers each provider's URL with its own shape; unlisted providers fail. */
function providers(answers: Partial<Record<'ipapi' | 'ipinfo' | 'ipapi2' | 'ipwho' | 'free', unknown>>) {
  return vi.fn(async (url: string) => {
    const host = new URL(url).hostname;
    const key = ({ 'ipapi.co': 'ipapi', 'ipinfo.io': 'ipinfo', 'ip-api.com': 'ipapi2', 'ipwho.is': 'ipwho', 'freeipapi.com': 'free' } as const)[host];
    return key && key in answers ? Response.json(answers[key]) : new Response('down', { status: 503 });
  });
}

const SPECTRUM = {
  ipapi: { ip: '24.56.91.147', latitude: 41.771, longitude: -88.153, city: 'Naperville', region: 'Illinois', country_name: 'United States', timezone: 'America/Chicago', asn: 'AS10796', org: 'Charter Communications Inc' },
  free: { ipAddress: '24.56.91.147', latitude: 40.8373, longitude: -81.2596, cityName: 'Louisville', regionName: 'Ohio', countryName: 'United States' },
  ipapi2: { status: 'success', lat: 39.1138, lon: -84.4788, city: 'Dayton', regionName: 'Kentucky', country: 'United States', timezone: 'America/New_York', query: '24.56.91.147', isp: 'Spectrum', org: 'Spectrum', as: 'AS10796 Charter Communications Inc' },
  ipinfo: { ip: '24.56.91.147', loc: '39.2465,-84.5836', city: 'Northbrook', region: 'Ohio', country: 'US', timezone: 'America/New_York', org: 'AS10796 Charter Communications Inc' },
  ipwho: { success: true, ip: '24.56.91.147', latitude: 39.1271, longitude: -84.5144, city: 'Cincinnati', region: 'Ohio', country: 'United States', timezone: { id: 'America/New_York' }, connection: { asn: 10796, org: 'Charter Communications Inc', isp: 'Charter Communications Inc' } },
};

it('asks every provider about the visitor’s own address', async () => {
  const fetchMock = providers(SPECTRUM);
  vi.stubGlobal('fetch', fetchMock);
  await GET(request({ 'cf-connecting-ip': '24.56.91.147' }));
  const urls = fetchMock.mock.calls.map(c => c[0]);
  expect(urls).toHaveLength(5);
  for (const url of urls) expect(url).toContain('24.56.91.147');
});

it('lands where most providers agree, not where the first one says', async () => {
  vi.stubGlobal('fetch', providers(SPECTRUM));
  const body = await (await GET(request({ 'cf-connecting-ip': '24.56.91.147' }))).json();
  expect(body).toMatchObject({ status: 'success', city: 'Cincinnati', agreement: 3, answered: 5 });
  expect(body.lat).toBeCloseTo(39.13, 1);
  expect(body.lon).toBeCloseTo(-84.51, 1);
});

it('drops an answer from another time zone than the browser’s', async () => {
  vi.stubGlobal('fetch', providers({ ipapi: SPECTRUM.ipapi, free: SPECTRUM.free }));
  const body = await (await GET(request({ 'cf-connecting-ip': '24.56.91.147' }, '?tz=America%2FNew_York'))).json();
  expect(body.city).toBe('Louisville');
});

it('counts Cloudflare’s visitor location headers as one more answer', async () => {
  vi.stubGlobal('fetch', providers({ ipapi: SPECTRUM.ipapi }));
  const body = await (await GET(request({
    'cf-connecting-ip': '24.56.91.147', 'cf-iplatitude': '39.10', 'cf-iplongitude': '-84.51', 'cf-ipcity': 'Cincinnati',
    'cf-ipcountry': 'US', 'cf-timezone': 'America/New_York',
  }, '?tz=America%2FNew_York'))).json();
  expect(body).toMatchObject({ city: 'Cincinnati', country: 'United States', answered: 2 });
});

it('asks the providers once per address, then answers from memory', async () => {
  const fetchMock = providers(SPECTRUM);
  vi.stubGlobal('fetch', fetchMock);
  await GET(request({ 'cf-connecting-ip': '24.56.91.147' }));
  await GET(request({ 'cf-connecting-ip': '24.56.91.147' }));
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

it('fails plainly when no provider answers', async () => {
  vi.stubGlobal('fetch', providers({}));
  const res = await GET(request({ 'cf-connecting-ip': '24.56.91.147' }));
  expect(res.status).toBe(502);
});

it('never lets a cache hand one visitor’s location to another', async () => {
  vi.stubGlobal('fetch', providers(SPECTRUM));
  const res = await GET(request({ 'cf-connecting-ip': '81.2.69.142' }));
  expect(res.headers.get('cache-control')).toBe('private, no-store');
});

it('in production, does not fall back to locating the server when the visitor address is lost', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const res = await GET(request({ 'x-real-ip': '172.18.0.5', 'x-forwarded-for': '10.0.0.4' }));
  expect(await res.json()).toMatchObject({ status: 'fail' });
  expect(res.headers.get('cache-control')).toBe('private, no-store');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('in development, locates the developer’s own connection', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetchMock = providers(SPECTRUM);
  vi.stubGlobal('fetch', fetchMock);
  await GET(request());
  expect(fetchMock.mock.calls.map(c => c[0])).toContain('https://ipapi.co/json/');
});

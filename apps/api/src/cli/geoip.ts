import { createWriteStream, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { loadEnv, loadEnvFiles } from '../env';
import { openIpLocator } from '../geoip/ip-location';

/*
 * npm run geoip -w @takip/api: fetches this month's DB-IP Lite city database (CC BY 4.0, https://db-ip.com), or last
 * month's while this one isn't out yet, to GEOIP_PATH. Restart the api afterwards: it reads the file once.
 */

loadEnvFiles();
const env = loadEnv();
const target = env.GEOIP_PATH ?? join(env.TAKIP_DATA_DIR, 'geoip', 'dbip-city-lite.mmdb');

const month = (back: number) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toISOString().slice(0, 7);
};

async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) return false;
  mkdirSync(dirname(target), { recursive: true });
  const partial = `${target}.partial`;
  try {
    await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(partial));
    // Checked before it replaces a working file.
    if (!openIpLocator(partial)('8.8.8.8')?.country) throw new Error('the downloaded database answers nothing for 8.8.8.8');
    renameSync(partial, target);
  } finally {
    rmSync(partial, { force: true });
  }
  return true;
}

for (const back of [0, 1]) {
  const url = `https://download.db-ip.com/free/dbip-city-lite-${month(back)}.mmdb.gz`;
  if (await download(url)) {
    console.log(`Wrote ${target} from ${url}. Restart the api to use it.`);
    process.exit(0);
  }
}
console.error('No DB-IP Lite city database for this month or last; see https://db-ip.com/db/download/ip-to-city-lite.');
process.exit(1);

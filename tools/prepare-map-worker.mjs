import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

// MapLibre 6's module worker imports a sibling shared module. Self-host both
// from the installed version, rather than relying on a CDN or bundler-relative URL.
const root = new URL('../', import.meta.url);
const source = new URL('node_modules/maplibre-gl/', root);
const { version } = JSON.parse(await readFile(new URL('package.json', source), 'utf8'));
const vendor = new URL('public/vendor/maplibre/', root);
const target = new URL(`${version}/`, vendor);
await mkdir(target, { recursive: true });
// Served as .js: Cloudflare's edge caches .js but not .mjs, and the map's first tiles wait on this pair.
const SHARED_IMPORT = '"./maplibre-gl-shared.mjs"';
const worker = await readFile(new URL('dist/maplibre-gl-worker.mjs', source), 'utf8');
if (!worker.includes(SHARED_IMPORT)) throw new Error(`prepare-map-worker: the worker no longer imports ${SHARED_IMPORT}`);
await writeFile(new URL('maplibre-gl-worker.js', target), worker.replace(SHARED_IMPORT, '"./maplibre-gl-shared.js"'));
await copyFile(new URL('dist/maplibre-gl-shared.mjs', source), new URL('maplibre-gl-shared.js', target));
await copyFile(new URL('LICENSE.txt', source), new URL('LICENSE.txt', target));
for (const stale of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) await rm(new URL(stale, target), { force: true });

/* These files are committed, because the map hard-fails without them and a
   build that skips npm lifecycle scripts would otherwise ship none. Committing
   them means a stale directory survives a version bump, and a developer keeping
   the old copy is exactly how a broken worker URL passes locally and 404s in
   production. Prune everything but the installed version so the tree can only
   ever hold what the bundle actually asks for. */
for (const entry of await readdir(vendor, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== version) {
    await rm(new URL(`${entry.name}/`, vendor), { recursive: true, force: true });
    console.log(`prepare-map-worker: pruned stale maplibre ${entry.name}`);
  }
}

// Shapes and orders Arabic and Hebrew labels; MapLibre fetches it only once such text is on screen.
const rtl = new URL('public/vendor/rtl-text/', root);
await mkdir(rtl, { recursive: true });
await copyFile(new URL('node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js', root), new URL('mapbox-gl-rtl-text.js', rtl));

import { indexedPages } from './pages';
import { placePath } from './paths';

/** Well under the 50,000 a sitemap may hold, so topics can grow without a chunk overflowing between builds. */
const PER_CHUNK = 20_000;

const paths = () => indexedPages().map(({ place, slug }) => placePath(place, slug));

/** One spare chunk: the camera pages are counted when the server runs, and may outgrow the build's count. */
export const placeSitemapIds = () => Array.from({ length: Math.ceil(paths().length / PER_CHUNK) + 1 }, (_, id) => ({ id }));

export const placeSitemapChunk = (id: number) => (Number.isInteger(id) && id >= 0 ? paths().slice(id * PER_CHUNK, (id + 1) * PER_CHUNK) : []);

/** For robots.txt. */
export const placeSitemapUrls = (origin: string) => placeSitemapIds().map(({ id }) => `${origin}/places/sitemap/${id}.xml`);

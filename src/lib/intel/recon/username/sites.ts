const DATA_URL =
  'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json';

/** Shape of one entry in Sherlock's data.json. */
export interface SiteDef {
  url: string;
  urlMain: string;
  urlProbe?: string;
  errorType: 'status_code' | 'message' | 'response_url';
  errorMsg?: string | string[];
  errorUrl?: string;
  errorCode?: number | number[];
  regexCheck?: string;
  request_method?: string;
  request_payload?: unknown;
  headers?: Record<string, string>;
  isNSFW?: boolean;
  username_claimed?: string;
}

/** The list changes rarely; refetching per scan would be wasteful. */
const DB_TTL = 6 * 60 * 60_000;
let dbCache: { at: number; sites: Record<string, SiteDef> } | null = null;
let dbInflight: Promise<Record<string, SiteDef>> | null = null;

export async function loadSites(): Promise<Record<string, SiteDef>> {
  if (dbCache && Date.now() - dbCache.at < DB_TTL) return dbCache.sites;
  if (dbInflight) return dbInflight;

  dbInflight = (async () => {
    try {
      // Outbound connects here intermittently hit UND_ERR_CONNECT_TIMEOUT on a
      // busy server even while the network is healthy. Losing the site list
      // fails the whole scan, so it is worth two extra attempts.
      let res: Response | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await fetch(DATA_URL, {
            signal: AbortSignal.timeout(20000),
            headers: { Accept: 'application/json' },
          });
          break;
        } catch (e) {
          lastError = e;
          if (attempt < 2) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      if (!res) throw lastError instanceof Error ? lastError : new Error('Sherlock data.json unreachable');
      if (!res.ok) throw new Error(`Sherlock data.json responded ${res.status}`);
      const raw = await res.json();
      const sites: Record<string, SiteDef> = {};
      for (const [name, def] of Object.entries<any>(raw)) {
        if (name === '$schema' || !def?.url || !def?.errorType) continue;
        sites[name] = def as SiteDef;
      }
      if (!Object.keys(sites).length) throw new Error('Sherlock data.json empty');
      dbCache = { at: Date.now(), sites };
      return sites;
    } catch (e) {
      if (dbCache) return dbCache.sites;   // stale beats nothing
      throw e;
    } finally {
      dbInflight = null;
    }
  })();

  return dbInflight;
}

/**
 * High-signal platforms checked by default. A full 481-site sweep does not
 * fit in a single request budget, so the default tier covers the sites an
 * investigator actually wants first; `?all=1` widens it.
 */
export const PRIORITY = [
  'GitHub', 'GitLab', 'Reddit', 'Instagram', 'TikTok', 'YouTube', 'Twitch', 'Steam',
  'Telegram', 'Pinterest', 'Tumblr', 'Flickr', 'SoundCloud', 'Spotify', 'Medium',
  'Patreon', 'BuyMeACoffee', 'Kick', 'VK', 'Vimeo', 'Dribbble', 'Behance', 'DeviantART',
  'HackerNews', 'HackerOne', 'Keybase', 'Kaggle', 'Replit.com', 'CodePen', 'Codecademy',
  'Docker Hub', 'npm', 'PyPi', 'RubyGems', 'Bitbucket', 'Launchpad', 'CodersRank',
  'LeetCode', 'Codeforces', 'HackerEarth', 'Chess.com', 'Lichess', 'Duolingo',
  'Last.fm', 'Bandcamp', 'MixCloud', 'Genius', 'Discogs', 'Untappd', 'Strava',
  'Trakt', 'Letterboxd', 'MyAnimeList', 'Anilist', 'Goodreads', 'Wattpad',
  'Blogger', 'WordPress', 'Slideshare', 'About.me', 'Linktree', 'Gravatar',
  'Roblox', 'Fiverr', 'Freelancer', 'Wikipedia', 'Archive.org', 'Ask FM', 'Snapchat',
];

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://searchconsole.googleapis.com/webmasters/v3';

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

/** One row of a Search Analytics answer: `keys` follow the requested dimensions; position is the average, 1 = top. */
export type SearchRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

export type SearchQuery = {
  startDate: string;
  endDate: string;
  dimensions: ('date' | 'page' | 'query' | 'country' | 'device')[];
  rowLimit?: number;
  startRow?: number;
};

export type SearchConsole = {
  /** The service account's address, which has to be a user on the property. */
  account: string;
  /** The property the account can read: the one GSC_SITE names, else the one for `host`. Null when it can read none. */
  site(): Promise<string | null>;
  query(q: SearchQuery): Promise<SearchRow[]>;
};

const base64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

/**
 * Reads Google Search Console as a service account (JSON key at `credentialsPath`, read-only scope), with no
 * library: a signed JWT buys an hour's token. Null when no key is configured.
 */
export function createSearchConsole({ credentialsPath, site: configured, host, fetch: get = fetch, now = () => Date.now() }: {
  credentialsPath?: string; site?: string; host?: string; fetch?: typeof fetch; now?: () => number;
}): SearchConsole | null {
  if (!credentialsPath) return null;
  const key = JSON.parse(readFileSync(credentialsPath, 'utf8')) as ServiceAccount;
  let token: { value: string; until: number } | null = null;
  let site: string | null | undefined = configured;

  async function bearer() {
    if (token && token.until > now() + 60_000) return token.value;
    const iat = Math.floor(now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
      iss: key.client_email, scope: SCOPE, aud: key.token_uri ?? TOKEN_URL, iat, exp: iat + 3600,
    }))}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
    const res = await get(key.token_uri ?? TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    });
    const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
    if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
    token = { value: body.access_token, until: now() + (body.expires_in ?? 3600) * 1000 };
    return token.value;
  }

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await get(`${API}${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${await bearer()}`, 'content-type': 'application/json' } });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(`Search Console: ${body.error?.message ?? res.status}`);
    return body;
  }

  return {
    account: key.client_email,
    async site() {
      if (site !== undefined) return site;
      const { siteEntry = [] } = await call<{ siteEntry?: { siteUrl: string }[] }>('/sites');
      const urls = siteEntry.map(s => s.siteUrl);
      // A domain property covers every address on the host, so it wins over a URL-prefix one.
      site = urls.find(u => u === `sc-domain:${host}`) ?? urls.find(u => u === `https://${host}/`) ?? urls.find(u => !!host && u.includes(host)) ?? urls[0] ?? null;
      // Not kept when empty: the account may be added to the property later.
      if (!site) site = undefined;
      return site ?? null;
    },
    async query(q) {
      const target = await this.site();
      if (!target) return [];
      const { rows = [] } = await call<{ rows?: SearchRow[] }>(`/sites/${encodeURIComponent(target)}/searchAnalytics/query`, {
        method: 'POST',
        // 'all' takes the last two days' fresh, still-changing numbers too.
        body: JSON.stringify({ type: 'web', dataState: 'all', rowLimit: 1000, ...q }),
      });
      return rows;
    },
  };
}

// Search Console names countries by ISO 3166-1 alpha-3; the admin's flags and names want alpha-2.
const ALPHA3 = Object.fromEntries(`AFG:AF ALA:AX ALB:AL DZA:DZ ASM:AS AND:AD AGO:AO AIA:AI ATA:AQ ATG:AG ARG:AR ARM:AM ABW:AW AUS:AU AUT:AT AZE:AZ
BHS:BS BHR:BH BGD:BD BRB:BB BLR:BY BEL:BE BLZ:BZ BEN:BJ BMU:BM BTN:BT BOL:BO BES:BQ BIH:BA BWA:BW BVT:BV BRA:BR IOT:IO BRN:BN BGR:BG BFA:BF
BDI:BI CPV:CV KHM:KH CMR:CM CAN:CA CYM:KY CAF:CF TCD:TD CHL:CL CHN:CN CXR:CX CCK:CC COL:CO COM:KM COG:CG COD:CD COK:CK CRI:CR CIV:CI HRV:HR
CUB:CU CUW:CW CYP:CY CZE:CZ DNK:DK DJI:DJ DMA:DM DOM:DO ECU:EC EGY:EG SLV:SV GNQ:GQ ERI:ER EST:EE SWZ:SZ ETH:ET FLK:FK FRO:FO FJI:FJ FIN:FI
FRA:FR GUF:GF PYF:PF ATF:TF GAB:GA GMB:GM GEO:GE DEU:DE GHA:GH GIB:GI GRC:GR GRL:GL GRD:GD GLP:GP GUM:GU GTM:GT GGY:GG GIN:GN GNB:GW GUY:GY
HTI:HT HMD:HM VAT:VA HND:HN HKG:HK HUN:HU ISL:IS IND:IN IDN:ID IRN:IR IRQ:IQ IRL:IE IMN:IM ISR:IL ITA:IT JAM:JM JPN:JP JEY:JE JOR:JO KAZ:KZ
KEN:KE KIR:KI PRK:KP KOR:KR KWT:KW KGZ:KG LAO:LA LVA:LV LBN:LB LSO:LS LBR:LR LBY:LY LIE:LI LTU:LT LUX:LU MAC:MO MDG:MG MWI:MW MYS:MY MDV:MV
MLI:ML MLT:MT MHL:MH MTQ:MQ MRT:MR MUS:MU MYT:YT MEX:MX FSM:FM MDA:MD MCO:MC MNG:MN MNE:ME MSR:MS MAR:MA MOZ:MZ MMR:MM NAM:NA NRU:NR NPL:NP
NLD:NL NCL:NC NZL:NZ NIC:NI NER:NE NGA:NG NIU:NU NFK:NF MKD:MK MNP:MP NOR:NO OMN:OM PAK:PK PLW:PW PSE:PS PAN:PA PNG:PG PRY:PY PER:PE PHL:PH
PCN:PN POL:PL PRT:PT PRI:PR QAT:QA REU:RE ROU:RO RUS:RU RWA:RW BLM:BL SHN:SH KNA:KN LCA:LC MAF:MF SPM:PM VCT:VC WSM:WS SMR:SM STP:ST SAU:SA
SEN:SN SRB:RS SYC:SC SLE:SL SGP:SG SXM:SX SVK:SK SVN:SI SLB:SB SOM:SO ZAF:ZA SGS:GS SSD:SS ESP:ES LKA:LK SDN:SD SUR:SR SJM:SJ SWE:SE CHE:CH
SYR:SY TWN:TW TJK:TJ TZA:TZ THA:TH TLS:TL TGO:TG TKL:TK TON:TO TTO:TT TUN:TN TUR:TR TKM:TM TCA:TC TUV:TV UGA:UG UKR:UA ARE:AE GBR:GB USA:US
UMI:UM URY:UY UZB:UZ VUT:VU VEN:VE VNM:VN VGB:VG VIR:VI WLF:WF ESH:EH YEM:YE ZMB:ZM ZWE:ZW XKK:XK XKX:XK`.split(/\s+/).map(p => p.split(':')));

/** 'tur' → 'TR'; null for Search Console's 'zzz' (unknown) or anything else it doesn't know. */
export const alpha2 = (alpha3: string) => ALPHA3[alpha3.toUpperCase()] ?? null;

import { z } from '@hono/zod-openapi';

export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 2000;
export const MAX_LINK = 2000;
export const MAX_BODY = 16 * 1024;

const text = (max: number) => z.string().trim().max(max);
// A path on this site only: no scheme, no protocol-relative "//" or "/\", nothing a browser would take elsewhere.
const SITE_PATH = /^\/(?![/\\])[^\s\\]*$/;

/** What the reporter was looking at, so the view can be rebuilt. Every field is optional: an API caller may have no map. */
export const ReportView = z.object({
  link: z.string().max(MAX_LINK).regex(SITE_PATH, 'a path on this site, starting with /').optional()
    .openapi({ description: 'Reopens the view: a path with its query, such as /?lat=41.0&lon=29.0&zoom=6&layers=flights.', example: '/?lat=41.0100&lon=28.9800&zoom=6.00&layers=flights,ships' }),
  center: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  zoom: z.number().min(0).max(30).optional(),
  bearing: z.number().min(-360).max(360).optional(),
  pitch: z.number().min(0).max(90).optional(),
  mode: z.enum(['live', 'replay', 'history']).optional(),
  time: text(40).optional().openapi({ description: 'In Replay or History, the moment shown: ISO 8601, or "250 Ma" in deep time.' }),
  space: text(40).optional().openapi({ description: 'Set while the space view is open: where it is looking.' }),
  track: text(60).optional().openapi({ description: 'What the map follows, as a share link names it: aircraft:4bb1c2.' }),
  baseMap: text(40).optional(),
  projection: text(20).optional(),
  theme: text(40).optional(),
  layers: z.array(text(64)).max(300).optional().openapi({ description: 'The layers switched on.' }),
  panel: text(40).nullable().optional().openapi({ description: 'The panel open beside the map, if any.' }),
  point: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional()
    .openapi({ description: 'Where the reporter right-clicked, when they reported from the map.' }),
  viewport: z.object({ width: z.number().int().min(0).max(20_000), height: z.number().int().min(0).max(20_000) }).optional(),
  version: text(40).optional(),
}).openapi('ReportView');

export const NewReport = z.object({
  message: z.string().trim().min(MIN_MESSAGE).max(MAX_MESSAGE).openapi({ description: `What went wrong, in the reporter's words: ${MIN_MESSAGE}–${MAX_MESSAGE} characters.` }),
  view: ReportView.optional(),
}).openapi('NewReport');

export const ReportReceived = z.object({ ok: z.literal(true), id: z.number().int() }).openapi('ReportReceived');

export const ReportTooLarge = z.object({ error: z.literal('too_large'), limit: z.literal(MAX_BODY) }).openapi('ReportTooLarge');

export const RateLimited = z.object({ error: z.literal('rate_limited'), retry_after: z.number().int().openapi({ description: 'Seconds.' }) }).openapi('RateLimited');

export type ReportViewData = z.infer<typeof ReportView>;

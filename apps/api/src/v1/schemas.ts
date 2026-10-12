import { z } from '@hono/zod-openapi';

/**
 * A query parameter as `URLSearchParams.get` reads it: the first value when repeated.
 * Handlers parse and reject it themselves, so the error bodies stay the ones callers already know.
 */
export const queryParam = () => z.preprocess(v => (Array.isArray(v) ? v[0] : v), z.string().optional());

export const ErrorBody = z.object({ error: z.string() }).openapi('Error');

export const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });

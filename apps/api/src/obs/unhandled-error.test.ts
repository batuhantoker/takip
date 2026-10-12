import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { startApp, type TestApp } from '../testing/helpers';
import { createLogger } from './logger';
import { unhandledError } from './unhandled-error';

type Line = Record<string, unknown> & { level: number; msg: string; err?: { message: string; stack: string } };

let t: TestApp;
let raw: string[];
let consoleError: MockInstance;

const logger = () => createLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' }, { write: line => raw.push(line) });
const lines = () => raw.map(line => JSON.parse(line) as Line);

beforeEach(async () => {
  raw = [];
  t = await startApp({}, { logger: logger() });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe('an unhandled error', () => {
  it('is answered with a generic 500 and the request id, and logged once with its stack', async () => {
    t.app.get('/api/v1/boom', () => {
      throw new Error('kaput at /srv/secret');
    });
    const res = await t.app.request('/api/v1/boom', { headers: { 'x-request-id': 'boom-1' } });

    expect(res.status).toBe(500);
    expect(res.headers.get('x-request-id')).toBe('boom-1');
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: 'internal_error', request_id: 'boom-1' });
    expect(body).not.toContain('kaput');

    const logged = lines().filter(line => JSON.stringify(line).includes('kaput'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ level: 50, msg: 'request', requestId: 'boom-1', path: '/api/v1/boom', status: 500 });
    expect(logged[0].err!.stack).toContain('Error: kaput');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps the response an HTTPException carries', async () => {
    t.app.get('/teapot', () => {
      throw new HTTPException(418, { message: 'short and stout' });
    });
    const res = await t.app.request('/teapot');
    expect([res.status, await res.text()]).toEqual([418, 'short and stout']);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('is logged by the handler itself where no request logger ran', async () => {
    const app = new Hono();
    app.onError(unhandledError(logger()));
    app.get('/boom', () => {
      throw new Error('early');
    });
    const res = await app.request('/boom');
    expect([res.status, await res.json()]).toEqual([500, { error: 'internal_error' }]);
    expect(lines()).toMatchObject([{ level: 50, msg: 'unhandled error', err: { message: 'early' } }]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

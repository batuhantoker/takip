import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openSourceSwitchboard } from './sources';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'switchboard-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('switches a source and tells the recorder through control.json', () => {
  const board = openSourceSwitchboard({ dataDir: dir, archiveDir: join(dir, 'archive') }, () => 1000);
  expect(board.list().find(s => s.code === 'cctv')).toMatchObject({ record: true, build: true });
  expect(board.set('cctv', { record: false }, 'admin:u1')).toMatchObject({ record: false, build: true, switchedBy: 'admin:u1', switchedAt: 1000 });
  expect(board.set('nope', { record: false }, 'admin:u1')).toBeUndefined();
  const control = JSON.parse(readFileSync(join(dir, 'archive', 'control.json'), 'utf8'));
  expect(control.sources.cctv).toEqual({ record: false });
  expect(control.sources.opensky).toEqual({ record: true });
  board.close();
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from './locales';
import { messageVariables } from './message';

const read = (locale: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'catalogs', `${locale}.json`), 'utf8')) as Record<string, unknown>;

describe.each(LOCALES.filter(l => l !== 'en'))('the %s catalog', locale => {
  const catalog = read(locale);

  it('translates every entry to text', () => {
    expect(Object.entries(catalog).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it('reads the same variables as each source', () => {
    const broken = Object.entries(catalog)
      .filter(([source, tr]) => messageVariables(source).join() !== messageVariables(tr as string).join())
      .map(([source]) => source);
    expect(broken).toEqual([]);
  });
});

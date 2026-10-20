import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from '../context';
import type { BulletDate } from './parse';

/* The fetch's output, one file per language, read by datasets/wikipedia-years.ts. */

export const YEARS_DIR = join(RAW_MORE, 'wikipedia-years');
export const yearsFile = (lang: string) => join(YEARS_DIR, `${lang}.json`);
export const CLASSES_FILE = join(YEARS_DIR, 'classes.json');

export type YearsPage = { title: string; revid: number; year: number; span: 'year' | 'decade' | 'century'; country?: string; countries?: string[]; portal?: [month: number, day: number] };
/** A link title, the article it ends at when that differs, its Wikidata item; `x` when the page doesn't exist. */
export type YearsLink = { t: string; to?: string; q?: string; x?: 1 };
/**
 * `p` page index, `s` section path, `t` text, `l` own links, `a` those the text puts it in or at, `c` the links of the
 * bullets above it (indexes into `links`); `b` when it is only a link.
 */
export type YearsBullet = { p: number; s?: string; t: string; l: number[]; a?: number[]; c?: number[]; d: BulletDate; b?: 1 };

export type YearsFile = {
  lang: string;
  fetched: string;
  stats: Record<string, number | Record<string, number>>;
  pages: YearsPage[];
  links: YearsLink[];
  bullets: YearsBullet[];
};

export const readYears = (lang: string): YearsFile => JSON.parse(readFileSync(yearsFile(lang), 'utf8')) as YearsFile;

/** The article a link ends at, through redirects. */
export const target = (l: YearsLink) => l.to ?? l.t;

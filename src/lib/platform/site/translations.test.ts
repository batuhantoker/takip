import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/core/i18n/locales';
import { ABOUT } from './about-copy';
import { loadSiteCopy } from './copy';
import { LAYER_PAGES, SECTIONS } from './layer-pages';

// Search results cut by width, and CJK characters are about twice as wide.
const LIMITS = { latin: { title: 60, description: [70, 165] }, cjk: { title: 32, description: [40, 95] } } as const;

describe.each(LOCALES.filter(l => l !== 'en'))('the %s page copy', locale => {
  it('covers every page, section and About key, with lists the length of the English', async () => {
    const copy = await loadSiteCopy(locale);
    const limits = locale === 'zh' || locale === 'ja' ? LIMITS.cjk : LIMITS.latin;
    for (const page of LAYER_PAGES) {
      const c = copy.pages[page.slug];
      expect(c, page.slug).toBeDefined();
      for (const key of ['title', 'description', 'heading', 'lede', 'freshness'] as const) expect(c?.[key], `${page.slug}.${key}`).toBeTruthy();
      expect(c?.shows?.length, `${page.slug}.shows`).toBe(page.shows.length);
      expect(c?.limits?.length, `${page.slug}.limits`).toBe(page.limits.length);
      expect(c?.sources?.length, `${page.slug}.sources`).toBe(page.sources.length);
      expect(c?.spots?.length ?? 0, `${page.slug}.spots`).toBe(page.spots?.length ?? 0);
      expect([...c!.title!].length, `${page.slug}: ${c?.title}`).toBeLessThanOrEqual(limits.title);
      const d = [...c!.description!].length;
      expect(d >= limits.description[0] && d <= limits.description[1], `${page.slug}: ${d} characters`).toBe(true);
    }
    for (const { id } of SECTIONS) expect(copy.sections?.[id]?.label, id).toBeTruthy();
    for (const [key, en] of Object.entries(ABOUT)) {
      const v = copy.about?.[key];
      if (Array.isArray(en)) expect((v as string[] | undefined)?.length, key).toBe(en.length);
      else expect(v, key).toBeTruthy();
    }
  });
});

import type { DataAttributes } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import type { StopId } from './lib/stops';

/** Marks a panel's section for the tour's look inside, in words the panel has already translated. */
export const tourPart = (stop: StopId, title: string, body: string): DataAttributes => ({
  'data-tour-part': stop,
  'data-tour-title': title,
  'data-tour-body': body,
});

/** "A, B and C" in the reader's language, for a section that names a few of the many things in it. */
export const fewOf = (names: string[], t: Translate) =>
  new Intl.ListFormat(t.locale === 'en' ? 'en-GB' : t.intl, { type: 'conjunction' }).format(names);

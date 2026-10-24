import Form from 'next/form';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { pickerOptions } from '@/lib/platform/site/compare/countries';
import type { Place } from '@/lib/platform/site/places/place';
import { CountryPicker } from './country-picker';

/** The countries compared, each in its chart colour and taken off with its ×, and a picker for one more. */
export function CountryBar({ countries, add, t }: {
  countries: { place: Place; label: string; slot: number; remove?: string }[];
  /** Where the picker sends the page and the query it keeps; undefined once the chart has a colour for no more. */
  add?: { action: string; keep: [string, string][] };
  t: Translate;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {countries.map(c => (
        <span key={c.place.id} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface-1 pr-1 pl-3 text-[13px] text-ink-1">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: SERIES_INK[c.slot % SERIES_INK.length] }} />
          {c.label}
          {c.remove ? (
            <Link href={c.remove} scroll={false} prefetch={false} rel="nofollow" aria-label={t('Remove {country}', { country: c.label })}
              className={cx('grid size-6 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
              <X className="size-3.5" aria-hidden />
            </Link>
          ) : <span className="w-2" />}
        </span>
      ))}
      {add && (
        <Form action={add.action} scroll={false} prefetch={false}>
          {add.keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <CountryPicker name="add" submit required look="chip" label={t('Add a country')} placeholder={t('+ Add a country')} empty={t('No country matches')}
            options={pickerOptions(t, new Set(countries.map(c => c.place.id)))} />
        </Form>
      )}
    </div>
  );
}

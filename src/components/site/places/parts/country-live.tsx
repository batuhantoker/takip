import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg } from '@/lib/core/i18n/translator';
import { layerPage, pagePath } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { count, nameOf } from '@/lib/platform/site/places/copy/format';
import { countryLive, type LiveTopic } from '@/lib/platform/site/places/country-live';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import { pageIn, type SiteText } from '@/lib/platform/site/text';

const ROW: Record<LiveTopic, string> = { cameras: msg('Live cameras'), weather: msg('Weather'), transit: msg('Live transit'), flights: msg('Flights') };
const LAYER_PAGES = ['live-cameras', 'flight-tracker', 'rain-radar'];

/** A country overview's way into its cities' live pages; nothing when no city has one. */
export function CountryLive({ text, place }: { text: SiteText; place: Place }) {
  const { t } = text;
  const rows = countryLive(place);
  if (!rows.length) return null;
  const layers = LAYER_PAGES.map(slug => layerPage(slug)).filter(p => !!p).map(p => pageIn(text, p));
  return (
    <Section title={t('Live in {country}', { country: nameOf(place, t) })}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
        {rows.map(r => (
          <div key={r.topic} className="contents">
            <dt className="font-medium text-ink-1">{t(ROW[r.topic])}</dt>
            <dd className="text-ink-2">
              {r.links.map((l, i) => (
                <span key={l.place.id}>
                  {i > 0 && ', '}
                  <Link href={localePath(t.locale, placePath(l.place, l.slug))} className={TEXT_LINK}>{nameOf(l.place, t)}</Link>
                  {l.cameras !== undefined && <span className="text-ink-3"> ({count(l.cameras, t)})</span>}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      {layers.length > 0 && (
        <p className="mt-4 text-[14px] text-ink-2">
          {t('On the whole map:')}{' '}
          {layers.map((p, i) => (
            <span key={p.slug}>
              {i > 0 && ', '}
              <Link href={localePath(t.locale, pagePath(p))} className={TEXT_LINK}>{p.heading}</Link>
            </span>
          ))}
        </p>
      )}
    </Section>
  );
}

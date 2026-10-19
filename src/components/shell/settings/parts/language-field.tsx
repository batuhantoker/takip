'use client';

import { Select } from '@/components/ui/field';
import { useLocale } from '@/components/ui/use-t';
import { chooseLocale } from '@/lib/core/i18n/choice';
import { isLocale, LOCALE_NAMES, LOCALES } from '@/lib/core/i18n/locales';

export default function LanguageField() {
  const { t, chosen, automatic } = useLocale();
  const options = [
    { value: '', label: t('Automatic ({language})', { language: LOCALE_NAMES[automatic] }) },
    ...LOCALES.map(l => ({ value: l, label: LOCALE_NAMES[l] })),
  ];
  return (
    <Select label={t('Show TAKIP in')} value={chosen ?? ''} options={options}
      hint={t('Automatic follows the country you open TAKIP from. The page reloads to switch.')}
      onChange={e => chooseLocale(isLocale(e.target.value) ? e.target.value : null)} />
  );
}

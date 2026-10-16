'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/field';
import { getWikiLanguage, setWikiLanguage } from '@/lib/core/wikipedia/language';
import { wikiLanguageOptions } from '../lib/wiki-language-options';

export default function WikiLanguageField() {
  const [lang, setLang] = useState(getWikiLanguage);
  return (
    <Select label="Language" value={lang} options={wikiLanguageOptions(lang)}
      hint="History popups show this Wikipedia's article when there is one, else the one the data names."
      onChange={e => { setWikiLanguage(e.target.value); setLang(getWikiLanguage()); }} />
  );
}

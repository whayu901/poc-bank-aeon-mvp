import React from 'react';
import { en } from '@/i18n/en';
import { ms } from '@/i18n/ms';
import { useLanguage, type Language } from '@/store/preferencesStore';

export const dictionaries = {
  en,
  ms,
} as const;

export type Translation = typeof en;

export function getDictionary(language: Language): Translation {
  return dictionaries[language];
}

export function useTranslation() {
  // Use the stable selector hook instead of inline selector
  const language = useLanguage();

  // Memoize the dictionary to prevent creating new object on every render
  const t = React.useMemo(() => getDictionary(language), [language]);

  return React.useMemo(
    () => ({
      language,
      t,
    }),
    [language, t]
  );
}

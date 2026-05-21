import { en } from '@/i18n/en';
import { ms } from '@/i18n/ms';
import { usePreferencesStore, type Language } from '@/store/preferencesStore';

export const dictionaries = {
  en,
  ms,
} as const;

export type Translation = typeof en;

export function getDictionary(language: Language): Translation {
  return dictionaries[language];
}

export function useTranslation() {
  const language = usePreferencesStore((state) => state.language);

  return {
    language,
    t: getDictionary(language),
  };
}

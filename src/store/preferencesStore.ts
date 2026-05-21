import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'en' | 'ms';

interface PreferencesState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage(language) {
        set({ language });
      },
    }),
    {
      name: 'aeon-bank-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
      }),
    },
  ),
);

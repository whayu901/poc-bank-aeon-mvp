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

// Stable selectors to prevent re-renders
const selectLanguage = (state: PreferencesState) => state.language;
const selectSetLanguage = (state: PreferencesState) => state.setLanguage;

// Export selector hooks
export const useLanguage = () => usePreferencesStore(selectLanguage);
export const useSetLanguage = () => usePreferencesStore(selectSetLanguage);

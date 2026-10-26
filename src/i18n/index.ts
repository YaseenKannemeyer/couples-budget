import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

export const resources = { en: { translation: en } } as const;

export const i18n = createInstance();

// All resources ship with the app: first render and offline use need no network request.
i18n.use(initReactI18next).init({
  resources,
  lng: getLocales()[0]?.languageTag ?? 'en',
  fallbackLng: 'en',
  supportedLngs: Object.keys(resources),
  nonExplicitSupportedLngs: true,
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

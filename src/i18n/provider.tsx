import { useLocales } from 'expo-localization';
import { useEffect, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { i18n } from './index';

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const locale = useLocales()[0]?.languageTag ?? 'en';

  // Expo's hook also tracks changes made in Android settings while the app is running.
  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

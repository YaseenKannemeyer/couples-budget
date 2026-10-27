import { render, renderHook } from '@testing-library/react-native';
import { getLocales, useLocales } from 'expo-localization';
import { Text } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import { useFormatters } from '@/hooks/use-formatters';
import { i18n } from '@/i18n';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'en-ZA' }]),
  useLocales: jest.fn(() => [{ languageTag: 'en-ZA' }]),
  useCalendars: jest.fn(() => [{ timeZone: 'America/Los_Angeles' }]),
}));

function Copy() {
  const { t } = useTranslation();
  return (
    <>
      <Text>{t('navigation.home')}</Text>
      <Text>{t('home.greeting', { name: '<Alex & Sam>' })}</Text>
      <Text>
        <Trans i18nKey="setup.environment" components={{ code: <Text /> }} />
      </Text>
    </>
  );
}

beforeEach(async () => {
  jest.mocked(useLocales).mockReturnValue(getLocales());
  await i18n.changeLanguage('en-ZA');
});

it('renders bundled English immediately, including regional variants and interpolated names', async () => {
  const view = await render(<LocalizationProvider><Copy /></LocalizationProvider>);
  expect(view.getByText('Home')).toBeTruthy();
  expect(view.getByText('Hi <Alex & Sam>')).toBeTruthy();
  expect(view.getByText(/Copy .env.example to .env.local and paste/)).toBeTruthy();
});

it('tracks device language changes and falls back to English for an unsupported language', async () => {
  const view = await render(<LocalizationProvider><Copy /></LocalizationProvider>);
  const changeLanguage = jest.spyOn(i18n, 'changeLanguage');
  jest.mocked(useLocales).mockReturnValue([{ ...getLocales()[0], languageTag: 'de-DE' }]);
  await view.rerender(<LocalizationProvider><Copy /></LocalizationProvider>);
  expect(changeLanguage).toHaveBeenLastCalledWith('de-DE');
  expect(i18n.resolvedLanguage).toBe('en');
  expect(view.getByText('Home')).toBeTruthy();
  changeLanguage.mockRestore();
});

it('keeps regional number formatting even when copy falls back to English, and uses the household timezone', async () => {
  jest.mocked(useLocales).mockReturnValue([{ ...getLocales()[0], languageTag: 'de-DE' }]);
  const { result, rerender } = await renderHook(
    (timezone: string) => useFormatters(timezone),
    { initialProps: 'Africa/Johannesburg' }
  );
  expect(result.current.money(123456, 'EUR')).toBe('1.234,56 €');
  expect(result.current.number(1234.5)).toBe('1.234,5');
  const instant = new Date('2026-11-01T23:30:00Z');
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  expect(result.current.date(instant, dateOptions)).toBe('02.11.2026');
  await rerender('America/Los_Angeles');
  expect(result.current.date(instant, dateOptions)).toBe('01.11.2026');
});

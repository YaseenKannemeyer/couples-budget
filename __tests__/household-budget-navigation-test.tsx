import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import HouseholdScreen from '@/app/(onboarding)/household';
import { useCreateHousehold, useJoinHousehold } from '@/features/household/api';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', currencyCode: 'USD' }],
  useLocales: () => [{ languageTag: 'en-US', currencyCode: 'USD' }],
  useCalendars: () => [{ timeZone: 'UTC' }],
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));
jest.mock('@/features/household/api', () => ({ useCreateHousehold: jest.fn(), useJoinHousehold: jest.fn() }));

it.each(['create', 'join'])('opens the budget after %s even when the household guard unmounts the form', async (path) => {
  jest.clearAllMocks();
  let unmount = async () => {};
  const mutateAsync = jest.fn(async () => { await unmount(); });
  jest.mocked(useCreateHousehold).mockReturnValue({ mutateAsync, isPending: false, error: null } as unknown as ReturnType<typeof useCreateHousehold>);
  jest.mocked(useJoinHousehold).mockReturnValue({ mutateAsync, isPending: false, error: null } as unknown as ReturnType<typeof useJoinHousehold>);
  const view = await render(<LocalizationProvider><HouseholdScreen /></LocalizationProvider>);
  unmount = view.unmount;
  if (path === 'join') await fireEvent.press(view.getByRole('tab', { name: 'Join my partner' }));
  await fireEvent.changeText(view.getByLabelText('Your first name'), 'Alex');
  if (path === 'join') await fireEvent.changeText(view.getByLabelText('Invite code'), 'ABCD-EFGH');
  await fireEvent.press(view.getByRole('button', { name: path === 'join' ? 'Join household' : 'Create our household' }));
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/budget');
});

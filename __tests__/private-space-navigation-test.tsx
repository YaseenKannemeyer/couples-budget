import { fireEvent, render } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PaymentEditor } from '@/features/payments/payment-editor';
import { PaymentsScreen } from '@/features/payments/payments-screen';
import { usePaymentAction } from '@/features/payments/api';
import { usePaymentData } from '@/features/payments/ui';
import { LocalizationProvider } from '@/i18n/provider';
import { household, me, partner, schedule, workspace } from '../test/fixtures/payments';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/quick-log/schedule-source', () => ({ useScheduleSource: jest.fn() }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/payments/api', () => ({ usePaymentAction: jest.fn(), usePaymentWorkspace: jest.fn() }));
jest.mock('@/features/payments/ui', () => ({ ...jest.requireActual('@/features/payments/ui'), usePaymentData: jest.fn() }));
jest.mock('@/features/payments/reminders', () => ({ useDevicePaymentReminders: () => ({ available: false }) }));
beforeEach(() => jest.clearAllMocks());
it('opens a private bill draft with Private already selected and keeps the payer owner-only', async () => {
  const mutateAsync = jest.fn(async (_input: { value: unknown }) => 'id');
  jest.mocked(usePaymentAction).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof usePaymentAction>);
  const view = await render(<LocalizationProvider><PaymentEditor defaultVisibility="private" household={household} me={me} members={[me, partner]} workspace={workspace} reload={jest.fn()} /></LocalizationProvider>);
  expect(view.getByRole('radio', { name: 'Private' }).props.accessibilityState.checked).toBe(true);
  await fireEvent.changeText(view.getByLabelText('Payment name'), 'My membership');
  await fireEvent.press(view.getByRole('button', { name: 'Save payment' }));
  expect(mutateAsync.mock.calls[0][0].value).toMatchObject({ visibility: 'private', payerId: me.userId });
});
it('filters the management list to owner-private schedules, retaining status controls', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ visibility: 'private' });
  jest.mocked(usePaymentData).mockReturnValue({ household: { household, me, partner, members: [me, partner] }, workspace: { data: { ...workspace, schedules: [
    { ...schedule, name: 'Shared internet' }, { ...schedule, id: 'own', name: 'My membership', visibility: 'private' },
    { ...schedule, id: 'partner', name: 'Partner secret', ownerId: partner.userId, visibility: 'private' },
    { ...schedule, id: 'paused', name: 'My paused bill', visibility: 'private', status: 'paused' },
  ] }, isError: false } } as unknown as ReturnType<typeof usePaymentData>);
  const view = await render(<LocalizationProvider><PaymentsScreen /></LocalizationProvider>);
  expect(view.getByText('My membership')).toBeTruthy(); expect(view.queryByText('Shared internet')).toBeNull(); expect(view.queryByText('Partner secret')).toBeNull();
  await fireEvent.press(view.getByRole('radio', { name: 'Paused' }));
  expect(view.getByText('My paused bill')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Add a payment' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/payment', params: { visibility: 'private' } });
});

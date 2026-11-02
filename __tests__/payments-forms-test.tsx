import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { household, me, partner, schedule, workspace } from '../test/fixtures/payments';

import { useMyHousehold } from '@/features/household/api';
import { usePaymentAction, usePaymentWorkspace } from '@/features/payments/api';
import { PaymentEditor } from '@/features/payments/payment-editor';
import { PaymentPaid, PaymentPaidScreen } from '@/features/payments/payment-paid';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/features/quick-log/schedule-source', () => ({ useScheduleSource: jest.fn() }));
jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({ id: '00000000-0000-4000-8000-000000000002' }) }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/payments/api', () => ({ usePaymentAction: jest.fn(), usePaymentWorkspace: jest.fn() }));

const mutateAsync = jest.fn(async () => 'record-id');
beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockReset().mockResolvedValue('record-id');
  jest.mocked(usePaymentAction).mockReturnValue({ mutateAsync, isPending: false, error: null } as unknown as ReturnType<typeof usePaymentAction>);
});

it('creates a private variable monthly bill with a date window and owner-only payer', async () => {
  const view = await render(<LocalizationProvider><PaymentEditor household={household} me={me} members={[me, partner]}
    workspace={workspace} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('radio', { name: 'Private' }));
  await fireEvent.changeText(view.getByLabelText('Payment name'), 'Private membership');
  await fireEvent.press(view.getByRole('radio', { name: 'Date window' }));
  await fireEvent.changeText(view.getByLabelText('Window starts (YYYY-MM-DD)'), '2026-11-14');
  await fireEvent.changeText(view.getByLabelText('Window ends (YYYY-MM-DD)'), '2026-11-16');
  await fireEvent.press(view.getByRole('button', { name: 'Save payment' }));
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'save', id: null, version: null, value: {
    name: 'Private membership', visibility: 'private', payerId: me.userId, expectedAmountMinor: null,
    categoryId: schedule.categoryId, note: null, recurrence: 'monthly', dateMode: 'window', dueStart: '2026-11-14', dueEnd: '2026-11-16', reminderDaysBefore: 1,
  } });
  expect(router.replace).toHaveBeenCalledWith('/payments');
});

it('rejects nonnumeric variable amounts instead of silently treating them as unknown', async () => {
  const view = await render(<LocalizationProvider><PaymentEditor household={household} me={me} members={[me, partner]}
    workspace={workspace} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Payment name'), 'Bank');
  await fireEvent.changeText(view.getByLabelText('Expected amount (USD)'), '-1');
  await fireEvent.press(view.getByRole('button', { name: 'Save payment' }));
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(view.getByText(/Enter an amount greater than zero/)).toBeTruthy();
});

it('preserves actual paid date, amount and payer while offering a transaction choice', async () => {
  const view = await render(<LocalizationProvider><PaymentPaid initial={schedule} household={household}
    members={[me, partner]} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Actual amount paid (USD)'), '82.45');
  await fireEvent.changeText(view.getByLabelText('Actual paid date (YYYY-MM-DD)'), '2026-11-15');
  await fireEvent.press(view.getByRole('radio', { name: 'Sam' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Record payment only' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save paid payment' }));
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'paid', value: { id: schedule.id, version: 4, dueStart: '2026-11-14',
    amountMinor: 8245, paidOn: '2026-11-15', paidBy: partner.userId, createTransaction: false } });
  expect(router.replace).not.toHaveBeenCalled();
  expect(view.getByText('Marked as paid')).toBeTruthy();
  expect(view.getByText('$82.45')).toBeTruthy();
  expect(view.getByText('Paid by Sam')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Payment history' }));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/payment-history', params: { id: schedule.id } });
});

it('holds the original cycle/version while an open paid form receives a newer schedule', async () => {
  const view = await render(<LocalizationProvider><PaymentPaid initial={schedule} household={household}
    members={[me, partner]} reload={jest.fn()} /></LocalizationProvider>);
  await view.rerender(<LocalizationProvider><PaymentPaid initial={{ ...schedule, version: 5, dueStart: '2026-12-14' }} household={household}
    members={[me, partner]} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Save paid payment' }));
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ version: 4, dueStart: '2026-11-14' }) }));
});

it('keeps the end of an existing window when its selected option is tapped again', async () => {
  const view = await render(<LocalizationProvider><PaymentEditor initial={schedule} household={household} me={me}
    members={[me, partner]} workspace={workspace} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('radio', { name: 'Date window' }));
  expect(view.getByDisplayValue('2026-11-16')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Save payment' }));
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ dueEnd: '2026-11-16' }) }));
});

it('excludes private labels from shared bills and corrects the selection when visibility switches', async () => {
  const ownPrivate = { ...workspace.categories[0], id: '00000000-0000-4000-8000-000000000009',
    name: 'Private label', visibility: 'private' as const, ownerId: me.userId };
  const view = await render(<LocalizationProvider><PaymentEditor household={household} me={me} members={[me, partner]}
    workspace={{ ...workspace, categories: [ownPrivate, ...workspace.categories] }} reload={jest.fn()} /></LocalizationProvider>);
  expect(view.queryByRole('radio', { name: 'Private label' })).toBeNull();
  await fireEvent.press(view.getByRole('radio', { name: 'Private' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Private label' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Shared' }));
  await fireEvent.changeText(view.getByLabelText('Payment name'), 'Shared bill');
  await fireEvent.press(view.getByRole('button', { name: 'Save payment' }));
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ categoryId: schedule.categoryId, visibility: 'shared' }) }));
});


it('keeps the receipt hidden while saving and preserves form values on failure', async () => {
  let rejectSave!: (error: Error) => void;
  mutateAsync.mockImplementationOnce(() => new Promise<string>((_resolve, reject) => { rejectSave = reject; }));
  const view = await render(<LocalizationProvider><PaymentPaid initial={schedule} household={household}
    members={[me, partner]} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Actual amount paid (USD)'), '96.50');
  const button = view.getByRole('button', { name: 'Save paid payment' });
  await fireEvent.press(button);
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  expect(view.getByText('Saving your payment…')).toBeTruthy();
  expect(view.queryByText('Marked as paid')).toBeNull();
  expect(view.queryByRole('button', { name: 'Done' })).toBeNull();
  await act(async () => { rejectSave(new Error('Offline')); });
  expect(view.getByDisplayValue('96.50')).toBeTruthy();
  expect(view.queryByText('Payment receipt')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Save paid payment' }));
  expect(view.getByText('Marked as paid')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Done' }));
  expect(router.replace).toHaveBeenCalledWith('/payments');
});

it('retains a one-off receipt when saving archives the schedule and the workspace refresh fails', async () => {
  const once = { ...schedule, recurrence: 'once' as const };
  jest.mocked(useMyHousehold).mockReturnValue({ data: { household, members: [me, partner], me } } as unknown as ReturnType<typeof useMyHousehold>);
  const refreshed = jest.fn();
  jest.mocked(usePaymentWorkspace).mockReturnValue({ data: { ...workspace, schedules: [once] }, refetch: refreshed } as unknown as ReturnType<typeof usePaymentWorkspace>);
  let resolveSave!: (value: string) => void;
  mutateAsync.mockImplementationOnce(() => new Promise<string>(resolve => { resolveSave = resolve; }));
  const view = await render(<LocalizationProvider><PaymentPaidScreen /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Save paid payment' }));
  jest.mocked(usePaymentWorkspace).mockReturnValue({ data: { ...workspace, schedules: [{ ...once, status: 'archived' }] }, isError: true, refetch: refreshed } as unknown as ReturnType<typeof usePaymentWorkspace>);
  await view.rerender(<LocalizationProvider><PaymentPaidScreen /></LocalizationProvider>);
  expect(view.getByText('Saving your payment…')).toBeTruthy();
  await act(async () => { resolveSave('record-id'); });
  expect(view.getByText('Marked as paid')).toBeTruthy();
  expect(view.getByText('Internet')).toBeTruthy();
});

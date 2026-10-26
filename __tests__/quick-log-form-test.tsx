import { fireEvent, render } from '@testing-library/react-native';
import { household, me, partner, workspace } from '../test/fixtures/payments';
import { useQuickLogQueue } from '@/features/quick-log/queue';
import { PendingLogs } from '@/features/quick-log/pending-screen';
import { QuickLogEntry, QuickLogForm } from '@/features/quick-log/quick-log-screen';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000090' }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/hooks/use-session', () => ({ useSession: () => ({ isOffline: false }) }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/payments/api', () => ({ usePaymentWorkspace: jest.fn() }));
jest.mock('@/features/quick-log/queue', () => ({ useQuickLogQueue: jest.fn() }));
jest.mock('@/features/quick-log/receipt-picker', () => ({ pickReceipt: jest.fn() }));
jest.mock('@/features/quick-log/receipt-files', () => ({ saveReceipt: jest.fn(), deleteReceipt: jest.fn(async () => undefined) }));
const enqueue = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useQuickLogQueue).mockReturnValue({ entries: [], error: false, enqueue, retry: jest.fn(), discard: jest.fn() });
});
const props = { household, me, members: [me, partner], workspace, cached: false, onChooseSpace: jest.fn() };
it('asks Shared or Private first and opens the selected form without exposing private partner categories', async () => {
  const view = await render(<LocalizationProvider><QuickLogEntry {...props} /></LocalizationProvider>);
  expect(view.queryByLabelText('Amount in USD')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Private' }));
  expect(view.getByLabelText('Amount in USD')).toBeTruthy();
  expect(view.queryByRole('radio', { name: partner.displayName })).toBeNull();
});
it('queues a fully validated shared expense with the selected actual payer', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount in USD'), '123.45');
  await fireEvent.changeText(view.getByLabelText('What was it for?'), 'Our groceries');
  await fireEvent.press(view.getByRole('radio', { name: partner.displayName }));
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000090', expect.objectContaining({ visibility: 'shared', amountMinor: 12345, paidBy: partner.userId, description: 'Our groceries' }));
});
it('keeps a linked cycle’s original version/due date and never lets its frequency change', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount in USD'), '75');
  await fireEvent.press(view.getByRole('radio', { name: 'Internet' }));
  expect(view.getByRole('radio', { name: 'One time' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ scheduleId: workspace.schedules[0].id, scheduleVersion: 4, scheduleDueStart: '2026-11-14', frequency: 'monthly' }));
});
it('does not queue bad amounts or a missing description', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="private" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount in USD'), '-1');
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).not.toHaveBeenCalled(); expect(view.getByText(/Check the amount, description/)).toBeTruthy();
});

it('never describes unreadable saved entries as an empty queue', async () => {
  jest.mocked(useQuickLogQueue).mockReturnValue({ entries: [], error: true, enqueue, retry: jest.fn(), discard: jest.fn() });
  const view = await render(<LocalizationProvider><PendingLogs householdId={household.id} currency="USD" /></LocalizationProvider>);
  expect(view.getByText(/couldn’t read or update this device/)).toBeTruthy();
  expect(view.queryByText('No expenses waiting to sync.')).toBeNull();
});

it('steps by whole currency units and preserves invalid input instead of replacing it', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  const amount = view.getByLabelText('Amount in USD');
  await fireEvent.changeText(amount, '12.50');
  await fireEvent.press(view.getByRole('button', { name: 'Increase amount by $1.00' }));
  expect(amount.props.value).toBe('13.50');
  await fireEvent.changeText(amount, '123.456');
  expect(view.getByRole('button', { name: 'Increase amount by $1.00' }).props.accessibilityState.disabled).toBe(true);
  expect(amount.props.value).toBe('123.456');
  await fireEvent.changeText(amount, '10000000000.00');
  expect(view.getByRole('button', { name: 'Increase amount by $1.00' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Decrease amount by $1.00' }));
  expect(amount.props.value).toBe('9999999999.00');
});

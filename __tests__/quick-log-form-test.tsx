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
const props = { household, me, members: [me, partner], workspace, cached: false };
it('shows the scope before saving, defaults Personal entry to Personal and never offers a partner payer there', async () => {
  const view = await render(<LocalizationProvider><QuickLogEntry {...props} requestedSpace="private" /></LocalizationProvider>);
  expect(view.getByRole('radio', { name: 'Personal' }).props.accessibilityState.checked).toBe(true);
  expect(view.getByText(/Only you see this purchase/)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: /^Receipt or more details/ }));
  expect(view.queryByRole('radio', { name: partner.displayName })).toBeNull();
  const shared = await render(<LocalizationProvider><QuickLogEntry {...props} /></LocalizationProvider>);
  expect(shared.getByRole('radio', { name: 'Shared' }).props.accessibilityState.checked).toBe(true);
  expect(shared.getByText('Visible to both of you')).toBeTruthy();
});
it('keeps the typed amount when switching scope but resets scope-specific choices', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount (USD)'), '12.00');
  await fireEvent.changeText(view.getByLabelText('What was it for?'), 'Coffee');
  await fireEvent.press(view.getByRole('button', { name: /^Receipt or more details/ }));
  await fireEvent.press(view.getByRole('radio', { name: partner.displayName }));
  await fireEvent.press(view.getByRole('radio', { name: 'Personal' }));
  expect(view.getByLabelText('Amount (USD)').props.value).toBe('12.00');
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ visibility: 'private', paidBy: me.userId, amountMinor: 1200, scheduleId: null }));
});
it('queues a fully validated shared expense with the selected actual payer', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount (USD)'), '123.45');
  await fireEvent.changeText(view.getByLabelText('What was it for?'), 'Our groceries');
  await fireEvent.press(view.getByRole('button', { name: /^Receipt or more details/ }));
  await fireEvent.press(view.getByRole('radio', { name: partner.displayName }));
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000090', expect.objectContaining({ visibility: 'shared', amountMinor: 12345, paidBy: partner.userId, description: 'Our groceries' }));
});
it('keeps a linked cycle’s original version/due date and never lets its frequency change', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount (USD)'), '75');
  await fireEvent.press(view.getByRole('button', { name: /^Receipt or more details/ }));
  await fireEvent.press(view.getByRole('radio', { name: 'Internet' }));
  expect(view.getByRole('radio', { name: 'One time' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ scheduleId: workspace.schedules[0].id, scheduleVersion: 4, scheduleDueStart: '2026-11-14', frequency: 'monthly' }));
});
it('does not queue bad amounts or a missing description', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="private" /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Amount (USD)'), '-1');
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).not.toHaveBeenCalled(); expect(view.getByText(/Check the amount, description/)).toBeTruthy();
});

it('never describes unreadable saved entries as an empty queue', async () => {
  jest.mocked(useQuickLogQueue).mockReturnValue({ entries: [], error: true, enqueue, retry: jest.fn(), discard: jest.fn() });
  const view = await render(<LocalizationProvider><PendingLogs householdId={household.id} currency="USD" /></LocalizationProvider>);
  expect(view.getByText(/couldn’t read or update this device/)).toBeTruthy();
  expect(view.queryByText('No expenses waiting to sync.')).toBeNull();
});

it('accepts a typed amount without steppers and preserves invalid input instead of replacing it', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  const amount = view.getByLabelText('Amount (USD)');
  expect(view.queryByRole('button', { name: /Increase amount/ })).toBeNull();
  await fireEvent.changeText(amount, '123.456');
  expect(amount.props.value).toBe('123.456'); expect(view.getByText(/Enter an amount like/)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Save expense' }));
  expect(enqueue).not.toHaveBeenCalled();
});
it('opens payer and date details from Edit and keeps them visible before saving', async () => {
  const view = await render(<LocalizationProvider><QuickLogForm {...props} space="shared" /></LocalizationProvider>);
  expect(view.getByText(/Paid by you ·/)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Edit payer and date' }));
  expect(view.getByLabelText('Expense date')).toBeTruthy();
});

it('keeps optional details out of the routine path and preserves them when collapsed', async () => {
  const view=await render(<LocalizationProvider><QuickLogForm {...props} space="shared"/></LocalizationProvider>);
  expect(view.queryByLabelText('Note (optional)')).toBeNull();
  await fireEvent.press(view.getByRole('button',{name:/^Receipt or more details/}));
  await fireEvent.press(view.getByRole('radio',{name:partner.displayName}));
  await fireEvent.changeText(view.getByLabelText('Expense date'), 'not-a-date');
  expect(view.getByText(/Enter a real date as YYYY-MM-DD/)).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText('Expense date'), '2026-10-26');
  await fireEvent.press(view.getByRole('button',{name:/^Receipt or more details/}));
  expect(view.getByText(/Paid by Sam/)).toBeTruthy();
});

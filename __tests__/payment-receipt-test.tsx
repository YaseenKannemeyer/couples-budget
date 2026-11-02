import { act, fireEvent, render } from '@testing-library/react-native';

import { PaymentReceipt, type PaidReceipt } from '@/features/payments/payment-receipt';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn() }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }] }));

const receipt: PaidReceipt = { name: 'Personal membership', visibility: 'private', amountMinor: 8245,
  currency: 'USD', paidOn: '2026-11-02', cycle: 'Nov 1, 2026', payer: 'Alex', createTransaction: false };
const props = { receipt, locale: 'en-US', onDone: jest.fn(), onHistory: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.useRealTimers(); });

it('feeds a confirmed receipt, then keeps it visible with working actions', async () => {
  jest.useFakeTimers();
  jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  const view = await render(<LocalizationProvider><PaymentReceipt {...props} recorded /></LocalizationProvider>);
  await fireEvent(view.getByTestId('payment-receipt-paper'), 'layout', { nativeEvent: { layout: { height: 440 } } });
  expect(view.getByText('Saved · Printing your receipt…')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(view.getByText('Payment recorded')).toBeTruthy();
  expect(view.getByText('$82.45')).toBeTruthy();
  expect(view.getByText('Private')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Done' }));
  expect(props.onDone).toHaveBeenCalledTimes(1);
});

it('shows the completed receipt immediately with reduced motion', async () => {
  jest.mocked(useReducedMotionPreference).mockReturnValue(true);
  const view = await render(<LocalizationProvider><PaymentReceipt {...props} recorded /></LocalizationProvider>);
  await fireEvent(view.getByTestId('payment-receipt-paper'), 'layout', { nativeEvent: { layout: { height: 440 } } });
  expect(view.getByText('Payment recorded')).toBeTruthy();
  expect(view.queryByText('Saved · Printing your receipt…')).toBeNull();
  expect(view.getByTestId('payment-receipt-paper')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
});

it('allows leaving during the paper feed without waiting for animation', async () => {
  jest.useFakeTimers();
  jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  const view = await render(<LocalizationProvider><PaymentReceipt {...props} recorded /></LocalizationProvider>);
  await fireEvent(view.getByTestId('payment-receipt-paper'), 'layout', { nativeEvent: { layout: { height: 440 } } });
  await fireEvent.press(view.getByRole('button', { name: 'Payment history' }));
  expect(props.onHistory).toHaveBeenCalledTimes(1);
  await view.unmount();
  await act(async () => { jest.runOnlyPendingTimers(); });
});

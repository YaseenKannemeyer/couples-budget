import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { household, me, partner, workspace } from '../test/fixtures/payments';

import { useCategoryAction } from '@/features/categories/api';
import { CategoriesView } from '@/features/categories/categories-screen';
import { CategoryEditor } from '@/features/categories/category-editor';
import { categoryInput, eligibleCategories, replacementCategories, type Category } from '@/features/categories/schema';
import { useClassifyExpense } from '@/features/expenses/api';
import { ExpenseClassification } from '@/features/expenses/expense-classification';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), canGoBack: () => false, back: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/categories/api', () => ({ useCategoryAction: jest.fn(), useCategories: jest.fn() }));
jest.mock('@/features/expenses/api', () => ({ useClassifyExpense: jest.fn(), useExpense: jest.fn() }));

const base = workspace.categories[0];
const source: Category = { ...base, id: '00000000-0000-4000-8000-000000000004', name: 'Coffee', bucket: 'wants', emoji: '☕', version: 3 };
const privateOwn: Category = { ...base, id: '00000000-0000-4000-8000-000000000005', name: 'My private label', visibility: 'private', ownerId: me.userId };
const privateOther: Category = { ...privateOwn, id: '00000000-0000-4000-8000-000000000006', name: 'Partner secret', ownerId: partner.userId };
const mutateAsync = jest.fn(async () => 'category-id');
const mutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCategoryAction).mockReturnValue({ mutateAsync, mutate, isPending: false, error: null, reset: jest.fn() } as unknown as ReturnType<typeof useCategoryAction>);
  jest.mocked(useClassifyExpense).mockReturnValue({ mutateAsync, isPending: false, error: null } as unknown as ReturnType<typeof useClassifyExpense>);
});

it('limits shared and private pickers and archive targets without revealing private partner labels', () => {
  const categories = [base, privateOwn, privateOther, { ...source, archived: true }];
  expect(eligibleCategories(categories, 'shared', me.userId).map((category) => category.id)).toEqual([base.id]);
  expect(eligibleCategories(categories, 'private', me.userId).map((category) => category.id)).toEqual([base.id, privateOwn.id]);
  expect(replacementCategories([base, source, privateOwn], source, me.userId).map((category) => category.id)).toEqual([base.id]);
});

it('validates category names and multi-codepoint emoji labels', () => {
  expect(categoryInput.safeParse({ name: 'Family', emoji: '👨‍👩‍👧‍👦', bucket: 'needs', visibility: 'private' }).success).toBe(true);
  expect(categoryInput.safeParse({ name: ' ', emoji: null, bucket: 'needs', visibility: 'shared' }).success).toBe(false);
  expect(categoryInput.safeParse({ name: 'x'.repeat(41), emoji: null, bucket: 'needs', visibility: 'shared' }).success).toBe(false);
});

it('creates a private category with an emoji and chosen reporting bucket', async () => {
  const view = await render(<LocalizationProvider><CategoryEditor householdId={household.id} userId={me.userId}
    categories={[base]} initialVisibility="private" reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Category name'), 'Subscriptions');
  await fireEvent.changeText(view.getByLabelText('Emoji (optional)'), '🎬');
  await fireEvent.press(view.getByRole('radio', { name: 'Wants' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save category' }));
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'save', id: null, version: null,
    value: { name: 'Subscriptions', emoji: '🎬', bucket: 'wants', visibility: 'private' } });
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/categories', params: { visibility: 'private' } });
});

it('requires an explicit eligible replacement before archiving and never offers private targets for shared categories', async () => {
  const view = await render(<LocalizationProvider><CategoryEditor householdId={household.id} userId={me.userId}
    categories={[source, base, privateOwn]} initial={source} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Archive category' }));
  await fireEvent.press(view.getByRole('button', { name: 'Move items and archive' }));
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(view.queryByRole('radio', { name: 'My private label' })).toBeNull();
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  await fireEvent.press(view.getByRole('button', { name: 'Move items and archive' }));
  expect(mutateAsync).toHaveBeenCalledWith({ kind: 'archive', id: source.id, version: 3, replacementId: base.id });
});

it('keeps the category version originally edited when updated props arrive', async () => {
  const view = await render(<LocalizationProvider><CategoryEditor householdId={household.id} userId={me.userId}
    categories={[source, base]} initial={source} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.changeText(view.getByLabelText('Category name'), 'Our coffee');
  await view.rerender(<LocalizationProvider><CategoryEditor householdId={household.id} userId={me.userId}
    categories={[source, base]} initial={{ ...source, version: 4, name: 'Other device' }} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Save category' }));
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ version: 3, value: expect.objectContaining({ name: 'Our coffee' }) }));
});

it('offers bounded move controls and sends the category version with a reorder', async () => {
  const view = await render(<LocalizationProvider><CategoriesView householdId={household.id} categories={[source, base]} reload={jest.fn()} /></LocalizationProvider>);
  expect(view.getByRole('button', { name: 'Move Coffee up' }).props.accessibilityState.disabled).toBe(true);
  expect(view.getByRole('button', { name: 'Move Utilities down' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Move Coffee down' }));
  expect(mutate).toHaveBeenCalledWith({ kind: 'move', id: source.id, version: 3, direction: 1 });
});

it('changes a manual expense’s category/frequency without sending amount or date changes', async () => {
  const initial = { id: '00000000-0000-4000-8000-000000000007', categoryId: source.id, frequency: 'one_time' as const,
    scheduledPaymentRef: null, version: 5, amountMinor: 1234, description: 'Nice coffee', occurredOn: '2026-10-25' };
  const view = await render(<LocalizationProvider><ExpenseClassification initial={initial} householdId={household.id} userId={me.userId}
    space="shared" categories={[base, source]} reload={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Monthly' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save expense labels' }));
  expect(mutateAsync).toHaveBeenCalledWith({ id: initial.id, version: 5, visibility: 'shared', categoryId: base.id, frequency: 'monthly' });
});

it('locks frequency to a linked schedule while still allowing recategorization', async () => {
  const initial = { id: '00000000-0000-4000-8000-000000000007', categoryId: source.id, frequency: 'monthly' as const,
    scheduledPaymentRef: '00000000-0000-4000-8000-000000000008', version: 5, amountMinor: 1234, description: 'Bill', occurredOn: '2026-10-25' };
  const view = await render(<LocalizationProvider><ExpenseClassification initial={initial} householdId={household.id} userId={me.userId}
    space="shared" categories={[base, source]} reload={jest.fn()} /></LocalizationProvider>);
  expect(view.getByRole('radio', { name: 'One time' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save expense labels' }));
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'monthly', categoryId: base.id }));
});

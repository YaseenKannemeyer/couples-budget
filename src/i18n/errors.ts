import type { ParseKeys } from 'i18next';

const authErrors: Record<string, ParseKeys> = {
  invalid_credentials: 'errors.invalidCredentials',
  email_not_confirmed: 'errors.emailNotConfirmed',
  user_already_exists: 'errors.alreadyRegistered',
  email_exists: 'errors.alreadyRegistered',
  weak_password: 'errors.weakPassword',
  email_address_invalid: 'errors.invalidEmail',
  over_request_rate_limit: 'errors.rateLimited',
  over_email_send_rate_limit: 'errors.rateLimited',
  session_expired: 'errors.signInRequired',
  refresh_token_not_found: 'errors.signInRequired',
};

// Match the foundation RPCs exactly; SQLSTATE alone is too broad (e.g. 23514).
const householdErrors: Record<string, ParseKeys> = {
  'Conversation unavailable': 'errors.conversationUnavailable',
  'Comment unavailable': 'errors.commentUnavailable',
  'Comment changed': 'errors.commentChanged',
  'Invalid comment input': 'errors.invalidComment',
  'Invalid reaction input': 'errors.invalidReaction',
  'Household currency changed': 'errors.householdCurrencyChanged',
  'Invalid expense input': 'errors.invalidExpense',
  'Queued expense changed': 'errors.queuedExpenseChanged',
  'Expense queue full': 'errors.queueFull',
  'Receipt unavailable': 'errors.receiptUnavailable',
  'Receipt upload pending': 'errors.receiptPending',
  'Receipt too large': 'errors.receiptTooLarge',
  'Receipt missing': 'errors.receiptMissing',
  'Camera permission denied': 'errors.cameraPermission',
  'Saved queue needs recovery': 'errors.deviceStorage',
  'Forecast unavailable': 'errors.forecastUnavailable',
  'Forecast changed': 'errors.forecastChanged',
  'Invalid forecast input': 'errors.invalidForecast',
  'Income unavailable': 'errors.incomeUnavailable',
  'Category unavailable': 'errors.categoryUnavailable',
  'Category changed': 'errors.categoryChanged',
  'Invalid category input': 'errors.invalidCategory',
  'Category visibility is fixed': 'errors.categoryVisibilityFixed',
  'Choose replacement category': 'errors.chooseReplacement',
  'Expense unavailable': 'errors.expenseUnavailable',
  'Expense changed': 'errors.expenseChanged',
  'Linked frequency is fixed': 'errors.linkedFrequencyFixed',
  'Payment not available': 'errors.paymentUnavailable',
  'Payment changed': 'errors.paymentChanged',
  'Invalid payment input': 'errors.invalidPayment',
  'Payment type is fixed': 'errors.paymentTypeFixed',
  'Payment cycle already paid': 'errors.paymentCyclePaid',
  'Invalid payment state': 'errors.paymentState',
  'Budget plan changed': 'errors.budgetChanged',
  'Invalid budget input': 'errors.invalidBudget',
  'Complete the earlier budget steps': 'errors.budgetEarlierSteps',
  'Not signed in': 'errors.signInRequired',
  'You are already part of a household': 'errors.alreadyInHousehold',
  "That invite code didn't match any household": 'errors.inviteNotFound',
  'This household already has two partners': 'errors.householdFull',
  'Not a member of this household': 'errors.notHouseholdMember',
};

/** Keep server diagnostics out of the UI and store keys so errors can be retranslated. */
export function errorTranslationKey(error: unknown): ParseKeys {
  if (!error || typeof error !== 'object') return 'errors.generic';
  if ('name' in error && ['QuotaExceededError', 'SecurityError'].includes(String(error.name))) return 'errors.deviceStorage';
  if ('code' in error && typeof error.code === 'string' && Object.hasOwn(authErrors, error.code)) {
    return authErrors[error.code];
  }
  if ('message' in error && typeof error.message === 'string') {
    if (Object.hasOwn(householdErrors, error.message)) return householdErrors[error.message];
    if (error.message.startsWith('Unknown timezone: ')) return 'errors.invalidTimezone';
  }
  return 'errors.generic';
}

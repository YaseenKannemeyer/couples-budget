import { errorTranslationKey } from '@/i18n/errors';

describe('translated service errors', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'English from Auth' }, 'errors.invalidCredentials'],
    [{ code: 'email_not_confirmed' }, 'errors.emailNotConfirmed'],
    [{ message: "That invite code didn't match any household" }, 'errors.inviteNotFound'],
    [{ code: '23514', message: 'This household already has two partners' }, 'errors.householdFull'],
    [{ message: 'Unknown timezone: Invalid/Zone' }, 'errors.invalidTimezone'],
    [new Error('Not signed in'), 'errors.signInRequired'],
  ])('maps %j to a translation key', (error, key) => {
    expect(errorTranslationKey(error)).toBe(key);
  });

  it.each([
    null,
    'Failed to fetch',
    new Error('Internal server detail: secret'),
    { code: '23514', message: 'Some other check constraint' },
    { code: 'constructor', message: 'toString' },
  ])('uses a safe translated fallback for unknown errors: %j', (error) => {
    expect(errorTranslationKey(error)).toBe('errors.generic');
  });
});

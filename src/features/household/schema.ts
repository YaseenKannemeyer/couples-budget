import { z } from 'zod';

import { isValidCurrency } from '@/lib/money';

/** Rows as Supabase returns them, converted to the camelCase shapes the app uses. */

export const householdSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    base_currency: z.string(),
    timezone: z.string(),
    split_mode: z.enum(['proportional', 'equal', 'combined']),
    money_date_day: z.number(),
    invite_code: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    timezone: row.timezone,
    splitMode: row.split_mode,
    moneyDateDay: row.money_date_day,
    inviteCode: row.invite_code,
  }));

export const memberSchema = z
  .object({
    household_id: z.uuid(),
    user_id: z.uuid(),
    display_name: z.string(),
    monthly_income_minor: z.coerce.number(),
    monthly_allowance_minor: z.coerce.number(),
    joined_at: z.string(),
  })
  .transform((row) => ({
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    monthlyIncomeMinor: row.monthly_income_minor,
    monthlyAllowanceMinor: row.monthly_allowance_minor,
    joinedAt: row.joined_at,
  }));

export type Household = z.output<typeof householdSchema>;
export type Member = z.output<typeof memberSchema>;

/** Form inputs. The database enforces the same rules again. */

const displayName = z.string().trim().min(1, 'What should your partner call you?').max(40);

export const createHouseholdInput = z.object({
  name: z.string().trim().min(1, 'Give your household a name').max(80),
  displayName,
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidCurrency, 'Use a 3-letter currency code, like USD or ZAR'),
  timezone: z.string().min(1),
});

export const joinHouseholdInput = z.object({
  inviteCode: z
    .string()
    .transform((code) => code.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().length(8, 'Invite codes are 8 characters')),
  displayName,
});

export type CreateHouseholdInput = z.input<typeof createHouseholdInput>;
export type JoinHouseholdInput = z.input<typeof joinHouseholdInput>;

/** Formats an invite code for reading aloud: "ABCD-EFGH". */
export function formatInviteCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

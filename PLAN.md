# Co-Pilot: Build Plan

A budgeting app for couples. The plan is built around three spaces:

- **Shared Bucket:** rent, groceries, bills and joint goals. Both partners can see and edit it.
- **Partner A's Private Space:** guilt-free allowance. The partner sees only the balance.
- **Partner B's Private Space:** the same, for the other partner.

The app's core promises:

- **Fair-share split:** shared costs are divided by income, 50/50, or fully combined.
- **Anti-nag reminders:** the app reminds you, so your partner never has to.
- **Tidy shared books:** every shared expense is logged, and unexplained gaps are moved into a private allowance.
- **Money Date:** a guided monthly review.
- **Joint goals:** goals grow from leftovers and gifts.

**Status key:** ✅ done · 🔜 next · ⏳ later

---

## Decisions

| Topic     | Decision                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Market    | Global from day one: multiple currencies, locale formatting, household timezone                                                 |
| Bank data | v1 uses manual logging plus a monthly balance check-in. Bank feeds come in v2                                                   |
| Platforms | One Expo codebase for iOS, Android and web. Desktop uses the web app, installable as a PWA. A Tauri wrapper only if ever needed |
| Backend   | Supabase: Postgres, Auth, Realtime, Row-Level Security, Edge Functions, pg_cron                                                 |
| Money     | Integer minor units plus an ISO currency code. Never floats                                                                     |
| Privacy   | Enforced in the database (RLS), not only in the UI. Partners only ever receive aggregates of private data                       |
| Styling   | Template's `StyleSheet` plus design tokens in `src/constants/theme.ts`. NativeWind was dropped to avoid extra dependency risk   |
| Tone      | "We" language, never "You overspent". Soft terracotta for warnings, no harsh red                                                |

## Tech stack

| Layer             | Choice                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| App               | Expo SDK 58, Expo Router, React Native 0.88, TypeScript                                        |
| Data fetching     | TanStack Query (optimistic updates). Offline queue added in Phase 1                            |
| Validation        | Zod (shared between screens and backend functions)                                             |
| Database and auth | Supabase                                                                                       |
| Notifications     | Expo Notifications, triggered by pg_cron and Edge Functions                                    |
| i18n              | i18next and expo-localization                                                                  |
| Animation         | Reanimated. Lottie for celebrations                                                            |
| Subscriptions     | RevenueCat (App Store, Play Store, Stripe on web)                                              |
| Monitoring        | Sentry (errors) and PostHog (analytics, feature flags)                                         |
| Testing           | Jest (unit), node:test + PGlite (database privacy), Maestro and Playwright (end-to-end, later) |

---

## Phase 0: Foundations ✅

**Goal:** a couple can sign up, form a household and see each other, on a foundation that keeps private data private.

**Done**

- [x] Expo project: web output switched to a single-page app, warm theme for the shared and private spaces, starter screens removed
- [x] `src/lib/money.ts`: parse, format, allocate (exact splits), currency conversion
- [x] `src/lib/split.ts`: Fair-Share Calculator (proportional, equal, combined)
- [x] Database migration: households, members, categories, budget periods, shared and private transactions
- [x] Row-level security, column-level update limits, `allowance_balances()`, `create_household()`, `join_household()`, `regenerate_invite_code()`
- [x] Email/password sign-in, create or join a household with an invite code, live update when the partner joins
- [x] Home screen (invite card or "connected") and Settings screen (household info, sign out)
- [x] Tests: 19 unit tests and 17 database privacy tests, all passing

**Your to-do before testing on a device**

- [ ] Create a Supabase project, fill in `.env.local`, and run the migration (see README)
- [ ] Try the two-partner flow: one partner in the browser, the other in Expo Go on a phone

---

## Phase 1: Core MVP 🔜

**Goal:** a couple can set up their budget and log every expense, shared or private, in seconds.

1. **i18n setup.** Move every on-screen string into translation files, before there are many screens.
2. **Onboarding wizard** (after the household is created)
   - Step 1: each partner enters their own monthly income. Choose a split mode, with the live Fair-Share ratio shown
   - Step 2: agree on the guilt-free allowances
   - Step 3: list recurring shared costs (rent, groceries, wifi, insurance). Show the household total and each partner's contribution
   - Step 4: add each partner's payday schedule: monthly, weekly, biweekly, irregular, or multiple income sources
3. **Scheduled payments and recurring expenses**
   - Add a bill or expense as **one-time** or **recurring monthly**
   - Set the next payment date, with either an exact day (for example, Apple on **2 November**) or a date window (for example, Bank between the **14th and 16th of every month**)
   - Store the payment name, expected amount (optional for variable bills), who pays, shared or private visibility, category, and an optional note
   - Show upcoming payments in date order, including a clear "due soon" state and the current month's paid/unpaid state
   - When a scheduled payment is marked paid, offer to create the transaction automatically while preserving the actual paid date and amount
   - Remind each partner about their own upcoming payments without exposing private payment details to the other partner
   - Support pausing, editing, archiving and deleting a schedule without deleting its payment history
   - Support variable bills by keeping the schedule while recording a different actual amount each cycle, with recent amounts and a next-payment estimate
   - New migration: `scheduled_payments`, with recurrence rules, date windows, next due date, reminder settings and RLS matching shared/private visibility
4. **Categories and expense frequency**
   - Give every expense a category and a frequency: **one-time**, **monthly**, or another recurring schedule when supported by a scheduled payment
   - Seed each household with editable starter categories: **Essentials** (toiletries, groceries), **Entertainment** (Netflix and other subscriptions), **Housing**, **Transport**, **Utilities**, **Health**, **Personal**, **Fun**, **Savings** and **Other**
   - Keep the existing `needs / wants / savings` bucket as a reporting dimension: Essentials generally maps to needs, Entertainment and Fun to wants, and Savings to savings, while allowing the household to change the bucket
   - Let either partner create, rename, reorder, archive and assign an emoji to custom categories; prevent archiving a category that still has transactions unless those transactions are reassigned
   - Category management applies consistently to shared expenses, private expenses and scheduled payments, while private names and spending remain private
   - New migration: seed categories during household creation and add transaction/category constraints needed for private category privacy
5. **Cash-flow calendar and forecast**
   - Display paydays, scheduled payments, planned budgets, goals and actual transactions on one household-timezone calendar
   - Forecast the available shared balance between income dates and payment dates, including a low-balance warning before payday
   - Separate confirmed money from expected money, and allow a partner to correct or dismiss a forecast item without changing the original schedule
   - Account for different paydays, irregular income, bonuses and temporary income changes
   - New migration: `income_sources` and `income_occurrences`, with private income details aggregated for shared forecasts where appropriate
6. **Home dashboard**
   - Household summary: joint income, remaining shared budget, progress bar
   - Allowance peek: each partner's remaining balance
   - Upcoming payments section: next due payment, date window, expected amount and paid/unpaid status
   - Cash-flow snapshot: next income, upcoming commitments and projected lowest balance
   - Recent activity feed
7. **Quick-log sheet**
   - Reachable from anywhere in two taps
   - Asks "Shared or Private?" first. Each choice switches to its own theme
   - Amount, category, frequency, who paid, date, and an optional note or foreign currency
   - Allow a quick-log entry to be linked to an existing scheduled payment, or create a new schedule after saving
   - Attach an optional receipt photo, with merchant, amount and date prefilled when receipt scanning is available
   - Offline queue, so logging works in a shop with no signal
8. **Shared budget screen.** Categories, with spent and remaining per category, upcoming scheduled payments and synced live totals between partners.
9. **Private Space screen.** Your own spending list, scheduled private payments and balance, shown with the private "desk" theme.
10. **Comments and reactions on shared transactions.**

- New migration: `comments` and `reactions` tables with RLS
- Example: "Thanks for grabbing the nice coffee ☕"

**Done when:** two partners can onboard with different payday schedules, log shared and private expenses on different devices, schedule exact-date and date-window payments, see a useful cash-flow forecast, and see the right things instantly, with private items never shown to the partner.

---

## Phase 2: Relationship features ⏳

**Goal:** the features that make this a couples app, not just a budget tracker.

11. **Joint savings goals.** Target and deadline, proportional monthly targets ("both 100% on track"), progress charts, celebrations. New migration: `goals` and `goal_contributions`, each with a source: scheduled, booster, gift, or variance.
12. **Leftover Booster.** When a weekly budget line comes in under, the app offers: "We have $40 left in groceries. Add it to Euro Trip 2027?"
13. **Gift to Joint Goal.** Move money from a private allowance into a goal. Both partners get a celebration, and the giver's remaining balance stays hidden.
14. **Sinking funds.** Create a dated target for predictable non-monthly costs such as insurance, car licence, birthdays, holidays, school fees or medical costs. Show saved, remaining and the monthly amount needed.
15. **Flexible bill splitting.** Split shared expenses by equal amount, income ratio, percentage, fixed amounts or custom shares, and show who is expected to contribute.
16. **End-of-month reconciliation.** Enter the actual account balance (new `balance_checkins` table) and see the discrepancy. Options: "Log a missing expense", "Move to my allowance", or split it between both partners.
17. **Money Date mode**, in this order:
    1. Wins first: categories that came in under budget, goal progress
    2. Clean-up: resolve unlogged gaps together
    3. A 30-day look-ahead at upcoming and unusual bills
    4. An optional one-month split tweak or goal draw-down
    5. Lock it in with a high-five/confetti animation, which closes the period, snapshots the numbers and hands out new allowances
18. **Anti-nag engine.** Neutral system reminders for unlogged days, upcoming scheduled payments, low projected balances and Money Date day, sent by pg_cron, an Edge Function and Expo Notifications. A `nudges` log prevents duplicate reminders.

**Done when:** a couple can run a full month (log, boost, reconcile, Money Date, lock) and the next month starts cleanly.

---

## Phase 3: Polish and growth ⏳

19. **Gamification.** Team streaks for consistent logging, badges for staying under budget, milestone celebrations.
20. **Income-inverted view.** Show budgets as percentages instead of amounts, to ease big income gaps.
21. **Settle-up IOUs.** Track who owes whom for couples with separate accounts (new `settlements` table).
22. **50/30/20 insights.** Categories already carry a needs, wants or savings bucket. Show how the split compares to 50/30/20.
23. **Shared shopping list.** Create a household grocery list with estimated prices, mark items bought and optionally turn the final list into one categorised transaction.
24. **Spending limits and gentle alerts.** Set optional category limits and notify the household when a category is approaching its plan, using the app's neutral tone.
25. **Shared financial snapshot.** Manually track household cash, savings, credit cards and debts before bank feeds arrive, with private accounts remaining private.
26. **Apple and Google sign-in.** Needs developer accounts and a development build.
27. **Account deletion, data export and leaving a household.** Required by app stores, GDPR and POPIA.
28. **Subscriptions via RevenueCat.** One plan per couple, valid on every platform.
29. **Monitoring.** Sentry and PostHog.
30. **App store release.** EAS Build and Submit, privacy labels, store listing.

---

## Phase 4: Bank feeds (v2) ⏳

31. **Bank-feed adapter interface**, so each provider plugs in the same way.
32. **Providers by region:** Plaid (US/CA), TrueLayer or GoCardless (UK/EU), Stitch (South Africa).
33. **Auto-matching.** Imported transactions are matched to manual logs and scheduled payments. Unmatched shared-account transactions feed reconciliation.
34. **CSV statement import** as a fallback where no bank-feed provider covers the bank.

---

## Global launch checklist

- [ ] Base currency per household, plus the original currency on each transaction, with daily FX rates
- [x] Month boundaries follow the household's timezone
- [ ] Locale-aware number and date formats on every screen
- [ ] Receipt storage, retention and deletion rules, including explicit camera/photo permission handling
- [ ] Shared transaction audit history: who edited, archived or deleted an item, with private fields excluded from partner-visible history
- [ ] Notification privacy settings: control lock-screen detail, reminder timing and whether private reminders are shown on shared devices
- [ ] Forecast rules documented for missing income, late payments, refunds, transfers and negative balances
- [ ] Translatable copy (Phase 1, step 1)
- [ ] Privacy policy, data export, account deletion
- [ ] Sign in with Apple (required on iOS when other social logins are offered)

## How we verify each phase

- `npm test`: money and split maths
- `npm run test:db`: privacy rules against a real Postgres. Every new table gets a test proving partners and outsiders see only what they should
- `npm run typecheck` and `npm run lint`
- Manual two-device test: browser plus phone, signed in as each partner
- Forecast test: partners with different paydays, a date-window bank payment, a variable bill and an irregular income occurrence
- Privacy test: partner-visible forecasts and notifications never reveal private payment names, categories, amounts or receipt images
- From Phase 2: end-to-end tests (Maestro on mobile, Playwright on web) for onboarding → log → reconcile → Money Date → lock

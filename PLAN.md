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

## Phase 1: Core MVP 🔜 (in progress)

**Goal:** a couple can set up their budget and log every expense, shared or private, in seconds.

1. **i18n setup. ✅** All current on-screen copy, navigation, validation and known service errors use typed translation keys. Bundled English fallback, device locale updates and locale-aware money/number/household-timezone date helpers are in place. Additional language translations can now be added without changing screens.
2. **Onboarding wizard. ✅** Opens after creating or joining a household; each step saves and can be resumed from Home or Settings. Shared edits detect stale drafts instead of overwriting a partner's changes.
   - Step 1: each partner enters their own monthly income. Choose a split mode, with the live Fair-Share ratio shown
   - Step 2: agree on the guilt-free allowances
   - Step 3: list recurring shared costs (rent, groceries, wifi, insurance). Show the household total and each partner's contribution
   - Step 4: add each partner's payday schedule: monthly, weekly, biweekly, irregular, or multiple income sources
   - Implemented in `20261025180000_budget_onboarding.sql`: shared planned costs, owner-only income sources, per-person progress and atomic setup RPCs. Income source amounts and payday dates stay private; only monthly income totals are shared. Payment occurrence generation and forecasting follow in steps 3 and 5.
3. **Scheduled payments and recurring expenses. ✅** Implemented; native notification delivery and the two-device flow still need device verification.
   - Add a bill or expense as **one-time** or **recurring monthly**
   - Set the next payment date, with either an exact day (for example, Apple on **2 November**) or a date window (for example, Bank between the **14th and 16th of every month**)
   - Store the payment name, expected amount (optional for variable bills), who pays, shared or private visibility, category, and an optional note
   - Show upcoming payments in date order, including a clear "due soon" state and the current month's paid/unpaid state
   - When a scheduled payment is marked paid, offer to create the transaction automatically while preserving the actual paid date and amount
   - Remind each partner about their own upcoming payments without exposing private payment details to the other partner
   - Support pausing, editing, archiving and deleting a schedule without deleting its payment history
   - Support variable bills by keeping the schedule while recording a different actual amount each cycle, with recent amounts and a next-payment estimate
   - New migration: `scheduled_payments`, with recurrence rules, date windows, next due date, reminder settings and RLS matching shared/private visibility
   - Implemented in `20261025193000_scheduled_payments.sql`: version-checked schedule RPCs, owner-only private schedules/history, immutable payment records, optional atomic expense logging, three-cycle variable estimates and original monthly anchors that survive short months and edits. Device reminders are opt-in, generic and limited to the signed-in payer's next unpaid cycles; the server reminder engine follows in Phase 2.
4. **Categories and expense frequency. ✅** Implemented; the user’s live two-person privacy check remains pending.
   - Give every expense a category and a frequency: **one-time**, **monthly**, or another recurring schedule when supported by a scheduled payment
   - Seed each household with editable starter categories: **Essentials** (toiletries, groceries), **Entertainment** (Netflix and other subscriptions), **Housing**, **Transport**, **Utilities**, **Health**, **Personal**, **Fun**, **Savings** and **Other**
   - Keep the existing `needs / wants / savings` bucket as a reporting dimension: Essentials generally maps to needs, Entertainment and Fun to wants, and Savings to savings, while allowing the household to change the bucket
   - Let either partner create, rename, reorder, archive and assign an emoji to custom categories; prevent archiving a category that still has transactions unless those transactions are reassigned
   - Category management applies consistently to shared expenses, private expenses and scheduled payments, while private names and spending remain private
   - New migration: seed categories during household creation and add transaction/category constraints needed for private category privacy
   - Implemented in `20261025210000_categories_and_frequency.sql`: ten editable starters, version-checked shared/private category management, reporting buckets, reordering and archive-with-reassignment. Archive always needs a replacement and never returns private usage counts. New expense review/classification screens update labels without changing money or dates; schedule-linked frequency and historical links are protected in the database. Upgrade tests preserve existing labels, IDs, money and paid snapshots.
5. **Cash-flow calendar and forecast. ✅** Implemented; apply the new migration before testing. Native and live two-person checks remain pending.
   - Display paydays, scheduled payments, planned budgets, goals and actual transactions on one household-timezone calendar
   - Forecast the available shared balance between income dates and payment dates, including a low-balance warning before payday
   - Separate confirmed money from expected money, and allow a partner to correct or dismiss a forecast item without changing the original schedule
   - Account for different paydays, irregular income, bonuses and temporary income changes
   - Extend onboarding's `income_sources` with `income_occurrences`, with private income details aggregated for shared forecasts where appropriate
   - Implemented in `20261026090000_cashflow.sql`: owner-only generated/manual income occurrences, explicitly approved daily shared contributions, signed closing balances, category-linked remaining budget reservations, dated goal reservations and version-checked forecast corrections. Stable onboarding cost/source IDs preserve links and history. A 90-day integer forecast handles overdue bills, date windows, short months, refunds and missing estimates. Full goal balances/progress remain in Phase 2. See README for forecast rules and test steps.
6. **Home dashboard. ✅** Implemented; native and live two-person checks remain pending.
   - Household summary: joint income, remaining shared budget, progress bar
   - Allowance peek: each partner's remaining balance
   - Upcoming payments section: next due payment, date window, expected amount and paid/unpaid status
   - Cash-flow snapshot: next income, upcoming commitments and projected lowest balance
   - Recent activity feed
   - Implemented with existing database contracts, without a new migration: monthly shared plan/spending/remaining and accessible progress, provisional joint income until both partners enter it, aggregate allowance peeks, the next unpaid cycle per shared schedule and recent paid cycles, corrected cash-flow estimates, and the five latest logged shared expenses. Home refreshes on focus, foreground, shared Realtime events and every 30 seconds while focused. Private row details never enter its activity feed.
7. **Quick-log sheet. ✅** Implemented; apply the new migration and rebuild the native development app before testing receipts. Native/offline-restart and live two-person checks remain pending.
   - Reachable from anywhere in two taps
   - Asks "Shared or Private?" first. Each choice switches to its own theme
   - Amount, category, frequency, who paid, date, and an optional note or foreign currency
   - Allow a quick-log entry to be linked to an existing scheduled payment, or create a new schedule after saving
   - Attach an optional receipt photo, with merchant, amount and date prefilled when receipt scanning is available
   - Offline queue, so logging works in a shop with no signal
   - Implemented in `20261026120000_quick_log.sql`: actor-checked idempotent logging, atomic payment-cycle linking, owner-scoped request records and private receipt Storage policies. A global launcher opens the shared/private choice; device-persisted entries retry without duplicate spending, with separate receipt retries and review for conflicts. Native photo capture/library selection, JPEG normalization, durable local photos, a receipt viewer/deletion flow, original-currency provenance and post-save future schedule setup are included. Last-account offline drafting can use cached catalogues after a retryable session refresh failure; it grants no server access. OCR scanning is not configured, so receipt details are entered manually.
8. **Shared budget screen. ✅** Implemented with existing migrations; native and live two-person checks remain pending.
   - A Shared tab shows the household’s current monthly plan, logged spending and remaining budget, plus assigned plan/spent/remaining for each shared category
   - Planned costs can be assigned to categories through a dedicated version-checked screen. Unassigned costs remain visible in the household total; categories without an allocation show that no plan is assigned
   - Shared refunds reduce spending; future-dated entries and other months are excluded. Upcoming shared bills show the next unpaid cycle per schedule within 90 days, including date windows, unknown estimates and cash-flow corrections; they are not counted as spending until an expense is logged
   - Shared totals use the existing shared-only cash-flow projection, refresh through Realtime, on focus/foreground and every 30 seconds while focused. Errors offer recovery instead of presenting failed loads as zero balances
9. **Private Space screen. ✅** Implemented with existing migrations; native and live two-person checks remain pending.
   - A Private tab uses the paper/clay desk theme and shows the signed-in partner’s monthly allowance, net spending and remaining balance from the existing aggregate contract
   - Recent own spending (ten entries, with access to the full paginated list) includes category/frequency, refund and future-date labels, and links to classification/receipt review
   - Upcoming own private payments show five next unpaid schedules within 90 days, date windows and exact/estimated/unknown amounts. Management opens filtered to Private; new payment drafts default to Private
   - Private expenses remain owner-filtered and protected by RLS; partners only receive the existing allowance aggregates. Future-dated ledger entries within the month count toward allowance, matching Home; unpaid schedules are not deducted until logged. Independent section recovery, owner-scoped cache keys, Realtime/focus/foreground refresh and a focused 30-second fallback are in place
10. **Comments and reactions on shared transactions. ✅** Implemented; apply the new migration before testing. Native and live two-person checks remain pending.
   - Open a shared expense’s conversation from Home activity, Review expenses or shared expense classification. Household members can read paginated comments and add Love, Thanks, Coffee or Celebrate reactions
   - Authors can edit and confirm removal of their own comments. Version checks preserve stale drafts; removed bodies become tombstones that cannot be resurrected by an old retry. Stable comment IDs and desired-state reactions make lost-response retries safe
   - Implemented in `20261026150000_transaction_conversations.sql`: shared-only composite foreign keys, membership/actor-checked RPCs, RLS and direct-write restrictions. No private transaction target or partner-authored edit is allowed. A household revision signal drives live refresh without publishing raw comments or reactions; focus/foreground and a 15-second focused fallback recover missed updates
   - Online comments preserve unsent text in the mounted form across failed refreshes and while editing/removing another comment. They do not use the expense offline queue; closing the screen discards an unsent draft. Money, payment history and classifications are unchanged

**Done when:** two partners can onboard with different payday schedules, log shared and private expenses on different devices, schedule exact-date and date-window payments, see a useful cash-flow forecast, and see the right things instantly, with private items never shown to the partner.

---

## Phase 1.5: Redesign ⏳

**Goal:** replace the current sage/clay look with a crisp, modern finance UI based on the references in `inspo/`. Behaviour, data contracts and privacy rules stay exactly as they are.

**How:** run every step with the `/impeccable` skill. This is a redesign, not a polish. The current look is something to replace, not something to refine. Product truth, copy, functions, accessibility and native affordances stay. No new features and no migrations in this phase.

**What we take from the references** (`inspo/`, 5 screenshots)

- Near-white canvas, large-radius white cards, and one high-contrast near-black hero card per screen (the "Spending vs limit" card with progress bar, spent/budgeted and a percentage)
- One saturated indigo/blue accent for progress and charts, plus a soft, distinct colour tile per category (orange, blue, pink, green)
- Segmented period control (for example This week / This month / This year)
- Circular spending chart: category arcs with icon markers and the total in the centre, plus three mini gauge rings for Income, Total spending and Net balance
- Rounded bar chart with the current period highlighted, a dashed reference line and a value label
- Two-up stat tiles (Bills paid/remaining, Earnings) with slim progress bars
- A horizontally scrolling strip of pill actions on a dark band ("Add budget", "Manage budget")
- Bottom sheets with a grab handle for category lists and transaction entry
- Quick-log amount entry with −/+ steppers, a category picker, and Cancel/Save in the sheet header
- Big, bold numerals with a clear label/value hierarchy

**What we keep from our own rules**

- **Tone:** "we" language and no harsh red. Over-budget states use a calm warning colour. The reference's "16.7% over spending budget" becomes something like "We're 16.7% over the plan".
- **Two spaces:** Shared and Private must still feel different at a glance, and Quick-log still switches theme. The new system needs a shared and a private variant inside one visual language (for example an accent or hero-card swap), not two unrelated themes.
- **Privacy:** no chart, gauge or total may reveal private data to the partner. The partner's allowance stays an aggregate.
- **Global:** charts and numerals use the existing locale-aware money formatting and never assume `$`. Layouts survive long translations.
- **Access:** light and dark mode, dynamic type, 44pt touch targets, screen-reader summaries for every chart, and reduced motion.

**Steps**

- **R1. Product context.** `/impeccable init` to write `PRODUCT.md`: users, the couples angle, tone, privacy promises, platforms. Settle the main tension up front: the references are cool neutrals with indigo, the current brand is warm. Also decide which period filters make sense. Budgets are monthly today, so Hours is dropped; Weeks and Year are added only where existing data supports them, computed client-side.
- **R2. Visual direction and design system.** Run the `/impeccable` redesign flow with `inspo/` as the reference. Write `DESIGN.md` to replace the sage/clay world, then rewrite the tokens in `src/constants/theme.ts`: colour, type scale, spacing, radius, elevation and motion. Load the chosen fonts with `expo-font`. Update the Styling and Tone rows in **Decisions**.
- **R3. Component kit.** Rebuild `src/components/ui/` (Card, Button, Choices as a segmented control, SummaryRow, TextField, Screen) and add HeroCard, StatTile, ProgressBar, CategoryRow with icon tile, PillActions and Sheet. Prefer `@expo/ui` for sheets, pickers and switches, `expo-symbols` for icons, and `expo-glass-effect` for glass surfaces on iOS with a solid fallback elsewhere. Use `/impeccable extract` to keep it consistent.
- **R4. Charts.** Add `react-native-svg` with `npx expo install` (check the SDK 58 docs first). Build SpendDonut, MiniGauge and PeriodBarChart, animated with Reanimated. Each one has a text summary for screen readers and handles empty, zero, single-category and over-budget data.
- **R5. Screens.** Redesign in this order, running `/impeccable critique` on each before moving on:
  1. Home dashboard
  2. Shared budget: hero spending card, period control, category list
  3. Private Space: the private variant
  4. Quick-log sheet: amount steppers, category picker, Shared/Private choice
  5. Payments, payment detail and history, cash-flow calendar and forecast
  6. Categories, income and expenses lists
  7. Onboarding wizard, sign-in, setup, settings, offline and pending logs
  8. Tab bar, native and web
- **R6. Motion.** `/impeccable animate`: sheet transitions, chart draw-in, number changes and press feedback with haptics (`expo-haptics`, added with `npx expo install`). Everything respects reduced motion.
- **R7. Quality pass.** `/impeccable audit` (native), then `/impeccable harden` (long names, large amounts, long translations, empty, loading and error states), then `/impeccable polish`. Check light and dark, small and large phones, and web.

Spending limits appear in the references, but the feature is Phase 3 (step 24). Design a slot for them in the hero card and leave it hidden until then.

**Done when:** every screen uses the new tokens and components with no hard-coded colours left in `src/app`, `DESIGN.md` matches `theme.ts`, all existing tests pass (UI tests change only where markup changed, never behaviour), and both partners see the new design on iOS, Android and web with the same data and privacy as before.

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
- [x] Forecast rules documented for missing income, late payments, refunds, transfers and negative balances
- [x] Translatable copy (Phase 1, step 1)
- [ ] Privacy policy, data export, account deletion
- [ ] Sign in with Apple (required on iOS when other social logins are offered)

## How we verify each phase

- `npm test`: money and split maths
- `npm run test:db`: privacy rules against a real Postgres. Every new table gets a test proving partners and outsiders see only what they should
- `npm run typecheck` and `npm run lint`
- Manual two-device test: browser plus phone, signed in as each partner
- Forecast test: partners with different paydays, a date-window bank payment, a variable bill and an irregular income occurrence
- Privacy test: partner-visible forecasts and notifications never reveal private payment names, categories, amounts or receipt images
- From Phase 1.5: a screenshot of each redesigned screen in light and dark mode on a small phone, a large phone and web, compared with `DESIGN.md`
- From Phase 2: end-to-end tests (Maestro on mobile, Playwright on web) for onboarding → log → reconcile → Money Date → lock

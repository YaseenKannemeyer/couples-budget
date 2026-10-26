# Couple Goals: Build Plan

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

## Positioning and launch strategy

**Pitch (use it everywhere: store listing, first screenshot, onboarding, website):**

> Shared money, private spending, fair splits, and no nagging.

The competitors are finance tools with sharing added on. Couple Goals is built to keep the relationship healthy, not just to track the money.

**Competitive landscape (October 2026)**

| App | Strength | Where we differ |
| --- | --- | --- |
| Honeydue (free) | Couples-focused, bank sync, chat about purchases | Shares at the account or transaction level. We keep private spending private and show the partner only a balance |
| Monarch Money (~$99/yr) | Full household finance, bank sync, net worth | General finance tool. No income-based fairness or relationship ritual |
| YNAB (~$100/yr) | Zero-based method, shared goals | A method, but no ritual for two people |
| Splitwise (free/paid) | Simple running balances | Not a budget |
| Manebo (free + IAP) | Receipt scanning, quick splits | No private spaces or income-aware splits |

**Strategy**

1. **One message.** Repeat the pitch everywhere. The first store screenshot shows privacy and fairness, not a feature list.
2. **Money Date ships at launch.** It's the retention hook and the marketing story ("our monthly money date"). None of the competitors has one, and a budgeting app without a ritual gets dropped in week three. Launch moves to after Phase 2 (see Phase 2.5).
3. **Manual logging is a selling point, not a gap.** We can't beat Monarch on bank sync, so we don't try yet. Pitch it as mindful logging that works anywhere and in any currency. Logging must take under 5 seconds (step 37). CSV import (step 34) moves forward as a cheap middle step before bank feeds.
4. **Go after markets the US apps ignore.** Monarch and YNAB are mostly US-focused, especially for bank sync. Launch first where we are the best option rather than the fifth option in the US (step 40).
5. **Undercut on price, with one plan per couple.** Logging, private spaces and splits are free, so we compete with Honeydue. Money Date, goals and insights are paid, at roughly half the big apps' price and covering both partners (step 28).
6. **Fix the two-person onboarding problem.** The app is useful solo from day one, and the invite feels like a gift: "I set up your private allowance" (steps 35 and 36).

**What we don't compete on (yet):** net worth, investments, broad bank sync and receipt scanning. Monarch and Manebo do these well. They can come later, once couples stay for the relationship features.

**Known risk:** some users won't consider a budgeting app without bank sync. That narrows the early audience to couples who budget on purpose, who are also the most loyal and most willing to pay. Bank feeds remain the v2 answer (Phase 4).

---

## Decisions

| Topic     | Decision                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Market    | Global from day one: multiple currencies, locale formatting, household timezone                                                 |
| Bank data | v1 uses manual logging, a monthly balance check-in and CSV statement import. Bank feeds come in v2                              |
| Launch    | Launch after Phase 2 so Money Date ships in v1. First markets are ones the US apps underserve                                   |
| Pricing   | One subscription per couple. Logging, private spaces and splits free; Money Date, goals and insights paid, at ~half of Monarch/YNAB |
| Platforms | One Expo codebase for iOS, Android and web. Desktop uses the web app, installable as a PWA. A Tauri wrapper only if ever needed |
| Backend   | Supabase: Postgres, Auth, Realtime, Row-Level Security, Edge Functions, pg_cron                                                 |
| Money     | Integer minor units plus an ISO currency code. Never floats                                                                     |
| Privacy   | Enforced in the database (RLS), not only in the UI. Partners only ever receive aggregates of private data                       |
| Styling   | `StyleSheet` with semantic finance tokens in `src/constants/theme.ts`: Shared indigo, Private violet, Manrope display and system body type   |
| Tone      | "We" language, never "You overspent". Calm amber/terracotta warnings, clear financial labels, no harsh red                                                |

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

## Phase 1.5: Redesign 🔜 (implementation complete; final acceptance pending)

**Goal:** replace the current sage/clay look with a crisp, modern finance UI based on the references in `inspo/`. Behaviour, data contracts and privacy rules stay exactly as they are.

**Implementation status — 26 October 2026**

The app is now named **Couple Goals**. `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` record the confirmed product and implemented visual system.

| Step | Status | Evidence / remaining work |
| --- | --- | --- |
| R1 | ✅ | Product brief confirmed; budgets stay monthly. No unsupported week/year selectors or historical series are shown. |
| R2 | ✅ | Cool light/dark tokens, Shared indigo / Private violet, bundled Manrope display font and system body text. |
| R3 | ✅ | Updated base controls plus HeroCard, StatTile, ProgressBar, CategoryRow, PillActions, Sheet, AmountEntry and platform category pickers. iOS uses SF Symbols; other platforms use local SVG icons. Router owns native sheet presentation. |
| R4 | ✅ | Spending donut with numbered category legend, mini gauges and signed forecast checkpoint bars. Summaries include uncategorised spending; refunds stay in signed totals. No fabricated history or spending-limit feature. |
| R5 | ✅ | Core dashboards, Quick-log, cash flow, payment detail, lists, onboarding and navigation use the new system. All other screens inherit the updated shared components. Independent source reviews and static web reviews of the core screens plus 21 secondary surfaces passed; screen implementation is complete. Full live-route/native visual acceptance remains under R7. |
| R6 | ✅ | Reduced-motion-aware progress/arcs/bar updates and amount-change feedback; native press haptics. Native transitions remain platform-owned. Hardware motion verification is pending. |
| R7 | 🔜 | Lint/typecheck, 199 app tests, 106 database tests and iOS/Android/web export pass. Core synthetic web captures cover 320/430/1440 widths in both appearances; 84 secondary captures cover 320/1440. Independent reviews cleared both static web scopes. Native, large-text and live two-partner checks remain open. |

**Remaining acceptance checks**

- [ ] Run the rebuilt native app on iOS and Android; verify picker labeling, sheet keyboard/dismissal, haptics, reduced motion and system navigation.
- [ ] Capture every live route in both appearances on small/large phones and web, including full forms, receipts and native/web tab chrome.
- [ ] Verify large system text, long translated labels/names, maximum amounts, empty/loading/error and offline states on device.
- [ ] Repeat the live two-partner shared/private flow after the redesign.

No migrations, financial models, API contracts or privacy policies were changed. Synthetic captures are development evidence, not native or real-account verification. Phase 1.5 is **not complete** until the remaining acceptance checks pass.

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

- [x] **R1. Product context.** `/impeccable init` to write `PRODUCT.md`: users, the couples angle, tone, privacy promises, platforms. Settle the main tension up front: the references are cool neutrals with indigo, the current brand is warm. Also decide which period filters make sense. Budgets are monthly today, so Hours is dropped; Weeks and Year are added only where existing data supports them, computed client-side.
- [x] **R2. Visual direction and design system.** Run the `/impeccable` redesign flow with `inspo/` as the reference. Write `DESIGN.md` to replace the sage/clay world, then rewrite the tokens in `src/constants/theme.ts`: colour, type scale, spacing, radius, elevation and motion. Load the chosen fonts with `expo-font`. Update the Styling and Tone rows in **Decisions**.
- [x] **R3. Component kit.** Rebuild `src/components/ui/` (Card, Button, Choices as a segmented control, SummaryRow, TextField, Screen) and add HeroCard, StatTile, ProgressBar, CategoryRow with icon tile, PillActions and Sheet. Prefer `@expo/ui` for sheets, pickers and switches, `expo-symbols` for icons, and `expo-glass-effect` for glass surfaces on iOS with a solid fallback elsewhere. Use `/impeccable extract` to keep it consistent.
- [x] **R4. Charts.** Add `react-native-svg` with `npx expo install` (check the SDK 58 docs first). Build SpendDonut, MiniGauge and PeriodBarChart, animated with Reanimated. Each one has a text summary for screen readers and handles empty, zero, single-category and over-budget data.
- [x] **R5. Screens.** Redesign in this order, running `/impeccable critique` on each before moving on:
  1. [x] Home dashboard
  2. [x] Shared budget: hero spending card, period control, category list
  3. [x] Private Space: the private variant
  4. [x] Quick-log sheet: amount steppers, category picker, Shared/Private choice
  5. [x] Payments, payment detail and history, cash-flow calendar and forecast
  6. [x] Categories, income and expenses lists
  7. [x] Onboarding wizard, sign-in, setup, settings, offline and pending logs
  8. [x] Tab bar, native and web
- [x] **R6. Motion.** `/impeccable animate`: sheet transitions, chart draw-in, number changes and press feedback with haptics (`expo-haptics`, added with `npx expo install`). Everything respects reduced motion.
- [ ] **R7. Quality pass (in progress).** `/impeccable audit` (native), then `/impeccable harden` (long names, large amounts, long translations, empty, loading and error states), then `/impeccable polish`. Check light and dark, small and large phones, and web.
  - [x] Lint and typecheck pass; 199 app tests and 106 database tests pass.
  - [x] iOS, Android and web exports pass.
  - [x] Synthetic web captures and independent reviews complete, including the final font and category-picker typography fixes.
  - [ ] Complete the native, full live-route, large-text, receipt/offline and two-partner acceptance checks listed above.

Spending limits appear in the references, but the feature is Phase 3 (step 24). Design a slot for them in the hero card and leave it hidden until then.

**Done when:** every screen uses the new tokens and components with no hard-coded colours left in `src/app`, `DESIGN.md` matches `theme.ts`, all existing tests pass (UI tests change only where markup changed, never behaviour), and both partners see the new design on iOS, Android and web with the same data and privacy as before.

---

## Phase 1.75: Onboarding and guided discovery improvements ⏳

**Goal:** help each partner set up real household finances, then learn the app a little at a time through optional, contextual product tours. The setup wizard handles the work; short overlay walkthroughs explain the relevant features after entering the app. Avoid turning onboarding into a manual for every current and planned feature.

**Placement:** build the onboarding and tour foundation after Phase 1.5. Cover the features that exist then; extend the relevant guides as Phase 2 and later features ship. Refresh the guides before the Phase 2.5 launch.

**Approach:** use `/impeccable onboard` to simplify the journey, `/impeccable clarify` for instructions, and `/impeccable harden` for accessibility and interruptions. Tours must fit the existing native and web app, its design system and its privacy promises. Choose an Expo-compatible implementation during this phase; a browser-only overlay library must not determine the mobile experience.

**Steps**

- **O1. Audit the first-use journey.** Walk through creating a household, joining an existing household, returning to unfinished setup and waiting for a partner. Identify what people need to do now, what can wait and which controls are hard to discover. Define first success as understanding Shared versus Private and being able to log a genuine expense or schedule a bill, without having to learn the whole app first.
- **O2. Improve the task-based setup wizard.** Keep income/split, allowances, shared costs and payday setup actionable: enter real details, see the result, save and continue. Explain why information is needed beside the field. Separate essential setup from optional details and education; offer “Set up later” where the underlying budget rules allow it. Preserve saved progress, validation, stale-edit protection and the ability to resume from Home or Settings. Missing partner information stays visibly pending. Joining partners review the shared setup and enter their own private details, rather than repeating the creator's work.
- **O3. Add a short first-visit product tour.** After setup, offer a walkthrough of roughly 3–5 steps covering the household summary, Shared, Private and the expense launcher. Use a spotlight and a short anchored tooltip or accessible instruction sheet to explain one useful action at a time. Show progress such as “Step 2 of 4”, with Back, Next and a clearly visible Skip/Close. Explain that the partner sees allowance totals, not private purchase details. Users can explore immediately without completing the tour.
- **O4. Teach workflows on the relevant screen.** Offer separate short guides when users first reach Quick-log, scheduled payments, the cash-flow calendar, budget categories and private allowances. Let users tap the actual controls and enter their own details; advance an action step when its expected result occurs, not just when the user taps Next. Opening or advancing a tour never saves an expense, marks a bill paid or changes a budget automatically. Make optional extras such as receipts and foreign currency discoverable at the point of use, rather than adding them all to the first tour. Empty states should explain the next useful action and offer the matching guide.
- **O5. Make guides optional, resumable and personal.** Provide “Show me around” / “Guides” in Settings or Help, with individual guides users can replay. Persist completion, dismissal and resumable progress per signed-in user and tour version, across restarts and devices, with an offline fallback. Store only guide/step identifiers and status; server-stored progress must be owner-only. One partner's progress never completes or resets the other's. Routine launches and ordinary updates do not restart dismissed tours. A newly shipped feature can offer its own small guide without replaying onboarding.
- **O6. Build a reusable cross-platform tour system.** Keep translated step content, stable target IDs, route, availability conditions, expected actions and version in a shared tour registry outside route files. Anchor overlays to the actual rendered control and reposition or scroll into view after layout, orientation or keyboard changes. Handle an absent target, loading/error state, offline action, navigation away and app backgrounding by pausing or ending cleanly. Never point to an unavailable feature or cover the control the user is meant to operate. Use the existing tokens and components; keep instructions short, supportive and specific.
- **O7. Add discovery as features arrive.** Include a small contextual guide and suitable empty-state explanation with joint goals, reconciliation, Money Date and other future workflows. Show guides only when the feature is shipped, enabled and available to that user. Revisit the overall navigation and information hierarchy as the app grows: simplify confusing screens and labels as well as explaining them. Keep advanced and occasional workflows out of the initial tour.
- **O8. Verify comprehension and accessibility.** Test with people unfamiliar with the app: can they finish setup, explain Shared versus Private, find Quick-log and record an expense without help? Check iOS, Android and web; light/dark; large text, long translations, screen readers, keyboard focus, reduced motion and comfortable touch targets. Overlays must announce their instruction and progress, preserve access to the intended control, and return focus sensibly when closed. Check Skip, Back, replay, interruption, account switching, partner joining and offline recovery. When analytics from step 29 are available, measure setup completion, first successful action and tour drop-off using step identifiers and coarse events, never amounts, notes, income, receipt content or entered field values.

**Done when:** a new user can complete or resume practical setup, enter the app without a compulsory long tour, understand the privacy boundaries, and use short, replayable guides to discover the workflows they need. Tour progress belongs to each partner, unavailable features are never advertised as usable, and guidance works accessibly on iOS, Android and web without performing financial actions on the user's behalf.

---

## Phase 2: Relationship features ⏳

**Goal:** the features that make this a couples app, not just a budget tracker.

**Build order:** Money Date is the launch feature, so build what it depends on first: 16 (reconciliation), 11 (joint goals), 17 (Money Date), 18 (anti-nag engine), then 12–15.

Each new workflow also adds its contextual guide and empty-state explanation from Phase 1.75; it does not lengthen the initial setup wizard or introduce tour steps for unfinished features.

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

## Phase 2.5: Launch ⏳

**Goal:** ship v1 to the stores with Money Date, a clear message, a fair price and an onboarding that works before the partner joins. Steps 26–30 move here from Phase 3, and step 34 from Phase 4.

**Onboarding launch gate:** finish Phase 1.75 and refresh its guides for the features actually shipping, including joint goals and Money Date. Verify both solo setup and the joining partner's journey, with tours that can be skipped, resumed and replayed.

35. **Solo mode.** One partner can set up the household, budget, scheduled payments and logging and get a useful forecast before the other joins. Missing partner data (income, payday) is shown as pending, never guessed. When the partner joins, their own income and private details stay private as today.
36. **Gift-style invite.** The inviter proposes the partner's private allowance and the shared plan, then sends an invite that reads like a gift ("I set up your private allowance"). The invitee sees what was prepared, confirms or adjusts their allowance on joining, and enters their own income privately. Share via the system share sheet with a deep link that carries the invite code.
37. **Five-second logging.** Target: launcher tap to saved entry in under 5 seconds for a typical shared or private expense. Remember the last Shared/Private choice and category, put the amount first and keep everything else optional. Measure the time with a PostHog event (step 29) and treat regressions as bugs.
34. **CSV statement import** (moved from Phase 4). Import a bank statement CSV, map its columns once per bank, and review rows before saving. Matching against manual logs and scheduled payments reuses the rules planned for step 33. Imported private rows stay owner-only.
26. **Apple and Google sign-in.** Needs developer accounts and a development build.
27. **Account deletion, data export and leaving a household.** Required by app stores, GDPR and POPIA.
28. **Subscriptions via RevenueCat.** One plan per couple, valid on every platform. Free: logging, private spaces, splits, scheduled payments and forecast. Paid: Money Date, joint goals and insights. Price at roughly half of Monarch/YNAB (~$100/yr), with regional pricing in launch markets. Either partner can pay; both get access.
29. **Monitoring.** Sentry and PostHog.
38. **Messaging.** Use the pitch from **Positioning and launch strategy** in the store listing, onboarding welcome, Home empty state and website. The first store screenshot shows privacy and fairness (Shared vs Private, income-based split). Add an "our monthly money date" screenshot. All copy goes through i18n.
39. **Website and privacy policy.** A simple landing page with the pitch, a privacy policy and a support contact. Both stores require the privacy policy URL.
40. **Launch markets.** Choose 1–3 first markets where US apps are weakest (South Africa is the natural first candidate: Stitch, POPIA and local pricing are already in the plan). Localise the store listing, currency defaults and pricing for each. The US comes later.
30. **App store release.** EAS Build and Submit, privacy labels, store listing. New personal Google Play accounts must run a closed test with 12 testers for 14 days before production, so start it early.
41. **Legal and compliance.** Complete every item marked "before launch" in the **Legal and compliance checklist** below. The app items (in-app deletion, data export, consent screens, disclaimers) are code work. The rest are business and paperwork tasks.
42. **Launch plan.** Run the stages and go/no-go gates in [LAUNCH.md](LAUNCH.md): private beta, store closed testing, soft launch in the first market, then expansion.

**Done when:** a couple in a launch market can download the app, set it up solo, invite their partner, log in under 5 seconds, run a Money Date and subscribe once for both of them.

---

## Phase 3: Polish and growth ⏳

19. **Gamification.** Team streaks for consistent logging, badges for staying under budget, milestone celebrations.
20. **Income-inverted view.** Show budgets as percentages instead of amounts, to ease big income gaps.
21. **Settle-up IOUs.** Track who owes whom for couples with separate accounts (new `settlements` table).
22. **50/30/20 insights.** Categories already carry a needs, wants or savings bucket. Show how the split compares to 50/30/20.
23. **Shared shopping list.** Create a household grocery list with estimated prices, mark items bought and optionally turn the final list into one categorised transaction.
24. **Spending limits and gentle alerts.** Set optional category limits and notify the household when a category is approaching its plan, using the app's neutral tone.
25. **Shared financial snapshot.** Manually track household cash, savings, credit cards and debts before bank feeds arrive, with private accounts remaining private.

Steps 26–30 moved to Phase 2.5.

---

## Phase 4: Bank feeds (v2) ⏳

31. **Bank-feed adapter interface**, so each provider plugs in the same way.
32. **Providers by region:** Plaid (US/CA), TrueLayer or GoCardless (UK/EU), Stitch (South Africa).
33. **Auto-matching.** Imported transactions are matched to manual logs and scheduled payments. Unmatched shared-account transactions feed reconciliation.

Step 34 (CSV statement import) moved to Phase 2.5. It remains the fallback where no bank-feed provider covers the bank.

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

## Legal and compliance checklist

Written for a South Africa-first launch (POPIA), with GDPR/UK GDPR in mind for later markets. This is a working checklist, not legal advice: have a South African attorney review the Terms, the Privacy Policy and the business setup before launch.

**Business setup (before launch)**

- [ ] Decide personal or company. Register a (Pty) Ltd with CIPC if possible. Store listings show the seller's legal name, and a company keeps personal liability and your home address separate
- [ ] Get a D-U-N-S number (free, needed for an Apple organisation account)
- [ ] Enrol in the Apple Developer Program and Google Play Console as the organisation. Google shows a physical address publicly on monetised apps
- [ ] Open a business bank account. Complete the tax and banking forms in App Store Connect and the Google Play payments profile
- [ ] Register with SARS for income tax (provisional tax if trading personally). Track VAT: Apple and Google act as merchant of record and handle VAT for in-app purchases in most countries, but web sales through Stripe make us the seller. Consider leaving web purchases off at launch, or use a merchant-of-record provider (Paddle, Lemon Squeezy) for web
- [ ] Trademark check for "Couple Goals" in CIPC, WIPO Global Brand Database, USPTO and EUIPO, plus both app stores. It's a common phrase, so confirm we can use it, or rename now while it's cheap. Register the mark in South Africa if it's clear
- [ ] Register the domain and social handles that match the final name

**POPIA (before launch)**

- [ ] Register the Information Officer with the Information Regulator (by default the CEO or sole director)
- [ ] Write a POPIA section 51 / PAIA manual and publish it on the website
- [ ] Record what personal information we process, why, where it's stored and for how long. This covers income, spending, receipts, comments, device tokens and analytics
- [ ] Retention schedule: closed households, deleted accounts, receipts, logs and backups
- [ ] Cross-border transfers (POPIA section 72): document the Supabase region and every processor outside South Africa, and make sure each has adequate protection (DPA or standard contractual clauses)
- [ ] Sign or accept DPAs with Supabase, Expo, Sentry, PostHog and RevenueCat (and Stitch later)
- [ ] Security safeguards (section 19): RLS privacy tests, encryption in transit and at rest, least-privilege service keys, MFA on all admin accounts, backups (Supabase Pro)
- [ ] Breach response plan (section 22): who decides, how we notify the Regulator and affected users "as soon as reasonably possible", plus a template notice
- [ ] Data subject requests: access, correction, deletion and objection handled in-app or by email within a set time
- [ ] Direct marketing (section 69): marketing emails and push only with opt-in consent, and an unsubscribe in every message

**User-facing documents (before launch)**

- [ ] **Privacy Policy:** plain language, covers both partners and explains exactly what the other partner can and can't see (balances only for private spaces). Linked in both stores, the website, sign-up and Settings
- [ ] **Terms of Service / EULA:** no financial advice, accuracy of user-entered data, acceptable use, limitation of liability, governing law, how a household is shared, and what happens to shared data when one partner leaves or deletes their account
- [ ] **Subscription terms:** price, renewal period, auto-renew, how to cancel (through the store), trial terms, and that one subscription covers both partners
- [ ] **Not financial advice:** forecasts, 50/30/20 insights and budget guidance are informational. Avoid "you should" advice wording so the app stays outside FAIS
- [ ] **ECTA section 43 disclosures** on the website: legal name, registration number, address, contact details and the Terms
- [ ] Consent at sign-up: accept the Terms and Privacy Policy (recorded with version and date). Separate opt-ins for marketing and analytics where needed
- [ ] Open-source and font licences listed in Settings (for example Manrope is under the OFL)

**App store requirements (before launch)**

- [ ] In-app account deletion (Apple guideline 5.1.1(v)), plus a web page for deletion requests (Google Play requirement)
- [ ] Data export (step 27)
- [ ] Apple privacy nutrition labels and Google Play Data safety form, matching what Sentry, PostHog and RevenueCat actually collect
- [ ] iOS privacy manifest covering the app and every SDK
- [ ] Sign in with Apple if Google sign-in is offered on iOS (step 26)
- [ ] Age rating questionnaires: set 18+ or 17+, as the app isn't aimed at children
- [ ] Export compliance: the app uses only standard HTTPS encryption, so set `ITSAppUsesNonExemptEncryption` to false in `app.json`
- [ ] Subscription screens show price, period and renewal terms before purchase, with Restore Purchases and links to the Terms and Privacy Policy
- [ ] Notification permission asked in context, with lock-screen privacy (see Global launch checklist)
- [ ] Review account: a demo household with both partners for Apple and Google reviewers

**Safety (before launch)**

- [ ] Leaving a household is safe for someone in a controlling relationship. Leaving or deleting never notifies the partner with details, and private data is never handed to the remaining partner
- [ ] A support page with links to financial-abuse resources in each launch market

**Before entering the EU/UK or US (later)**

- [ ] GDPR/UK GDPR: lawful basis for each purpose, an EU and UK representative (Article 27) if there's no establishment there, cookie and analytics consent on web, and the 72-hour breach notification rule
- [ ] US: state privacy laws (CCPA and others) once over their thresholds. Ask a US attorney whether the FTC Safeguards Rule (GLBA) applies, especially once bank feeds arrive
- [ ] Bank feeds (Phase 4): provider agreements (Stitch, Plaid, TrueLayer), explicit consent flows, and per-market open-banking rules
- [ ] Cyber and professional indemnity insurance once revenue starts

## How we verify each phase

- `npm test`: money and split maths
- `npm run test:db`: privacy rules against a real Postgres. Every new table gets a test proving partners and outsiders see only what they should
- `npm run typecheck` and `npm run lint`
- Manual two-device test: browser plus phone, signed in as each partner
- Forecast test: partners with different paydays, a date-window bank payment, a variable bill and an irregular income occurrence
- Privacy test: partner-visible forecasts and notifications never reveal private payment names, categories, amounts or receipt images
- From Phase 1.5: a screenshot of each redesigned screen in light and dark mode on a small phone, a large phone and web, compared with `DESIGN.md`
- From Phase 1.75: first-use and returning-user tests for setup → optional tour → real task, including Skip/Back/replay, per-user progress, missing targets, offline interruption, large text and screen-reader/keyboard operation; tour advancement must never submit a financial change automatically
- From Phase 2: end-to-end tests (Maestro on mobile, Playwright on web) for onboarding → log → reconcile → Money Date → lock

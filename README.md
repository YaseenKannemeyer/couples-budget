# Couple Goals

A budgeting app for couples: one Shared Bucket for life together, plus a Private Space for each
partner that the other can see the balance of, but never the contents.

One codebase (Expo + React Native) runs on iOS, Android and the web. Supabase provides the
database, sign-in and live sync.

See [PLAN.md](PLAN.md) for the full roadmap, phase by phase.

## First-time setup

1. Install dependencies: `npm install`
2. Create a free project at [supabase.com](https://supabase.com).
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key
   (Supabase → Project Settings → API).
4. In the Supabase dashboard, open **SQL Editor** and run every file in
   `supabase/migrations/` in filename order. For an existing database, run only the files
   you haven't applied yet: `20261025180000_budget_onboarding.sql`, then
   `20261025193000_scheduled_payments.sql`, then `20261025210000_categories_and_frequency.sql`.
5. While developing, consider turning off **Confirm email** (Authentication → Sign In / Providers →
   Email) so new test accounts can sign in immediately.

## Running it

```bash
npm run web        # in the browser
npm start          # then scan the QR code with Expo Go on your phone
```

To try the couple flow, sign up as one partner in the browser and as the other on your phone
(or in a private browser window).

## Checks

```bash
npm test           # money maths and the fair-share split
npm run test:db    # privacy rules, run against a real Postgres in-process
npm run typecheck
npm run lint
```

## Translations and formatting

Phase 1 has started with i18next, react-i18next and the existing Expo Localization module.
English is the first bundled language; other device languages fall back to English. Language
changes detected by Expo update the app while it is running. No translation downloads are needed.

- Put on-screen copy in `src/i18n/locales/en.json` and render it with `useTranslation()`.
  Translation keys are checked by TypeScript. Keep complete sentences together and interpolate
  names and values; use `Trans` for sentences containing styled text.
- To add a language, create a matching locale JSON file and register it in `resources` in
  `src/i18n/index.ts`. Add only reviewed translations; incomplete translations fall back to English.
- Forms store validation/error keys rather than translated strings. Known service errors are
  mapped in `src/i18n/errors.ts`; unknown errors show a translated fallback.
- Use `useFormatters(household.timezone)` for money, numbers and dates on household screens.
  Formatting follows the device region even when its language falls back to English. Dates use
  the household timezone. These helpers format values only; money remains integer minor units.

## Budget onboarding (Phase 1, step 2)

Apply `supabase/migrations/20261025180000_budget_onboarding.sql` to an existing database before
starting this version. The app now reads the setup columns added by this migration.

After creating or joining a household, the four-step wizard saves monthly income and split mode,
agreed allowances, planned monthly shared costs, and private payday sources. Each partner enters
their own income and payday schedules. Either partner can adjust the shared split, allowances and
cost plan. Monthly income totals are shared; source names, per-payment amounts and payday dates
are owner-only at the database level.

Each **Save and continue** persists the current step. **Finish later** returns Home without saving
changes on the current step; Home and Settings offer a way back. Returning after a saved step
resumes the next step. Completing setup shows the monthly plan on Home. A stale shared draft
offers **Reload latest plan**, which explicitly replaces unsaved local edits with the saved plan.

Amounts use the device's decimal and grouping separators and are saved as integer minor units.
Dates are entered as `YYYY-MM-DD` in the household timezone. Monthly schedules anchor on that
day (short months will use their last day); weekly and biweekly schedules anchor at 7 and 14 days.
Irregular sources allow unknown dates or amounts. Multiple sources can have different schedules.
The income in step 1 remains the monthly estimate used by the split calculator; source amounts
represent individual paydays and do not automatically change that estimate.

Shared costs here are budget plans, separate from actual transactions and the payment schedules
below. Income occurrences and cash-flow forecasts follow in Phase 1, step 5.

Verification includes money/input tests, the four-step UI flow and database tests for private
source visibility, outsider access, stale-write rejection and atomic rollback. To try two devices:
finish or leave setup on the first device, share the invite from Home, then join on the second.
Set different paydays and check that only each owner's source details are visible.

## Scheduled payments (Phase 1, step 3)

The onboarding migration and `supabase/migrations/20261025193000_scheduled_payments.sql` must
both be applied. If you've already run onboarding, run only the scheduled-payments migration.
Open **See all payments** on Home to add a one-time or monthly bill with a name, category,
expected amount (optional for variable bills), payer, shared/private visibility, date and note.
Choose an exact date or a window. Monthly windows stay within one calendar month. A window
on days 30–31 uses February's last day and restores 30–31 in March; editing an unrelated field
during February preserves those original anchors. Dates use the household timezone.

Upcoming schedules are sorted by the next unpaid date. **Due soon** means the window starts
within three days; a payment becomes overdue only after the end of its window. Monthly paid
status refers to the due cycle, not the month in which a late or early payment was recorded.
Late unpaid cycles remain outstanding; paying one advances one monthly cycle rather than
silently skipping missed months. One-time schedules complete after payment.

**Mark paid** confirms the actual amount, paid date and payer. **Also log this expense** creates
the corresponding shared or private transaction atomically; **Record payment only** preserves
history without adding spending a second time. Variable bills retain their schedule and estimate
the next amount from the most recent three cycles. The actual amount always needs confirmation.

Schedules can be edited, paused, resumed, archived or deleted. Visibility and recurrence are
fixed after creation to avoid exposing private history or confusing cycle identities. Delete keeps
immutable history snapshots and logged transactions. All history is available from **Payment
history**, including deleted schedules, with earlier records loaded in pages. Revision checks
reject a stale edit or duplicate paid action and offer an explicit reload.

Shared schedules/history are visible to both partners; private names, amounts, notes and records
are owner-only in Postgres RLS and every RPC. Private expense transactions now also retain the
selected category and note. Categories are archived rather than deleted; direct category deletion
is denied so foreign-key failures cannot reveal private usage. Category management is described below.

### Device reminders

Expo Notifications is now installed and configured. Create a new development build for native
testing after this dependency change; no native project directories need hand editing.
In **Payments**, choose **Enable reminders on this device** and allow notifications. Each bill
can remind its payer on the due date or 1, 3 or 7 days before the window starts, at 9 am in the
household timezone. Permission is requested only after that explicit action. The browser shows
upcoming payments but does not schedule system notifications.

Reminders are local to each opted-in iOS/Android device, cover its next 50 future unpaid reminders,
and never include payment names, amounts, categories or notes. Past reminder times are not
replayed. Managed reminders are reconciled after payment, schedule/status edits, disabling,
sign-out, account changes and foreground refresh; unrelated app notifications are preserved.
Open the app to refresh changes made on another device. Background server-driven reminders
and cross-device cancellation while the app stays closed are Phase 2's anti-nag engine.

Automated checks cover schedule/history privacy, actual transaction fields, stale/duplicate
writes, monthly clamping and editing, deletion retaining history, estimates, notification payloads,
permission revocation and cancellation. Browser forms were checked with synthetic data at desktop
and phone widths. Native delivery, permission/keyboard behavior and a live two-device Supabase
flow still need device testing after applying the new migration.

## Categories and expense frequency (Phase 1, step 4)

After the previous migrations, apply `supabase/migrations/20261025210000_categories_and_frequency.sql`.
Open **Settings → Manage categories**, or use the same action in a payment form or **Review expenses**.
New households receive Essentials, Entertainment, Housing, Transport, Utilities, Health, Personal,
Fun, Savings and Other. Upgrades keep existing category IDs, renamed labels, reporting buckets and
existing valid expense choices, adding missing starter categories rather than deleting legacy ones.

Either partner can create, rename, set an emoji, reorder and archive shared categories. Each person
can also create private custom labels; their names and metadata are owner-only in RLS and payment
workspace queries. A shared expense or schedule can only use shared categories. Private expenses
and schedules can use a shared category or an owner-private label. Category visibility stays fixed
after creation. Buckets (Needs, Wants, Savings) are editable reporting dimensions, separate from
the category name and expense frequency. Saving a private item returns to its private list.

Archiving always requires a different active replacement category, even when a label is unused.
Shared categories must move into another shared category; a private label can move into a shared
or own-private one. The transaction atomically reassigns all linked expenses and schedules before
archiving, including private uses of a shared label, without returning private names, amounts,
usage counts or a conditional “in use” error. This avoids revealing a partner’s private spending.
Paid history keeps its original category-name snapshot. Archived labels can be restored; their
previously moved items stay in their replacement category. Hard category deletion stays disabled.

Home → **Review expenses** lists logged shared expenses or your own private entries. **Update
category and frequency** changes their labels without changing amounts, payers or dates. Every
expense has an active/default category when created and a one-time or monthly frequency. A
standalone monthly label is for reporting and does not create another expense. When a scheduled
payment logs an expense, it records the schedule’s frequency and a persistent schedule reference;
neither can be detached or rewritten, including after deleting the original schedule. Its expense
category can still be changed. The global Log expense action now opens the quick-log workflow described below.

Version checks reject stale edits, archive requests and expense updates; reloading an editor
explicitly replaces unsaved drafts. Category changes refresh payment pickers, and shared/private
expense subscriptions respect RLS. Automated tests include both fresh creation and upgrading
old data with renamed categories, uncategorized entries and deleted payment schedules.

Browser layouts are checked with synthetic data. Live two-person category/payment privacy checks
and native device behavior remain pending.

## Cash-flow calendar (Phase 1, step 5)

After all previous migrations, apply
[`20261026090000_cashflow.sql`](supabase/migrations/20261026090000_cashflow.sql).
Open **Home → Our cash-flow calendar**. No dependency or native module was added in this step.

1. Open **Balance and budget coverage**. Enter the shared account’s closing balance and date,
   after all activity on that date, plus a low-balance threshold. Overdrafts are supported.
2. Link monthly budget lines to shared categories. Several lines in one category are combined.
   Saving an existing onboarding plan preserves its cost/source IDs and category links; new lines
   need a link. Removing a cost removes its link.
3. Each person opens **My income and contributions → Choose what to share** for their own
   payday sources. Enter the amount expected to reach shared funds and a 0–31 day delay.
   The default is zero. Source names, per-payday salaries and individual occurrences remain
   owner-only. The shared calendar receives daily totals of explicitly approved contributions,
   with generic labels and expected/confirmed status. The budget’s existing monthly income total
   used for split calculations remains shared.
4. Open an income occurrence to correct one payday, dismiss it, or record the actual income.
   Receiving a salary privately does **not** confirm a shared transfer: explicitly select
   **Transferred to shared funds** when it arrives there. Use **Add bonus or one-off income**
   for irregular entries; their date and amount may stay unknown.
5. Select a calendar day to see its agenda and projected closing balance. Either partner can
   correct or dismiss a pending shared forecast item without changing its source schedule.
   Income corrections affect a daily aggregate only and cannot confirm money. When that
   aggregate changes, its correction is discarded so partial confirmation cannot count twice.
   An edited item can be reset to the original forecast.
6. **Plan a goal contribution** reserves money for a dated shared goal. These reservations can
   be edited or removed. They do not record savings transfers or progress; full goals follow
   in Phase 2.

The forecast follows these rules:

- Dates and month boundaries use the household timezone; calculations use integer minor units.
  The calendar forecasts the next 90 days. Income generation is bounded to the past year and
  next 180 days, preserving the original monthly day through short months, or 7/14-day cadence.
  An irregular source creates at most one dated occurrence; undated income needs a manual entry.
- A closing balance includes all activity through its date. Only later logged shared transactions
  and confirmed shared contributions change the confirmed balance. There is no guessed starting
  balance. A balance older than a year must be updated before forecasting.
- Expected income is separate from confirmed funds. Late expectations and expectations on/before
  the closing date are excluded until corrected or confirmed. Missing future contributions,
  uncovered budgets and unknown bill amounts produce explicit coverage messages.
- Pending bills use their known amount or the mean of the latest three payments. An unknown
  amount stays unknown. A date window reserves from its first day. Overdue unpaid cycles are
  carried forward immediately after the closing date, or today if later. Paused/archived schedules
  are excluded. More than 600 unpaid monthly cycles requires schedule review.
- Remaining monthly category reservations equal the linked plan minus the full month’s logged
  spending, pending bills and goal reservations in that category, floored at zero. This prevents
  a rent plan and rent bill from reserving the same amount twice. Corrections can intentionally
  override a reservation; dismissing a bill does not remove the underlying monthly budget.
- Outflows are reserved before expected inflows on the same day. The low-balance warning uses
  the lowest projected amount before the next expected contribution, including that day’s outflows.
  With no upcoming contribution, it uses the forecast horizon. Negative balances are displayed.
- Positive transaction amounts are expenses; negative amounts are refunds and increase cash.
  Future-dated ledger entries remain expected until their date. Payment history alone is not an
  extra outflow: **Mark paid → also log expense** creates the ledger entry atomically; if the
  expense was already logged, mark paid without another entry. Update the closing balance for
  gaps rather than treating record-only payment history as a second cash movement.
- Transfers are not new spending or salary. Record an actual contribution to shared funds once;
  do not also log it as a refund. Bank feeds and automatic matching are future work. Goal
  reservations become actual only through a logged movement or an updated closing balance.
- One-off corrections, dismissed income and received history survive source edits/deletion.
  Sharing-rule changes affect future unedited expectations. Shared changes refresh via Realtime
  and on app foreground; owner-only income also refreshes on entry, foreground and every minute
  while open. Raw income occurrences are deliberately absent from the public Realtime publication.

For a repeatable smoke test, set yesterday’s closing balance to 1,000 and a threshold of 100.
Add a shared bill of 1,100 due tomorrow, then an expected shared contribution of 1,500 two days
later. The forecast should warn about a negative balance before the contribution and keep the
confirmed balance at 1,000 until actual entries arrive. Move only that bill occurrence to after
the contribution and check the source schedule has not changed. Add a linked monthly plan and
verify the bill reduces its remaining reservation. Finally, record a private salary as received:
it must remain expected in shared funds until its contribution is explicitly confirmed.
Use separate categories or remove unrelated plans when checking these exact amounts.

Automated checks cover different paydays, short-month anchors, windows, refunds, late/unknown
income, partial confirmation, preserved cost links, stale edits and partner/outsider privacy.
The calendar and day selection were smoke-tested on web at phone and desktop widths using
synthetic data. Native rendering, keyboard/large-text/accessibility-service behavior and the live
two-person workflow still need testing; browser captures do not provide native signoff.

## Home dashboard (Phase 1, step 6)

Reload the app and open **Home** after applying all migrations through cash-flow.
This step adds no migration, dependency or native module.

- The month summary shows monthly income entered by both partners, planned shared costs,
  net logged shared spending, remaining plan and a progress bar. Income is marked provisional
  until both partners enter it. The progress bar is visually bounded; actual over-budget amounts
  and refunds are preserved. With no plan, Home offers setup instead of inventing a percentage.
  Current spending excludes future-dated entries and follows the household timezone.
- Allowance peeks show each partner’s remaining monthly allowance through the existing
  `allowance_balances` aggregate. Raw private purchases and income sources are never requested
  for this section. The aggregate uses the existing allowance rules, including entries dated
  anywhere in the household’s current month.
- Upcoming payments show the next unpaid cycle of up to three shared schedules within the
  calendar’s 90-day horizon, including earlier unpaid obligations, corrected dates/amounts and
  original date windows for amount-only corrections. The two most recently paid shared cycles
  due this month show their paid status and actual amounts. **See all payments** also opens
  your private schedules.
- The cash-flow snapshot uses the same projection as the calendar: next positive expected
  shared contribution, the next 30 days’ reservations and the lowest projected balance across
  90 days. Reservations combine pending bills, remaining category plans, goal reservations and
  future logged outflows; unknown amounts are explicitly additional. An opening balance is
  required for balance figures, and coverage messages direct you to the calendar for missing
  details. A contribution corrected to zero does not count as the next payday.
- Recent activity contains the five latest logged shared expenses/refunds, ordered by creation
  time with a stable ID tie-break, and excludes future-dated expenses. Amount signs show cash
  direction. Paid history and the activity feed explicitly exclude private payment details.

Shared changes refresh via Realtime. Home refreshes on focus and app foreground; its visible
figures poll every 30 seconds while Home has focus, so allowance aggregates update without
broadcasting private transaction identities. **Refresh Home** is available immediately. Queries
are scoped to the signed-in user, household and date. Loading/error states retain navigation
and offer retry; a failed fetch does not become a zero balance.

To test, open Home with a saved monthly cost plan, log a shared scheduled payment with an
expense, then return to Home. Check spending, remaining plan, paid status and recent activity.
Compare the forecast snapshot with **Our cash-flow calendar**. Change only a bill’s estimated
amount and verify its original date window remains visible. On separate partner accounts,
confirm both allowance remainders update while private purchase names and private bills stay
absent from Home. Native phone rendering, large text, accessibility-service behavior and the live
two-person test remain pending; web layout smoke checks use synthetic data.

## Quick-log sheet (Phase 1, step 7)

Apply [`20261026120000_quick_log.sql`](supabase/migrations/20261026120000_quick_log.sql)
after the earlier migrations. It creates the idempotent logging functions, request/receipt tables,
and a private `expense-receipts` Storage bucket. Rebuild your native development app for the new
Expo image-picker, image-manipulator, file-system and crypto modules and photo permission copy.
The project does not yet include an EAS development-build profile; configure one for the target
platform before building. No `ios/` or `android/` directories were created or edited by hand.

The global **Log expense** action opens a modal. Choose **Shared** or **Private**, then enter the
household-currency amount, description, category, frequency, actual payer, date and optional note.
The themes follow that choice. Private entries always use their owner as payer. Dates follow the
household timezone; this version accepts expenses from today back to ten years ago.

- Select an active scheduled payment to log and mark its current unpaid cycle paid atomically.
  The cycle/version is captured when selected. Retries cannot pay the following cycle; a changed,
  paused or already-paid cycle requires review. The expense’s category may differ from its paid
  history snapshot, while the source schedule remains unchanged.
- Without a link, monthly is a reporting label. After the expense reaches the server,
  **Schedule future payments like this** opens the existing schedule editor with its details and
  a default next-month date. Confirm the next unpaid date before saving. The existing expense is
  not created a second time.
- For another currency, enter the actual household-currency charge plus the original currency
  and amount. Both monetary amounts are integer minor units; a derived rate records provenance.
  This step does not fetch daily FX quotes or convert an expense from a guessed rate.
- Attach a photo from the library, or use the camera on native. Camera access is requested only
  after tapping its action; no microphone access is requested. Images are resized to at most
  2,000 pixels on the longest side and re-encoded as JPEG; the app does not request EXIF data.
  Uploads are capped at 5 MB. OCR scanning is not configured, so amount/date/description remain
  manual inputs. Camera delivery and permission-denial behavior still require physical-device tests.

**Offline and retry rules**

Save writes a validated entry to device storage before claiming success. Up to 100 unsynced
entries are allowed per account/household. Each gets a stable random identifier; a lost server
acknowledgement replays the same payload and returns the same saved transaction. Photos are
copied to app document storage on native or IndexedDB on web. A photo upload failure leaves the
expense saved and retries only the attachment. **Pending expenses** distinguishes waiting,
review-required and photo-pending states, offers retry and replacement photos, and lets you
edit/discard a definitively failed entry. A storage failure or unreadable queue is shown explicitly.

Open the household/payment catalogue online once before relying on offline entry. The native
bundle and account-scoped catalogue snapshots allow drafting after restart. If a session refresh
fails because of a connection error, the last remembered account can access only the offline
landing page, quick-log and its own pending entries; no authenticated session is fabricated and
queued transport remains disabled until a real session returns. Sign-out and explicit auth
rejection clear that remembered drafting identity. Switching accounts never sends the previous
account’s queue. On web, keep an already loaded tab available while offline; cold loading the
whole site without a network requires a service worker, which this step does not add.

Sync runs while the app is open, on foreground/reconnection and every 15 seconds. Changes to
household currency, categories, membership or payment cycles are checked again on the server. Queues from a signed-out
account stay on that device until that account returns; clearing app/browser data removes unsynced
entries and photos. Synced local metadata is pruned after a day or beyond the most recent 50 items.
Uploaded local photo copies are deleted after confirmation, with cleanup retried during pruning.

**Receipt privacy and deletion**

A receipt is published only after its expense exists and upload metadata is verified. Shared
photos become readable to household members only after finalization; private photos and request
records remain owner-only. Only the original logger uploads/removes a receipt. Restrictive bucket
policies keep these checks even alongside a broader policy for another bucket. Upload retries
cannot overwrite an existing object. The viewer uses short-lived signed URLs (60 seconds), never
persists those URLs, and disables image disk caching.

Open **Review expenses → Update category and frequency → Receipt photo** to view an attachment.
Removing one deletes Storage bytes before metadata and preserves the expense. The queue reconciles
confirmed removal, including a lost upload acknowledgement or removal on another device, so it
does not retry a cancelled attachment forever. Private receipt data never enters partner-visible
forecasts, activity or reminders. Full retention automation, orphan-object cleanup after direct
ledger/account deletion and account export/deletion remain on the launch checklist.

For manual acceptance testing, log one shared and one private expense, then switch devices/accounts
and check shared-only visibility and allowance aggregates. Select a scheduled cycle and retry its
queue identifier after interrupting the response; spending and paid history should increase once.
In airplane mode, save an expense with a photo, restart the native app, reconnect and verify one
expense plus one receipt. Try an expired-session restart, a changed/archived category, a cycle paid
by the other partner, a denied camera permission, a missing local photo and receipt removal while
upload is pending. These real-device, Supabase Storage and two-person tests are still pending.
Web layout smoke checks use synthetic shared/private forms; automated tests cover queue/account
scoping, lost acknowledgements, auth rejection, receipt cancellation and database/object policies.

## Shared budget (Phase 1, step 8)

Reload the app and open the **Shared** tab (or **Our shared budget** on Home).
No new migration or dependency is required for this step; keep the existing migrations through
`20261026120000_quick_log.sql` applied.

- The screen uses the existing shared-only `get_cashflow` contract. It does not request private
  expenses, private payment details or income-source rows.
- Monthly spending is net shared expenses and refunds dated in the household’s current month,
  through the household’s current day. Future entries are excluded until their date arrives.
- Category plans add together all monthly cost lines assigned to that category. Remaining is
  assigned plan minus logged spending, including negative remaining when spending exceeds the plan.
  Categories without an assigned cost show **No plan assigned** instead of a fabricated balance.
- **Assign planned costs** opens category allocation without asking for a cash balance. Either
  partner can assign or unassign a cost using its saved version; stale edits are rejected.
  Unassigned costs remain listed and included in the household plan. A failed background refresh
  keeps unsaved category choices and their original expected versions, with a reconnect action.
  No automatic allocation
  or change to cost amounts occurs.
- Archived categories with monthly activity or an allocation remain visible. Empty archived
  categories are hidden. Missing category metadata has a fallback so spending still reconciles.
- Upcoming payments show one next unpaid cycle per shared schedule within 90 days, including
  overdue bills, date windows and corrected forecast dates/amounts. Variable bills without an
  estimate stay unknown. Dismissed forecast cycles are omitted. These commitments are shown
  separately and never subtracted from category remaining until an expense is logged.
- Totals refresh on shared Realtime changes (including costs, allocations, transactions,
  categories and paid schedules), focus/foreground, and every 30 seconds while focused.
  The refresh action is also available manually. A failed refresh hides cached amounts and
  offers retry; it never presents a failed load as a zero balance.

To test alone: add a 500 monthly cost in budget setup, assign it to Essentials, then log a
50 shared expense in Essentials dated today. The category should show 50 spent and 450
remaining. A private expense must not change those numbers. Unassigning the cost should move
500 into **Plan still to assign**, while household planned costs stay unchanged. An unpaid bill
must not change spent; recording it with an expense should update the totals once.

For two-person acceptance, keep Shared open on both accounts and log or reclassify a shared
expense from one. Both screens should converge without a reload (with a 30-second focused
fallback after missed events). Repeat with a private expense and confirm no shared total or
private details appear. Test stale simultaneous category allocations, offline/reconnect,
household month rollover, large text and light/dark themes on iOS and Android. These native
and live two-person checks remain pending. Web layout smoke checks used synthetic data at
390×844 and 1280×900; they are not native signoff.

## Private Space (Phase 1, step 9)

Reload and open the **Private** tab. No new migration or dependency is required for this step.
The screen uses the existing private paper/clay palette in light and dark appearances.

- **My allowance** retains only the signed-in account’s row from `allowance_balances()`.
  Monthly allowance, net logged spending and remaining match the aggregate on Home. Refunds
  reduce spending; all ledger dates in the household’s current month count, including future
  dates. Older months and unpaid schedules do not reduce this month’s allowance. It is an
  allowance balance, not a bank balance.
- **My spending** shows ten latest own entries by expense date, with refund/future-date labels
  and available category/frequency labels. Review opens the existing private classification and
  receipt flow. **All my private spending** opens the existing 50-row paginated list.
- **My upcoming payments** shows the five earliest active owner-private schedules within 90 days,
  including overdue payments and date windows. Fixed amounts, variable estimates and unknown
  amounts remain distinct. **All my private payments** opens management filtered to Private,
  including its paused/archived/completed status controls. **Add a private payment** starts a
  Private draft; visibility can still be reviewed before saving.
- Each section loads and retries independently. Failed reads hide that section’s cached values
  instead of inventing zero balances or empty lists. Other successful sections stay usable.
- Query keys include household and signed-in account. Spending queries explicitly filter to
  the owner; RLS remains the privacy boundary for private expenses, schedules and receipt data.
  The payment catalogue can include shared schedules and own private schedules; the overview
  only displays this owner’s private schedules. Partner allowance totals remain the existing
  aggregate-only contract. Nothing adds private spending details to Home or Shared.
- Totals and entries refresh through existing private/payment subscriptions, an owner-filtered
  balance subscription, focus/foreground recovery and a 30-second fallback while focused.
  Log expense stays above native tab bars and takes the private palette on this tab; its first
  step continues to ask Shared or Private.

To test alone, set your allowance to 300, log a private expense for 50 dated this month and
open Private. The allowance should show 50 logged and 250 remaining. Log a shared expense and
confirm that allowance is unchanged. Add a private variable bill, verify its date window and
unknown amount, then mark it paid with an expense: spending and balance should change once.
Try a denied network request and retry, then sign out and use a different account to check that
neither spending nor cached balances appear across accounts.

With two accounts, confirm each Private tab has only its owner’s spending, schedules, private
category labels and receipt access. Home may show allowance aggregates, while shared spending
stays unchanged. Check updates on another device signed into the same account, month rollover,
light/dark appearance, large text and native tab/launcher placement. These native and live
two-person checks remain pending. Synthetic web checks used 390×844 and 1280×900; they do not
provide native or physical accessibility signoff.

## Shared comments and reactions (Phase 1, step 10)

Apply [`20261026150000_transaction_conversations.sql`](supabase/migrations/20261026150000_transaction_conversations.sql)
after the previous migrations, then reload. Open **Comments & reactions** on a shared expense
in Home activity, Review expenses or its category/frequency screen. Private expenses have no
conversation link and cannot be targeted by the database APIs, even with a known private ID.

- Comments appear newest first, 20 at a time, with **Load older comments**. Author and timestamp
  are shown using the household timezone. Text is plain text, trimmed and limited to 1,000
  Unicode characters. Blank comments are rejected in the app and database.
- Either partner can read and post. Only the author can edit or remove a comment. Removal asks
  for confirmation, clears the stored body and leaves a visible tombstone. An old create retry
  cannot resurrect removed text. Stale edits/removals are rejected. After refresh, review the latest saved text and explicitly
  adopt its version before retrying; an edit keeps its authored draft. Removal still requires confirmation.
- Love, Thanks, Coffee and Celebrate are independent reactions. Each partner can select each
  kind once and remove only their own selection. Buttons expose their selected state and count;
  names show who reacted. Requests set the desired state instead of toggling it on the server,
  so retrying a lost acknowledgement does not toggle twice.
- Comment requests use a stable client ID while retrying the open draft, avoiding duplicate
  comments after a lost response. Failed sends keep the draft; successful sends clear it.
  A new draft stays mounted while editing/removing an existing comment, and an edit retains its
  captured version during background updates. Comments require a connection and do not use the
  expense queue. Leaving the conversation or restarting the app discards an unsent draft.
- Reads and caches are scoped to household, signed-in account and shared expense. RLS controls
  reads; actor-checked, version-aware RPCs control writes. Direct table mutations and internal
  helper execution are revoked. Composite foreign keys prevent cross-household targets.
- Raw `comments` and `reactions` are not added to the Realtime publication. An authorised
  household revision signals changes; clients refetch through RLS. Threads also refresh on
  focus/foreground and every 15 seconds while focused. Failed section loads offer retry rather
  than fabricated empty histories or reaction counts. Monetary totals, payment records and
  expense classification are unaffected. Deleting a shared expense cascades its conversation.

To test alone, open a shared expense, post a comment, edit it, and try each reaction twice to
select/remove it. Confirm comment removal, refresh, and check that spending is unchanged.
Go offline while writing: a failed send must keep the text; reconnect and retry. A private
expense must offer no conversation action.

For two-account acceptance, post from each partner and watch updates arrive on the other screen.
Confirm each account can change only its own comments and reaction selections. Edit the same
author’s comment on two devices to verify stale-version recovery, and interrupt a response to
check that retries do not duplicate a post or toggle a reaction twice. Native keyboard, large
text, accessibility, live Realtime and two-person checks remain pending. Synthetic web smoke
checks used 390×844 and 1280×900 and do not provide native signoff.

## Onboarding and guides (Phase 1.75)

Apply [`20261026170000_guided_discovery.sql`](supabase/migrations/20261026170000_guided_discovery.sql) after the existing migrations, then reload. No new dependency or native rebuild is needed for this phase.

- Joining partners review the saved split, allowances and costs. **Change the shared agreement** enables editing; version checks still reject stale drafts. Each partner enters only their own income and payday sources.
- **Finish later** preserves previously saved steps. On the last step, **Set up paydays later** completes setup without inventing income/date values or removing saved sources. Missing partner totals and household leftover stay pending.
- Phase 1.8 starts **Show me around** automatically on first eligible Home entry. Short guides are offered on Quick-log, payments, cash flow, categories, category allocation and Private. All are optional; **Settings → Guides** can replay or resume each one.
- Instructions appear in the normal scroll flow beside controls. Back, Next, Skip and Close do not log expenses, mark bills paid, save categories or change budgets. Action steps wait for the real result. Quick-log completes its action step after an expense is durably queued, with the existing queue status showing whether it has synced.
- Guide progress stores only guide/version/step/status and concurrency metadata. The server table is owner-only, is not published to household Realtime, and cascades with auth-account deletion. Local caches include the Supabase project and account ID. Partners never share tour progress.
- Progress saves locally before sync. Sync retries on foreground/reconnect/browser focus and every 30 seconds while active. A newer remote revision wins a conflict, including dismissal; explicit replay is available. A lost acknowledgement reuses its request ID. Storage and sync failures are shown, and Guides offers retry.
- Account changes clear the active guide immediately. A remembered offline drafting identity can read/update only its local guide cache; no progress transport runs until a real session returns. Guides pause on background/navigation away or unavailable targets. Guide progress persists; unsaved financial form values keep their existing lifecycle and are not stored in guide state.
- Empty category allocation explains that a cost must be created first and links to budget setup. Unshipped goals, reconciliation and Money Date have no guide entries.

For acceptance, create a household and exit setup after a saved step, then resume it. Join as the second partner and confirm that shared changes require an explicit edit choice. Defer paydays and verify that no source is guessed or deleted. Start, skip, close, resume and replay each guide; perform action steps only with genuine intended entries. Test the same account across devices and two different partner accounts, interrupted responses, offline restart, remote dismissal and account switching. Verify native keyboard/Back, screen readers, focus return, long translations, large text, light/dark and small screens. These live/native checks and comprehension tests with new people remain pending.

## Calm interface and first-sign-in guidance (Phase 1.8)

Apply [`20261026180000_first_sign_in_guidance.sql`](supabase/migrations/20261026180000_first_sign_in_guidance.sql) after the Phase 1.75 migration, then reload. No dependency or native rebuild is required for these changes.

- First authenticated household entry starts a short Shared/Private introduction automatically. The first eligible Home entry starts Show me around; finishing its logging step hands off to Quick-log guidance. Start waits for saved progress to load and a real target to mount. Anonymous/offline identities do not start authenticated introductions. Existing Skip, Close and completion records are respected; regular launches do not reset a tour. Other contextual help stays available through Show me how and Settings → Guides.
- Summaries use the current appearance's surface instead of large inverted cards. Compact list groups and actions replace icon-heavy tiles/bands. Desktop web uses top navigation; narrow web/native retains bottom tabs. Guidance scrolls clear of navigation and safe areas.
- Shared spending charts, forecast charts and budget settings are expandable. This changes information hierarchy, not totals or available data. Private purchase details stay private.
- Quick-log shows amount, description, category, payer/date summary and Save expense on the common path. More details exposes payer/date editing, scheduled cycles, frequency, notes, currency and receipt options. Collapsing details preserves entered values. Blocked entries open their details for review. Queued/synced/review status and idempotent transport retain their existing behavior.
- A successful local queue save remembers only the last space and each space's category ID, scoped to project/account/household. The next entry still asks Shared or Private explicitly and revalidates category eligibility. Storage failure for these optional preferences never turns an expense save into an error. Amounts, notes and photos are not stored in these preferences.
- Long category menus offer search while retaining the current selection. A no-match search never silently changes the category or switches visibility.

Verification and remaining native/live/new-person checks are in `.impeccable/review/phase18/VERIFICATION.md`. No interaction latency, cross-device sync SLA or native usability result is claimed from synthetic browser captures.

## Where things live

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router: every file is a route) |
| `src/features/` | Feature code: data hooks and validation per area |
| `src/lib/money.ts` | Integer minor-unit money maths and formatting |
| `src/lib/split.ts` | The Fair-Share Calculator |
| `src/constants/theme.ts` | Colours for the shared and private spaces |
| `supabase/migrations/` | Database tables and row-level security |
| `test/db/` | Database privacy tests |

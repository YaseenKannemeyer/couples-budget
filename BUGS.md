# Review findings — 30 October 2026

Scope: existing implementation reviewed against the build plan, using Codebase Memory, source inspection and local tests. Application behaviour was not changed.

**BUG** = reproduced defect. **FIX** = follow-up or implementation prerequisite, without claiming a currently exercised defect. **VERIFY** = missing external/device evidence. **NON-ISSUE** = intentional behaviour in the inspected contract. P1 = before beta; P2 = correctness work before broad release; P3 = lower urgency/latent helper.

Findings were reproduced against the actual TS helpers and all migrations in a fresh in-memory database. No production records were used. The retry probes repeated an identical RPC request, modelling a committed write whose response was lost; they did not simulate a device network interruption.

## Confirmed bugs — all open

### BUG-001 · P1 · Retrying new bill creation inserts another bill

**Evidence:** [payment editor](src/features/payments/payment-editor.tsx), [payment API](src/features/payments/api.ts), [scheduled-payment SQL](supabase/migrations/20261025193000_scheduled_payments.sql). Creation sends a null ID; after an uncertain successful save the form still has no saved baseline. A repeated create request inserts a fresh row. The probe produces two different IDs and two schedules.

**Impact:** duplicate commitments and potentially reminders; this does not cause a bank charge. Version checks protect edits but do not deduplicate initial creation.

**Proposed fix:** retain a stable actor-scoped creation request identifier and the original payload until the outcome is resolved; make the server return the original result on retry. A deliberate second bill must use a new request. **Acceptance:** simulate commit followed by lost response, retry and verify one schedule, including app restart recovery where supported.

### BUG-002 · P1 · Retrying manual income creation duplicates shared contribution

**Evidence:** [income form](src/features/cashflow/income-screens.tsx), [cash-flow API](src/features/cashflow/api.ts), [cash-flow SQL](supabase/migrations/20261026090000_cashflow.sql). A new manual occurrence sends a null ID; repeating the create inserts a new occurrence. Probe: two records and 10,000 confirmed shared minor units instead of one record and 5,000.

**Impact:** inflated recorded shared income and misleading forecast/reconciliation inputs. No bank transfer occurs.

**Proposed fix:** stable creation request plus payload retention and server deduplication, as in BUG-001. **Acceptance:** received and expected income retries preserve one occurrence; intentionally separate income remains possible; editing uses existing version checks.

### BUG-003 · P2 · Unknown currency codes pass client and database validation

**Evidence:** [money helper](src/lib/money.ts), [household schema](src/features/household/schema.ts), [quick-log schema](src/features/quick-log/schema.ts), [foundation](supabase/migrations/20261025152237_foundation.sql), [household creation override](supabase/migrations/20261025210000_categories_and_frequency.sql). Three uppercase letters plus successful `Intl.NumberFormat` construction do not validate ISO membership. `ZZZ` passes the helper and creates a household in the probe.

**Impact:** an unsupported currency can be stored, undermining currency/precision assumptions.

**Proposed fix:** define and validate an explicit supported currency registry consistently at client/server boundaries; review existing invalid values before any remediation. **Acceptance:** reject unknown codes while supporting valid zero-, two- and three-decimal currencies. Do not silently rewrite household currency or past amounts.

### BUG-004 · P2 · Valid Indian digit grouping is rejected

**Evidence:** [money input parser](src/features/budget/money-input.ts). Grouping validation assumes each group after the first has three digits. `parseBudgetAmount('12,34,567.89', 'INR', 'en-IN')` returns null; expected 123456789 minor units.

**Impact:** valid locale-formatted amounts fail in forms using this parser. Ungrouped input provides a workaround.

**Proposed fix:** derive primary/secondary grouping sizes from the locale; preserve unambiguous decimal parsing. **Acceptance:** Indian and Western grouping, malformed input, signed values and supported currency precisions; extend coverage for localized digits as appropriate.

### BUG-005 · P2 · Largest-remainder allocation loses precision at permitted high values

**Evidence:** [money allocator](src/lib/money.ts), consumed by [split helpers](src/lib/split.ts). Floating multiplication of safe-integer inputs loses the exact remainder ordering.

For total `999427556014` and weights `[999228437743, 999727182274]`, actual shares are `[499589098144, 499838457870]`; exact integer arithmetic gives `[499589098143, 499838457871]`. Inputs are within the relevant form ceiling. The sum still matches; one minor unit goes to the wrong share at this boundary.

**Impact:** client suggested fair shares can differ by one minor unit for very large values. This finding does not establish the same defect in server goal/expense-split routines, which use numeric arithmetic.

**Proposed fix:** exact integer quotient/remainder arithmetic, preserving tie ordering and signed totals. **Acceptance:** boundary fixture, deterministic ties, negative totals and exact sum; compare against an independent integer reference.

### BUG-006 · P2 · Direct household timezone updates can break forecasts

**Evidence:** [foundation grants/schema](supabase/migrations/20261025152237_foundation.sql), [creation validation](supabase/migrations/20261025210000_categories_and_frequency.sql), [cash-flow SQL](supabase/migrations/20261026090000_cashflow.sql). Creation validates timezone, but an authorized member's permitted direct update accepts `Not/A_Real_Zone`. The next `get_cashflow` fails with “time zone … not recognized.” Reproduced with all migrations loaded.

**Impact:** an invalid authorized update makes timezone-dependent reads fail. No ordinary settings UI path or outsider access is claimed; this is a database contract gap.

**Proposed fix:** enforce valid timezone updates server-side, preferably through a validated/versioned settings contract. **Acceptance:** invalid updates rejected; valid household-timezone changes remain consistent with dates and closed-month rules.

## Follow-up fixes

### FIX-001 · P3 · Define signed FX rounding before using the conversion helper

**Open, latent.** [convertMinor](src/lib/money.ts) uses `Math.round`: at rate 0.5, one minor unit converts to 1 while minus one converts to negative zero (JSON renders 0). Symmetric half-away-from-zero would produce -1. Decide the supported rounding policy and validate rate/input bounds before integrating this helper into imported/refunded amounts. Graph and `rg` inspection found no current production caller beyond the definition; existing quick-log records actual entered base charges. No current user-facing FX loss is established.

### FIX-002 · P1 for BR9 · Guide progress compatibility

**Open prerequisite.** [provider](src/features/guides/provider.tsx) queries guide version 1; [database](supabase/migrations/20261026170000_guided_discovery.sql) constrains version 1; [local progress](src/features/guides/progress.ts) validates stored arrays against the current registry. Current guides use version 1, so this is not a current v1 defect.

Before changing versions/step IDs for the redesign, define migration or compatibility handling for existing progress. Preserve dismissals and completed steps; one old entry must not discard unrelated progress. Test old-cache load, server reads, replay, account switching and interrupted sync. A metadata migration may be needed despite the visual redesign otherwise preserving financial schemas.

### FIX-003 · P1 before public launch · Account recovery

**Open missing workflow.** [sign-in screen](src/features/auth/sign-in-screen.tsx) implements sign-in/sign-up; source search found no password-reset/recovery flow. Add reset request, native/web return handling, password update and invite retention. Verify expiry, invalid links and session transitions. This is missing functionality, not a regression reproduced against a prior recovery feature.

### FIX-004 · Documentation · Completed in this review

Replaced contradictory redesign instructions with the approved banking concept; archived the full prior plan. Separated implementation, deployment and acceptance. Updated product/design/readme pointers. No runtime fixes were applied.

## Verification still required

| ID | Open item | Evidence required |
| --- | --- | --- |
| VERIFY-001 | Launch-invites migration is recorded as undeployed while the app calls its preview/reviewed-join RPCs | Apply prerequisite migrations in order and verify real authenticated create/invite/join; do not distribute against a database missing these RPCs |
| VERIFY-002 | Anti-nag worker, Cron, credentials and native delivery activation | Follow [deployment checklist](supabase/setup/ANTI_NAG_DEPLOYMENT.md); test opt-in, generic content, cooldowns, uncertain send and device registration |
| VERIFY-003 | Installed iOS/Android, accessibility and receipt/offline lifecycle | Keyboard/safe areas, large text, screen readers, dark mode, camera/library, background/restart, account switching and real two-person privacy/sync |
| VERIFY-004 | Financial acceptance on live accounts | Full setup → log → bills/income → goals/gifts → reconciliation → both approve/close; verify snapshots and retained private boundaries |
| VERIFY-005 | Other create operations and deployment history | Extend uncertain-outcome review to categories/forecast reservations and other creates; reconcile deployed migration records without overriding the user's request not to recheck Money Date |

The audit does not verify current legal obligations, pricing, store policies, external providers or business readiness. Existing launch checklist items remain open and need appropriate current verification when acted on.

## Non-issues in inspected behaviour

| ID | Behaviour | Why it is intentional |
| --- | --- | --- |
| NON-001 | Partner can see allowance aggregates | Product contract shares allowance totals, while individual private purchases/receipts remain owner-only; aggregate visibility alone is not a leak |
| NON-002 | Goal contribution/booster/gift does not transfer bank money | These record earmarks; own-allowance gifts explicitly debit the actor's allowance ledger under existing rules |
| NON-003 | Remaining budget differs from actual cash/forecast | They represent different quantities. Current-month future-dated private entries count toward allowance, while shared current-day spending excludes future entries under the documented contract |
| NON-004 | Retrying queued Quick-log differs from new bill/income creation | Expense logging already uses stable request IDs and separate receipt retry; existing local tests cover deduplication. BUG-001/002 must not be generalized to every save |
| NON-005 | Some descriptive/classification edits remain possible around locked history | Monetary amount/date locks and frozen monthly snapshots are the contract; a permitted label edit is not automatically a reopened financial period |
| NON-006 | Node prints MODULE_TYPELESS_PACKAGE_JSON during worker tests | Tests pass; warning is a test-loader concern. Do not globally change package module type without examining Expo/tooling impact |

These verdicts describe inspected contracts, not a blanket security or correctness certification.

## Redesign follow-up — 1 November 2026

These are findings from the [current page/flow review](docs/redesign/REVIEW-2026-11-01.md), separate from the earlier six reproduced financial defects. Runtime code was not changed in this review.

| ID | Classification | Finding and next step |
| --- | --- | --- |
| UI-001 | FIX · high · open | 31 routes still need a dedicated layout pass and 2 are partially adapted. Reuse the banking components across complete list/detail/edit journeys; follow review R-01 and the 40-route checklist. BR5 is partial. |
| UI-002 | FIX · high · open | Contextual navigation remains inconsistent: missing top Back on inherited pages, Income returns to Forecast, and bill edit/cancel returns can lose Personal filtering. Define and test parent/history/fallback rules (R-02). |
| UI-003 | BUG · high · source-confirmed integration mismatch; live reproduction pending | Monthly review guide advances to `money-date-close` without opening stage three, where that target is mounted. The provider deactivates guides whose target is absent. Connect stage navigation to guide progress and test with the real provider, including resume. The synthetic preview manually supplies this connection and cannot validate production behaviour (R-03). |
| UI-004 | BUG · medium · confirmed copy mismatch | Plan says “Add to a category for one week” for Boosters. Actual behaviour earmarks completed-week leftovers toward a goal. Proposed subtitle: “Put weekly leftovers toward a goal” (R-04). |
| UI-005 | VERIFY / FIX · medium · open | Global floating Add expense appears on secondary forms and Monthly review. Presence is source-confirmed; overlap needs native/large-text/keyboard verification. Set task-specific visibility/insets (R-05). |
| UI-006 | FIX · medium · open | Old Phase 1.8 preview imports the removed tabs Settings path; current banking preview covers only six bodies. Restore current secondary-page fixture coverage before claiming visual acceptance (R-06). |

Fresh local checks: 335 app tests across 52 suites, lint and typecheck passed. Passing tests do not close the visual, routing, guide integration or native acceptance findings. See [flow.md](flow.md) for the actual implemented journeys and current limitations.

## Runtime follow-up — 1 November 2026

**BUG-007 · high · fixed in code; device verification pending:** Money-entry screens crashed on the reported iOS runtime because `symbolsFor` unconditionally called the unavailable `Intl.NumberFormat.formatToParts`. The shared parser now detects support and falls back to deriving separators from formatted numbers using locale-specific digits. The regression test removes the method with a fresh module cache and checks grouped amounts, decimal commas, Arabic digits, currency precision, editable-text round trips and rejected malformed amounts. Existing Indian-grouping limitation BUG-004 remains open. Reload the app on the affected device to verify the reported screens.

# Banking redesign — route map and state (BR1)

Recorded 30 October 2026 for the BR implementation. Public URLs are unchanged: Expo Router groups do not appear in URLs, so moving a file out of `(tabs)` keeps its path.

**1 November review:** this is the technical route map. See [flow.md](../../flow.md) for user journeys and [the review](REVIEW-2026-11-01.md) for incomplete secondary layouts, contextual Back issues and the Monthly review guide/stage mismatch. Unchanged guide IDs do not establish working guide progression.

## Baseline before the change

Lint and typecheck passed; app 321/321, database 213/213 and worker 13/13 tests passed (the audit baseline). Tabs were Home · Shared · Private · Settings.

## Main navigation

| Destination | File | URL | Notes |
| --- | --- | --- | --- |
| Overview (tab) | `src/app/(tabs)/index.tsx` | `/` | Was Home. Profile button opens `/settings` |
| Plan (tab) | `src/app/(tabs)/plan.tsx` → `src/features/plan/plan-screen.tsx` | `/plan` | New. Grouped entry points only; no new financial calculations |
| Personal (tab) | `src/app/(tabs)/private-space.tsx` | `/private-space` | Was Private. Route name and URL kept for links and guides |
| Spending budget | `src/app/shared-budget.tsx` | `/shared-budget` | Moved out of tabs into the root Stack; same URL, same auth guard |
| Settings | `src/app/settings.tsx` → `src/features/household/settings-screen.tsx` | `/settings` | Moved out of tabs; opened from the profile/gear button |

Both moved screens sit inside the existing `Stack.Protected guard={isSignedIn && hasHousehold}` group, so signed-out and household-less users are redirected exactly as before. Back returns to the originating tab (Stack history); with no history the detail header replaces to `/`.

## Contextual destinations (unchanged routes)

| From | Opens |
| --- | --- |
| Overview | `/shared-budget` (View budget), `/payments` (See all bills), `/payment-detail?id`, `/expenses` (See all activity), `/expense-thread?id`, `/budget` / `/payment-detail` / `/cash-flow` (attention message) |
| Plan | `/shared-budget`, `/payments`, `/goals`, `/income`, `/cash-flow`, `/money-date`, `/reconciliation`, `/boosters`, `/categories`, `/budget` |
| Spending budget | `/expenses?visibility=shared`, `/budget`, `/budget-categories`, `/categories` |
| Personal | `/expenses?visibility=private`, `/expense-category?id&visibility=private`, `/payments?visibility=private`, `/payment?visibility=private`, `/payment-detail?id`, `/income`, `/budget`, `/settings` |
| Settings | `/budget`, `/categories`, `/reminders`, `/guides` |

Receipt, pending-log, payment history, category, conversation, split, goal, gift, booster and reconciliation screens are reached from their existing parents; none was removed or renamed.

## Add expense

- `src/features/quick-log/launcher.tsx` shows a full-width **Add expense** bar on `/`, `/plan`, `/private-space` and `/shared-budget`; other screens keep the compact floating action.
- Personal opens `/quick-log?space=private`. Elsewhere the form starts from the account's last validated scope, then Shared. Scope is always visible (Shared/Personal control) before saving.
- Pending count stays on the action ("· N waiting to sync") and a Pending expenses link remains on the form.
- Request IDs, owner-scoped queue, receipt retry and conflict recovery are unchanged (`queue.ts`, `sync.ts`, `receipt-files*`).

## Guides and drafts

- No guide ID, version or step ID changed, so FIX-002 compatibility handling is not triggered. Guide paths `/`, `/shared-budget`, `/private-space`, `/quick-log` still resolve.
- The quick-log guide's `space` step (`space-chosen`) now fires when the user changes scope on the form or saves (saving confirms the visible scope), followed by `expense-queued`. Its target `log-space` sits beside the scope control.
- Unsent drafts, offline queue entries and receipt files remain account-scoped and untouched by navigation.

## Offline

`/quick-log` and `/pending-logs` keep their `(isSignedIn || isOffline) && hasHousehold` guard; the launcher still shows the offline label. Moved screens are online-only, as they were inside tabs.

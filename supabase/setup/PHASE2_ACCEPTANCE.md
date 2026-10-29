# Phase 2 rollout and acceptance

Status, 29 October 2026: **implementation and relationship database migration complete; reminder activation and real-device acceptance pending**. This file distinguishes app code readiness from a completed live household month.

## Applied change

`supabase/migrations/20261029100000_relationship_features.sql` was applied to the hosted project on 29 October, after the already-present anti-nag database prerequisites. All seven schema/permission checks passed. Deployment evidence is in `.impeccable/review/phase2/DEPLOYMENT.md`. It adds explicit repeating weekly budgets, booster claim history, owner-only allowance gift debits, a sinking-fund purpose, exact per-expense contribution plans and guide progress IDs; it extends allowance aggregates and joint close snapshots. Existing raw private purchases remain owner-only. It does not transfer bank funds, close household periods or opt anyone into notifications. The migration passes the full ordered local database suite. Earlier migration deployment reports are accepted; Money Date has not been queried again.

The earlier dashboard access rejection and local-only decision were superseded by explicit user authorization to apply the migration. The prepared SQL was executed in one transaction through the authenticated project SQL Editor. CLI migration history was not changed or fabricated. Money Date was not queried again. No worker, Cron, credentials, opt-in preference or financial record was changed.

For another environment, apply the ordered migrations through its normal migration process. The new relationship feature requires no additional client dependency or notification opt-in. Reminder activation still follows [ANTI_NAG_DEPLOYMENT.md](ANTI_NAG_DEPLOYMENT.md) for the Edge worker, dedicated secrets, APNs/FCM, installed build and Cron.

## Acceptance with two test partners

Use test accounts and controlled data, not invented real purchases. Each partner controls their own actions, consent and allowance.

1. Create/edit a Shared weekly category limit from a future Monday; verify repeat, pause, changed future limit, household timezone and month-spanning weeks. Completed-week offers require synced spending. Check a refund, overspend, late expense and the same leftover targeted by two clients. Only one combined available amount can be reserved. A correction returns the original week's allocation once; a week intersecting a closed period stays locked. Confirm actual cash and allowances do not change.
2. Gift from one partner's allowance. Verify current allowance and goal-capacity checks, actor spoof prevention and a smaller latest allowance after a private purchase. The partner sees the gift celebration and contribution history without private purchases/remainder in gift details. Existing allowance aggregates remain shared as before. Verify correction, already-corrected entry, lost response, a final gift completing the goal, refresh/reconnect and an attempted competing decision before exact recovery.
3. Create insurance/car-licence/birthday sinking funds. Verify the date, integer monthly amount, saved/remaining, exact odd-unit fair shares, overdue/funded/archive states and shared forecast availability. No target becomes saved money automatically.
4. From a shared expense, save equal/income/percentage/fixed/custom shares and a signed refund. Confirm totals match exactly, zero shares work, missing incomes/partner stay pending, stale concurrent plans cannot overwrite silently and an amount/date correction warns. Private transactions must not expose this shared action. Expected contributions never change the recorded payer, money ledger or allowance.
5. Run a completed **recorded** month: log/sync, boost, gift, reconcile, review Money Date including split agreements, approve from both accounts and close once. Check old and new request retries, stale consent, immutable locked amounts and gift debits, preserved cash checkpoints, frozen allowance aggregates and next-month grants/spending. A closed booster week or gift cannot be reopened through a correction. Historic plans remain unknown when never recorded.
6. On installed iOS/Android builds and web, check keyboard, safe areas, system Back, large text, VoiceOver/TalkBack, locale currencies (zero/two/three decimal), long names and reduced motion. Check offline recovery, account switching, foreground refresh and private-activity isolation. Reminders require the separate activation guide plus real permission/token/cold-start/receipt tests; synthetic browser screenshots are not native proof.

## Local verification

Current evidence is recorded in `.impeccable/review/phase2/VERIFICATION.md`, `REVIEW.md` and `DOCUMENTATION.md`. No hosted or real-device acceptance should be marked done from those records alone.

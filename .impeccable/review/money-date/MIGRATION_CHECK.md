# Live migration check — 28 October 2026

Project: couples-budget (ucacfgmmygffqcniqryf), matching the app Supabase host. Read-only PostgreSQL catalog queries were run through the Supabase SQL Editor. No household records or schema objects were changed.

- Reconciliation: expected tables and apply RPC present.
- Joint goals: expected tables and apply RPC present.
- Money Date: missing. The 35-check metadata comparison against the local Money Date migration returned 0 passed; its five new tables, required columns and triggers were absent. Existing prerequisite functions differ from their intended Money Date replacements.

Next: apply supabase/migrations/20261027200000_money_date.sql. Do not rerun the already-present prerequisite migrations. This is installation verification, not native or two-partner functional acceptance.

Screenshot: live-migration-check.png.

Subsequent update: the user reports applying Money Date on 28 October 2026 and explicitly requested no recheck. That report is accepted; the earlier missing result above is historical evidence, not the current claimed deployment status.

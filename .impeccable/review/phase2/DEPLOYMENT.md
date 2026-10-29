# Phase 2 relationship migration — 29 October 2026

Applied to Supabase project `ucacfgmmygffqcniqryf` (`couples-budget`, main) after the user explicitly reversed the earlier local-only decision and authorized the migration.

- Source: `supabase/migrations/20261029100000_relationship_features.sql`.
- SHA-256: `277bdce9463d5a76c9616c03961804ef1a6d36ea11d1b649e74ed81532a2a035`.
- Method: authenticated Supabase SQL Editor. The entire editor text was copied back and compared with the prepared source plus `begin`, a 5-second local lock timeout, a 60-second statement timeout and `commit`; exact match confirmed before execution.
- Result: **Success. No rows returned**. The transaction committed.
- Before execution, metadata showed the anti-nag preferences, devices, outbox and settings RPC already present, while the relationship request table was absent. No earlier migration was reapplied. Money Date was not queried or independently rechecked.
- Requested PostgREST schema reload after the commit.
- Editor/verification session: https://supabase.com/dashboard/project/ucacfgmmygffqcniqryf/sql/1f4ed288-2c25-480c-a8ae-e7dd5971c043

## Hosted metadata verification

All seven results were **true**:

| Check | Result |
| --- | --- |
| All five relationship tables exist and have RLS enabled | Passed |
| Goals have the non-null sinking-fund kind column | Passed |
| Authenticated clients can read but cannot directly insert/update/delete the five new tables | Passed |
| New public financial RPCs allow authenticated callers and deny anonymous execution | Passed |
| Internal allocation and pre-migration wrapper helpers deny authenticated/anonymous execution | Passed |
| Closed-period and revision triggers exist | Passed |
| Guide constraint includes all four new workflow identifiers | Passed |

Screenshot: `supabase-migration-verification.jpg`. Verification selected schema/permission metadata only; no household records or private financial values were read or written. This verifies deployment and permissions, not a real two-partner financial workflow.

The migration file was applied through SQL Editor; CLI migration history was not changed or fabricated. No Edge worker, Cron, push credentials, opt-in preference, financial record or real household close was changed. Reminder activation and native/live acceptance remain separate work.

# Reconciliation verification — 27 October 2026

Scope: Phase 2 step 16, end-of-month reconciliation. Joint goals, Money Date, period locking/renewal and reminders remain subsequent implementation work.

## Automated checks

- Jest: **35 suites, 242 tests passed**, including 15 new reconciliation UI/API/schema tests.
- PGlite database: **130 tests passed**, including 16 new reconciliation boundary/lifecycle tests.
- Expo lint and TypeScript: passed.
- iOS, Android and web production exports: passed after the confirmation fix. Output is local at `/private/tmp/couple-goals-reconciliation-export`; nothing was published.
- `git diff --check`: passed.

Database tests run the full ordered migration chain with authenticated/anonymous roles. They cover opening/signed balances, confirmed-only expected cash, closing-day boundaries, signed refunds, private-source isolation, stale submissions, actor changes, exact split totals, individual consent, cancellation/replacement, past-month allowance attribution, locked periods, direct-write/helper denial, and lost-response retries without duplicate charges. PGlite does not establish real hosted concurrent-connection behavior.

UI/API tests cover explicit confirmation, stale review blocking, split defaults without guessed missing income, partial approvals, surplus/baseline replacement, signed input/date validation, failed-refresh draft preservation, request-ID/revision reuse across uncertain responses, definitive-conflict recovery and account changes. Response schemas reject null/empty/unsafe confirmed money rather than inventing zero.

## Browser evidence

Nine PNGs in this directory use the production screen with synthetic data and memory-only action/guide callbacks. Phone captures are 390×844; desktop captures are 1280×900. Manrope was loaded before capture. This preview mounts no authenticated session or financial transport and makes no real financial saves.

Opening, shortfall, surplus, approval and guide states were inspected in light/dark appearances across the sampled sizes. Quick confirmation checks exercised own allowance, proposed split, partner approval, cancellation, matched money and extra-money correction. Every review moved web focus to the review heading and revealed its final action. The sampled split screen had a 390 px document width at a 390 px viewport.

`confirm-desktop-dark.png`, `confirm-mobile-light.png` and `split-confirm-mobile-light.png` show the automatic post-click review position, without manual scrolling. Other files show the page top or the guide's intentional anchored scroll position. See REVIEW.md for the independent review and its bounded verdict.

Development-only entry: `.impeccable/reconciliation-preview-entry.tsx`; local HTML/font reference: `.impeccable/reconciliation-preview/`. These are outside Expo Router and production imports.

## Deployment and acceptance

Apply `supabase/migrations/20261027180000_reconciliation.sql` after both guided-discovery migrations, then reload. This migration **has not been applied to live Supabase by this work**. No new native dependency or development rebuild is needed specifically for reconciliation.

Live two-partner testing remains required: real compare/resolve, own-allowance allocation, proposal followed by the other partner's approval, simultaneous edits, interrupted responses/reconnect and account switching. Verify allowance and forecast refresh once, shared-only visibility and owner-private purchase/receipt boundaries. The screen requires a connection; unsaved reconciliation form text is retained only while mounted, not in an offline financial queue.

iOS/Android keyboard, safe areas, system Back, VoiceOver/TalkBack, native accessibility focus, large text, long translations and device timing remain acceptance tasks. Native tooling was unavailable in this environment. Exports prove compilation, and browser fixtures do not replace native or live financial acceptance.

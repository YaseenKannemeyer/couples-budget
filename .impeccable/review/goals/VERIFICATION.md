# Joint goals verification — 27 October 2026

Scope: Phase 2 step 11. Reconciliation was implemented previously and the user reports applying that SQL. Joint-goals SQL is prepared locally; it has not been applied to live Supabase by this work.

## Automated evidence

- Jest: **38 suites / 259 app tests passed**, including 17 new goal UI/model/schema/API cases.
- PGlite: **146 database tests passed**, including 16 new goal lifecycle/privacy cases.
- Expo lint and TypeScript: passed.
- Final production exports for iOS, Android and web: passed. Local output: `/private/tmp/couple-goals-joint-goals-export`; nothing was published.
- `git diff --check`: passed.

Database tests run the full ordered migration chain. They cover integer fair shares and large targets; fixed monthly snapshots; missing-income/partner handling; explicit replan; owner attribution; amount/date caps; overfunding/completion; stale revision, actor and request validation; idempotent retries; immutable correction/reversal history; stable 50-row pagination; category reassignment; explicit legacy reservation replacement; locked periods; archive earmarks; direct-write/helper/RLS denials; and private purchase/source exclusion from responses/signals.

UI/model/API tests cover equal relative progress for different absolute shares, explicit review, exact minor units, stale-confirmation blocking, correction ownership, unknown income, invalid dates/overfunding, draft preservation during failed refresh, funded/empty states, stale editor versions, actor-scoped uncertain-response retries and conflict recovery. Forecast cases prove actual cash remains unchanged while held savings reduce availability, and category budgets/current targets are not counted twice, including closing-day month boundaries. Saved-money response validation rejects null, blank and unsafe values instead of inventing zero.

## Browser evidence

Nine final PNGs in this directory use production components with synthetic fixtures and memory-only financial/guide callbacks. No authenticated session provider or financial mutation transport is mounted. No live contribution, correction, goal or other financial record was saved through the browser.

The sampled matrix includes phone (390×844) and desktop (1280×900), light/dark, real overall/personal progress, creation, contribution review, pending shares, funded/empty states, guidance and the actual recorded-month chart. Manrope loaded before capture; captures were opened and checked. Review automatically moved web focus to **Review our decision**. At 390 px, document width was 390 px and the final confirmation button was at top 306.5 / bottom 356.5 within the 844 px viewport.

`contribution-review-mobile-light.png` is the automatic review position; `guide-desktop-light.png` is the guide's anchored position; `chart-desktop-dark.png` is an explicitly scrolled chart detail. Other captures show their screen's initial position. See REVIEW.md for the independent, bounded disposition and DOCUMENTATION.md for inheritance.

Development-only entry: `.impeccable/goals-preview-entry.tsx` and `.impeccable/goals-preview/`. These are outside Expo Router and production imports. They are not evidence of authenticated route operation.

## Deployment and acceptance

Apply `supabase/migrations/20261027190000_joint_goals.sql` after the reconciliation migration and reload. No new dependency or native rebuild is required specifically for goals. This step does not implement gifts, boosters, genuine goal spending/drawdowns or Money Date.

Still required: actual two-partner goal creation/contributions/corrections and refresh; historical-month rollover and setup changes; stale simultaneous edits; lost responses/reconnect and account switching; real manual-reservation replacement and forecast/reconciliation comparison; native VoiceOver/TalkBack, focus, keyboard/IME, safe areas, system Back, large text, translations, reduced motion and device timing. PGlite and browser fixtures do not establish hosted concurrent-connection or native runtime behavior.

# Phase 1.8 verification

## Follow-up verification — 27 October 2026

- The user reports applying both phase migrations. Reran lint, typecheck, all 227 app tests and all 114 local database tests: passed.
- The real authenticated Expo web app loaded Home, Shared, Private, Settings, Guides and Quick-log against the existing household. The skipped introduction stayed skipped on ordinary entry. Guide replay/Back/Next/Close, focus return, reload and saved-step resume worked; restored the original skipped choice after testing.
- At 390×844, Quick-log required an explicit Shared/Private selection. Empty submission was rejected; the pending queue remained empty and Home still showed no shared expenses. A no-match category search kept the selected category. More details preserved a test-only note across collapse/reopen; Cancel discarded it, and the next Private form was empty. No valid financial save was attempted.
- Quick-log document width matched the 390 px viewport. Measured visible button heights were 48–63 px; amount increment controls were 48×48 px. Tab reached Cancel. These sampled checks do not establish all-control accessibility or native keyboard behavior.
- Inspected phone-sized dark web guidance and normal desktop web navigation; restored the browser viewport afterward. No interaction/logging/sync latency was measured, and no new exports were needed because this pass changed documentation only.
- Still open: native devices/accessibility/large text/light-mode matrix; fresh create/join and first-sign-in flows; two-account and cross-device behavior; offline/expired-session restart and stale simultaneous edits; successful expense/receipt lifecycle acceptance; measured interaction/logging/sync timing; and before/after new-user comprehension. iOS simulator utility and Android tooling are unavailable here.

## Original implementation verification

26 October 2026. Code and synthetic browser verification complete; native/live/new-user acceptance remains pending.

## Automated evidence

- Expo lint and TypeScript: pass after the final inset fix.
- Jest: 32 suites, 227 tests pass. Existing assertions were updated only for intentional copy, disclosure and chart-density changes; money/privacy behavior remains tested.
- Database: 114 tests pass, including preservation of existing decisions when adding owner-only welcome progress.
- Final Expo export: iOS, Android and web pass, locally at `/tmp/couple-goals-phase18-export`. Bundles were not published.
- `git diff --check`: pass.

New tests cover automatic authenticated introduction, Home walkthrough start, remote dismissal, Close/restart, signed-out exclusion, account/household/visibility-scoped defaults, category eligibility and storage failure. Quick-log regression coverage confirms optional details preserve the actual payer, invalid date drafts do not crash formatting, linked payment versions remain captured, and queue validation is unchanged.

## Visual and source evidence

Twenty-two final synthetic browser PNGs live in this directory, with checked dimensions: phone-sized web at390×844 and desktop web at1280×900. The loaded-font marker was checked before capture. These are real screenshots of fixture-rendered components, not native screenshots or live household data. The preview uses memory-only guide state and mounts no authenticated guide transport. Automatic triggers are verified by source/integration tests, not by claiming the fixture authenticates.

A bounded visual pass simplified the summary/actions, disclosed occasional settings/charts and corrected desktop header placement. An independent default finish reviewer substituted for the unavailable named Impeccable role. It inspected all20 initial final captures and found one material source issue: revealing a guide could scroll its heading under the desktop navigation. Screen now reserves72 units for desktop navigation plus16 units of space, or native top safe area plus16. The two additional light/dark desktop guide captures show the correction; DOM geometry measured guide heading top144.5 versus tab-control bottom64. Native inset behavior remains device acceptance work.

Design documentation was refreshed independently from source: DESIGN.md, the design sidecar and the canonical dashboard surface brief now record the approved calm/native system, current63 palette literal values, 18/26 section,28/36 title,34/42 display, 10/12/16 corners and 16-unit surface padding. No new dependencies or fonts were introduced. Taste's native-product exclusions were respected; its audit/restraint judgment informed the redesign while Impeccable's native guidance governed controls and layouts. No native detector was run.

## Deployment and acceptance

Apply `supabase/migrations/20261026180000_first_sign_in_guidance.sql` after the Phase1.75 migration before live testing. It extends the existing progress whitelist and does not reset saved rows. It has not been applied to live Supabase here. Local preferences contain category identifiers and last-space choice only, scoped to project/account/household; server RLS and financial RPCs are unchanged.

Still required: iOS/Android screen readers, keyboard/safe areas, system text scaling and gestures; live authenticated create/join and returning-user flows; same-user cross-device and two-partner isolation; offline/expired-session restart and migration rollout; measured logging/interaction/partner-sync timings; and before/after comprehension with new users. No400ms sync guarantee, five-second logging result, hardware performance result or full Phase1.8 acceptance is claimed.

The development-only preview is `.impeccable/phase18-preview-entry.tsx` plus its memory-only context and static HTML. It remains outside Expo Router and production imports. Review servers were stopped after verification.

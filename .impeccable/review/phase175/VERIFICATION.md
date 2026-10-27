# Phase 1.75 verification

## Follow-up verification — 27 October 2026

- The user reports applying both guided-discovery and first-sign-in-guidance migrations. Live migration history was not independently inspected.
- Reran all checks: 32 Jest suites / 227 app tests and 114 local PGlite database tests passed; lint and typecheck passed.
- Tested the real Expo web app in Chrome with the existing authenticated account and live household data. Settings → Guides loaded; the existing skipped introduction was respected. Replay, Next, Back, Close, focus return, reload, and resume at the saved second step worked. The fourth step offered no Next button and waited for the real launcher action. Restored the introduction's original skipped status afterward.
- Inspected the Shared guide at 390×844 in the current dark appearance. No console warnings/errors were captured during the sampled guide flow. This is a bounded live-web check, not native or full accessibility approval.
- No financial records were created or changed. Same-user cross-device sync, two-partner isolation, offline/expired-session restart, fresh create/join, missing-target interruptions, native accessibility and new-user comprehension remain open. Browser reload persistence alone does not establish server/cross-device sync.
- Native testing remains unavailable: `xcrun simctl` cannot be found and `adb` is not installed.

## Original implementation verification

26 October 2026. Implementation complete; native/live-account/new-user acceptance pending.

## Automated evidence

- Expo lint: pass.
- TypeScript (`npx tsc --noEmit`): pass.
- Jest: 31 suites, 218 tests pass, including all 199 existing tests and 19 additional tests.
- Database: 113 tests pass, including seven new privacy/idempotency/payday-deferral tests.
- Final Expo export: iOS, Android and web pass. Output is local under `/tmp/couple-goals-phase175-export`; nothing was published.
- `git diff --check`: pass.

Tests exercise owner-only guide progress, invalid/anonymous/direct writes, lost acknowledgements, cross-device stale revisions, explicit replay, owner-only completion and payday-source preservation. App tests cover optional offers, actual-result advancement, skip/replay, offline resume, account switching, wrong-route actions, Back preparation, joining-partner review, pending totals, payday deferral and empty-allocation recovery. They use mocks/PGlite and do not certify a live Supabase deployment.

## Synthetic browser evidence

Eleven final PNG captures in this directory use synthetic fixtures and the real app components. Eight mobile captures, including focus/empty-state captures, are 390×844; three desktop captures are 1280×900. The font-loaded label was checked. Captures intentionally show the guide's active scroll position where it sits beside a real control; they do not claim to show the full length of every form.

The first refreshed screenshot batch was malformed by the browser's viewport capture mode and was rejected by the reviewer. It was replaced using full-page capture mode. Final dimensions were checked, every file was opened, and the screenshot bytes were re-encoded to real PNG without altering pixels. No malformed capture remains in the final set.

An independent default reviewer substituted for the unavailable named Impeccable reviewer. It identified two material issues: unavailable category assignment in an empty plan and missing web focus return. Both were fixed. The final reviewer opened all 11 valid captures and scored both listed fixes **resolved**, disposition **ship at the two-fix synthetic/source scope**. This is not whole-surface or native approval. A separate documenter verified inheritance and preserved DESIGN.md/design.json.

A synthetic browser close action was exercised: AX state and a read-only active-element check both identified **Shared** as the focused control. No financial Save action was performed through the browser. No native detector ran; the detector does not judge native React Native surfaces.

## Migration and acceptance boundary

`supabase/migrations/20261026170000_guided_discovery.sql` is added but was not applied to live Supabase. Apply it after the previous migrations before using payday deferral or remote guide progress. Local guide state remains separate from financial drafts and queues.

Native tools are unavailable: `xcrun simctl` is missing and `adb` is not installed. iOS/Android screen readers, native focus, gestures, keyboard/safe areas, orientation and system text scaling remain unverified. Exports prove compilation only. Live migration, same-user cross-device sync, two-partner isolation, offline restart/expired-session recovery and comprehension testing with new users remain acceptance tasks in PLAN.md and AUDIT.md.

Development-only preview: `.impeccable/guides-preview-entry.tsx` with its memory-only guide context and static HTML under `.impeccable/guides-preview/`. It is outside Expo Router and production imports. It mounts no authenticated session or guide transport. The Metro/static servers used for review were stopped after verification.

Tooling note: Impeccable reports an unset comp/code preference for future landing/showcase pages. This ordinary app extension used the established code-first system; no preference or visual-system drift was repaired.

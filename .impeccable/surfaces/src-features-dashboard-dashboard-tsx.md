---
version: 1
slug: "src-features-dashboard-dashboard-tsx"
primary_target: "src/features/dashboard/dashboard.tsx"
related_targets: ["src/features/shared-budget/shared-budget-screen.tsx","src/features/private-space/private-space-screen.tsx","src/features/quick-log/quick-log-screen.tsx","src/components/ui","src/constants/theme.ts"]
---

# Phase 1.8 app simplification

Mode: Operate. Scope: existing app screens and their loading, error, empty and offline states. Code-first Expo/React Native implementation with responsive web. The user confirmed a calm, native direction with simpler screens, compact rows and fewer cards on 26 October 2026.

History: Phase 1.5 introduced the cool finance palette and large inverted spending cards. The user-approved Phase 1.8 direction supersedes that composition; Shared indigo, Private violet and financial/privacy contracts remain.

## Direction contract

THESIS: A couple can understand the shared plan, find the next action and log common expenses with fewer avoidable decisions, while each partner's private spending remains private.

OWN-WORLD: One calm canvas per appearance, compact native-scale headings and left-aligned amounts. Financial summaries follow the current appearance: white with normal ink in light mode, near-black with light ink in dark mode. Shared indigo and Private violet identify the space. Group related rows once and separate tasks with space; retain category color tiles as quiet, redundant decoration. Existing system text, bundled Manrope, platform controls and icons remain; no new fonts or dependencies.

STORY: Read actual spending against the monthly plan, then see compact income/commitment figures, aggregate allowances, upcoming shared commitments, forecast facts and recent shared activity. Open occasional explanations and charts when useful. Unknown, provisional, planned, confirmed and projected values retain their distinct meanings.

FIRST VIEWPORT: Page identity, a concise in-flow guide only when active, one monthly spending summary and compact useful figures/actions. Spent, planned and remaining stay together; income and commitments use transparent compact stat rows. Avoid independent decorative metric cards and heavy inverted action bands. At 390 units wide, content keeps 20-unit side margins and a maximum 760-unit reading width. Desktop web uses top navigation from an effective width of 900; narrower web retains bottom tabs. Native navigation keeps platform behavior.

FORM: The current direction is confirmed in `.impeccable/review/phase18/AUDIT.md`. Shared category rows remain visible while supporting charts and budget settings are disclosed. Quick-log begins with visibility, amount and category; optional details remain mounted when collapsed so entered state survives. Compact guides start automatically at the first eligible authenticated entry after progress and the real target are ready; completion/dismissal remains per account. Guide steps never submit financial actions. Reduced-motion-aware progress and amount feedback show real final values throughout.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

No financial-contract changes, new spending limits or fabricated chart values. The owner-only guide whitelist extension for first-sign-in guidance is the intentional Phase 1.8 migration. Shared charts stay shared; Private charts use only the signed-in owner's existing records. Existing translated labels, functions, native navigation and receipt lifecycle stay intact. Spending-limit UI remains hidden (no data contract exists yet).

## Source values

`src/constants/theme.ts` supplies section/title/display size and line height at 18/26, 28/36 and 34/42; small/medium/large radii at 10/12/16; the legacy `pill` token is now 12. `Card` and `HeroCard` use 16-unit padding and 8-unit gaps. Buttons are at least 50 units high; detail triggers and quiet action rows remain at least 48. These values are recorded as normative tokens in `DESIGN.md`, with preview components and extension metadata in `.impeccable/design.json`.

## Evidence and acceptance

Twenty-two synthetic browser captures under `.impeccable/review/phase18/` cover selected mobile-sized and desktop layouts, light/dark appearances and active guidance. They use preview fixtures and do not establish live household behavior or native runtime acceptance. iOS/Android devices, live two-person/offline flows, large-text/screen-reader checks and new-user comprehension remain acceptance work. No logging-time, interaction-latency or performance measurements were made.

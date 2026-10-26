---
version: 1
slug: "src-features-dashboard-dashboard-tsx"
primary_target: "src/features/dashboard/dashboard.tsx"
related_targets: ["src/features/shared-budget/shared-budget-screen.tsx","src/features/private-space/private-space-screen.tsx","src/features/quick-log/quick-log-screen.tsx","src/components/ui","src/constants/theme.ts"]
---

# Phase 1.5 app redesign

Mode: Operate. Scope: every existing app screen and its loading, error, empty and offline states. Code-first app implementation. The user confirmed PLAN.md and the five inspo screenshots as the direction on 26 October 2026.

## Direction contract

THESIS: A couple can understand their shared plan immediately, then act without exposing personal spending. The supplied finance references replace the incumbent sage/clay world.

OWN-WORLD: Cool near-white canvas, white rounded surfaces, near-black financial summary, indigo progress and orange/blue/pink/green category tiles. Private uses violet selection and a dark violet hero. Native text remains familiar; bundled Manrope carries large numerals.

STORY: Read actual spending against the monthly plan, see aggregate allowances and upcoming commitments, then log or review. Unknown data stays visibly unknown.

FIRST VIEWPORT: Existing tabs and household greeting lead into the dark monthly spending card. Spent, planned and remaining values are visible with a slim progress track. Paired income and plan tiles follow; charts and household actions never displace error recovery or privacy explanations. At 390 units wide, content has 20-unit side margins. Web expands the reading measure without stretching number rows.

FORM: Brief-pinned finance references confirmed by the user override concept seed 730edd41, assigned index 3. No new visual-choice round: the user's reference direction is settled. Monthly period presentation only where data is monthly; no invented historical series. Signature interaction: category arcs and progress settle with a short reduced-motion-aware draw, using genuine existing data.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

No migrations, backend changes, new spending limits or fabricated chart values. Shared charts stay shared; Private charts use only the signed-in owner's existing records. Existing translated labels, functions, native navigation and receipt lifecycle stay intact. Spending-limit UI remains hidden (no data contract exists yet).

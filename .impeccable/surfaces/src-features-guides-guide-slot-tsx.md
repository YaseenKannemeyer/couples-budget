---
version: 1
slug: "src-features-guides-guide-slot-tsx"
primary_target: "src/features/guides/guide-slot.tsx"
related_targets: ["src/features/guides/registry.ts", "src/features/guides/provider.tsx", "src/features/guides/progress.ts", "src/features/guides/guides-screen.tsx", "src/features/budget/budget-wizard.tsx", "supabase/migrations/20261026170000_guided_discovery.sql"]
---

# Phase 1.75 onboarding and guided discovery

Mode: Operate. A local extension of the established Expo/React Native app on iOS, Android and web. Inherit PRODUCT.md and DESIGN.md; no new visual world or durable token change. DESIGN.md and .impeccable/design.json remain unchanged.

## Inheritance

Instruction sheets use the current space/appearance's `accentSoft`, accent progress text, system section/body/small text and existing primary, secondary and ghost buttons. Padding is `Spacing.three` (16), gaps `Spacing.two` (8), and corners `Radius.medium` (18). Actions wrap in the normal scroll flow. Existing screen safe areas, keyboard handling, text scaling and button behavior remain authoritative; no scrim or floating overlay blocks the task.

## Behavior

Guides are optional and offered beside real controls. Seven version-1 guides cover first visit, Quick-log, payments, cash-flow dates, categories, budget category allocation and private allowances. Settings → Guides offers individual resume/replay. Unshipped workflows have no registry entries.

Back, Next/Finish, Skip and Close update guidance only. Action steps omit Next and wait for the matching real result on the expected route; Quick-log waits for durable queueing, with sync status still owned by the existing queue. Preparation copy supports a resumed step whose prerequisite control or cost line is unavailable. Joining partners review the saved shared agreement before explicitly choosing to edit it; optional payday deferral preserves saved sources and never invents amounts or dates. Missing partner totals remain pending.

## States and access

Offers wait for ready progress and are suppressed while another guide is active or after dismissal/completion. Close preserves resumable progress; Skip dismisses; explicit replay restarts. Backgrounding, navigation away or a missing target clears the active guide while retaining progress. Local-storage and sync failures have separate copy; Guides exposes retry.

Instructions reveal in the enclosing scroll view on layout, keyboard and viewport/text-scale changes. Native announcements and web heading focus convey instruction/progress. Web closing returns focus to the following real control; native closing announces the result and supports accessibility escape. These implemented behaviors still require native and live-route acceptance.

## Writes and privacy

Guide state contains only guide/version/step/status plus revision/request and local pending metadata. Local keys include the Supabase project and account ID; server progress is owner-only, excluded from household Realtime and deleted with the auth account. Local writes precede sync; newer remote revisions win conflicts and lost acknowledgements reuse their request IDs. Account changes remount guidance; remembered offline identities use their own cache without server transport until authenticated.

Starting or advancing a guide never saves an expense, changes a budget, creates a category or marks a bill paid. Financial forms keep their existing validation, stale-edit checks, permissions and draft lifecycle. No amounts, notes, income values, receipt contents or entered field values belong in guide progress; no onboarding analytics were added.

## Evidence and remaining acceptance

Checked GuideSlot, registry, provider, progress schema, Guides screen, budget wizard, themed primitives, theme tokens, progress migration, PRODUCT.md, DESIGN.md, the sidecar, README.md and the Phase 1.75 audit. The 11 synthetic captures under .impeccable/review/phase175/ and successful exports are development evidence. Native tooling was unavailable. iOS/Android accessibility and interaction, real-route keyboard/translation checks, live Supabase migration and two-account/device/offline recovery, and comprehension with people unfamiliar with the app remain pending. See the audit and .impeccable/review/phase175/VERIFICATION.md for the acceptance boundary.

# Phase 1.8 baseline and direction

User confirmed: calm and native, simpler screens, compact rows, fewer cards. User rejected the current interface and requested guidance at first sign-in. This supersedes the prior large dark-card composition.

Design read: a mobile-first budgeting app for couples, expressed through restrained native list groups, truthful financial summaries and progressive details. DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 5. Existing Expo/RN controls, SF/Material icons, Manrope/system fonts and semantic Shared/Private colors remain the foundation. Taste contributes audit/typographic/spacing judgment; its marketing/native exclusions mean no landing-page layout, CSS framework or motion library is introduced. Impeccable's native guidance controls interaction.

## Verified baseline findings

- Home stacks a large guide sheet, inverted financial card, icon tiles and another inverted action band before ordinary household information. Repeated independent containers flatten hierarchy.
- Shared repeats plan/spent/remaining in its hero, donut, three gauges and category rows. The category list is pushed down despite being the task.
- Quick-log exposes schedule, frequency, notes, currency and receipt options on the routine path. Save is in a header that can scroll away from the amount.
- Guides have no first-authenticated-entry trigger; every guide needs discovery. Large instructional panels compete with the task underneath them.
- Web uses a floating bottom navigation band even on desktop, leaving little difference between pointer and thumb layouts.
- Existing strengths to preserve: per-account guide progress, RLS boundaries, integer money, explicit queued/synced states, conflict recovery, labelled 48-unit controls and reduced-motion support.

## Direction contract

One calm canvas per appearance. Shared indigo and Private violet are identifiers, not full-page decoration. Native-scale headings and left-aligned amounts. Group related rows once; use spacing between tasks. At most one prominent financial summary per screen. Charts become optional supporting detail. Forms start with the common task and disclose occasional fields. Primary controls stay at least 48 units high. Guidance starts automatically on first eligible authenticated entry, stays short, and remains skippable; prior dismissals/completions never reset.

First viewport: clear page identity, a concise guide only when active, one financial summary and useful list rows/actions. No repeated decorative metric tiles or heavy inverted action bars. On web, desktop navigation moves to the top; narrow layouts retain bottom tabs.

## Acceptance boundary

Native runtime, hardware timing and new-person comprehension require real-device/person evidence. Source tests and synthetic browser captures will be reported at their actual scope. No fake balances, latency measurements or native signoff.

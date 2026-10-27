# Phase 1.75 first-use audit

26 October 2026. Source audit plus synthetic web inspection; this is not a usability study or native acceptance.

| Journey | Finding | Implemented response |
| --- | --- | --- |
| Create household | Four real financial steps precede Home, although each already saves independently | Retain the wizard and Finish later; explain the purpose beside each field; defer optional paydays without guessed values |
| Join household | The same fully editable shared form is presented to both people | Joining partners review the saved split, allowances and costs first; changing the shared agreement is explicit; income and sources remain personal |
| Resume setup | Saved steps and stale-draft recovery already work | Preserve atomic version-checked saves, explicit reload and owner progress; tests retain these contracts |
| Wait for partner | Partial income can look like a complete household total or leftover | Label partial income and withhold household leftover until both incomes are entered; explain that logging can start immediately |
| First useful action | Shared/Private and the global launcher require discovery | Offer a four-step walkthrough on Home and contextual Quick-log help; no compulsory tour |
| Learn occasional workflows | Existing screens provide actions but no replayable education | Offer separate guides for bills, cash-flow dates, categories, category allocation and private allowances; list them in Settings → Guides |
| Empty category allocation | There may be no cost line to assign | Explain the dependency and show budget setup recovery; register the assignment control only when a cost exists |

First success: a person can explain Shared versus Private and save one genuine expense or schedule a real upcoming bill. Tours never submit those actions. The existing data entry, permissions, queue and privacy boundaries remain the authority.

The implementation uses in-flow, accessible instruction sheets beside stable targets rather than floating overlays. These reflow with text, orientation and keyboard changes, scroll into view and leave controls usable. This is a local extension of the existing design system. No new dependencies, visual identity or onboarding analytics were added.

## Acceptance still required

- New people: create/join/resume/solo-wait, explain privacy, find the launcher and log without coaching.
- iOS/Android: screen readers, focus after closing, Back gesture, large system text, keyboard/orientation changes, reduced motion and safe areas.
- Live Supabase: apply migration, repeat across two accounts/devices, offline restart/reconnect, simultaneous progress updates, missing target/loading and session changes.
- Web: keyboard flow, long translations and narrow layouts with all real routes and native sheet equivalents checked separately.

Automated and synthetic evidence is recorded in VERIFICATION.md; it does not close these gates.

# Couple Goals — Phase 1.5 verification

Date: 26 October 2026. Status: implementation and static web review complete; full phase acceptance remains open in PLAN.md.

## Automated evidence

- Expo lint and TypeScript: pass.
- Jest: 29 suites, 199 tests pass, including retained privacy-sensitive UI behavior and a new invalid/max-amount stepper regression check.
- Database: 106 tests pass. No migrations, API contracts, schemas or financial models changed.
- Expo export: iOS, Android and web bundles pass. Bundling is not a native runtime test.

## Visual evidence

All captures are local browser screenshots of synthetic fixtures, stored as genuine PNG files. Each final capture waits for the bundled Manrope font to report loaded; the main heading family was also checked in the DOM. The preview serves that same bundled font via a same-origin symlink, avoiding cross-origin fallback. They are not iOS/Android screenshots or real household data. No auth provider, sync engine or live-account session is mounted in the fixture entry.

- Core Home, Shared, Private and Cashflow: 320×740, 430×932 and 1440×900, light/dark, plus two scrolled chart captures. Independent review: `ship` within those 26 synthetic web views.
- Secondary surfaces: 21 screens at 320×740 and 1440×900, light/dark (84 captures). Independent review opened all files; final disposition: `ship` for their first viewports.
- Budget allocation is an embedded Card; its four captures were corrected to use its normal Screen wrapper and reviewed again.
- Quick-log also has a 390×844 light capture.

Secondary surfaces: sign-in, setup, household setup, budget wizard, payment editor, mark-paid form, categories, category editor, expense classification, income entry, space choice, Quick-log form, pending logs, conversation, budget allocation, offline, settings, payments list, payment history, expenses list and income list.

## Final font-verified review

The fresh review inspected all 111 final captures (74 individually and 37 desktop views in contact sheets for evidence validity). It identified one material web typography issue: the category picker inherited serif text. The picker now explicitly uses Fonts.sans; all five affected views were recaptured, its DOM computed family was checked as system-ui, and the reviewer scored that fix **resolved**, disposition `ship` at the synthetic-web fix scope. This does not certify native or full phase acceptance.

## Remaining acceptance

Native light/dark appearance; real system text scaling and long translations; native picker labels and selection; form-sheet keyboard, scrolling and dismissal; reduced motion and haptics on hardware; actual tab chrome and focus; full forms below the fold; receipts; live/offline restart; and two-partner shared/private flows. Simulators and Android tooling are unavailable on this machine.

Automatic approval review rejected a browser click on Save expense because it could create a financial record. That submission was not performed or bypassed. Automated tests cover invalid submission and queue behavior.

## Local preview

The development-only entry is `.impeccable/preview-entry.tsx`, outside Expo Router and production app imports. Start Expo on port 8082, then serve `.impeccable/preview` locally on port 8090 to inspect it. It is for visual review, not live submissions. Neither static screenshot review certifies native interactions or full financial workflows.

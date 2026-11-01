# Couple Goals: active product and build plan

Updated 1 November 2026. The user approved a simpler, professional banking-style concept. **Core banking layouts are implemented locally; BR5, BR8 and BR9 are partial; BR10 device/live acceptance remains open.** The [current review](docs/redesign/REVIEW-2026-11-01.md) inventories all 40 screens and identifies unfinished secondary layouts. See [flow.md](flow.md) for the implemented app journeys.

This plan supersedes the visual/navigation instructions from Phases 1.5, 1.75 and 1.8. Their implementation and outstanding acceptance work remain part of the project history.

Read alongside [BUGS.md](BUGS.md), [PRODUCT.md](PRODUCT.md) and [LAUNCH.md](LAUNCH.md). “Implemented” means local code exists, not necessarily deployed, device-tested or accepted by users.

## Product direction

**Shared money, private spending, fair contributions.** The interface should feel as clear and dependable as a banking app: factual labels, readable amounts, predictable navigation and short tasks. It remains a budgeting app; recording a bill, contribution or allowance gift does not initiate a bank transfer.

Everyday use should answer: How much of our shared monthly budget remains? What needs attention next? How do I record a purchase quickly?

Retain monthly budgets, fair-share contributions, private allowances, bills, forecasts, goals, reconciliation and joint monthly approval. Put occasional tasks inside their relevant sections rather than on the first screen.

## Approved visual concept

- Overview, Plan and Personal
- Add expense and Monthly review
- Refinement: coloured icons across the main screens
- Refinement: spending wheel and financial summary

**30 October refinement:** retain the approved layout, box radii, white/navy base and three-tab flow. Incorporate the rounded solid icons, coloured category tiles and spending-wheel palette throughout the relevant UI.

Images establish hierarchy and appearance. Names, balances and dates are illustrative, not real account data or implemented features.

| Element | Target |
| --- | --- |
| Surfaces | White `#FFFFFF`, cool grey `#F4F6F8`; flat rows and fine dividers |
| Identity | Navy `#102A43`, one blue action accent `#175CD3` |
| Text | Slate `#243746`, secondary `#526574`; verify contrast in actual states |
| Typography | Readable system body, restrained headings, tabular financial numerals; reuse bundled fonts only where useful |
| Hierarchy | One dominant summary per main screen, compact lists and clear section titles |
| Shapes | Restrained corners around 12 units; avoid nested cards and decorative gauges |
| Financial states | Explicit remaining, over plan, expected, recorded and pending labels; never colour alone |
| Shared/Personal | Persistent labels within one visual system; replace the separate violet identity |
| Accessibility | 48-unit targets, system text scaling, screen-reader names, logical focus, reduced motion |

Use blue, orange, pink and mint accents for identifiable categories/features, with consistent rounded solid glyphs. Place the multicolour spending wheel and Income / Total spending / Net balance summary in Spending budget; keep Overview focused. Small circular finance badges are icon holders unless an explicitly defined ratio supports a real gauge. Preserve actual-versus-planned meaning and owner-only Personal details.

Design a matching dark appearance before release. Preserve native navigation, safe areas and keyboard behaviour. Address empty/loading/error/offline/stale-data states; an unavailable balance must never look like zero.

## Navigation

Three tabs: **Overview · Plan · Personal**. Settings opens from the profile button. Keep Add expense visible and easy to reach from each main tab.

| Destination | Content | Route strategy |
| --- | --- | --- |
| Overview | Shared budget remaining, next bills, recent shared activity, one timely attention message | Reuse `src/app/(tabs)/index.tsx` and dashboard services |
| Plan | Spending budget, Bills, Goals, Contributions & income, Forecast, Monthly review | Add `src/app/(tabs)/plan.tsx`; grouped rows open existing features |
| Personal | Own allowance, own transactions, private bills, Add personal expense | Reuse `(tabs)/private-space.tsx`; change label, preserve route |
| Spending budget | Category plan/spent/remaining, unassigned costs, plan editing | Keep `/shared-budget` as a Plan detail instead of a main tab |
| Settings | Account, household, invites, reminders, appearance, help/guides | Preserve `/settings`; access from profile |
| Monthly review | Check month, review next month, approve together | Preserve `/money-date` and existing financial services |

Moving routes between Expo Router groups must preserve public URLs, authentication guards, Back behaviour and old links. Keep non-route components outside `src/app/`. Native/web navigators expose the same destinations. Receipt, pending-log, payment history, category, conversation, split, goal, gift, booster and reconciliation screens remain reachable contextually.

The main number is **Shared budget remaining**, not “Account balance.” Actual cash is an explicitly recorded balance; forecast is an estimate. Never combine them into one misleading number. Month browsing requires complete existing facts or frozen snapshots; the mockup does not authorize fabricated history.

## App flows

### First use

Sign in/create account → create household or open invite → essential budget setup → Overview.

Save each step and support resume. The creator enters their own income, proposed split, allowances and shared costs. Defer optional payday details and invitations where existing rules allow. Missing partner information stays pending. A joining partner reviews the proposal and confirms/adjusts their own allowance before entering their private income/payday details. Retain invite codes through authentication. Guides remain optional; respect saved dismissal. Password recovery is FIX-003.

### Add expense

Add expense → amount, description and category → confirm → saved or queued feedback.

Keep Shared/Personal scope prominent. Personal entry defaults to Personal; elsewhere use a validated contextual/default choice and show it before saving. Keep payer/date visible. Receipts, notes, foreign currency and schedule linking belong under More details. Preserve required fields and validation; making description/category optional needs a separate contract decision. Avoid amount steppers.

Reuse the stable expense request ID, owner-scoped offline queue and separate receipt retry. Queued does not mean server-confirmed. Preserve conflict recovery and photo lifecycle; return to the originating screen with refreshed data.

### Bills, goals and income

Plan → Bills → detail → record actual paid date/amount → optionally log expense atomically. Recording payment does not send money. Distinguish upcoming commitments from spending. Address BUG-001 before beta.

Plan → Goals → detail → review and record earmark. Place gifts, boosters and sinking-fund options inside the goal flow. Preserve consent, own-allowance limits, reversals, frozen shares and month locks. Contributions & income keeps source details owner-only and shared contributions explicit. Address BUG-002 before beta.

### Monthly review

Group the existing review engine into three visible stages:

1. **Check this month:** spending, savings progress and observed month-end cash; resolve discrepancies through existing explicit reconciliation actions.
2. **Review next month:** commitments, forecast and optional one-month contribution changes or savings releases, preserving their consent requirements.
3. **Approve together:** show exactly what will close, each partner's approval and the locked-month confirmation.

This changes presentation, not the financial model. Preserve completed-month eligibility, recorded-plan requirements, immutable snapshots, approval hashes, stale-review detection, actor-scoped retries and exactly-once next-month allowances. Never silently allocate discrepancies to a partner. Missing history remains unknown. Resume from server state without implying both people approved.

## Banking redesign implementation checklist

Status reviewed 1 November 2026. "Done" means implemented in local code with automated checks; native/device and live acceptance are tracked under BR10. Route map and state notes: [docs/redesign/ROUTES.md](docs/redesign/ROUTES.md).

- [x] **BR1 — Routes and state.** Route map, preserved URLs, guide targets, draft/offline ownership and Back behaviour recorded; baseline 321 app / 213 database / 13 worker tests plus lint/typecheck.
- [x] **BR2 — Tokens and controls.** New palette (white/grey, navy, one blue accent, separate semantic tokens, light and dark), solid icon set (SVG on Android/web, SF Symbols on iOS), 38-unit category/feature tiles, stable ID/starter-key colour mapping that keeps user emoji, chart colours. Contrast measured (tile glyphs ≥ 3:1, text ≥ 4.5:1); accent tile values deepened from the illustrative starting values for that reason. Rows stack amounts at large text. `DESIGN.md` and `.impeccable/design.json` updated. *Open:* screen-reader and keyboard-focus checks on devices.
- [x] **BR3 — Navigation.** Tabs Overview · Plan · Personal (native and web). Settings and Spending budget moved to the root Stack with unchanged URLs and guard; profile/gear opens Settings; persistent Add expense bar on main screens. *Open:* native deep-link and authentication-return checks on devices.
- [x] **BR4 — Overview.** Shared budget remaining summary ("Budget estimate · Not your bank balance"), one attention message, next bills, recent shared activity, unavailable-not-zero states. Partner allowance aggregates and the cash-flow card moved to Plan.
- [ ] **BR5 — Plan/details (partial).** Plan tab groups Spending budget, Bills, Savings goals, Contributions & income, Cash forecast, Monthly review, Balance check, allowances and tools. Spending budget has the wheel, Income / Total spending / Net balance (same month and cutoff, received shared contributions only), signed-refund and empty handling, selectable accessible category rows and plan editing. Inner feature screens (bills, goals, income, forecast, reconciliation) received the new tokens/components only; their layouts were not individually redesigned.
- [x] **BR6 — Personal.** Own allowance (centred), persistent privacy wording, own transactions and private bills with tiles, income and allowance review. Owner filters and data props unchanged.
- [x] **BR7 — Expense entry.** Shared/Personal control on the form (Personal defaults to Personal; elsewhere last validated choice, then Shared), large typed amount without steppers, category with tile, "Paid by … · date / Edit", "Receipt or more details". Request ID, queue, receipt and conflict paths unchanged.
- [ ] **BR8 — Setup/invites.** *Partly done:* new tokens and components apply to setup, join and invite screens, and Settings shows the invite card when no partner has joined. Shorter explanations and setup-flow restructuring were not done; launch-invites migration deployment remains open (VERIFY-001).
- [ ] **BR9 — Review/guides (partial).** Monthly review shows three stages (Check this month · Review next month · Both approve) around the existing five sections, actions, confirmations, hashes and approvals; "No money is moved" note; Finish later. Guide IDs, versions and step IDs are unchanged, avoiding a version migration. However, the review guide is not connected to the new local stages: its close target is absent until stage three. Resolve R-03 in the 1 November review and verify the real provider before completing BR9.
- [ ] **BR10 — Acceptance.** *Local:* lint, typecheck, 335 app tests (52 suites, including new Plan and wheel suites), 213 database and 13 worker tests pass; `expo export --platform web` succeeds; synthetic web previews compared with the concept images in light and dark. *Open:* native iOS/Android builds, installed iOS/Android and responsive web checks (keyboard, safe areas, screen readers, large text, receipts, offline restart, account switching), live two-partner month close and unassisted new-user observation.

The concept requires no financial schema changes. Any financial contract change is a separate fix. Guide metadata may need a narrow compatibility migration; preserve completion/dismissal and do not put a new version into the current version-1 constraint.

Read matching SDK 58 docs before writing Expo/React Native API code. This is an npm project: use `npx expo install` for compatible dependencies; `package-lock.json` is present, not `bun.lock`.

## Implemented work and actual status

Statuses below are not absence-of-bug certifications.

| Original work | Status and qualification |
| --- | --- |
| Phase 0: auth, household, money, RLS | Implemented; currency/allocation/timezone defects and recovery follow-up recorded |
| Phase 1 / 1–2: i18n, setup | Implemented; Indian grouping defect; native/fresh two-person acceptance pending |
| 3–5: bills, categories, cash flow | Implemented; bill/income creation retry defects; device/live acceptance pending |
| 6–9: dashboard, quick-log, shared/private views | Implemented; local tests pass; native receipts/offline restart/live acceptance pending |
| 10: shared comments/reactions | Implemented; local ownership/retry tests pass; unsent mounted drafts are not durable offline messages |
| Phase 1.5 / 1.75 / 1.8 | Implemented, acceptance incomplete; appearance superseded by BR; native/comprehension checks remain open |
| Phase 2 / 11–17: goals, boosters, gifts, sinking funds, splits, reconciliation, Money Date | Implemented; local tests pass; live two-partner financial acceptance pending |
| 18: anti-nag engine | Implemented locally; worker/Cron/credentials and native delivery activation pending |
| Phase 2.5 / 35–36: solo setup/reviewed invitations | Implemented locally; launch-invites migration undeployed per repository record; native/live acceptance pending |
| BR banking redesign | Core layouts implemented locally; BR5 secondary pages, BR8 setup and BR9 guide integration partial; BR10 device/live acceptance open |

Deployment evidence is historical: reconciliation is user-reported; Money Date was reported applied on 28 October with a request not to recheck it. Anti-nag prerequisites and the relationship migration have recorded 29 October verification. This audit did not recheck production; local tests do not establish live deployment.

## Retained release and future backlog

Original IDs remain for traceability. Full previous wording and business checklists are archived; no unfinished task is silently completed.

| IDs | Remaining work |
| --- | --- |
| 37 | Measure ordinary logging speed; under-five-second target remains unverified |
| 34 | CSV import: mapping, review, duplicate matching, private ownership |
| 26 | Apple/Google sign-in and native return paths |
| 27 | Account deletion, export and safe household departure |
| 28 | Couple subscriptions/entitlements and regional pricing decisions |
| 29 | Monitoring and privacy-preserving analytics; exclude financial field contents |
| 38–40 | Messaging, landing/privacy/support pages, markets and localisation |
| 30, 41–42 | Store release, current business/legal/platform requirements and LAUNCH.md gates |
| 19–25 | Later: gamification, percentage view, IOUs, bucket insights, shopping list, spending alerts, financial snapshot |
| 31–33 | Later: bank adapters/providers and matching |

Reassess gamification against the professional direction. Existing weekly booster limits are not general monthly category limits. Do not advertise CSV, subscriptions, social sign-in or feeds as available before implementation.

Installed stack includes Expo 58, React Native 0.88, Expo Router, TypeScript, Supabase, TanStack Query, Zod, i18next, Reanimated and SVG. RevenueCat, Sentry, PostHog, Lottie and full Maestro/Playwright journeys remain planned. `eas.json` has preview/production profiles; development configuration remains open.

## Next work and release gates

1. Keep BUGS.md visible during redesign. This review records findings without fixes; prioritize duplicate bill/income creation before beta.
2. Complete the remaining page families in the [1 November review](docs/redesign/REVIEW-2026-11-01.md), especially BR5 secondary layouts, BR8 setup and BR9 stage-aware guides. Preserve the core redesign and existing services; use [flow.md](flow.md) to verify contextual navigation.
3. Resolve release defects, deploy prerequisites in order and complete BR10. Activate reminders through their separate deployment checklist.
4. Finish launch/business gates. Old synthetic captures and passing local tests do not replace native/live acceptance.

```sh
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:db
npm run test:edge
```

Audit baseline: **321 app + 213 database + 13 worker tests = 547 passed**, plus lint/typecheck. Database tests use isolated PGlite with a Supabase shim.

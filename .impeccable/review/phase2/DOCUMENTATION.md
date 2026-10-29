# Phase 2 relationship extensions: design inheritance

Date: 29 October 2026. Platform: adaptive Expo/React Native, with synthetic web evidence. This records the finished local extensions against the confirmed incumbent identity; it does not establish a new visual world.

## Authority and preservation

Read `PRODUCT.md`, root `DESIGN.md`, `.impeccable/design.json`, the [direction contract](../../surfaces/phase2-relationship-extensions.md) and Impeccable's `reference/document.md`. The existing north star, “Shared clarity, private confidence,” remains applicable. Root `DESIGN.md` and its sidecar are preserved. No token, identity or component-preview regeneration was needed or performed for this documentation pass.

The contract calls for explicit reviewed decisions in existing Goals, expense and Money Date flows. These were precisely specified, code-led extensions; there is no approved comp or concept card to match. The confirmed explicit weekly-budget decision supplies a real data contract rather than relabelling monthly data.

## Inheritance observed

| Incumbent rule | Finished extension and evidence |
| --- | --- |
| Cool neutral surfaces; Shared indigo and Private violet resolved by space/appearance | Boosters and bill routes explicitly enter Shared context. Goal gifts remain within the shared destination surface while copy identifies the giver's allowance. The dark gift capture does not imply that this is a Private-space screen. Existing theme roles supply appearance; no new palette was introduced. |
| Manrope headings, system body text and truthful money | Existing `ThemedText`, locale-aware money formatting and `SummaryRow` carry the new headings, explanations and exact amounts. All nine captures identify loaded Manrope. Amounts are synthetic fixtures, not evidence of household balances. |
| Compact flat groups, restrained corners and progressive detail | `Screen`, `Choices`, `Disclosure`, `ActionReview`, `TextField` and `Button` are reused. Weekly setup, gifts and goal history/settings use in-flow disclosures; review decisions are visibly separated from editing. Captures retain tonal surfaces and ordinary rows without a decorative container system. |
| Mobile wrapping and bounded desktop reading width | Source retains the shared 760-unit maximum content width. `Choice` now permits shrinking and limits width to its parent so long options wrap; its existing 48-unit minimum target remains. The phone and desktop captures show readable labels and amounts. The parent reports no measured document-width overflow; this documentation pass did not rerun browser measurements. |
| Privacy and factual financial meaning | Gift review shows destination and gift amount; the mutation values contain goal ID/version and amount, with no private remainder. Sinking detail distinguishes ordinary earmarks from gifts that reduce the giver's allowance. Bill review states expected contributions separately from the recorded payer, payment and allowance charges. |
| Recoverable state before decoration | Source retains stale/revision warnings, loading/retry controls, locked-state handling, disabled invalid reviews and uncertain-decision copy. The resolved recovery fixes are recorded in [REVIEW.md](REVIEW.md); the supplied captures cover only selected states. |

Relevant implementation: `src/features/relationships/`, `src/features/goals/{goals-screen,goal-editor,goal-detail,model}`, `src/components/ui/choices.tsx`, the `/boosters` and `/bill-split` route wrappers, guide registry and Money Date's bill-plan disclosure. New guides use the existing in-flow guide pattern and success signals from real mutations. Guide execution and Money Date's new disclosure have source coverage here, not dedicated screenshots.

## Capture coverage

All nine supplied JPEGs were visually inspected and their dimensions checked with `sips`. Each is labelled a synthetic preview. Phone captures are 390×844; desktop captures are 1280×900. Review captures show scrolled portions rather than the whole task.

| Capture | Visible coverage |
| --- | --- |
| [boosters-mobile-light.jpg](boosters-mobile-light.jpg) | Task explanation, completed-week/destination selectors, amount, synced-expenses acknowledgement and disabled review. |
| [booster-review-mobile-light.jpg](booster-review-mobile-light.jpg) | Reviewed completed week, goal and exact earmark; financial meaning and confirm/cancel. |
| [boosters-empty-desktop-light.jpg](boosters-empty-desktop-light.jpg) | Honest no-leftovers state, weekly-budget setup entry and restrained centered layout. |
| [weekly-budget-review-desktop-light.jpg](weekly-budget-review-desktop-light.jpg) | Explicit future Monday and amount; repetition, future-only changes, pause and separation from the monthly spending plan. |
| [gift-review-mobile-dark.jpg](gift-review-mobile-dark.jpg) | Shared goal gift confirmation, allowance effect and no bank-transfer claim; no private remainder displayed. |
| [sinking-mobile-light.jpg](sinking-mobile-light.jpg) | Dated cost, target/saved/remainder/monthly provision and corrected ordinary-contribution versus gift explanation. The final replacement is confirmed 390×844. |
| [sinking-editor-desktop-dark.jpg](sinking-editor-desktop-dark.jpg) | Existing editor with goal-kind choices, sinking explanation, labelled amount/date/category and disabled review. |
| [bill-desktop-dark.jpg](bill-desktop-dark.jpg) | Recorded payer, suggested and proposed exact shares, five split methods and review action. |
| [bill-review-mobile-light.jpg](bill-review-mobile-light.jpg) | Exact percentage shares, contribution-plan explanation and separate confirm/cancel. |

No visible horizontal clipping or new visual-system divergence was observed in these captures. This is selected-state coverage, not exhaustive localization, accessibility or interaction acceptance.

## Historical documentation drift

The preserved `DESIGN.md` Charts and progress paragraph says budget presentation supports monthly data only. That statement predates this extension's explicit weekly category budgets. Shared Budget and allowance presentation remain monthly; Booster budgets are separate future-Monday leftover limits. The historical statement is reported here without editing the incumbent design document. Its prohibition on fabricated weekly data still applies.

The sidecar remains its dated incumbent preview snapshot. Its Selected Choice CSS does not include this extension's shrink/max-width safeguard; source is authoritative for that behavior. No broader drift audit or repairs were performed.

## Finish scope and limits

[REVIEW.md](REVIEW.md) records all three bounded fixes resolved: uncertain gift recovery through competing decisions/completion refresh, income-readiness explanation independent of the household default, and neutral general-savings allowance copy. Its verdict is ship at the reviewed source/synthetic-web scope. This document adds inheritance and evidence coverage; it does not expand that verdict.

No shipping raster assets were introduced; these JPEGs are review evidence only. No detector was run for this adaptive React Native extension. No native device or simulator evidence was available (`simctl`/`adb` absent). Native safe areas, keyboard behavior, Back gestures, screen-reader use, large text and reduced motion remain unverified at runtime. Live two-partner concurrency, deployed migrations, bank movements and new-user comprehension were not verified. Validation commands and deployment status belong to the parent implementation report; no tests, lint or typecheck were independently run by this documentation pass.

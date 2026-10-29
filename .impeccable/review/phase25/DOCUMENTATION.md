# Phase 2.5 documentation: solo setup and invitations

Recorded 29 October 2026. This is the first Phase 2.5 slice (steps 35–36), covering solo-setup explanation and gift-style invitations. It is a source-level implementation record, not launch or visual acceptance.

## Authority and inheritance

The durable product authority is [PRODUCT.md](../../../PRODUCT.md), with the existing visual system in [DESIGN.md](../../../DESIGN.md) and its [sidecar](../../design.json). The implementation extends the incumbent “Shared clarity, private confidence” world: cool neutral surfaces, Shared indigo and Private violet, Manrope display headings and system body text, compact rows and flat related-content groups.

No new visual world, token, asset or dependency is introduced by this slice. `DESIGN.md` and `.impeccable/design.json` are preserved. Their primitives remain authoritative; this report records how the feature uses them rather than generating replacement design documentation.

| Surface | Observed inheritance in source |
| --- | --- |
| Home invitation | One existing `Card` groups the explanation, optional allowance proposal, readable code and actions. Existing primary, secondary and ghost `Button` variants express action priority. |
| Proposal editor | Existing labelled `TextField`, locale-aware budget amount helpers, themed validation and existing spacing. Save, Cancel and stale-save Reload use incumbent controls. |
| Invite entry | Existing `Screen` and `JoinHouseholdForm`; visible name/code labels and explicit Review action. |
| Invite review | One `Card`, `SummaryRow` for shared facts, a labelled allowance field and separate confirmation. The review heading uses the existing system-font `section` variant. |
| Recovery | Existing themed text and buttons for configuration, loading, offline, unavailable household and already-joined states. |

The invitation action row wraps with the existing `Spacing.two` gap and a flexible 140-unit basis. The readable invitation code uses the existing `subtitle` variant with tabular numerals, centered alignment and local letter spacing. These are surface details, not additions to the global token system. Screens and controls inherit their layout, minimum targets, appearance handling and text scaling from the common components; actual rendered behavior remains unverified.

## Product and interaction record

Solo setup remains a real one-member household. As recorded in PRODUCT.md and the acceptance checklist, missing partner income/payday facts and two-person shares remain pending. The invitation is optional; its gift-style framing represents a proposed monthly allowance, not a bank transfer or a created partner.

Observed in [invite-card.tsx](../../../src/features/household/invite-card.tsx):

- The proposal is optional; blank removes it, while zero remains an explicit amount. The editor retains a failed draft and offers Reload after a save error.
- Share and Copy are disabled while editing or rotating the invitation code. Share constructs a `/join` link and readable code; it passes no amount or income value into the invitation message.
- Native sharing uses the system share API. Web uses Web Share when available and otherwise copies the complete invitation. Copy code is a separate action. Copy success uses a polite live region; action failure uses themed alert text.

Observed in [join-form.tsx](../../../src/features/household/join-form.tsx):

- Reviewing a code is separate from joining. The entry form requests a preview only after the explicit Review action.
- The review displays inviter/household identity, split and planned shared costs, then lets the prospective partner confirm or adjust their own allowance. A privacy explanation precedes confirmation.
- The component freezes the facts actually reviewed. A submitted request is retained for uncertain retries; the allowance field stops editing after submission. A changed-plan error requires a new review rather than a silent replacement of the decision.
- Success routes to the budget; a separate Back/Review again action returns to code entry.

Observed in [join.tsx](../../../src/app/join.tsx):

- The route renders sign-in in place, retaining the invitation URL rather than automatically joining on link open.
- An existing household receives an Open Home action rather than a replacement flow.
- Offline entry now exposes Try again wired to session `refresh`; unavailable-household recovery refetches the household separately.
- Configuration and loading states have explicit copy. The normal authenticated entry uses the existing welcome-guide slot and a code/account-keyed form.

The [Phase 2.5 acceptance record](../../../supabase/setup/PHASE25_ACCEPTANCE.md) owns the broader backend and rollout contract: limited authenticated preview facts, own-allowance consent, revision checks, a two-member limit and retry-safe joining. Those claims were not independently re-proven by this documenter. The new launch-invites migration is prepared locally and remains undeployed. Production universal/app links depend on later website/domain work.

## Existing documentation drift and scope

The design sidecar identifies its generation date as 26 October and describes the Phase 1.8 scan. Its synthetic-browser evidence statements belong to that earlier scan; they do not establish browser evidence for this slice. The feature scope recorded in PRODUCT.md has subsequently advanced through Phase 2 and into Phase 2.5.

DESIGN.md also retains historical component/capability descriptions, including the unrendered spending-limit slot and absence of a weekly/annual budget selector. PRODUCT.md now records separately implemented explicit weekly boosters. Preserve that distinction: neither the old component description nor this slice establishes a weekly replacement for monthly budget data. No documentation refresh or repair was performed here.

No new palette or typography departure was observed in the three reviewed feature files. This scoped read does not certify that every existing token, component or sidecar preview matches the current app.

## Evidence and remaining acceptance

Inputs read for this report: PRODUCT.md, DESIGN.md, `.impeccable/design.json`, the three feature files linked above, `supabase/setup/PHASE25_ACCEPTANCE.md` and the Impeccable `reference/document.md` guidance. This report is supplemental review documentation; it does not regenerate the existing design authorities.

The coordinating source reviewer reported an offline-reconnect issue, then reported it resolved after the refresh button and a regression test were added. The current route source contains that refresh button. This documents a source-level resolution only; there is no visual verdict.

No screenshots were captured for this slice. The coordinating agent reported `simctl` unavailable, `adb` absent, no available CUA browsers and a Chrome app click failing with `noWindowsAvailable`. No native or browser runtime inspection is claimed. Historical screenshots or sidecar previews must not be reused as Phase 2.5 acceptance evidence.

The coordinating agent records final check results in [VERIFICATION.md](VERIFICATION.md): 50 Jest suites / 321 tests, 213 local database tests, lint, typecheck, final iOS/Android/web export and `git diff --check` passed. These are attributed results from that verification record, not independently executed by this documenter. Automated checks and exports cannot establish the outstanding runtime and comprehension outcomes.

Still open, using controlled accounts and each partner's own consent actions:

- Cold/warm invite links, signed-out sign-up/email-confirmation return, restart, malformed parameters and native/system Back.
- Offline entry and reconnection on devices, share/copy behavior, cancellation and clipboard failure.
- Stale reviews, rotated codes, concurrent prospective partners and uncertain successful responses across clients.
- Light/dark appearance, small screens, large text, keyboard/IME, reading order, screen readers and localized amounts/currencies.
- New-user understanding of solo setup, shared/private boundaries, a monthly proposal and explicit confirmation.

Follow the acceptance record for the complete runtime checklist and rollout prerequisites. Native, visual, live two-partner and new-user comprehension acceptance remain unverified.

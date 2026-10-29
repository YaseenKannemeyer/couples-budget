# Reminders · implementation documentation

This records PLAN step 18, the ordinary code-led Settings extension described in `.impeccable/surfaces/src-features-nudges-reminders-screen-tsx.md`. It preserves the incumbent “Shared clarity, private confidence” system. `DESIGN.md` and `.impeccable/design.json` were inspected and left unchanged; this surface establishes no new durable palette, type, layout or asset rules. The unavailable named `impeccable_documenter` role was substituted with this documentation pass using `reference/document.md` and `reference/degraded/documenter.md`.

## System preserved

- **Palette:** `src/constants/theme.ts` remains the source of truth. Reminders uses Shared cool neutrals and indigo in both appearances, secondary ink for explanations, Attention for failure/stale notices and Success for a saved confirmation. Private violet remains the established Private-space identity; this personal Settings control does not introduce another privacy color.
- **Type:** the screen title uses the existing `subtitle` variant, loaded Manrope at 28/36, bold with −0.7 tracking. Section headings use system 18/26 semibold; body uses system 16/24; hints and choice labels use 14/21. The preview explicitly reports Manrope loaded. No new font or typography scale was added.
- **Layout:** the existing `Screen` supplies a centered maximum width of 760 logical units, 20-unit horizontal inset at the reviewed widths, 24-unit top padding, 20-unit section gaps and scrolling. Below 380 units its horizontal inset becomes 16. Toggle rows use 16-unit gaps, 8-unit vertical padding and flexible copy; history groups use 8-unit vertical padding. Desktop remains one readable column.
- **Shapes and depth:** plain rows and tonal separation retain the Flat Surface Rule. Buttons retain the 12-unit corner and 50-unit minimum height; the hour group uses 12-unit corners, its options 10-unit corners and 48-unit minimum height. There are no new shadows, large summary cards or nested decorative containers.
- **Named rules:** the Space Rule, Truthful Amount Rule and Flat Surface Rule remain authoritative. This surface has no financial amount display or chart. Its factual saved status, chosen hour and generic history labels carry meaning in text as well as color.

Sources sampled: `src/features/nudges/reminders-screen.tsx`, `src/constants/theme.ts`, `src/components/themed-text.tsx`, and the incumbent `Screen`, `Button`, `Choices`, `Disclosure`, `SummaryRow` and web tab components. Source inspection supports these implementation descriptions; synthetic screenshots do not establish native behavior or performance.

## Surface and interaction

The first viewport presents Reminders, its short introduction, the **saved** Off/On status, the one-reminder-per-person-per-day/privacy explanation and the device section. The saved status intentionally describes server preferences; unsaved switches remain local form choices until Save or the explicit device action succeeds.

The device action is separate and explicit. On a supported installed native build, enabling requests notification permission, registers this account's delivery installation, then saves the selected preferences with consent enabled. Registration refresh and enabling share this explicit action. The device text distinguishes this installation, another installation and no active registration. Each account has one active installation. The explanatory copy states that this choice does not change the partner's preferences.

The existing native `Switch` controls personal consent and four types: upcoming payments, low shared forecast, Money Date and the optional own expense-log check-in. Expense-log prompts start off. The other type defaults are on while overall consent starts off. Labels and supporting text explain the circumstances rather than using partner activity or financial details as motivation.

**Choose reminder time** discloses wrapping choices from 09:00 through 20:00. The household timezone is explicit, and the selected hour is repeated in an always-visible summary. Selection uses the existing surface/border/accent treatment. `Choices` now supplies explicit web `aria-checked` alongside native checked/disabled accessibility state; the radio group remains labelled.

**My recent reminders** discloses only the owner's recent kind/date/status records. Empty history has its own copy. The delivery explanation distinguishes service handoff from receiving or reading a message, and states that uncertain delivery is not automatically resent. No token, provider diagnostic, partner purchase detail or financial amount is rendered.

Buttons retain incumbent busy/disabled semantics, reduced-motion-aware feedback and appearance-aware colors. Optional timing/history content stays mounted when collapsed. No new bespoke motion was introduced.

## States and recovery

| State | Implemented presentation and behavior |
| --- | --- |
| Initial loading | Distinct loading copy before settings are available; no invented zero/Off result. |
| Initial load failure | Load-error copy, Try again refetching household/settings, and Settings navigation. |
| Existing data refresh failure | Warm alert while retained saved data stays visible; edits/device action are disabled, with refresh available. |
| Registration or save failure | Existing `PaymentError` translates the error into user-facing recovery copy; form choices remain available for correction/retry. |
| Permission unavailable | Explains permission/build availability and directs the person to device permission and an installed iOS/Android app. The screenshot is an injected error, not an actual OS permission request. |
| Busy | Save/registration uses existing loading treatment and blocks conflicting edits. |
| Stale revision | Warns that settings changed, disables submission and offers Load saved choices. Explicit reloading replaces the local form with the current saved version. |
| Saved | Polite Success confirmation after a successful callback; saved status reflects refreshed preferences. |
| Web / Expo Go | Explains installed native-build requirements; endpoint registration is unavailable. Web can review and edit/pause eligible existing account choices. |

`ConnectedReminders` is keyed by household and user, and preference queries include both identifiers. Revision and actor-scoped retry contracts remain in the API/database layer. These are source-level safeguards; real account switching and interrupted transport remain acceptance work.

## Navigation and guide

`src/app/reminders.tsx` exposes the screen through Expo Router, with a title in the root Stack. Settings and Payments link to `/reminders`; the screen returns to Settings through its existing action. Notification taps map only known reminder kinds to Payments, Money Date, Cash flow or Quick log. Payloads do not provide arbitrary URLs.

The version-1 personal **reminders** guide has overview and save steps, anchored at `reminders-overview` and `reminders-preferences`. It uses the incumbent in-flow guide component and existing resume/replay lifecycle. Its action step waits for `reminders-saved`, emitted after a real connected preference mutation succeeds. The synthetic guide screenshot verifies presentation/anchoring only; its in-memory callbacks do not demonstrate a persisted save.

## Browser evidence and limits

All eight PNGs in this folder are synthetic browser evidence, with memory callbacks and capability flags. They do not use real native permission, endpoint registration or session transport. Phone captures are 390 × 844; desktop captures are 1280 × 900. The preview banner identifies the fixture and loaded font and is not shipping app chrome.

| Screenshot | Evidence represented |
| --- | --- |
| `off-mobile-light.png` | Off state, no active device, explicit enable action and first reminder controls. |
| `active-mobile-dark.png` | On state, this-device status and dark appearance. |
| `web-desktop-light.png` | Readable centered desktop column and native-registration limitation for another registered device. |
| `permission-mobile-light.png` | Injected permission/unavailable error with recovery text. |
| `error-desktop-dark.png` | Injected refresh error with retained data and disabled controls. |
| `timing-mobile-dark.png` | Intentionally scrolled timing disclosure, visibly selected 09:00 and matching timezone summary. |
| `history-desktop-dark.png` | Intentionally scrolled history disclosure, generic delivery statuses and truthful delivery explanation. |
| `guide-desktop-light.png` | Anchored in-flow overview guide and compact wrapping controls. |

The screenshots show wrapping explanatory copy and the inherited mobile/desktop reading width. They do not establish large text, VoiceOver/TalkBack, native safe areas, system Back/gestures, notification cold starts or production browser/session behavior. The Switch appearance in these browser captures is the web renderer's implementation, not evidence of iOS/Android rendering.

## Review corrections

`REVIEW.md` records both scored material findings resolved and a **ship** disposition limited to those fixes at source/synthetic-browser scope:

1. The selected hour now reaches the installed web renderer through `aria-checked`. The recapture shows 09:00 selected and the matching summary. The supplied browser observation checked the initial 19:00 state, then 09:00 true with the other eleven false after interaction.
2. Native notification-response identifiers survive subscription cleanup through the module ledger and persisted latest identifier. The retained SDK response is cleared before navigation, and stale listeners are suppressed. Focused mocked-SDK tests cover replay across account subscriptions, stale callbacks, unknown kinds and one handling of a fresh tap. This is not native runtime signoff.

Full check results belong in the parent task's verification record; this documentation pass does not claim a fresh lint, typecheck, export or full-suite run of its own.

## Operational truth

The implementation is local. `supabase/migrations/20261028100000_anti_nag.sql` adds owner-only preferences/history, private device storage and service-only evaluation/delivery RPCs. The outbox has a unique user/local-date constraint, leased evaluation, final eligibility checks, cycle/weekly cooldowns and an irreversible sending phase. Unknown submissions are not automatically resent. These are implemented contracts, not proof of hosted concurrent execution.

The Edge worker in `supabase/functions/anti-nag/` emits fixed generic notifications. Its low-balance decision uses the same integer forecast implementation as the app: `supabase/functions/_shared/forecast.ts`, with `src/features/cashflow/model.ts` preserving the app's `Workspace` wrapper contract. Own private logging is checked only for that person; it does not create a shared activity signal.

Activation remains separate: apply the anti-nag migration, configure the dedicated Edge secret/deploy, configure FCM/APNs and an installed EAS build, create matching Vault secrets, activate `supabase/setup/anti-nag-cron.sql`, then obtain each person's explicit opt-in. `supabase/setup/ANTI_NAG_DEPLOYMENT.md` contains the operational sequence and live acceptance cases. No remote worker, Cron job, credentials or push delivery was activated or tested by this UI work. Applying SQL alone sends nothing.

The updated app retires managed local payment scheduling; older installed builds may retain local schedules until upgraded/opened. Submitted messages cannot be recalled by changing preferences. A receipt is service handoff, not proof of receipt/read. Native/hosted delivery, permission revocation, device replacement, account switching, timezones/rollover and concurrent final checks remain open acceptance work.

The user reports Money Date applied and explicitly requested no recheck. That report is accepted; this documentation pass performs no remote verification.

## Assets and drift not canonized

There is no new shipping raster artwork and therefore no new generated/downloaded raster provenance to register. The eight PNGs are review screenshots of synthetic UI, not product image assets. Typography, theme, native controls and existing code-rendered components provide the surface.

Pre-existing sidecar preview drift remains unchanged: its selected-choice CSS uses `flex: 1`, whereas the React Native source uses `flexGrow: 1` with automatic basis; its navigation preview uses a raw `900px` CSS breakpoint, whereas the app uses effective width divided by font scale. The sidecar's explicit hover/focus preview treatments also exceed the source components' custom treatments, as incumbent `DESIGN.md` already explains. These preview approximations are not promoted into new normative rules or repaired during an ordinary Settings extension. No new build-path preference is required for this Operate surface.

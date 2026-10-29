# Anti-nag verification — 28 October 2026

Scope: PLAN step 18 implementation. The user reports Money Date applied and asked not to check again; that report was accepted. No preceding migration was queried again. The new migration, Edge deployment, credentials and Cron activation remain deployment work described in `supabase/setup/ANTI_NAG_DEPLOYMENT.md`.

## Automated checks

- Expo lint: passed.
- TypeScript: passed.
- App Jest: **43 suites / 287 tests passed**.
- Full ordered PGlite database migrations: **185 tests passed**, including **20 reminder cases**.
- Node tests for the pure Edge worker: **13 passed**.
- Final Expo production exports: **iOS, Android and web passed**. Output `/private/tmp/couple-goals-nudges-export`; nothing published.
- `git diff --check`: passed.

The app tests cover explicit permission gating, Expo Go exclusion, token refresh, old local schedule cancellation, stale preferences, actor-scoped uncertain retries, own successful saves, web restrictions, typed notification cold/live responses, stale listener cleanup, unknown routes and no retained-tap replay across account subscriptions. The selected radio has native checked semantics; browser assertions additionally confirm web ARIA before/after selection.

Database cases cover disabled defaults, independent opt-in, device-required consent, exact hour validation, revision/idempotency/actor checks, household/DST time, payer/private-owner eligibility, one daily claim, bill-cycle suppression, weekly check-in cooldowns, recent own logging, lease recovery, uncertain sending, account/installation rebinds, token-revision-safe receipt errors, expiry, stale-hour cleanup, old-installation sign-out, shared forecast/private-source isolation, restored transaction-local identity, owner RLS, no token SELECT and client denial of service helpers. Private activity/preferences do not change shared revision signals.

Worker cases use mock HTTP only: dedicated-secret authentication, method checks, ignored body recipients, durable-before-send ordering, generic payloads, rejected/uncertain/unknown provider responses, skipped invalid contexts, receipt lookup retry/handoff, no false low-balance assertion, sanitized diagnostics and a six-connection submission bound. Deno's small entry adapter was source-inspected; no hosted Deno function or real push endpoint was exercised.

The shared integer forecast was moved into a platform-free module. Existing cash-flow/goal tests still pass through the app's original Workspace-typed wrapper.

## Browser evidence

Eight final screenshots use production panel components with synthetic data, capability flags and memory-only save/registration callbacks. The preview does not mount a session provider, permission request, device registration transport, server worker or financial mutation. Manrope was loaded. Measured document widths matched phone **390×844** and desktop **1280×900**, with no horizontal overflow.

- `off-mobile-light.png`: initial off/no-device state.
- `active-mobile-dark.png`: saved on/current-device state.
- `web-desktop-light.png`: saved remote-device settings without registration.
- `permission-mobile-light.png`: injected permission-unavailable recovery.
- `error-desktop-dark.png`: retained data with refresh failure and disabled edits.
- `timing-mobile-dark.png`: intentionally scrolled time detail after choosing 09:00.
- `history-desktop-dark.png`: intentionally scrolled own delivery-status detail.
- `guide-desktop-light.png`: automatically anchored optional guide.

Browser ARIA verification: initially 19:00 was `aria-checked="true"`. After choosing 09:00, that option was true and all eleven alternatives, including 19:00, were false. Shared Choice now exposes explicit web ARIA alongside its native accessibility state.

## Independent finish and limits

An independent default-role agent substituted for the unavailable named Impeccable finish reviewer. Its initial bounded review found selected-time web semantics and retained notification-response replay. Both were corrected; the same reviewer scored **both fixes resolved** and returned **ship at the fix-list source/synthetic-browser scope**. See `REVIEW.md`. A separate substitute documenter confirmed inheritance without changing DESIGN.md or its sidecar; see `DOCUMENTATION.md`. No design detector ran for adaptive React Native. No shipping raster artwork was added.

This does not certify native rendering, notification permissions, credential provisioning, safe areas/Back/keyboard, Dynamic Type, VoiceOver/TalkBack, actual cold-start handling, real device delivery, hosted concurrent connections or scheduled Cron execution. Those acceptance steps are retained in the deployment guide. Provider receipts are handoff evidence, not proof that a user received/read a notification. Unknown sends deliberately trade automatic delivery retries for avoiding duplicate nags; provider-level duplicate behavior is outside this log's control.

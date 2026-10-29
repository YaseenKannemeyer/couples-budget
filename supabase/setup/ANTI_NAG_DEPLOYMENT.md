# Activate the reminder engine

The code is prepared locally. No Edge Function was deployed, Cron job activated, real push sent or credential inspected by this implementation. The user reports applying the preceding Money Date migration; it was deliberately not checked again.

## 1. Apply the database migration

Run `supabase/migrations/20261028100000_anti_nag.sql` after Money Date. It adds owner-only preferences/devices/delivery logs and service-role-only worker RPCs. Existing accounts start **off**; expense-log check-ins also start off independently. Applying this migration alone sends nothing.

## 2. Configure and deploy the Edge Function

Use the Supabase dashboard or the official CLI:

```sh
npx supabase@latest functions deploy anti-nag --project-ref ucacfgmmygffqcniqryf
npx supabase@latest secrets set --project-ref ucacfgmmygffqcniqryf --env-file .env.nudges.local
```

Create the ignored `.env.nudges.local` yourself with `NUDGE_CRON_SECRET` set to a new random secret of at least 32 bytes. Generate one with `openssl rand -hex 32`. Add `EXPO_ACCESS_TOKEN` only if Expo enhanced push security is enabled. Do not put either value in `EXPO_PUBLIC_*`, app config, source control, screenshots or chat. The Edge runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not copy a service-role key into the app.

`supabase/config.toml` disables the JWT gateway only for this new internal endpoint. Its handler independently authenticates the dedicated secret using SHA-256 comparison before doing any work. It rejects public keys, user JWTs, missing secrets and non-POST requests. It ignores request-body recipients, content and timestamps. The app never calls this endpoint.

## 3. Configure native push delivery

Keep the existing EAS project. For Android, configure FCM v1 credentials in EAS and provide the Firebase **client** `google-services.json` through the EAS file environment variable `GOOGLE_SERVICES_JSON`. `app.config.ts` maps that file path to `android.googleServicesFile`. The Firebase service-account private key belongs in EAS credentials, not in this repository or client file. Configure APNs credentials for iOS through EAS. Use the correct Android package/iOS bundle identifier for your app when EAS asks; this change does not invent those identifiers.

```sh
npx eas-cli@latest credentials
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
```

The supplied `eas.json` has internal `preview` and store `production` profiles. Preview builds include no development client and need no `expo-dev-client` dependency. EAS will request any missing app identifiers/provisioning details. Native push requires a correctly configured installed development/production build; Expo Go and web cannot register through this feature. The SDK and notifications plugin are already installed. No native `ios/` or `android/` files are hand-edited.

## 4. Activate Cron last

In **Supabase Vault**, create exactly one secret for each name:

- `anti_nag_project_url`: `https://ucacfgmmygffqcniqryf.supabase.co`
- `anti_nag_cron_secret`: the same value as the Edge `NUDGE_CRON_SECRET`

Then run `supabase/setup/anti-nag-cron.sql`. It verifies those names exist, enables pg_cron/pg_net and schedules `couple-goals-anti-nag` every five minutes. Re-running the named schedule updates that job. It uses a dedicated secret rather than an exposed publishable key. Keep Vault and database administration access restricted: pg_net holds request headers while the request waits in its queue.

To stop the worker later:

```sql
select cron.unschedule('couple-goals-anti-nag');
```

## 5. Opt in and accept the feature

On each partner's installed app, use **Settings → Reminders**. Choose types and household-timezone hour, then **Enable on this device**. This explicitly requests permission, registers that account's one delivery installation and saves consent. A partner controls their own account. Web can edit/pause an already registered account's choices. Only English notification copy is shipped, matching the currently available app locale.

Verify a genuinely due payment assigned to that person, a recorded completed open month on Money Date day, and a complete low-balance forecast. Expense-log prompts check only that person's records after two calendar days; no spending is a legitimate state. The server sends at most one reminder per local day, prioritizing Money Date, a payment, a reliable low forecast, then the optional log check-in. Payment cycles are suppressed after successful/uncertain submission; low/log prompts have seven-day cooldowns. A batch handles up to 100 candidates with at most six concurrent Expo submissions; monitor capacity before expanding beyond this deployment's hourly volume.

Run the checks below with two opted-in test accounts/devices and controlled data. Do not create real spending solely to trigger a reminder:

- Permission denial/revocation; reinstall; token refresh; selecting a second delivery device; sign out and account switch on one installation.
- Changing types, pausing, paying/pausing a bill, or closing the month between candidate creation and sending.
- Household timezone, DST, chosen hour, closed periods and day/month rollover.
- Android/iOS cold-start and foreground notification taps. Only fixed known routes are allowed; no URLs or financial values come from push content.
- Retry/crash after sending, Expo acceptance vs receipt confirmation, invalid-device receipts and receipt timeouts. A provider receipt means handoff, not proof that a person saw the notification.
- VoiceOver/TalkBack, large text, keyboard/system Back, and both themes on real native builds.

The updated app cancels its previous managed device-only payment schedules. Older app builds on another installation can retain local schedules until upgraded/opened. Online sign-out unregisters this installation first; if network revocation fails, generic messages can remain possible until rebinding or the 30-day inactive-device lease expires. Already submitted notifications cannot be recalled by a preference change. Nothing private is included in that content.

## Delivery behavior and tests

The database reserves one user/date log and leases evaluation with row locking. It commits `sending` before contacting Expo. A timeout, crash or uncertain response becomes `unknown` and is never automatically submitted again. This trades delivery retries for avoiding duplicate nags. Explicit provider failures are recorded; a still-due bill can be considered on a later day. Receipt lookups safely retry on subsequent Cron runs; invalid current tokens are disabled using their revision so an old failure cannot disable a replacement token. Old-hour work expires rather than delaying other timezones. Device registrations expire after 30 days without refresh.

Payloads contain only a fixed app title, generic localized-kind text, a whitelisted route kind, the opaque Expo token and a one-hour TTL. No private names, spending amounts, categories, notes, receipts, employer data or partner logging activity are sent. Preference/history tables have owner RLS; device tokens have no client SELECT grant; all financial eligibility and delivery RPCs are denied to anonymous and authenticated users. They do not publish household revisions for private logging or preference changes. Service-side forecast evaluation reuses the same integer engine as the app and restores its transaction-local actor.

```sh
npm test -- --runInBand
npm run test:db
npm run test:edge
npm run lint
npm run typecheck
```

References: [Expo SDK 58 Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/), [tickets and receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

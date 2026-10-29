# Phase 2.5 launch work

Started 29 October 2026. The first implementation slice covers solo setup and gift-style invitations (steps 35–36). It does not certify launch readiness. Phase 2 reminder activation and real two-partner/native acceptance remain open in [PHASE2_ACCEPTANCE.md](PHASE2_ACCEPTANCE.md).

## First slice

- Solo setup retains one real member. Income/payday gaps and two-person fair shares stay pending. The first partner can finish setup, plan payments, log Shared/Private expenses and use a forecast based on their own supplied facts. An invitation is optional.
- Home can save an optional monthly partner-allowance proposal, including explicit zero; clearing the field removes the proposal. This neither creates a partner nor transfers money. Sharing is disabled while the proposal is being edited.
- The system share sheet includes a link to `/join?code=...` and a readable fallback code. Web uses Web Share when available and otherwise copies the complete invitation; Copy code remains separate. No amount or income is included in the shared message. Native links use the existing app scheme; production universal/app links depend on the later website/domain work.
- The public `/join` route keeps the invitation in the URL while sign-in/sign-up renders in place. An existing household is not replaced. Offline invitation entry offers reconnection. After authentication, the code holder explicitly requests a preview, then separately confirms or adjusts their own monthly allowance before joining.
- The authenticated preview returns only household name/currency, inviter name, shared split, planned monthly shared costs, proposed allowance and revision. It excludes monthly income, income sources, balances, purchases, receipts, schedules and notes. Table RLS remains enforced for non-members. The joining partner is told which income/allowance aggregates become shared after joining.
- Reviewed join locks the household and checks the exact shared-plan revision. It edits only the joining person's allowance, leaves their income/payday setup pending, and respects the two-member limit. Replaying a committed join cannot reset allowances or duplicate membership. Older clients' original join RPC remains compatible and does not apply the proposal automatically.
- Welcome guidance covers the invite route without changing guide IDs/version or replaying saved dismissals. The create/join guide advances only after the real mutation succeeds.

## Rollout

Apply `supabase/migrations/20261029120000_launch_invites.sql` after `20261029100000_relationship_features.sql`, before distributing this client. This new migration is **prepared locally, not deployed**. Earlier Phase 2 deployment reports remain unchanged; Money Date was not rechecked. No real invitation was sent, account created, financial record changed or push delivered.

The migration adds the nullable allowance proposal to `households` and three authenticated RPCs: `save_invite_allowance`, `preview_household_invite`, `join_household_reviewed`. Proposal writes use existing member/revision checks. Direct client updates to the new column and anonymous RPC execution are denied. No new dependency, native source directory or secret is required.

## Runtime acceptance

Use controlled test accounts, with each partner taking their own consent actions.

1. Start solo on iOS, Android and web. Complete setup, defer/add paydays, create a scheduled payment, log Shared and Private expenses and supply a dated balance/contribution for a useful forecast. Check all missing partner figures remain pending. No guessed paycheck, second allowance or invented cash appears.
2. Save, change and remove a proposal. Check explicit zero, invalid/large amounts, a background plan change, stale-save reload, clipboard failure, share cancellation and a browser without Web Share. Share only the saved proposal. Confirm no private amount appears in the invitation text.
3. Open the link cold and warm, signed out and already signed in, on web and installed builds. Check sign-up/email-confirmation return, app restart, offline entry/reconnect, system Back and duplicate/malformed URL parameters. The partner must still choose Review and Confirm; opening a link never joins automatically. Reopen the original invitation if the email-confirmation flow opens a different browser/device.
4. Join with the proposed amount, an adjusted amount and zero. Verify the existing partner's allowance stays unchanged, current-period allowance matches the accepted amount, and the joiner's monthly income/payday inputs start pending. Verify private sources and purchases stay owner-only after joining. Review the ordinary shared-budget agreement together afterward.
5. Use two devices to change costs/split/proposal or rotate the code while a review is open. Old facts cannot be confirmed. Race two prospective partners; only one joins. Interrupt a successful response, refresh membership and retry the same decision; no duplicate membership or allowance reset occurs. An account already in a household cannot switch by opening another invitation.
6. Verify light/dark, large text, small screens, keyboard/IME, screen readers, reading order and native share/Back behavior. Test locale decimal separators and zero/two/three-decimal currencies. Check Welcome Skip/resume/replay and the real-action guide handoff.

No simulator/adb runtime or usable browser control was available for this slice. Automated exports and source review do not establish native, visual, live concurrent-client or new-user comprehension acceptance.

## Remaining phase order

Next: five-second logging measurement/monitoring foundation, then reviewed CSV import; account lifecycle/privacy/export, platform sign-in, household subscriptions and their entitlement rules; launch copy/site/market decisions; legal/business gates, beta/closed testing and EAS store submission. These are open items, not prerequisites silently marked done by this first slice. Product/account decisions and external setup must be recorded before their dependent work.

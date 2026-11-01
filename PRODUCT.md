# Couple Goals

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Expo/React Native on iOS and Android, plus responsive web. Preserve platform navigation, safe areas, keyboard handling and system Back gestures.

## Users

Couples planning and tracking household money together, including partners with different incomes and payday schedules. A partner may log an expense quickly in a shop without connectivity, then review their household finances together later.

## Product Purpose

Make shared money understandable and fair while preserving each partner's independence. Success means both partners can onboard, log expenses, manage payments and understand their forecast without seeing each other's private spending details.

## Positioning

One shared bucket and two private spaces, income-aware contribution splits, aggregate-only partner allowance balances and neutral system reminders reduce the need to monitor each other.

## Operating Context

Manual expense logging, recurring payments, monthly budgets, private allowances, offline queued entries and a household-timezone cash-flow forecast. Phase 1.75 adds practical joining-partner review, optional payday deferral and optional, versioned guides beside real controls, with replay/resume in Settings. Phase 1.8 follows with a user-approved calm native interface, compact rows, optional charts/details, searchable long category lists and account-scoped defaults. A short welcome starts at first authenticated household entry, followed by the Home walkthrough and Quick-log handoff; saved dismissal/completion decisions stay respected. Implementation is complete; live, native and new-user comprehension acceptance remains pending. Phase 2 reconciliation (step 16), joint goals (step 11), Money Date (step 17) and the anti-nag engine (step 18) are implemented locally. The user reports the reconciliation migration applied; the user also reports Money Date applied on 28 October and asked not to recheck it. Anti-nag worker/Cron/credentials and live/native acceptance remain pending; its database prerequisites were verified present on 29 October. On 29 October the remaining Phase 2 workflows were implemented locally: explicit weekly category boosters, own-allowance gifts, sinking-fund purpose and per-expense contribution plans. The relationship migration was applied to the hosted project on 29 October after explicit authorization; seven schema/permission checks passed. Native/live financial-workflow acceptance and reminder activation remain open.

Phase 2.5 started on 29 October with solo-setup clarification and gift-style invitations. A saved allowance proposal is a monthly budget suggestion, not a transfer. The prospective partner explicitly reviews limited shared facts and confirms or adjusts their own allowance. Invite links retain the code through sign-in; missing own income/paydays remain pending. The launch-invites migration is local and undeployed, with native/live acceptance still open.

## Capabilities and Constraints

- PLAN.md is the active product brief, updated for the banking-style concept approved on 30 October 2026. Runtime redesign BR1–BR9 is implemented locally (BR8 partly), device/live acceptance pending; BUGS.md records the code-review findings and verification limits.
- Global currencies and locale-aware formatting; money stays in integer minor units.
- The Phase 1.5 redesign preserved Supabase contracts, RLS, owner filters, caching, mutations and refresh behavior, with no migrations or new financial features. That constraint applies to the redesign, not later phases.
- Phase 1.75 adds owner-only guide progress and version-checked payday deferral. Guides never submit financial actions; action steps wait for actual results. Progress stores guide/version/step/status and concurrency metadata only, with account-scoped local caching and server sync; financial field values and partner-private details never enter guide state.
- Reconciliation establishes an observed closing balance and compares later checks with confirmed shared contributions and transactions. A shortfall can be resolved by a synced missing expense or an explicit allowance allocation; each charged partner approves their own share before the allocation takes effect. A surplus can be retained through an explicit balance correction after reviewing records. Shared history, revision checks, retry protection and an optional guide are implemented locally; the user reports `20261027180000_reconciliation.sql` applied. Reconciliation allocations do not create partner-visible private purchase details.
- Joint goals record a target, deadline and Shared category, with exact monthly fair-share snapshots and visibly pending shares when income/setup is incomplete. Each partner records their own real shared savings earmarks and can append a reversal to correct their own entry; shared history is retained. Progress compares each partner with their own agreed share, with optional contribution charts, a quiet completion message and a guide. Saved earmarks reduce forecast spendable cash without changing actual cash or creating an expense. Creation can explicitly replace an existing forecast reservation. Revision checks and retry protection are implemented locally; `20261027190000_joint_goals.sql` must be applied before live use. Money Date supports jointly approved releases of saved earmarks. The relationship extension now adds explicit weekly-budget boosters and reviewed own-allowance gifts. Gift details never include private remainders or purchases; the existing household allowance-aggregate visibility remains unchanged. Saved monthly shares receive pooled booster credit by their frozen plan.
- Money Date reviews wins, the actual month-end balance, the next 30 days and optional one-month split/savings releases before explicit approval by both partners. Shared review hashes and stable actor-scoped retries protect closing. Only completed months with a recorded plan can close; missing historic plans/allowances stay unknown. Closing freezes financial amounts/dates, snapshots shared figures and aggregate allowance totals, issues next-month allowances once and retains existing spending. Private purchases and income-source details are absent from review facts, hashes and new activity signals. One-month splits expire without altering the permanent agreement. `20261027200000_money_date.sql` must follow the goals migration; live/native verification remains pending.
- The anti-nag engine is implemented locally with owner-only consent, types/hour and delivery history, explicit native push registration, one active installation per account, bounded generic notifications and shared integer forecast decisions. A database outbox enforces one user/day, cycle/weekly cooldowns, leased evaluation, final eligibility checks, no automatic resubmission after uncertain sending and token-revision-safe receipts. Private own logging is inspected only for that person and does not emit shared activity. The anti-nag database prerequisites were verified present on 29 October. Deploy the Edge Function, set dedicated server/Vault secrets and push credentials, and activate Cron separately; no live delivery is claimed. The previous device-only payment scheduler is retired by the upgraded app.
- Phase 2 steps 12–15 use `20261029100000_relationship_features.sql` after anti-nag. Weekly leftover limits are entered explicitly and start on a future Monday, preserving past weeks; they are separate from the monthly plan. Shared-week facts, locked-period checks and claim history prevent double use. Allowance gifts debit only the actor, check current availability, retain owner-only debit entries and restore the original month on correction. They earmark existing shared funds rather than moving bank money. Money Date snapshots include gift aggregates. A sinking fund is a dated goal purpose with saved/remaining/monthly-needed figures. Expense-level equal/income/percentage/fixed/custom plans allocate exact signed amounts, preserve the actual payer and create no payment/allowance charge. Plans enter exact joint close facts. Four contextual guides accompany these workflows. Uncertain writes retain their original actor/request, block competing decisions and keep final-gift recovery mounted through completion refresh.
- Monthly budget data must not be presented as weekly or annual budget data. Other period views require complete existing data for that period.
- Partner-visible charts use shared records and approved aggregates only. Never derive private category or transaction detail for a partner.
- Expense receipts and unsent drafts retain their current lifecycle and privacy.

## Brand Commitments

The name Couple Goals was confirmed on 26 October 2026. On 30 October the user approved a professional banking-style direction: white and cool-grey surfaces, navy identity, blue actions, readable financial amounts and compact lists. Three main tabs are Overview, Plan and Personal; Settings moves behind the profile button. Add expense becomes a concise form and Money Date is presented as a three-stage Monthly review. See PLAN.md for the approved concept.

This supersedes the original sage/clay and subsequent Shared-indigo/Private-violet directions. The runtime now uses this design (implemented locally 30 October; device acceptance pending). Keep supportive, factual language, clear Shared/Personal scope, light/dark support and all existing financial/privacy boundaries. Banking appearance does not imply bank accounts, transfers or payment execution.

The user subsequently requested the rounded solid icons, coloured category tiles and blue/orange/pink spending-wheel treatment. Apply that detail language across the app while retaining the approved radii, clean layout and three-tab flow. The wheel and Income / Total spending / Net balance row belong in Spending budget; the summary describes recorded shared income less spending, not bank cash.

## Evidence on Hand

PLAN.md, README.md, implemented screens and database privacy tests. Phase 1.75 source and synthetic review evidence is in .impeccable/review/phase175/; it does not establish native, live-account or new-user comprehension acceptance. Reconciliation documentation and synthetic browser evidence are in .impeccable/review/reconciliation/; migration application is user-reported, and this evidence does not establish live two-partner or native acceptance. Joint-goals documentation and synthetic browser evidence are in .impeccable/review/goals/; that record described its migration as pending at the time; this audit did not recheck current deployment, and the evidence covers source/synthetic-browser scope only. Do not fabricate live balances, transaction history, historical chart series or device-verification results.

## Product Principles

1. Respect independence: privacy is a database guarantee and a presentation constraint.
2. Show what is known: distinguish actual spending, plans and expected payments.
3. Keep logging quick and recoverable, including offline.
4. Support decisions together without blame.

## Accessibility & Inclusion

Light and dark appearance, system text scaling, screen-reader chart summaries, reduced motion, 48-unit control targets, long translated labels and large localized amounts. No chart depends on color alone.

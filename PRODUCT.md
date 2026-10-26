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

Manual expense logging, recurring payments, monthly budgets, private allowances, offline queued entries and a household-timezone cash-flow forecast. Money Date and the other relationship features in later phases of PLAN.md are planned, not available capabilities.

## Capabilities and Constraints

- PLAN.md is the confirmed product brief (user confirmed 26 October 2026).
- Global currencies and locale-aware formatting; money stays in integer minor units.
- Supabase contracts, RLS, owner filters, caching, mutations and refresh behavior remain unchanged during Phase 1.5. No migrations or new financial features.
- Monthly budget data must not be presented as weekly or annual budget data. Other period views require complete existing data for that period.
- Partner-visible charts use shared records and approved aggregates only. Never derive private category or transaction detail for a partner.
- Expense receipts and unsent drafts retain their current lifecycle and privacy.

## Brand Commitments

The name Couple Goals was confirmed by the user on 26 October 2026. Couple Goals uses supportive “we” language, factual labels and calm warnings without harsh red. Shared and Private remain distinguishable. The user confirmed replacing the sage/clay identity with the five finance references in inspo/: cool near-white surfaces, near-black spending cards, indigo progress and category color tiles.

## Evidence on Hand

PLAN.md, README.md, implemented screens and database privacy tests; five screenshot references in inspo/. Do not fabricate live balances, transaction history, historical chart series or device-verification results.

## Product Principles

1. Respect independence: privacy is a database guarantee and a presentation constraint.
2. Show what is known: distinguish actual spending, plans and expected payments.
3. Keep logging quick and recoverable, including offline.
4. Support decisions together without blame.

## Accessibility & Inclusion

Light and dark appearance, system text scaling, screen-reader chart summaries, reduced motion, 48-unit control targets, long translated labels and large localized amounts. No chart depends on color alone.

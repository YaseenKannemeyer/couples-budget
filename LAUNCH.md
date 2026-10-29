# Couple Goals: Launch Plan

How Couple Goals goes from a working build to a public launch. The build work lives in [PLAN.md](PLAN.md) (Phase 2.5). This document covers the order of launch, who we test with, what we measure and when we're ready to move on.

Each stage ends with a **go/no-go gate**. We move on when the gate passes, not on a fixed date.

**Pitch:** Shared money, private spending, fair splits, and no nagging.

---

Engineering status, 29 October 2026: Phase 2.5 has started with local solo-setup and gift-invitation work. The new migration is undeployed. The business, beta and store gates below remain open; see [the first-slice acceptance checks](supabase/setup/PHASE25_ACCEPTANCE.md).

## Stage 0: Groundwork

Starts now, alongside Phase 2. Most of it is paperwork with long waits, so it shouldn't wait for the code.

- [ ] Trademark and name check for "Couple Goals" (see the Legal checklist in PLAN.md). Rename now if it's not clear
- [ ] Company registration, D-U-N-S number, Apple and Google developer accounts
- [ ] Information Officer registration with the Information Regulator
- [ ] Domain, landing page with the pitch and a **waitlist** form
- [ ] Social handles matching the name
- [ ] Draft the Privacy Policy, Terms and subscription terms. Book an attorney review
- [ ] `eas.json` with development, preview and production profiles. Supabase project moved to Pro (backups, no pausing)
- [ ] Pick the first market (South Africa is the default) and the price for it

**Gate:** the name is cleared, developer accounts are active, the waitlist page is live.

---

## Stage 1: Private beta (friends and family)

**Who:** 10–20 couples you know, ideally with a mix of equal and unequal incomes, different paydays and both iPhone and Android.

**How:** TestFlight for iOS and a Google Play **closed test** for Android. The closed test also starts the Google requirement of 12 testers for 14 days, so add at least 12 Android testers on day one.

**What we ask them to do:**

1. One partner sets up solo, then invites the other
2. Log every expense for two weeks
3. Run one full Money Date at the end of the month

**What we measure** (PostHog):

| Metric | Target |
| --- | --- |
| Partner joins within 7 days of the invite | 60%+ |
| Median time to log an expense | under 5 seconds |
| Couples logging in week 3 | 50%+ |
| Couples completing a Money Date | 50%+ |
| Crash-free sessions (Sentry) | 99.5%+ |

Also: a 15-minute call with at least five couples. Ask what felt fair, what felt intrusive and whether privacy felt real.

**Gate:** targets mostly met, no open privacy bug, Money Date completed by real couples, Google's 14-day test done.

---

## Stage 2: Launch readiness

- [ ] Every "before launch" item in the Legal and compliance checklist is done
- [ ] Store listings in the first market's language and currency: pitch as the subtitle, first screenshot shows privacy and fairness, second shows Money Date
- [ ] Store keywords: couples budget, shared expenses, budget for two, money date, split bills by income
- [ ] Subscription products in RevenueCat, App Store Connect and Google Play, with regional pricing. Optional: "founding couples" discount for the waitlist
- [ ] Review account (demo household) for Apple and Google
- [ ] Support: email address, FAQ page (privacy, how splits work, cancelling), account-deletion web page
- [ ] Monitoring: Sentry alerts to your phone, PostHog launch dashboard
- [ ] EAS Update set up on a production channel, with a tested rollback
- [ ] Submit for review at least a week before the planned launch day

**Gate:** both apps approved, legal docs live, support ready.

---

## Stage 3: Soft launch (first market)

**Where:** South Africa only (or the chosen first market).

**Launch week:**

- Day 1: release in the stores. Email the waitlist. Post on your own social accounts
- Days 1–7: personally reply to every review and support email
- Watch daily: crashes, sign-ups, partner join rate, logging time, payments, refunds

**Channels** (low cost, where couples already talk about money):

- Local personal finance communities (for example r/PersonalFinanceZA) and podcasts
- Short videos about "our monthly money date", fair splits with unequal incomes and private spending money. Couples creators and finance creators in the market
- Engaged and newly-wed couples: wedding planners, premarital counsellors, wedding expos
- A referral loop built into the product: every invite already brings in a second user

**Gate (after 4–6 weeks):**

| Metric | Target |
| --- | --- |
| Week-4 retention (couples still logging) | 30%+ |
| Free to paid conversion | 3–5% |
| Store rating | 4.5+ |
| Refund and cancellation reasons | none about privacy or broken trust |

If the gate fails, stay in the first market and fix the biggest drop-off before spending on growth.

---

## Stage 4: Expansion

- Add 1–2 more markets where US apps are weak, with localised listings and pricing
- Turn on web purchases only once a merchant-of-record setup is in place
- Start Phase 3 features in the order users ask for them
- Bank feeds (Phase 4) start in the market with the most demand, beginning with Stitch in South Africa
- EU/UK and the US only after the "later" legal items are done

---

## Costs

| Item | Cost |
| --- | --- |
| Apple Developer Program | $99/year |
| Google Play Console | $25 one-time |
| Domain | ~$10–15/year |
| Company registration (CIPC) | small fee, plus an accountant if used |
| Attorney review of Terms and Privacy Policy | quote needed |
| Trademark registration (South Africa) | filing fee per class, plus an attorney if used |
| Supabase Pro | $25/month from beta onward |
| Expo EAS | free to start, Starter $19/month if needed |
| Sentry, PostHog, RevenueCat | free tiers until revenue grows |

Check the current prices before paying. They change often.

## Launch-day checklist

- [ ] Production build approved in both stores and set to manual release
- [ ] Legal pages, support page and deletion page live and linked
- [ ] Waitlist email scheduled
- [ ] Sentry alerts on, PostHog dashboard open
- [ ] EAS Update rollback tested
- [ ] Review demo account still works
- [ ] A free day to answer every message

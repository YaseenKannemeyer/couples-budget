# Co-Pilot (working title)

A budgeting app for couples: one Shared Bucket for life together, plus a Private Space for each
partner that the other can see the balance of, but never the contents.

One codebase (Expo + React Native) runs on iOS, Android and the web. Supabase provides the
database, sign-in and live sync.

See [PLAN.md](PLAN.md) for the full roadmap, phase by phase.

## First-time setup

1. Install dependencies: `npm install`
2. Create a free project at [supabase.com](https://supabase.com).
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key
   (Supabase → Project Settings → API).
4. In the Supabase dashboard, open **SQL Editor** and run
   `supabase/migrations/20261025152237_foundation.sql`.
5. While developing, consider turning off **Confirm email** (Authentication → Sign In / Providers →
   Email) so new test accounts can sign in immediately.

## Running it

```bash
npm run web        # in the browser
npm start          # then scan the QR code with Expo Go on your phone
```

To try the couple flow, sign up as one partner in the browser and as the other on your phone
(or in a private browser window).

## Checks

```bash
npm test           # money maths and the fair-share split
npm run test:db    # privacy rules, run against a real Postgres in-process
npm run typecheck
npm run lint
```

## Where things live

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router: every file is a route) |
| `src/features/` | Feature code: data hooks and validation per area |
| `src/lib/money.ts` | Integer minor-unit money maths and formatting |
| `src/lib/split.ts` | The Fair-Share Calculator |
| `src/constants/theme.ts` | Colours for the shared and private spaces |
| `supabase/migrations/` | Database tables and row-level security |
| `test/db/` | Database privacy tests |

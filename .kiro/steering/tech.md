# Tech

## Stack
- **Frontend:** Vite + React + TypeScript (strict) + Tailwind CSS + React Router. Single-page app.
- **Backend:** Supabase free tier - Postgres, Supabase Auth (email/password, email confirmation off), Row Level Security on every table.
- **Client library:** @supabase/supabase-js using the public anon key only.
- **Testing:** Vitest + fast-check (property-based testing).
- **Hosting:** Vercel free tier. Version control: GitHub.
- **Budget:** $0. OS: Windows / PowerShell.

## Architecture rules
- No custom server. The React app talks directly to Supabase.
- **All trusted business rules live in the database:** CHECK constraints, RLS policies, and `security definer` Postgres functions (RPC). Every status change (accept, submit, confirm, cancel, simulate payment, mark delivered, confirm received) is an RPC that locks the task row (`SELECT ... FOR UPDATE`), checks `auth.uid()` and the current status, and writes all-or-nothing.
- Status tables (`tasks`, `applications`, `simulated_payments`) have **no UPDATE policy**. RPCs are the only way to change status.
- Mirror the trusted rules in a **pure TypeScript domain module** (`src/domain/*`) for instant UI validation and property-based testing. Pure = no network, no storage, no `Date.now` (pass the current date in).
- Money is stored as **integer cents**, never floats.
- Age bracket lives in a separate `member_private` table that only the owner can read.

## Conventions
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `.env.local` is gitignored; `.env.example` is committed. No secret or service role key in the repo, ever.
- Database errors are raised with short codes (e.g. `NOT_SAME_STATE`); `src/lib/errors.ts` maps codes to plain-language messages. Raw DB text never reaches the UI.
- SQL lives in `supabase/schema.sql` and `supabase/seed.sql`, applied by the developer in the Supabase SQL editor (no CLI/Docker needed).

## Commands
- Install: `npm install`
- Dev server: `npm run dev` (the developer runs this manually; do not run long-lived servers from the agent)
- Build: `npm run build`
- Tests (single run): `npm test` (= `vitest --run`)

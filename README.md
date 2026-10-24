# Bounty

**Local help, powered by your community.**

Bounty is a community-driven web platform (built for the Hackachusetts hackathon, **Civic Action** track) that connects local small businesses and everyday people who need digital help — a website, a spreadsheet, birthday flyers, a resume touch-up — with nearby students and skilled neighbors who can do the work. Rewards are flexible: money, a nonmonetary item or service, or a volunteer give-back. Work stays local: every task and profile belongs to one US state, and members only see and apply to tasks in their own state.

Monetary rewards are settled with a clearly labeled **demo payment simulator** — Bounty moves no real money and never collects card or bank details.

## Live demo

**App:** https://hackachusetts-project-bounty-tovar.vercel.app/

## Video demo

**Youtube Link:** https://youtu.be/l1WfYQAokQI

The demo runs in **Massachusetts** (all seeded tasks are posted there). Sign in with any account below, or sign up a new account (the demo restricts sign-up to Massachusetts so you immediately see listings).

### Demo accounts

All accounts use the password: `DemoPass123!`

| Email | Who they are | Good for showing |
|---|---|---|
| `demo.business@bounty.test` | Bay State Bakery (business poster) | Posting, confirming completion, the demo payment |
| `demo.individual@bounty.test` | Maria Chen (individual poster) | Everyday-person tasks, reviewing & accepting an applicant |
| `demo.student@bounty.test` | Alex Rivera (helper) | Browsing, applying, submitting work |
| `demo.youth@bounty.test` | Jordan Lee (13-17 helper) | The youth-safety experience |

### Suggested walkthrough
1. Open the landing page (signed out) and **Browse** the Massachusetts tasks.
2. Sign in as **Maria Chen** -> open the resume task -> **review and accept** the applicant.
3. Sign in as **Bay State Bakery** -> open the completed menu task -> run **"Simulated payment (demo only)"**.
4. Sign in as **Alex Rivera** -> **apply** to an open task; try the New Hampshire task to see the same-state rule block it.

## Challenge track

**Civic Action** - Bounty makes digital help accessible to small businesses and individuals who cannot easily afford paid services, while giving students real-world experience, portfolio pieces, and community connections. It is designed to be accessible, safe for minors (ages 13+), and local by design.

## Features

- **Full task lifecycle:** post -> browse -> apply -> creator accepts one applicant -> applicant submits work -> creator confirms completion -> reward is settled.
- **Flexible rewards:** Monetary (demo-simulated), Nonmonetary (product/service/experience, with a deliver/receive handshake), or Volunteer.
- **Local by design:** tasks and profiles belong to one US state; members apply only within their own state. Enforced in the database, not just the UI.
- **Safe for minors:** ages 13+; a youth (13-17) safety notice; age and email are never shown publicly; contact stays in the in-app message thread.
- **Member dashboard** with a clear next action on every task, public profiles with completed-project portfolios, and a report button for safety.
- **Accessible, responsive, polished UI** (keyboard operable, labeled fields, text-plus-color status, 360px-1920px).

## Tech stack

- **Frontend:** Vite + React + TypeScript (strict) + Tailwind CSS + React Router (single-page app).
- **Backend:** Supabase (Postgres, Auth, Row Level Security) - no custom server; the browser uses the public anon key only.
- **Testing:** Vitest + fast-check (property-based testing).
- **Hosting:** Vercel (free tier). **Version control:** GitHub. **Budget:** $0.

### Architecture: trusted rules live in the database

Every business rule that must be trusted is enforced in Postgres, not just the client:
- **Row Level Security** on every table (deny by default).
- Every status change (accept, submit, confirm, cancel, simulate payment, mark delivered, confirm received) is a `security definer` **RPC** that locks the task row, checks `auth.uid()` and the current status, and writes all-or-nothing - so rules cannot be bypassed with the anon key.
- Status tables have **no UPDATE policy**; the RPCs are the only way to change status.
- Money is stored as **integer cents**, never floats.
- The same rules are mirrored in a pure TypeScript domain module (`src/domain/`) for instant UI validation and property-based testing.

## Run it locally

Prerequisites: Node.js 18+ and a free Supabase project.

```bash
npm install
# create .env.local (see below), then:
npm run dev      # start the dev server
npm run build    # production build
npm test         # run the test suite once (Vitest, offline)
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase values (never commit `.env.local`):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Find both under Supabase -> Settings -> API. Use the public anon key only; never put a service role key in the repo.

### Supabase setup

1. Create a free Supabase project.
2. In **Authentication -> Providers -> Email**, turn **off** "Confirm email" (so sign-in works immediately).
3. In the **SQL editor**, paste and run `supabase/schema.sql` (tables, constraints, RLS, RPC functions, triggers). Safe to re-run.
4. (Demo data) In **Authentication -> Users**, create the four demo users above (password `DemoPass123!`, "Auto Confirm User" checked), then run `supabase/seed.sql` in the SQL editor.
5. In **Authentication -> URL Configuration**, set the Site URL (and Redirect URLs) to your deployed app URL so auth works in production.

> `supabase/fix-001-profile-on-signup.sql` and `supabase/fix-002-grants.sql` are already folded into `schema.sql`; they are kept only as a record of the fixes.

## How Kiro was used

This project was built end to end with **Kiro**, and the `/.kiro` directory is committed (specs, steering docs, and hooks). A running log of how Kiro was used is in [`docs/kiro-log.md`](docs/kiro-log.md).

- **Spec-driven development.** Instead of vibe coding, we drove the whole build from a formal spec in `.kiro/specs/bounty-platform/`: a requirements document (22 requirements in EARS format, each refined for testability), a design document (architecture, full database schema, RLS/RPC design, and 16 correctness properties), and an ordered task list. Kiro implemented the app task by task against that spec, which kept scope tight and the core loop shippable early.
- **Steering docs.** `.kiro/steering/` (product, tech, structure, coding-standards) load into every Kiro turn, so generated code consistently followed the stack, folder structure, security model, and accessibility rules without re-explaining them each time.
- **Agent hooks.** `.kiro/hooks/` runs the test suite automatically when the pure domain rules change, giving instant feedback that the correctness properties still hold.
- **Property-based testing.** Nine required correctness properties are verified with fast-check (e.g. the reward round-trip, one active application per member per task, single assignee, the task and reward state machines, and that a simulated payment equals the agreed amount at most once). Each test checks behavior against an independent oracle, not against itself.
- **Debugging with Kiro.** When hosted Supabase surfaced opaque sign-up failures, Kiro diagnosed the real causes from the actual errors (a fragile auth trigger, a wrong env URL, over-aggressive table grants) and fixed each properly rather than masking them.

## Testing

Run `npm test` to run the Vitest + fast-check suite once (non-watch, offline); it exits non-zero on failure. The suite covers the pure domain rules that mirror the trusted database logic.

## Notes and limitations

- Monetary payment is **simulated** for the demo; no real money moves and no payment credentials are collected.
- For the demo, Browse defaults to Massachusetts and sign-up is restricted to Massachusetts so new visitors immediately see listings. These are isolated, clearly commented demo settings and are easy to revert to full 50-state behavior.
- Full WCAG conformance requires manual assistive-technology testing beyond the automated checks performed here.

## Image Use

- The landing page image used and our logo found on our website were ai generated.

# Structure

## Folder layout
```
/
.kiro/                  specs, steering, hooks (must be committed, never gitignored)
docs/kiro-log.md        running evidence log of how Kiro was used (for judges)
supabase/
  schema.sql            tables, constraints, RLS, RPC functions, triggers
  seed.sql              idempotent demo seed
src/
  domain/               pure rules - no network, no storage, no Date.now
    constants.ts        US_STATES, CATEGORIES, statuses, limits
    labels.ts           humanize (in_progress -> "In progress")
    reward.ts           validateReward, toRow, fromRow, formatReward, parseDollars
    validation.ts       validateSignUp/Profile/Task/Submission/Cover/Message/Report, normalizeSkills, isHttpUrl, sameState
    taskMachine.ts      TaskModel + reduce(model, request)
    rewardMachine.ts    rewardTransition(...)
    browse.ts           filterTasks
    nextAction.ts       nextActionLabel
  lib/                  supabase.ts, api.ts, errors.ts, withTimeout.ts, auth context
  components/           shared UI (Layout, Button, Field, Card, Badge, Toast, Loading, ErrorState, SafeLink, ...)
  pages/                one file per route
  main.tsx, App.tsx
tests/domain/           Vitest + fast-check tests, one file per domain module
vercel.json, .env.example, tailwind.config.ts, README.md
```

## Where things go
- A new business rule goes in `src/domain` (pure) AND in `supabase/schema.sql` (trusted). Keep the two copies in agreement.
- A new page goes in `src/pages` and is wired into the router in `App.tsx`.
- Reusable UI goes in `src/components`; never duplicate a primitive.
- All data access goes through `src/lib/api.ts`; pages do not call `supabase` directly.

## Naming
- Database columns and enum values: `snake_case` (e.g. `in_progress`, `graphic_design`). The UI humanizes them for display.
- React components: `PascalCase`. Domain functions and variables: `camelCase`.
- Property-based test names include the requirement number they validate.

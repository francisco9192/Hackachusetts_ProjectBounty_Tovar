# Kiro Usage Log

A running record of how Kiro was used to build Bounty, kept as evidence for the Hackachusetts judges (Implementation / Best Use of Kiro).

## How Kiro was used (summary)
- **Spec-driven development:** requirements, design, and task list live in `.kiro/specs/bounty-platform/`. The spec, not vibe coding, drove every implementation task.
- **Steering docs:** `.kiro/steering/` (product, tech, structure, coding-standards) keep Kiro's output consistent with the stack and accessibility rules on every turn.
- **Agent hooks:** `.kiro/hooks/` automate repetitive workflow steps (see below).
- **Property-based testing:** nine correctness properties verified with Vitest + fast-check.

## Timeline
- 2026-10-24 ~12:30 - Planning kickoff. Chose Civic Action track, confirmed scope for a solo build with ~7.5 hours.
- 2026-10-24 - Wrote requirements.md (22 requirements, EARS format) and refined each for testability.
- 2026-10-24 - Wrote design.md (architecture, DB schema, RLS/RPC design, 16 correctness properties).
- 2026-10-24 - Wrote tasks.md (27 MVP tasks + 5 stretch, ordered for an early deployable demo loop).
- 2026-10-24 - Created steering docs and the test-on-save agent hook.

- 2026-10-24 - Task 1 (Scaffold project and tooling): Kiro scaffolded the Vite + React + TypeScript (strict) app at the repo root with Tailwind CSS (shared theme in `tailwind.config.ts`), React Router, and Vitest + fast-check. Created the folder structure (`src/domain`, `src/lib`, `src/components`, `src/pages`, `tests/domain`, `supabase/`), added `vercel.json` (SPA rewrite), `.env.example` (anon key names only), and a `.gitignore` that ignores `node_modules`/`.env.local`/`dist` but deliberately keeps `.kiro/` committed. Verified `npm install`, `npm run build`, and `npm test` all succeed; made the initial commit.

<!-- Add a dated bullet after each meaningful task. -->

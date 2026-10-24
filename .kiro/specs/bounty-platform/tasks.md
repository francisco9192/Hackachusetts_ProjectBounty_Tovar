# Implementation Plan: Bounty Platform

## Overview

This plan builds Bounty in strict build-priority order so a deployable end-to-end demo loop (sign up → post → browse → apply → accept → submit → confirm → settle) exists as early as possible. The pure `src/domain` rules and their property-based tests are built alongside the UI that uses them. The backend (schema + RLS + RPC + seed) is applied by the developer in the Supabase SQL editor. A DEPLOY-EARLY task lands in the middle, right after the core loop works, not at the end. Security/demo/testability hardening, then supporting-MVP polish (dashboard, messages, report, accessibility, responsive/landing), then stretch features come last.

Stack: Vite + React + TypeScript + Tailwind + React Router, Supabase (anon key only), Vitest + fast-check, Vercel. Language: TypeScript (the design is written in TypeScript, so no language selection is needed).

Manual prerequisites are called out inside the relevant task's details (creating the Supabase project and Vercel project are account/dashboard steps the developer performs; this plan only covers the code and SQL that those steps consume).

## Tasks

- [x] 1. Scaffold project and tooling
  - Initialize a Vite React + TypeScript app at the repo root; add Tailwind CSS and `tailwind.config.ts`, React Router, and TypeScript strict mode
  - Create the folder structure from the design: `src/domain`, `src/lib`, `src/components`, `src/pages`, `tests/domain`, `supabase/`, `docs/`
  - Add `vercel.json` with the SPA rewrite `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
  - Add `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; add `.gitignore` that ignores `.env.local` and `node_modules`
  - Initialize the git repository and make an initial commit
  - Create `docs/kiro-log.md` with a first dated bullet noting the scaffold
  - _Requirements: 10.2, 11.6, 12.4_

- [x] 2. Set up Supabase client and env wiring
  - Create `src/lib/supabase.ts` that reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and throws a clear dev error naming the missing variable when either is absent
  - Install `@supabase/supabase-js`; export a single configured client using only the anon key
  - Note (manual prerequisite): the developer creates the Supabase project in the dashboard and copies the URL and anon key into `.env.local`
  - _Requirements: 10.2, 17.4_

- [x] 3. Domain constants, labels, and reward rules
  - [x] 3.1 Implement `src/domain/constants.ts` and `src/domain/labels.ts`
    - Define `US_STATES` (51 values), `CATEGORIES`, Task/Application/Reward statuses, Reward_Type and Nonmonetary_Kind lists, and field length/count limits
    - Implement `humanize` (e.g. `in_progress` → "In progress", `graphic_design` → "Graphic design")
    - _Requirements: 1.1, 16.9_

  - [x] 3.2 Implement `src/domain/reward.ts`
    - Implement `validateReward`, `toRow`, `fromRow`, `formatReward`, and `parseDollars` (money as integer cents, reject >2 decimals)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x]* 3.3 Write property test for reward round trip
    - **Property 1: Reward round trip**
    - **Validates: Requirements 3.10**

  - [x]* 3.4 Write property test for reward validation
    - **Property 2: Reward validation accepts exactly well-formed Rewards**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

  - [x]* 3.5 Write property test for reward display
    - **Property 3: Reward display contains required information**
    - **Validates: Requirements 3.9**

- [x] 4. Domain validation functions
  - [x] 4.1 Implement `src/domain/validation.ts`
    - Implement `normalizeSkills`, `validateSignUp`, `validateProfile`, `validateTask(input, today)`, `validateSubmission`, `validateCover`, `validateMessage`, `validateReport`, `isHttpUrl`, and `sameState`
    - All functions pure: no network, storage, or `Date.now` (current date passed in)
    - _Requirements: 1.1, 1.5, 1.10, 1.11, 1.12, 2.1, 2.3, 2.4, 2.8, 5.1, 5.8, 7.1, 7.2, 7.7, 10.4, 12.1, 13.2, 13.6, 15.2, 15.5_

  - [x]* 4.2 Write property test for skill normalization
    - **Property 4: Skill normalization**
    - **Validates: Requirements 1.12, 2.8**

  - [x]* 4.3 Write property test for task form validation
    - **Property 5: Task form validation**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [x]* 4.4 Write property test for sign-up and profile validation
    - **Property 6: Sign-up and profile validation**
    - **Validates: Requirements 1.1, 1.5, 1.10, 1.11**

  - [x]* 4.5 Write property test for submission and URL validation
    - **Property 7: Submission and URL validation**
    - **Validates: Requirements 7.1, 7.2, 7.7, 10.4**

- [x] 5. Domain state machines and browse/next-action logic
  - [x] 5.1 Implement `src/domain/taskMachine.ts`
    - Implement `TaskModel` and `reduce(model, request)` for apply, accept, submit, confirm, cancel, pay, markDelivered, confirmReceived, enforcing authorization, same-state, single-assignee, and transition rules
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.3, 7.5, 7.6, 7.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.3, 9.7_

  - [x] 5.2 Implement `src/domain/rewardMachine.ts`
    - Implement `rewardTransition` for pay / markDelivered / confirmReceived with final-state enforcement
    - _Requirements: 9.1, 9.9, 9.11, 9.12, 9.13, 9.15_

  - [x] 5.3 Implement `src/domain/browse.ts` and `src/domain/nextAction.ts`
    - Implement `filterTasks` (open only, AND filters, sorted newest first, null state → empty) and `nextActionLabel`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 14.4, 14.5_

  - [x]* 5.4 Write property test for browse filtering
    - **Property 8: Browse filter soundness and monotonicity**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

  - [x]* 5.5 Write property test for Application uniqueness
    - **Property 9: At most one active Application per Member per Task**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

  - [x]* 5.6 Write property test for same-state acceptance
    - **Property 10: Same-state acceptance**
    - **Validates: Requirements 6.3, 6.4**

  - [x]* 5.7 Write property test for rejected requests changing nothing
    - **Property 11: Rejected requests change nothing**
    - **Validates: Requirements 5.3, 5.6, 6.7, 6.8, 7.5, 7.6, 7.8, 8.2, 8.3, 8.4, 9.7, 9.12**

  - [x]* 5.8 Write property test for single Assignee
    - **Property 12: Single Assignee**
    - **Validates: Requirements 6.2, 6.5, 6.6, 8.5, 8.7**

  - [x]* 5.9 Write property test for Task status state machine
    - **Property 13: Task status state machine**
    - **Validates: Requirements 7.3, 8.1, 8.4, 8.6**

  - [x]* 5.10 Write property test for simulated payment
    - **Property 14: Simulated payment at most once with the agreed amount**
    - **Validates: Requirements 9.3, 9.6, 9.7**

  - [x]* 5.11 Write property test for Reward status state machine
    - **Property 15: Reward status state machine**
    - **Validates: Requirements 9.1, 9.9, 9.11, 9.12, 9.13, 9.15**

  - [x]* 5.12 Write property test for dashboard next-action invariant
    - **Property 16: Dashboard next-action invariant**
    - **Validates: Requirements 14.4, 14.5**

- [x] 6. Database schema, RLS, RPC functions, and triggers
  - Create `supabase/schema.sql` with all eight tables (`profiles`, `member_private`, `tasks`, `applications`, `submissions`, `simulated_payments`, `messages`, `reports`), CHECK constraints, partial unique indexes (one active app, one accepted app, one simulated payment per task), RLS enabled on every table, the RLS policies in the design's RLS Summary, and the `security definer` RPC functions (`apply_to_task`, `accept_application`, `cancel_task`, `submit_work`, `confirm_completion`, `simulate_payment`, `mark_reward_delivered`, `confirm_reward_received`, `task_has_youth`) with `for update` row locks and `auth.uid()` checks
  - Add the new-user trigger (`on_auth_user_created`) and the `tasks_before_insert` trigger that forces `creator_id`, `status`, `assignee_id`, `completed_at`, and `reward_status`, and normalizes skills
  - Mirror the domain error codes (`NOT_SIGNED_IN`, `NOT_SAME_STATE`, etc.) in the raised exceptions
  - Note (manual prerequisite): the developer pastes `schema.sql` into the Supabase SQL editor and runs it, and turns off email confirmation in Auth settings
  - _Requirements: 6.6, 8.8, 8.9, 8.10, 9.6, 10.1, 10.5, 10.6, 10.7, 10.8, 10.9, 13.8, 15.3_

- [x] 7. Data access layer and error mapping
  - Create `src/lib/api.ts` with typed functions for reads (browse, task detail, profile, dashboard) and writes (insert task/profile/message/report, and `rpc(...)` calls for every status change)
  - Create `src/lib/errors.ts` mapping error codes to plain-language messages (unknown codes → generic message, never raw DB text) and `src/lib/withTimeout.ts` (15 s)
  - _Requirements: 8.2, 16.9, 17.4_

- [x] 8. Auth context, shared layout, and core UI primitives
  - [x] 8.1 Implement auth context and `RequireAuth`
    - Create `src/lib/auth` context tracking the Supabase session; implement `RequireAuth` route wrapper that redirects Visitors to `/signin`
    - _Requirements: 1.8, 1.17, 2.6, 14.7_

  - [x] 8.2 Implement shared components
    - Build `Layout` (one header/nav/main/footer), `Button`, `Field` (Input/Textarea/Select with labels + `aria-describedby`), `Form` helper, `Card`, `Badge`, `RewardDisplay`, `Toast`, `Loading`, `ErrorState`, `SafeLink`, `YouthSafetyNotice`, `DemoNotice`
    - Render all user text through JSX escaping; ban `dangerouslySetInnerHTML`
    - _Requirements: 3.9, 10.3, 10.4, 16.3, 16.8, 17.3_

- [x] 9. Accounts, sign-up, sign-in, and profiles
  - [x] 9.1 Implement sign-up and sign-in pages
    - Build `SignUpPage` using `validateSignUp`, the Under 13 / 13-17 / 18+ selector that disables submit for Under 13 and shows the Youth_Safety_Notice for 13-17, call `supabase.auth.signUp` with metadata; build `SignInPage` with the single incorrect-credentials message and sign-out wiring
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 9.2 Implement profile view and edit pages
    - Build `/profile/:id` (public, shows name, bio, skills, town, state, completed projects; omits email and age; not-found message) and `/profile/edit` (owner only, uses `validateProfile`)
    - _Requirements: 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.18, 7.4_

- [x] 10. Post a task
  - Build `/tasks/new` form using `validateTask`, prefilling US_State and Town from the Member's Profile, disabling submit during request, inserting via the data layer; on success show the Task detail page
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1_

- [x] 11. Browse local tasks
  - Build `/browse` using `filterTasks`: Member defaults to Profile state, Visitor picks a state, Town/Category/Reward_Type/keyword filters, empty-state with Clear filters, and the per-task card fields
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

- [x] 12. Task detail: apply and review/accept applicants
  - [x] 12.1 Implement apply action
    - On `/tasks/:id`, show the apply form to eligible Members using `validateCover`, calling `apply_to_task`; handle same-state, own-task, duplicate, and not-open rejections with their messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9_

  - [x] 12.2 Implement applicant review and accept
    - Show all Applications to the Task_Creator (sorted, with applicant details and profile link) and an accept action calling `accept_application`; handle empty-state and rejection messages
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7, 6.8, 6.9, 8.1, 8.2, 8.3_

- [x] 13. Task detail: submit work, confirm completion, cancel
  - Add the Assignee submission form using `validateSubmission` calling `submit_work`; the Task_Creator confirm-completion action calling `confirm_completion`; the Task_Creator cancel action on Open tasks calling `cancel_task`; display Submission description and URLs as `SafeLink`s
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.1, 8.4, 8.5_

- [x] 14. Reward settlement and demo payment simulator
  - On `/tasks/:id`, show the "Simulated payment (demo only)" action (creator, completed, monetary, pending) calling `simulate_payment`; the mark-delivered action (creator, nonmonetary) and confirm-received action (assignee, nonmonetary); display current Reward_Status and the DemoNotice everywhere required
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14, 9.15_

- [x] 15. Checkpoint - core loop works locally
  - Ensure all tests pass and the full loop (sign up → post → browse → apply → accept → submit → confirm → settle) runs locally. Ask the user if questions arise.

- [x] 16. DEPLOY-EARLY: ship the core loop to Vercel
  - Add any build config needed for a clean `vite build`; confirm `vercel.json` SPA rewrite; wire the production env var names so the deployed app reads the Supabase URL and anon key
  - Verify the public landing page loads for a Visitor and that a demo sign-in reaches the dashboard on the deployed link
  - Note (manual prerequisite): the developer connects the GitHub repo to a Vercel project and sets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel project settings; append the result to `docs/kiro-log.md`
  - _Requirements: 11.7, 11.8, 17.7_

- [x] 17. Idempotent demo seed
  - Create `supabase/seed.sql` with fixed UUIDs, demo auth users + identities, 3+ Massachusetts members (business 18+, student 18+, youth 13-17), 6+ MA tasks across all Reward_Types and 3+ Categories, every Task_Status represented, one Open task with a Pending Application, one Completed monetary task with its Simulated_Payment, and one Open New Hampshire task; use `on conflict ... do update` so re-running restores exact values without duplicates
  - Note (manual prerequisite): the developer runs `seed.sql` in the Supabase SQL editor (with the dashboard fallback for creating the three users if the direct `auth.users` insert fails)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.9_

- [ ] 18. Security hardening pass
  - Verify every table has RLS enabled with deny-by-default, no UPDATE policy on status tables, every RPC is `security definer` with `set search_path` and an `auth.uid()` check; confirm the browser bundle uses only the anon key and the repo contains no service role key or secret
  - Add database smoke-test notes to `docs/kiro-log.md` covering the Visitor-read-empty, direct-update-rejected, same-state, double-accept, double-pay, and age-bracket checks
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

- [ ] 19. Testability finalization
  - Ensure `npm test` runs `vitest --run` once, offline, under 120 s, exits non-zero on failure, and prints the shrunk counterexample; confirm each property test name contains its requirement number and there are no hand-rolled random generators
  - Add shared arbitraries in `tests/domain/arbitraries.ts` and the required example tests (humanize over every enum, error-code mapping, `parseDollars` edge cases, `<script>` renders as literal text, one example per single transition)
  - _Requirements: 10.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 16.9_

- [ ] 20. Checkpoint - deployed core loop and tests green
  - Ensure all tests pass and the deployed link runs the core loop with seeded data. Ask the user if questions arise.

- [ ] 21. Task message thread
  - On `/tasks/:id`, show the Message_Thread and input to the Task_Creator and Assignee while the task is In_Progress/Submitted/Completed, using `validateMessage`; insert messages, display them in timestamp order as plain text, show the Youth_Safety_Notice above the thread when a participant is a youth, and handle send failures with retry
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 22. Minimal dashboard
  - Build `/dashboard` with Posted, Working On, and Applications lists sorted newest first, each with status/reward-status text, next-action labels from `nextActionLabel`, empty-state messages per list, and Visitor redirect
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ] 23. Report button
  - Add `ReportButton` / `ReportDialog` on Task detail and Profile pages (signed-in only), with reason select + optional note using `validateReport`, inserting one Report, handling the duplicate-report message, and leaving the target unchanged
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 24. Accessibility pass
  - Ensure keyboard reachability and operability with visible focus indicators, labels + accessible names for icon-only buttons, color-contrast-compliant tokens, one of each landmark + one h1 per page, focus moves to first invalid field, backend errors announced via a live region, text labels alongside color/icon for statuses, and humanized enum display with no raw error text
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_

- [x] 25. Responsive interface and landing page
  - Ensure every page renders cleanly from 360px to 1920px with no horizontal scroll, all tokens come from the shared Tailwind theme, Loading/ErrorState/Retry and confirmation toasts behave per spec, and build the public landing page with the required text sections and a sign-up control
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [x] 26. README and judging docs
  - Write the repository README listing the public test link; each demo Member's email, password, Age_Bracket, and role; local setup (install, run, test); and Supabase setup (create project, apply schema + RLS, set URL/anon key, run seed)
  - Ensure the `.kiro` folder (specs, steering, hooks) is committed and `docs/kiro-log.md` is linked from the README
  - _Requirements: 11.5, 11.6_

- [ ] 27. Final checkpoint - ensure all tests pass
  - Ensure all tests pass and the deployed demo is ready. Ask the user if questions arise.

## Stretch Tasks (Optional - build only after every MVP task works on the deployed site)

- [ ]* 28. Task editing, cancellation after acceptance, and revisions
  - Add `edit_task` and `request_revision` RPCs (+ `revision_notes` table), extra `reduce` cases, and edit/revision UI; grow Property 13's allowed-transition list
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ]* 29. Manual rejection and withdrawal of applications
  - Add `reject_application` and `withdraw_application` RPCs and UI; the partial unique index already treats rejected/withdrawn as inactive
  - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [ ]* 30. Skill-based recommendations
  - Add a pure `recommend(tasks, profile, myApps)` in `src/domain` and a dashboard recommendation section with empty/no-skills states
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [ ]* 31. Automatic portfolio generation
  - Add a public `/portfolio/:id` route reusing Profile queries with a print-friendly single-column layout and not-found handling
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

- [ ]* 32. Completion testimonials
  - Add a `testimonials` table (unique task_id) written inside `confirm_completion`, an optional testimonial field on confirm, and display next to Completed_Projects
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

## Notes

- Tasks marked with `*` are optional. All stretch tasks (28-32) and the property/unit test sub-tasks are optional and can be skipped for a faster MVP, but the test sub-tasks implement the property-based tests required by Requirement 12.2 and should be kept if time allows.
- Each task references specific requirements for traceability.
- The core demo loop is reachable at task 15 and deployed at task 16, before dashboard/messages/report/accessibility polish.
- Backend SQL (schema and seed) is applied by the developer in the Supabase SQL editor; those manual steps are noted in the relevant tasks.
- Property tests validate the universal correctness properties (Properties 1-16); unit tests validate specific examples and edge cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["3.2", "4.1"] },
    { "id": 2, "tasks": ["3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "4.5", "5.1", "5.2", "5.3"] },
    { "id": 3, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12", "8.1", "8.2"] },
    { "id": 4, "tasks": ["9.1", "9.2"] },
    { "id": 5, "tasks": ["12.1", "12.2"] }
  ]
}
```

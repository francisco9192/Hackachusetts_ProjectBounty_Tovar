---
inclusion: always
---

# Coding Standards & Accessibility

## TypeScript / React
- TypeScript strict mode. No `any` unless unavoidable; prefer precise types and discriminated unions (e.g. the `Reward` type).
- Domain functions are pure and return a `Result<T>` (`{ ok: true; value }` or `{ ok: false; errors }`). No throwing for validation.
- Pages read/write only through `src/lib/api.ts`. No `supabase` calls inside components.
- Disable submit buttons while a request is in flight so one click creates at most one record.

## Security
- Render all user-provided text through normal JSX (`{text}`) so React escapes it. **Never** use `dangerouslySetInnerHTML`.
- Render a URL as a clickable link only when it passes `isHttpUrl`; otherwise show plain text.
- Never put a secret or service role key in the repo. Browser code uses the anon key only.
- Never show raw database error text, codes, or stack traces to users; map through `src/lib/errors.ts`.

## Accessibility (applies to every page)
- Every interactive control is keyboard reachable (Tab/Shift+Tab) and operable (Enter/Space), with a visible focus ring (>= 2px, 3:1 contrast).
- Every form field has a visible `<label htmlFor>`; every icon-only button has an `aria-label`.
- Body text contrast >= 4.5:1; large text and component borders >= 3:1. All color values come from the shared Tailwind theme.
- Each page has exactly one `<header>`, `<nav>`, `<main>`, `<footer>` and one `<h1>` inside `<main>`.
- On validation failure, move focus to the first invalid field and link each error to its field via `aria-describedby`.
- Backend errors are announced in a `role="alert"` / `aria-live` region without moving focus; entered values are preserved.
- Status and reward values always show a **text label** in addition to any color or icon, and display humanized words (not `snake_case`).
- Use plain language. No technical jargon in user-facing text.

## Testing
- Each of the nine required correctness properties has a fast-check property test whose name contains its requirement number.
- `npm test` runs once (`vitest --run`), offline, and exits non-zero on failure.

## Workflow
- Build in the task order in `tasks.md`. Get the core loop deployed early, then polish.
- After completing a meaningful task, add a dated bullet to `docs/kiro-log.md`.

/**
 * Error mapping: turn any failure from Supabase (a raised Postgres exception,
 * an auth error, an RLS denial) or the {@link TimeoutError} sentinel into a
 * single, plain-language, jargon-free message the UI can show (Req 16.9,
 * 17.4). Raw database text, Postgres SQLSTATEs, and stack traces NEVER reach a
 * user through this module.
 *
 * How it works: our RPCs and triggers `raise exception 'CODE'` with a short
 * code (e.g. `NOT_SAME_STATE`). supabase-js surfaces that as an error whose
 * `message`/`details`/`hint` text contains the code. We scan those fields for a
 * known code and return the matching friendly sentence; anything unrecognized
 * maps to a safe generic message. The codes mirror
 * `src/domain/taskMachine.ts` and the exceptions in `supabase/schema.sql`.
 */

import { TIMEOUT_CODE, TimeoutError } from './withTimeout';

// ---------------------------------------------------------------------------
// Known codes
// ---------------------------------------------------------------------------

/**
 * Every short code this app can surface. The first group is raised by the
 * database (RPCs + the sign-up / task triggers in `supabase/schema.sql`); the
 * last two are client-side (`TIMEOUT` from {@link withTimeout}, `UNKNOWN` the
 * catch-all).
 */
export type AppErrorCode =
  // --- raised by RPCs (status/reward changes) ---
  | 'NOT_SIGNED_IN'
  | 'NOT_FOUND'
  | 'NOT_CREATOR'
  | 'NOT_ASSIGNEE'
  | 'NOT_PERMITTED'
  | 'CREATOR_CANNOT_APPLY'
  | 'WRONG_STATUS'
  | 'NOT_SAME_STATE'
  | 'APP_NOT_PENDING'
  | 'DUPLICATE_APPLICATION'
  | 'INVALID_COVER'
  | 'INVALID_SUBMISSION'
  | 'WRONG_REWARD_TYPE'
  | 'WRONG_REWARD_STATUS'
  | 'ALREADY_PAID'
  // --- raised by the new-user sign-up trigger ---
  | 'INVALID_DISPLAY_NAME'
  | 'INVALID_AGE_BRACKET'
  | 'INVALID_US_STATE'
  | 'INVALID_TOWN'
  // --- client-side ---
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * The plain-language message shown for each code. Wording follows the
 * requirements where they fix it (same-state, creator-cannot-apply,
 * already-applied, task-no-longer-open, reward-settlement), and stays short and
 * jargon-free everywhere (Req 16.9, 17.4). No message leaks a code, SQLSTATE,
 * or raw DB text.
 */
const MESSAGES: Record<AppErrorCode, string> = {
  NOT_SIGNED_IN: 'Please sign in to continue.',
  NOT_FOUND: "We couldn't find that item. It may have been removed.",
  NOT_CREATOR: "Only the person who posted this task can do that.",
  NOT_ASSIGNEE: 'Only the person assigned to this task can do that.',
  NOT_PERMITTED: "You don't have permission to do that.",
  CREATOR_CANNOT_APPLY: "You can't apply to your own task.",
  WRONG_STATUS: 'This task is no longer accepting that action.',
  NOT_SAME_STATE: 'You can only apply to tasks in your own state.',
  APP_NOT_PENDING: 'That application has already been handled.',
  DUPLICATE_APPLICATION: "You've already applied to this task.",
  INVALID_COVER: 'Your cover message must be 20 to 1000 characters.',
  INVALID_SUBMISSION: 'Please check your work description and links, then try again.',
  WRONG_REWARD_TYPE: "That action doesn't match this task's reward type.",
  WRONG_REWARD_STATUS: 'The reward could not be settled in its current state.',
  ALREADY_PAID: 'This reward has already been settled.',
  INVALID_DISPLAY_NAME: 'Please enter a display name of 1 to 50 characters.',
  INVALID_AGE_BRACKET: 'Please choose a valid age option.',
  INVALID_US_STATE: 'Please choose a valid state.',
  INVALID_TOWN: 'Please enter a town of 2 to 60 characters.',
  TIMEOUT: 'The request took too long. Please check your connection and try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

/** Supabase auth: email already registered (case-insensitive) (Req 1.4). */
const EMAIL_IN_USE_MESSAGE = 'That email is already in use. Try signing in instead.';
/** Supabase auth: wrong email/password — one generic message (Req 1.7). */
const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.';

/** All DB/trigger codes, longest-first so a longer code wins any substring tie. */
const DB_CODES: AppErrorCode[] = (
  [
    'NOT_SIGNED_IN',
    'NOT_FOUND',
    'NOT_CREATOR',
    'NOT_ASSIGNEE',
    'NOT_PERMITTED',
    'CREATOR_CANNOT_APPLY',
    'WRONG_STATUS',
    'NOT_SAME_STATE',
    'APP_NOT_PENDING',
    'DUPLICATE_APPLICATION',
    'INVALID_COVER',
    'INVALID_SUBMISSION',
    'WRONG_REWARD_TYPE',
    'WRONG_REWARD_STATUS',
    'ALREADY_PAID',
    'INVALID_DISPLAY_NAME',
    'INVALID_AGE_BRACKET',
    'INVALID_US_STATE',
    'INVALID_TOWN',
  ] as AppErrorCode[]
).sort((a, b) => b.length - a.length);

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/** Pull the string fields a Supabase/Postgres error may carry, concatenated. */
function errorText(err: unknown): string {
  if (err === null || err === undefined) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const extra = err as { details?: unknown; hint?: unknown; code?: unknown };
    return [err.message, extra.details, extra.hint, extra.code]
      .filter((p): p is string => typeof p === 'string')
      .join(' ');
  }
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    return [o.message, o.details, o.hint, o.code, o.error_description, o.error, o.msg]
      .filter((p): p is string => typeof p === 'string')
      .join(' ');
  }
  return '';
}

/** True when `haystack` contains `needle`, compared case-insensitively. */
function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Detect the two Supabase auth cases that don't use our short codes:
 * - an already-registered email -> `INVALID_DISPLAY_NAME`? No — handled as a
 *   dedicated message below, so this returns a marker we special-case.
 * Returns `null` when neither auth case matches.
 */
function authMessage(text: string): string | null {
  // Already-registered email (Req 1.4). supabase-js phrases vary across
  // versions ("User already registered", "already been registered", ...).
  if (
    includesCI(text, 'already registered') ||
    includesCI(text, 'already been registered') ||
    includesCI(text, 'already in use') ||
    includesCI(text, 'user already exists')
  ) {
    return EMAIL_IN_USE_MESSAGE;
  }
  // Wrong email/password — always one generic message (Req 1.7).
  if (includesCI(text, 'invalid login credentials') || includesCI(text, 'invalid credentials')) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify any thrown value into an {@link AppErrorCode}. Recognizes the
 * {@link TimeoutError} sentinel, then scans the error's text fields for a known
 * DB/trigger code; falls back to `'UNKNOWN'`. Useful for tests and for callers
 * that want to branch on the code (the UI normally uses {@link messageForError}).
 *
 * Note: the two Supabase auth cases (email-in-use, bad credentials) do not map
 * to a code here — they are handled directly in {@link messageForError}.
 */
export function codeOf(err: unknown): AppErrorCode {
  if (err instanceof TimeoutError) return 'TIMEOUT';

  const text = errorText(err);
  if (includesCI(text, TIMEOUT_CODE) && includesCI(text, 'timed out')) return 'TIMEOUT';

  for (const code of DB_CODES) {
    if (includesCI(text, code)) return code;
  }
  return 'UNKNOWN';
}

/**
 * Map any thrown value to a safe, plain-language message for the UI (Req 16.9,
 * 17.4). Order: timeout sentinel, then the Supabase auth special cases
 * (email-in-use Req 1.4, bad credentials Req 1.7), then our DB/trigger codes,
 * then a generic fallback. The result never contains a raw code, SQLSTATE, or
 * database text.
 */
export function messageForError(err: unknown): string {
  if (err instanceof TimeoutError) return MESSAGES.TIMEOUT;

  const text = errorText(err);

  // Auth-specific wording takes priority over the generic code scan.
  const auth = authMessage(text);
  if (auth !== null) return auth;

  return MESSAGES[codeOf(err)];
}

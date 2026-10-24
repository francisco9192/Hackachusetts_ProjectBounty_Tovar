/**
 * `withTimeout` races a pending promise against a timer so a hung network call
 * cannot leave the UI spinning forever. If the wrapped promise does not settle
 * within `ms`, the returned promise rejects with a sentinel {@link TimeoutError}
 * that `src/lib/errors.ts` recognizes and maps to a plain-language message
 * (Req 17.4).
 *
 * This module is a pure utility: no React, no Supabase, no global state. The
 * default budget is 15 seconds (Req 17.4); callers may pass a shorter/longer
 * `ms` when it makes sense.
 */

/** The short code carried by a timeout, matched by `src/lib/errors.ts`. */
export const TIMEOUT_CODE = 'TIMEOUT' as const;

/**
 * The error a timed-out call rejects with. It carries both a stable `name`
 * (`'TimeoutError'`) and a `code` (`'TIMEOUT'`) so the error mapper can detect
 * it by either, without parsing free-text.
 */
export class TimeoutError extends Error {
  readonly code = TIMEOUT_CODE;

  constructor(message = 'The request timed out.') {
    super(message);
    this.name = 'TimeoutError';
    // Keep `instanceof` working when compiled down to ES5-ish targets.
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/** Default timeout budget for a network call, in milliseconds (Req 17.4). */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Resolve/reject with whatever `promise` does, unless `ms` milliseconds pass
 * first, in which case reject with a {@link TimeoutError}. The timer is always
 * cleared once the race settles so no stray timer keeps the process alive.
 *
 * Accepts any `PromiseLike<T>` (the Supabase query builders are thenables), and
 * always returns a real `Promise<T>`.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError());
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

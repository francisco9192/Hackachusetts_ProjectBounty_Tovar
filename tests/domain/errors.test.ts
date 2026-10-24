/**
 * Unit tests for the error mapper (`src/lib/errors.ts`). These confirm that the
 * short codes the database raises (see `supabase/schema.sql`) become safe,
 * plain-language messages and that raw codes/DB text never leak through.
 *
 * _Requirements: 16.9, 17.4_
 */

import { describe, it, expect } from 'vitest';

import { codeOf, messageForError, type AppErrorCode } from '../../src/lib/errors';
import { TimeoutError } from '../../src/lib/withTimeout';

/** The codes the DB/triggers raise, as they surface in a Postgres error message. */
const DB_CODES: AppErrorCode[] = [
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
];

describe('messageForError / codeOf', () => {
  it('maps every DB code to a non-empty, jargon-free message that never leaks the code', () => {
    for (const code of DB_CODES) {
      // Postgres surfaces `raise exception 'CODE'` with the code inside message.
      const err = { message: code };
      expect(codeOf(err)).toBe(code);
      const msg = messageForError(err);
      expect(msg.length).toBeGreaterThan(0);
      // The raw short code must never appear in the user-facing text.
      expect(msg).not.toContain(code);
    }
  });

  it('detects a specific same-state message (Req 6.4)', () => {
    expect(messageForError({ message: 'NOT_SAME_STATE' })).toBe(
      'You can only apply to tasks in your own state.',
    );
  });

  it('maps the timeout sentinel to the timeout message (Req 17.4)', () => {
    expect(codeOf(new TimeoutError())).toBe('TIMEOUT');
    expect(messageForError(new TimeoutError())).toMatch(/took too long/i);
  });

  it('maps Supabase auth cases without using a code', () => {
    expect(messageForError({ message: 'User already registered' })).toMatch(/already in use/i);
    expect(messageForError({ message: 'Invalid login credentials' })).toBe(
      'Incorrect email or password.',
    );
  });

  it('falls back to a generic message for unknown errors, leaking no raw text', () => {
    const raw = 'duplicate key value violates unique constraint "pg_foo_42"';
    const msg = messageForError(new Error(raw));
    expect(msg).toBe('Something went wrong. Please try again.');
    expect(msg).not.toContain('pg_foo_42');
    expect(messageForError(null)).toBe('Something went wrong. Please try again.');
  });
});

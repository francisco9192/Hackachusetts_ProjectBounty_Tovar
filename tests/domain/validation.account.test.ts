/**
 * Property-based test for sign-up and profile validation in
 * `src/domain/validation.ts`.
 *
 * Covers design Correctness Property 6: Sign-up and profile validation.
 *
 * Feature: bounty-platform, Property 6: Sign-up and profile validation
 *
 * Validates: Requirements 1.1, 1.5, 1.10, 1.11
 *
 * The oracles recompute the expected invalid-field set directly from the raw
 * input per Req 1.1 (sign-up) and Req 1.10 (profile); they never call the
 * functions under test. Password is checked at RAW length (not trimmed);
 * "Under 13" is an invalid Age_Bracket for sign-up.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  validateProfile,
  validateSignUp,
  type ProfileInput,
  type SignUpInput,
} from '../../src/domain/validation';
import { LIMITS, AGE_BRACKETS, isUsState } from '../../src/domain/constants';
import { profileInput, signUpInput } from './arbitraries';

const RUNS = { numRuns: 200 };

// ---------------------------------------------------------------------------
// Independent helpers (mirror the requirements; do not call the SUT)
// ---------------------------------------------------------------------------

function trimLen(s: string): number {
  return s.trim().length;
}

function inTrimmedRange(s: string, min: number, max: number): boolean {
  const n = trimLen(s);
  return n >= min && n <= max;
}

/** Req 1.1 email shape: <=254, exactly one '@', label before, dotted domain after. */
function oracleValidEmail(raw: string): boolean {
  const email = raw.trim();
  if (email.length === 0 || email.length > LIMITS.email.max) return false;
  const at = email.indexOf('@');
  if (at <= 0 || email.indexOf('@', at + 1) !== -1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.indexOf('.');
  if (dot <= 0 || dot === domain.length - 1) return false;
  return true;
}

function oracleNormalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const t = raw.trim();
    if (t.length === 0) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sign-up oracle (Req 1.1, 1.5)
// ---------------------------------------------------------------------------

function oracleSignUpInvalid(input: SignUpInput): Set<string> {
  const bad = new Set<string>();

  if (!oracleValidEmail(input.email)) bad.add('email');

  // Password: RAW length, not trimmed.
  if (input.password.length < LIMITS.password.min || input.password.length > LIMITS.password.max) {
    bad.add('password');
  }

  if (!inTrimmedRange(input.displayName, LIMITS.displayName.min, LIMITS.displayName.max)) {
    bad.add('displayName');
  }

  // "Under 13" and anything not in the two stored brackets is invalid.
  if (!(AGE_BRACKETS as readonly string[]).includes(input.ageBracket.trim())) {
    bad.add('ageBracket');
  }

  if (!isUsState(input.usState.trim())) bad.add('usState');
  if (!inTrimmedRange(input.town, LIMITS.town.min, LIMITS.town.max)) bad.add('town');

  return bad;
}

// ---------------------------------------------------------------------------
// Profile oracle (Req 1.10, 1.11)
// ---------------------------------------------------------------------------

function oracleProfileInvalid(input: ProfileInput): Set<string> {
  const bad = new Set<string>();

  if (!inTrimmedRange(input.displayName, LIMITS.displayName.min, LIMITS.displayName.max)) {
    bad.add('displayName');
  }
  if (!inTrimmedRange(input.bio, LIMITS.bio.min, LIMITS.bio.max)) bad.add('bio');

  const skills = oracleNormalizeSkills(input.skills);
  if (skills.length > LIMITS.profileSkills.maxCount) {
    bad.add('skills');
  } else if (skills.some((s) => s.length < LIMITS.skill.min || s.length > LIMITS.skill.max)) {
    bad.add('skills');
  }

  if (!isUsState(input.usState.trim())) bad.add('usState');
  if (!inTrimmedRange(input.town, LIMITS.town.min, LIMITS.town.max)) bad.add('town');

  return bad;
}

describe('validation.ts - validateSignUp (Property 6)', () => {
  it('Property 6 (Req 1.1, 1.5): validateSignUp.ok iff every field meets Req 1.1 (password at raw length, "Under 13" rejected), and errors name exactly the failing fields', () => {
    fc.assert(
      fc.property(signUpInput, (input: SignUpInput) => {
        const expectedInvalid = oracleSignUpInvalid(input);
        const expectedOk = expectedInvalid.size === 0;

        const result = validateSignUp(input);
        expect(result.ok).toBe(expectedOk);

        if (!result.ok) {
          expect(new Set(Object.keys(result.errors))).toEqual(expectedInvalid);
        }
      }),
      RUNS,
    );
  });

  it('Property 6 (Req 1.1): explicit example - "Under 13" is an invalid Age_Bracket', () => {
    const result = validateSignUp({
      email: 'teen@example.com',
      password: 'password123',
      displayName: 'Teen User',
      ageBracket: 'Under 13',
      usState: 'MA',
      town: 'Boston',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveProperty('ageBracket');
  });

  it('Property 6 (Req 1.1): explicit example - a password of trailing spaces counts at raw length', () => {
    // 8 space characters: raw length 8 is in range, so password is valid.
    const result = validateSignUp({
      email: 'a@b.com',
      password: '        ',
      displayName: 'Valid Name',
      ageBracket: '18+',
      usState: 'MA',
      town: 'Boston',
    });
    expect(result.ok).toBe(true);
  });
});

describe('validation.ts - validateProfile (Property 6)', () => {
  it('Property 6 (Req 1.10, 1.11): validateProfile.ok iff displayName/bio/skills/state/town meet Req 1.10, and errors name exactly the failing fields', () => {
    fc.assert(
      fc.property(profileInput, (input: ProfileInput) => {
        const expectedInvalid = oracleProfileInvalid(input);
        const expectedOk = expectedInvalid.size === 0;

        const result = validateProfile(input);
        expect(result.ok).toBe(expectedOk);

        if (!result.ok) {
          expect(new Set(Object.keys(result.errors))).toEqual(expectedInvalid);
        }
      }),
      RUNS,
    );
  });

  it('Property 6 (Req 1.10): explicit example - an empty bio and empty skill list are valid', () => {
    const result = validateProfile({
      displayName: 'Jane Doe',
      bio: '',
      skills: [],
      usState: 'MA',
      town: 'Boston',
    });
    expect(result.ok).toBe(true);
  });
});

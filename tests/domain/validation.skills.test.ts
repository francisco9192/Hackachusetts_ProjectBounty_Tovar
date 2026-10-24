/**
 * Property-based test for skill normalization in `src/domain/validation.ts`.
 *
 * Covers design Correctness Property 4: Skill normalization.
 *
 * Feature: bounty-platform, Property 4: Skill normalization
 *
 * Validates: Requirements 1.12, 2.8
 *
 * The oracle recomputes expected validity/shape directly from the raw input
 * (case-insensitive trimmed de-duplication, first-occurrence spelling and
 * order); it never calls `normalizeSkills` to decide the expected result.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { normalizeSkills } from '../../src/domain/validation';
import { normalizeSkillsInput } from './arbitraries';

const RUNS = { numRuns: 200 };

/**
 * Independent oracle for the expected normalized list: trim each entry, drop
 * blanks, and keep the first occurrence of each case-insensitive group in
 * original order. This mirrors Req 1.12 / 2.8 without calling the SUT.
 */
function oracleNormalize(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

describe('validation.ts - normalizeSkills (Property 4)', () => {
  it('Property 4 (Req 1.12, 2.8): normalizeSkills de-dupes case-insensitively after trim, keeps first-occurrence spelling and order, and drops blanks', () => {
    fc.assert(
      fc.property(normalizeSkillsInput, (input: string[]) => {
        const out = normalizeSkills(input);

        // (a) No two outputs are equal case-insensitively after trim. Because
        // the oracle trims identically, outputs should already be trimmed, but
        // we lower-case defensively to prove the de-dup rule directly.
        const lowered = out.map((s) => s.trim().toLowerCase());
        expect(new Set(lowered).size).toBe(lowered.length);

        // (d) No empty / whitespace-only entries remain.
        for (const s of out) {
          expect(s.trim().length).toBeGreaterThan(0);
        }

        // (b) Each output equals the trimmed first occurrence of its group in
        // original order - verified by matching the independent oracle exactly.
        expect(out).toEqual(oracleNormalize(input));

        // (c) Idempotence: normalizing a normalized list is a no-op.
        expect(normalizeSkills(out)).toEqual(out);
      }),
      RUNS,
    );
  });

  it('Property 4 (Req 1.12, 2.8): explicit example - trimmed first spelling and order win over later duplicates', () => {
    expect(normalizeSkills([' React ', 'react', 'REACT', '  node', 'Node '])).toEqual([
      'React',
      'node',
    ]);
    expect(normalizeSkills(['', '   ', '\t', 'a', ' a ', 'A'])).toEqual(['a']);
  });
});

/**
 * Property-based tests for the reward domain module (`src/domain/reward.ts`).
 *
 * Covers design Correctness Properties 1, 2, 3:
 *   - Property 1 (Req 3.10): Reward round trip.
 *   - Property 2 (Req 3.1-3.8): validation accepts exactly well-formed Rewards.
 *   - Property 3 (Req 3.9): display contains the required information.
 *
 * Each property runs >= 100 random cases. The Property 2 oracle recomputes the
 * expected validity directly from the raw form input per Requirement 3, never
 * by calling `validateReward`.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  formatReward,
  fromRow,
  toRow,
  validateReward,
  type Reward,
  type RewardFormInput,
} from '../../src/domain/reward';
import { humanize } from '../../src/domain/labels';
import {
  LIMITS,
  NONMONETARY_KINDS,
  REWARD_TYPES,
} from '../../src/domain/constants';
import { reward, rewardFormInput } from './arbitraries';

const RUNS = { numRuns: 300 };

// ---------------------------------------------------------------------------
// Independent oracle for Property 2 (does NOT call validateReward)
// ---------------------------------------------------------------------------

/**
 * Parse a dollar string to integer cents following the REQUIREMENTS' documented
 * accepted format: optional single leading "$", then digits, then optionally a
 * "." with exactly 1 or 2 fractional digits. No commas, no sign, no extra
 * whitespace beyond trimming. Returns null when not well-formed.
 *
 * This is an independent reimplementation used only to decide expected
 * validity; it mirrors Requirement 3's "numeric amount ... with at most 2
 * decimal places" and the documented strict dollar grammar.
 */
function oracleParseDollars(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  const m = /^\$?(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (m === null) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + frac;
  return Number.isSafeInteger(cents) ? cents : null;
}

function present(v: string): boolean {
  return v.trim().length > 0;
}

/**
 * The set of field keys that the oracle expects to be invalid for a given form
 * input, computed from the raw requirements. An empty set means the input is
 * well-formed and `validateReward` must return ok.
 */
function oracleInvalidFields(input: RewardFormInput): Set<string> {
  const bad = new Set<string>();
  const type = input.type.trim();

  // Req 3.1 / 3.2: exactly one valid Reward_Type.
  if (!(REWARD_TYPES as readonly string[]).includes(type)) {
    bad.add('type');
    // Implementation short-circuits on an unknown type and reports only 'type';
    // the oracle matches that so the invalid-field key set aligns.
    return bad;
  }

  if (type === 'monetary') {
    // Req 3.3 / 3.8: numeric amount $0.01..$10,000.00, <=2 decimals, required.
    if (!present(input.amount)) {
      bad.add('amount');
    } else {
      const cents = oracleParseDollars(input.amount);
      if (
        cents === null ||
        cents < LIMITS.amountCents.min ||
        cents > LIMITS.amountCents.max
      ) {
        bad.add('amount');
      }
    }
    // Req 3.7: no nonmonetary fields on a monetary reward.
    if (present(input.kind)) bad.add('kind');
    if (present(input.description)) bad.add('description');
    if (present(input.estimatedValue)) bad.add('estimatedValue');
    return bad;
  }

  if (type === 'nonmonetary') {
    // Req 3.4: exactly one valid kind.
    const kind = input.kind.trim();
    if (!(NONMONETARY_KINDS as readonly string[]).includes(kind)) {
      bad.add('kind');
    }
    // Req 3.4: description 5..300 after trim.
    const description = input.description.trim();
    if (
      description.length < LIMITS.rewardDescription.min ||
      description.length > LIMITS.rewardDescription.max
    ) {
      bad.add('description');
    }
    // Req 3.5: estimated value optional; when present, $0.00..$10,000.00, <=2 dp.
    if (present(input.estimatedValue)) {
      const cents = oracleParseDollars(input.estimatedValue);
      if (
        cents === null ||
        cents < LIMITS.estimatedValueCents.min ||
        cents > LIMITS.estimatedValueCents.max
      ) {
        bad.add('estimatedValue');
      }
    }
    // Req 3.7: no monetary amount on a nonmonetary reward.
    if (present(input.amount)) bad.add('amount');
    return bad;
  }

  // type === 'volunteer' (Req 3.6, 3.7): no other field may be present.
  if (present(input.amount)) bad.add('amount');
  if (present(input.kind)) bad.add('kind');
  if (present(input.description)) bad.add('description');
  if (present(input.estimatedValue)) bad.add('estimatedValue');
  return bad;
}

// ---------------------------------------------------------------------------
// Property 1: Reward round trip (Req 3.10)
// ---------------------------------------------------------------------------

describe('reward.ts domain properties', () => {
  it('Property 1 (Req 3.10): fromRow(toRow(r)) deep-equals r for any valid Reward', () => {
    fc.assert(
      fc.property(reward, (r: Reward) => {
        expect(fromRow(toRow(r))).toEqual(r);
      }),
      RUNS,
    );
  });

  // -------------------------------------------------------------------------
  // Property 2: validation accepts exactly well-formed Rewards (Req 3.1-3.8)
  // -------------------------------------------------------------------------

  it('Property 2 (Req 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8): validateReward.ok iff input is well-formed, and every invalid field is reported', () => {
    fc.assert(
      fc.property(rewardFormInput, (input: RewardFormInput) => {
        const expectedInvalid = oracleInvalidFields(input);
        const expectedOk = expectedInvalid.size === 0;

        const result = validateReward(input);
        expect(result.ok).toBe(expectedOk);

        if (!result.ok) {
          // Every field the oracle marks invalid must appear as an error key.
          for (const field of expectedInvalid) {
            expect(result.errors).toHaveProperty(field);
          }
          // And the implementation must not invent errors for fields the
          // oracle considers valid: the key sets match exactly.
          expect(new Set(Object.keys(result.errors))).toEqual(expectedInvalid);
        }
      }),
      RUNS,
    );
  });

  // -------------------------------------------------------------------------
  // Property 3: display contains required information (Req 3.9)
  // -------------------------------------------------------------------------

  it('Property 3 (Req 3.9): formatReward returns a type-matched label, a per-type-unique icon, and the required detail', () => {
    const expectedLabel: Record<Reward['type'], string> = {
      monetary: 'Monetary',
      nonmonetary: 'Nonmonetary',
      volunteer: 'Volunteer',
    };

    // Track the icon used for each type across all samples to prove the three
    // icons are pairwise distinct and stable per type (Req 3.9: "different for
    // each Reward_Type").
    const iconByType: Partial<Record<Reward['type'], string>> = {};

    fc.assert(
      fc.property(reward, (r: Reward) => {
        const { label, icon, detail } = formatReward(r);

        // Label names the type.
        expect(label).toBe(expectedLabel[r.type]);

        // Icon is stable per type.
        if (iconByType[r.type] === undefined) {
          iconByType[r.type] = icon;
        } else {
          expect(icon).toBe(iconByType[r.type]);
        }

        if (r.type === 'monetary') {
          // Detail matches the US-dollar pattern and parses back to the cents.
          expect(detail).toMatch(/^\$[\d,]+\.\d{2}$/);
          const digits = detail.replace(/[$,]/g, ''); // e.g. "150.00"
          const [whole, frac] = digits.split('.');
          const cents = Number(whole) * 100 + Number(frac);
          expect(cents).toBe(r.amountCents);
        } else if (r.type === 'nonmonetary') {
          // Detail contains the humanized kind and the exact description.
          expect(detail).toContain(humanize(r.kind));
          expect(detail).toContain(r.description);
        } else {
          expect(detail).toBe('Volunteer');
        }
      }),
      RUNS,
    );

    // The three icons are pairwise distinct (all three types are generated
    // across 300 runs, so each key is populated).
    const icons = [
      iconByType.monetary,
      iconByType.nonmonetary,
      iconByType.volunteer,
    ];
    expect(icons.every((i) => i !== undefined)).toBe(true);
    expect(new Set(icons).size).toBe(3);
  });
});

/**
 * Property-based test for task form validation in `src/domain/validation.ts`.
 *
 * Covers design Correctness Property 5: Task form validation.
 *
 * Feature: bounty-platform, Property 5: Task form validation
 *
 * Validates: Requirements 2.1, 2.3, 2.4 (and Requirement 3 via the embedded
 * Reward, which a valid task requires).
 *
 * The oracle recomputes the expected set of invalid field keys directly from
 * the raw input and a generated `today`; it never calls `validateTask` or
 * `validateReward` to decide the expected result.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { validateTask, type TaskFormInput } from '../../src/domain/validation';
import {
  LIMITS,
  CATEGORIES,
  NONMONETARY_KINDS,
  REWARD_TYPES,
  isUsState,
} from '../../src/domain/constants';
import type { RewardFormInput } from '../../src/domain/reward';
import { isoDateString, taskFormInput } from './arbitraries';

const RUNS = { numRuns: 200 };

// ---------------------------------------------------------------------------
// Independent reward oracle (mirrors Requirement 3; does not call the SUT)
// ---------------------------------------------------------------------------

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

/** Expected invalid reward field keys (unprefixed), per Requirement 3. */
function oracleRewardInvalid(input: RewardFormInput): Set<string> {
  const bad = new Set<string>();
  const type = input.type.trim();

  if (!(REWARD_TYPES as readonly string[]).includes(type)) {
    bad.add('type');
    return bad;
  }

  if (type === 'monetary') {
    if (!present(input.amount)) {
      bad.add('amount');
    } else {
      const cents = oracleParseDollars(input.amount);
      if (cents === null || cents < LIMITS.amountCents.min || cents > LIMITS.amountCents.max) {
        bad.add('amount');
      }
    }
    if (present(input.kind)) bad.add('kind');
    if (present(input.description)) bad.add('description');
    if (present(input.estimatedValue)) bad.add('estimatedValue');
    return bad;
  }

  if (type === 'nonmonetary') {
    const kind = input.kind.trim();
    if (!(NONMONETARY_KINDS as readonly string[]).includes(kind)) bad.add('kind');
    const description = input.description.trim();
    if (
      description.length < LIMITS.rewardDescription.min ||
      description.length > LIMITS.rewardDescription.max
    ) {
      bad.add('description');
    }
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
    if (present(input.amount)) bad.add('amount');
    return bad;
  }

  // volunteer
  if (present(input.amount)) bad.add('amount');
  if (present(input.kind)) bad.add('kind');
  if (present(input.description)) bad.add('description');
  if (present(input.estimatedValue)) bad.add('estimatedValue');
  return bad;
}

// ---------------------------------------------------------------------------
// Independent task oracle (mirrors Req 2.1 / 2.3 / 2.4)
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function oracleIsRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function trimLen(s: string): number {
  return s.trim().length;
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

/**
 * The full expected invalid-key set for `validateTask`, where reward keys are
 * nested under the `reward.` prefix exactly as the implementation documents.
 */
function oracleTaskInvalid(input: TaskFormInput, today: string): Set<string> {
  const bad = new Set<string>();

  if (!(trimLen(input.title) >= LIMITS.taskTitle.min && trimLen(input.title) <= LIMITS.taskTitle.max)) {
    bad.add('title');
  }
  if (
    !(
      trimLen(input.description) >= LIMITS.taskDescription.min &&
      trimLen(input.description) <= LIMITS.taskDescription.max
    )
  ) {
    bad.add('description');
  }
  if (!(CATEGORIES as readonly string[]).includes(input.category.trim())) {
    bad.add('category');
  }

  const skills = oracleNormalizeSkills(input.skills);
  if (skills.length > LIMITS.taskSkills.maxCount) {
    bad.add('skills');
  } else if (skills.some((s) => s.length < LIMITS.skill.min || s.length > LIMITS.skill.max)) {
    bad.add('skills');
  }

  const rawDeadline = input.deadline.trim();
  if (rawDeadline.length > 0) {
    if (!oracleIsRealIsoDate(rawDeadline)) {
      bad.add('deadline');
    } else if (rawDeadline < today) {
      bad.add('deadline');
    }
  }

  if (!isUsState(input.usState.trim())) bad.add('usState');
  if (!(trimLen(input.town) >= LIMITS.town.min && trimLen(input.town) <= LIMITS.town.max)) {
    bad.add('town');
  }

  for (const key of oracleRewardInvalid(input.reward)) {
    bad.add(`reward.${key}`);
  }

  return bad;
}

describe('validation.ts - validateTask (Property 5)', () => {
  it('Property 5 (Req 2.1, 2.3, 2.4): validateTask.ok iff every task field and the embedded reward are valid, and errors name exactly the failing fields (reward keys under "reward.")', () => {
    fc.assert(
      fc.property(taskFormInput, isoDateString, (input: TaskFormInput, today: string) => {
        const expectedInvalid = oracleTaskInvalid(input, today);
        const expectedOk = expectedInvalid.size === 0;

        const result = validateTask(input, today);
        expect(result.ok).toBe(expectedOk);

        if (!result.ok) {
          // Exact key-set match: no missing keys and no invented keys.
          expect(new Set(Object.keys(result.errors))).toEqual(expectedInvalid);
        }
      }),
      RUNS,
    );
  });

  it('Property 5 (Req 2.1, 2.3, 2.4): explicit example - a fully valid task with a monetary reward passes', () => {
    const input: TaskFormInput = {
      title: 'Build a flyer',
      description: 'We need a one-page promotional flyer for our bakery grand opening.',
      category: 'graphic_design',
      skills: ['Design', 'design', ' Illustrator '],
      reward: { type: 'monetary', amount: '150', kind: '', description: '', estimatedValue: '' },
      deadline: '2099-01-01',
      usState: 'MA',
      town: 'Boston',
    };
    const result = validateTask(input, '2024-01-01');
    expect(result.ok).toBe(true);
  });

  it('Property 5 (Req 2.3): explicit example - a past deadline is reported under "deadline"', () => {
    const input: TaskFormInput = {
      title: 'Valid title',
      description: 'This description is comfortably longer than twenty characters.',
      category: 'writing',
      skills: [],
      reward: { type: 'volunteer', amount: '', kind: '', description: '', estimatedValue: '' },
      deadline: '2020-01-01',
      usState: 'MA',
      town: 'Boston',
    };
    const result = validateTask(input, '2024-06-15');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveProperty('deadline');
  });
});

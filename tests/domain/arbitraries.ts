/**
 * Shared fast-check arbitraries for the reward domain tests (and later domain
 * tests that touch Rewards / reward form input). Kept minimal and pure: these
 * only build values, they never call the functions under test.
 */

import * as fc from 'fast-check';
import {
  LIMITS,
  NONMONETARY_KINDS,
  type NonmonetaryKind,
} from '../../src/domain/constants';
import type { Reward, RewardFormInput } from '../../src/domain/reward';

// ---------------------------------------------------------------------------
// Valid Reward arbitraries (all three variants)
// ---------------------------------------------------------------------------

/** A valid monetary Reward: amountCents in 1..1,000,000. */
export const monetaryReward: fc.Arbitrary<Reward> = fc
  .integer({ min: LIMITS.amountCents.min, max: LIMITS.amountCents.max })
  .map((amountCents) => ({ type: 'monetary', amountCents }));

/** A valid Nonmonetary_Kind. */
export const nonmonetaryKind: fc.Arbitrary<NonmonetaryKind> = fc.constantFrom(
  ...NONMONETARY_KINDS,
);

/**
 * A valid nonmonetary Reward: a valid kind, a trimmed description of length
 * 5..300, and an estimated value that is either null or 0..1,000,000 cents.
 *
 * The description is built so that it is already trimmed (no leading/trailing
 * whitespace) and its length lands in range, so `fromRow(toRow(r))` must return
 * it unchanged.
 */
export const nonmonetaryReward: fc.Arbitrary<Reward> = fc.record({
  type: fc.constant('nonmonetary' as const),
  kind: nonmonetaryKind,
  description: trimmedString(
    LIMITS.rewardDescription.min,
    LIMITS.rewardDescription.max,
  ),
  estimatedValueCents: fc.option(
    fc.integer({
      min: LIMITS.estimatedValueCents.min,
      max: LIMITS.estimatedValueCents.max,
    }),
    { nil: null },
  ),
});

/** A valid volunteer Reward: no other fields. */
export const volunteerReward: fc.Arbitrary<Reward> = fc.constant({
  type: 'volunteer',
});

/** Any valid Reward across all three variants. */
export const reward: fc.Arbitrary<Reward> = fc.oneof(
  monetaryReward,
  nonmonetaryReward,
  volunteerReward,
);

/**
 * A non-empty string of the given trimmed length range that neither starts nor
 * ends with whitespace, so it survives a `.trim()` unchanged. Uses visible
 * printable characters only.
 */
export function trimmedString(
  minLength: number,
  maxLength: number,
): fc.Arbitrary<string> {
  // Printable, non-whitespace-edged content. Internal spaces are allowed but
  // the first and last chars are drawn from a non-space set.
  const edgeChar = fc.char().filter((c) => c.trim() === c && c.length === 1);
  const midChar = fc.char();
  return fc
    .tuple(
      edgeChar,
      fc.array(midChar, { minLength: Math.max(0, minLength - 2), maxLength: Math.max(0, maxLength - 2) }),
      edgeChar,
    )
    .map(([first, middle, last]) => first + middle.join('') + last)
    .filter((s) => {
      const t = s.trim();
      return t === s && t.length >= minLength && t.length <= maxLength;
    });
}

// ---------------------------------------------------------------------------
// RewardFormInput arbitraries (valid + mutated), for validation testing
// ---------------------------------------------------------------------------

/** An empty reward form (all fields blank). */
export function emptyForm(): RewardFormInput {
  return { type: '', amount: '', kind: '', description: '', estimatedValue: '' };
}

/**
 * A dollar-amount string arbitrary covering well-formed and malformed shapes:
 * plain integers, 1-2 decimal places, optional leading "$", plus junk like
 * commas, 3+ decimals, signs, and non-numeric text. The oracle in the test
 * decides which of these are actually valid.
 */
export const amountString: fc.Arbitrary<string> = fc.oneof(
  // Well-formed-ish: integer dollars, optionally with "$" and 0-3 decimals.
  fc
    .tuple(
      fc.boolean(),
      fc.integer({ min: 0, max: 20000 }),
      fc.option(fc.integer({ min: 0, max: 999 }), { nil: null }),
    )
    .map(([dollar, whole, frac]) => {
      const prefix = dollar ? '$' : '';
      return frac === null ? `${prefix}${whole}` : `${prefix}${whole}.${frac}`;
    }),
  // Comma-grouped (should be rejected).
  fc.constantFrom('1,000', '$1,000.00', '10,000.00'),
  // Signed / junk / empty / whitespace.
  fc.constantFrom('-5', '+5', '', '   ', 'abc', '$', '1.', '.5', '1.234', '5e2', '1 000'),
);

/** A kind string arbitrary: valid kinds plus junk. */
export const kindString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...NONMONETARY_KINDS),
  fc.constantFrom('', 'Product', 'gift', 'money', 'nonmonetary'),
);

/** A description string arbitrary of any length (too short, in range, too long). */
export const descriptionString: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 4 }), // likely too short after trim
  trimmedString(LIMITS.rewardDescription.min, LIMITS.rewardDescription.max), // in range
  fc.string({ minLength: 301, maxLength: 320 }), // too long
  fc.constantFrom('', '   ', '  abc  '),
);

/** A type string arbitrary: valid types plus junk / empty. */
export const typeString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('monetary', 'nonmonetary', 'volunteer'),
  fc.constantFrom('', '  ', 'Monetary', 'cash', 'both', 'money'),
);

/**
 * A broadly-mutated RewardFormInput: every field is drawn independently from a
 * mix of valid and invalid values, so the generated space includes well-formed
 * rewards of every type as well as foreign-field, out-of-range, and
 * wrong-type mutations. The test's oracle recomputes expected validity.
 */
export const rewardFormInput: fc.Arbitrary<RewardFormInput> = fc.record({
  type: typeString,
  amount: fc.oneof(fc.constant(''), amountString),
  kind: fc.oneof(fc.constant(''), kindString),
  description: fc.oneof(fc.constant(''), descriptionString),
  estimatedValue: fc.oneof(fc.constant(''), amountString),
});
// ===========================================================================
// Shared arbitraries for validation.ts property tests (Properties 4, 5, 6, 7)
// ===========================================================================
//
// These build RAW form inputs mixing valid and invalid values across the whole
// input space. The test oracles recompute expected validity from the raw input
// per the requirements; the arbitraries never call the functions under test.

import {
  AGE_BRACKETS,
  CATEGORIES,
  US_STATES,
} from '../../src/domain/constants';
import type {
  ProfileInput,
  SignUpInput,
  TaskFormInput,
} from '../../src/domain/validation';

// ---------------------------------------------------------------------------
// Generic length-controlled strings (may have whitespace at the edges)
// ---------------------------------------------------------------------------

/**
 * A string whose length (before trimming) lands in `[minLength, maxLength]`.
 * Characters come from the full fast-check char set, so results can include
 * leading/trailing whitespace, internal spaces, and odd code points. The test
 * oracle decides validity by trimming, exactly as the implementation does.
 */
export function rawString(minLength: number, maxLength: number): fc.Arbitrary<string> {
  return fc.string({ minLength, maxLength });
}

/** A string that is empty or whitespace-only (trims to length 0). */
export const blankString: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 6 }),
);

/**
 * A string with controlled TRIMMED length: it adds random whitespace padding
 * around a visible core whose length is `coreLen`, so the trimmed length is
 * exactly `coreLen`. Useful for probing length boundaries where the rule counts
 * the trimmed length.
 */
export function trimmedLenExactly(coreLen: number): fc.Arbitrary<string> {
  if (coreLen <= 0) return blankString;
  const core = fc
    .array(
      fc.char().filter((c) => c.trim().length === 1),
      { minLength: coreLen, maxLength: coreLen },
    )
    .map((cs) => cs.join(''));
  const pad = fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 3 });
  return fc.tuple(pad, core, pad).map(([a, c, b]) => a + c + b);
}

// ---------------------------------------------------------------------------
// US state / category / age bracket strings (valid values + junk)
// ---------------------------------------------------------------------------

const VALID_STATE_CODES = US_STATES.map((s) => s.code);

/** A state-code string: a valid code (sometimes space-padded) or junk. */
export const stateString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...VALID_STATE_CODES),
  fc.constantFrom(...VALID_STATE_CODES).map((c) => `  ${c} `),
  fc.constantFrom('', 'ma', 'ZZ', 'Massachusetts', 'XX', '  ', 'USA'),
);

/** A category string: a valid category (sometimes space-padded) or junk. */
export const categoryString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...CATEGORIES),
  fc.constantFrom(...CATEGORIES).map((c) => ` ${c}  `),
  fc.constantFrom('', 'Website', 'misc', 'graphicdesign', '  ', 'design'),
);

/** An age-bracket string: valid stored brackets, the blocked "Under 13", or junk. */
export const ageBracketString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...AGE_BRACKETS),
  fc.constantFrom(...AGE_BRACKETS).map((b) => ` ${b} `),
  fc.constantFrom('Under 13', 'under 13', '12', '', '  ', '0-12', '18'),
);

// ---------------------------------------------------------------------------
// Email strings (valid shapes + many invalid shapes) - Req 1.1
// ---------------------------------------------------------------------------

/** A well-formed email per Req 1.1 (one '@', label before, dotted domain after). */
const validEmail: fc.Arbitrary<string> = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 12,
    }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 10,
    }),
    fc.constantFrom('com', 'org', 'net', 'io', 'co.uk'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** An email string arbitrary mixing valid and many invalid shapes. */
export const emailString: fc.Arbitrary<string> = fc.oneof(
  validEmail,
  // Space-padded valid (implementation trims the email before checking).
  validEmail.map((e) => `  ${e} `),
  // Too long (> 254).
  fc
    .integer({ min: 255, max: 300 })
    .map((n) => `${'a'.repeat(n - 6)}@d.com`),
  // No '@'.
  fc.constantFrom('plainaddress', 'a.b.c', 'nope'),
  // Multiple '@'.
  fc.constantFrom('a@b@c.com', 'x@@y.com'),
  // Nothing before '@'.
  fc.constantFrom('@domain.com', ' @d.com'),
  // Domain without a dot, or dot at an edge of the domain.
  fc.constantFrom('a@domain', 'a@domaincom', 'a@.com', 'a@com.', 'a@.'),
  // Empty.
  fc.constant(''),
);

// ---------------------------------------------------------------------------
// Password strings (raw length boundaries; NOT trimmed) - Req 1.1
// ---------------------------------------------------------------------------

/**
 * A password string with raw lengths spanning the 8..72 boundary, deliberately
 * including leading/trailing spaces (which count: passwords are not trimmed).
 */
export const passwordString: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 7 }), // too short
  fc.string({ minLength: 8, maxLength: 72 }), // in range
  fc.string({ minLength: 73, maxLength: 90 }), // too long
  // Spaces that matter for the raw-length check (e.g. "       " is length 7).
  fc.stringOf(fc.constantFrom(' '), { minLength: 6, maxLength: 9 }),
  fc.constantFrom('       ', '        ', '12345678'),
);

// ---------------------------------------------------------------------------
// Skill-list strings - Req 1.12, 2.8
// ---------------------------------------------------------------------------

/** A single raw skill entry: in-range, too long, blank, or edge-padded. */
const skillEntry: fc.Arbitrary<string> = fc.oneof(
  trimmedLenExactly(1),
  trimmedLenExactly(10),
  trimmedLenExactly(40),
  fc.string({ minLength: 41, maxLength: 60 }), // likely too long after trim
  blankString,
  // Case/whitespace variants that collide after normalization.
  fc.constantFrom('React', 'react', '  REACT ', 'Node', 'node', ' node '),
);

/** A raw skill list of 0..13 entries (spans the 10 / 20 count limits). */
export function skillListArb(maxCount: number): fc.Arbitrary<string[]> {
  return fc.array(skillEntry, { minLength: 0, maxLength: maxCount });
}

/**
 * A broad raw string list for `normalizeSkills` (Property 4): includes empties,
 * whitespace-only, surrounding spaces, case variants, and duplicates.
 */
export const normalizeSkillsInput: fc.Arbitrary<string[]> = fc.array(
  fc.oneof(
    fc.constantFrom(
      'React',
      'react',
      ' REACT ',
      '\tReact\t',
      'node',
      'Node',
      ' node ',
      'TypeScript',
      'typescript',
      '',
      '   ',
      '\n',
      'a',
      ' a ',
      'A',
    ),
    fc.string({ minLength: 0, maxLength: 8 }),
  ),
  { minLength: 0, maxLength: 15 },
);

// ---------------------------------------------------------------------------
// Deadline strings - Req 2.3
// ---------------------------------------------------------------------------

/** A YYYY-MM-DD date string arbitrary (real calendar dates, 2000-2099). */
export const isoDateString: fc.Arbitrary<string> = fc
  .date({ min: new Date(Date.UTC(2000, 0, 1)), max: new Date(Date.UTC(2099, 11, 31)) })
  .map((d) => d.toISOString().slice(0, 10));

/** A deadline string: empty, a valid ISO date, or a malformed/invalid date. */
export const deadlineString: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''), // no deadline
  isoDateString, // real date (may be before or after `today`)
  isoDateString.map((d) => `  ${d} `), // space-padded real date
  fc.constantFrom(
    '2024-13-01', // bad month
    '2024-02-30', // bad day
    '2024-00-10', // bad month
    '2024-1-1', // wrong shape
    '24-01-01', // wrong shape
    'not-a-date',
    '2024/01/01',
  ),
);

// ---------------------------------------------------------------------------
// Composite form-input arbitraries
// ---------------------------------------------------------------------------

/** A broadly-mutated SignUpInput (every field independently valid-or-not). */
export const signUpInput: fc.Arbitrary<SignUpInput> = fc.record({
  email: emailString,
  password: passwordString,
  displayName: fc.oneof(trimmedLenExactly(1), trimmedLenExactly(50), fc.string({ minLength: 51, maxLength: 60 }), blankString),
  ageBracket: ageBracketString,
  usState: stateString,
  town: fc.oneof(trimmedLenExactly(2), trimmedLenExactly(60), trimmedLenExactly(1), fc.string({ minLength: 61, maxLength: 70 }), blankString),
});

/** A broadly-mutated ProfileInput (no ageBracket; adds bio + skills). */
export const profileInput: fc.Arbitrary<ProfileInput> = fc.record({
  displayName: fc.oneof(trimmedLenExactly(1), trimmedLenExactly(50), fc.string({ minLength: 51, maxLength: 60 }), blankString),
  bio: fc.oneof(blankString, trimmedLenExactly(250), trimmedLenExactly(500), fc.string({ minLength: 501, maxLength: 520 })),
  skills: skillListArb(22),
  usState: stateString,
  town: fc.oneof(trimmedLenExactly(2), trimmedLenExactly(60), trimmedLenExactly(1), fc.string({ minLength: 61, maxLength: 70 }), blankString),
});

/** A broadly-mutated TaskFormInput, reusing the reward form arbitrary. */
export const taskFormInput: fc.Arbitrary<TaskFormInput> = fc.record({
  title: fc.oneof(trimmedLenExactly(5), trimmedLenExactly(100), trimmedLenExactly(4), fc.string({ minLength: 101, maxLength: 110 }), blankString),
  description: fc.oneof(trimmedLenExactly(20), trimmedLenExactly(3000), trimmedLenExactly(19), fc.string({ minLength: 3001, maxLength: 3010 }), blankString),
  category: categoryString,
  skills: skillListArb(13),
  reward: rewardFormInput,
  deadline: deadlineString,
  usState: stateString,
  town: fc.oneof(trimmedLenExactly(2), trimmedLenExactly(60), trimmedLenExactly(1), fc.string({ minLength: 61, maxLength: 70 }), blankString),
});

// ---------------------------------------------------------------------------
// Submission / URL arbitraries - Req 7.1, 7.2, 7.7, 10.4
// ---------------------------------------------------------------------------

/** A valid http(s) URL (scheme, non-empty host, well under 2048 chars). */
const validHttpUrl: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('http', 'https'),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 15,
    }),
    fc.constantFrom('com', 'org', 'net', 'io'),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789/-_'), {
      minLength: 0,
      maxLength: 20,
    }),
  )
  .map(([scheme, host, tld, path]) => `${scheme}://${host}.${tld}/${path}`);

/** A single raw URL entry: valid http(s), wrong scheme, garbage, or overlong. */
export const urlEntry: fc.Arbitrary<string> = fc.oneof(
  validHttpUrl,
  validHttpUrl.map((u) => `  ${u}  `), // space-padded valid (trimmed before check)
  // Non-http schemes (must be rejected by isHttpUrl).
  fc.constantFrom(
    'mailto:someone@example.com',
    'javascript:alert(1)',
    'ftp://files.example.com/x',
    'file:///etc/passwd',
    'data:text/plain,hi',
  ),
  // Relative / garbage (URL parser rejects or no scheme).
  fc.constantFrom('example.com', '/relative/path', 'notaurl', '', '   ', 'http://'),
  // Overlong (> 2048) but otherwise http.
  fc.integer({ min: 2049, max: 2100 }).map((n) => `https://a.com/${'x'.repeat(n - 15)}`),
);

/** A raw URL list of 0..7 entries (spans the 1..5 count limit). */
export const urlListArb: fc.Arbitrary<string[]> = fc.array(urlEntry, {
  minLength: 0,
  maxLength: 7,
});

/** A broadly-mutated submission input. */
export const submissionInput: fc.Arbitrary<{ description: string; urls: string[] }> =
  fc.record({
    description: fc.oneof(
      blankString,
      trimmedLenExactly(10),
      trimmedLenExactly(2000),
      trimmedLenExactly(9),
      fc.string({ minLength: 2001, maxLength: 2010 }),
    ),
    urls: urlListArb,
  });

// ===========================================================================
// Shared arbitraries for the state-machine property tests (Properties 8-16)
// ===========================================================================
//
// These build values only; they never call reduce/rewardTransition/filterTasks/
// nextActionLabel. The task-machine generators deliberately produce a mix of
// VALID and INVALID requests so rejection paths (Property 11) are exercised.

import {
  REWARD_TYPES as _REWARD_TYPES,
  TASK_STATUSES as _TASK_STATUSES,
  REWARD_STATUSES as _REWARD_STATUSES,
  type RewardType,
  type RewardStatus,
  type TaskStatus,
  type UsState,
  type Category,
} from '../../src/domain/constants';
import type {
  Request as TaskRequest,
  TaskModel,
} from '../../src/domain/taskMachine';
import type { TaskSummary, BrowseFilters } from '../../src/domain/browse';
import type { RewardAction, RewardContext } from '../../src/domain/rewardMachine';
import type { DashboardTask } from '../../src/domain/nextAction';

// ---------------------------------------------------------------------------
// Fixed member pool (small so apply/accept collisions actually happen)
// ---------------------------------------------------------------------------

/** The fixed Member id pool shared by model + request generators. */
export const MEMBER_POOL = ['m1', 'm2', 'm3', 'm4', 'm5'] as const;

/** A Member id drawn from the fixed pool. */
export const memberId: fc.Arbitrary<string> = fc.constantFrom(...MEMBER_POOL);

/** Two distinct state codes used so "same state" and "different state" both occur. */
const STATE_POOL: readonly UsState[] = ['MA', 'CA', 'NY', 'TX'] as const;

/** A US state drawn from a small pool (so same/different-state cases collide). */
export const poolState: fc.Arbitrary<UsState> = fc.constantFrom(...STATE_POOL);

/** A Reward_Type value. */
export const rewardTypeArb: fc.Arbitrary<RewardType> = fc.constantFrom(..._REWARD_TYPES);

// ---------------------------------------------------------------------------
// taskModel: a VALID initial TaskModel (status 'open', correct reward status)
// ---------------------------------------------------------------------------

/**
 * A valid initial `TaskModel`:
 * - random creator drawn from the pool, random Task US_State;
 * - random Reward_Type, with `amountCents` 1..1,000,000 when monetary else null;
 * - Reward_Status `not_applicable` for volunteer, `pending` otherwise (Req 9.1);
 * - status `open`, no assignee, no applications, no payments;
 * - a `profiles` map covering the creator plus the whole member pool, each with
 *   a random state from the pool (some match the Task state, some do not) so the
 *   same-state apply/accept rules are exercised.
 */
export const taskModel: fc.Arbitrary<TaskModel> = fc
  .record({
    creatorId: memberId,
    usState: poolState,
    rewardType: rewardTypeArb,
    amountCents: fc.integer({ min: 1, max: 1_000_000 }),
    profileStates: fc.record(
      Object.fromEntries(MEMBER_POOL.map((id) => [id, poolState])) as Record<
        (typeof MEMBER_POOL)[number],
        fc.Arbitrary<UsState>
      >,
    ),
  })
  .map(({ creatorId, usState, rewardType, amountCents, profileStates }) => {
    const profiles: Record<string, { usState: UsState }> = {};
    for (const id of MEMBER_POOL) {
      profiles[id] = { usState: profileStates[id] };
    }
    const rewardStatus: RewardStatus =
      rewardType === 'volunteer' ? 'not_applicable' : 'pending';
    const model: TaskModel = {
      creatorId,
      usState,
      status: 'open',
      assigneeId: null,
      rewardType,
      rewardStatus,
      amountCents: rewardType === 'monetary' ? amountCents : null,
      applications: [],
      payments: [],
      profiles,
    };
    return model;
  });

// ---------------------------------------------------------------------------
// request: one Request of any kind (valid actors + occasionally bogus app ids)
// ---------------------------------------------------------------------------

/**
 * An application id a `reduce('accept')` might reference: plausible ids
 * (`app-1`..`app-5`) that may exist on the model, plus occasional bogus ids so
 * the NOT_FOUND path is exercised.
 */
const applicationIdArb: fc.Arbitrary<string> = fc.constantFrom(
  'app-1',
  'app-2',
  'app-3',
  'app-4',
  'app-5',
  'app-bogus',
);

/**
 * One `Request` of every kind, with `actor` drawn from the member pool. Invalid
 * combinations (wrong actor, wrong status, bogus application id) are EXPECTED:
 * they exercise the rejection paths the invariants must survive.
 */
export const request: fc.Arbitrary<TaskRequest> = fc.oneof(
  memberId.map((actor): TaskRequest => ({ kind: 'apply', actor })),
  fc
    .tuple(memberId, applicationIdArb)
    .map(([actor, applicationId]): TaskRequest => ({ kind: 'accept', actor, applicationId })),
  memberId.map((actor): TaskRequest => ({ kind: 'submit', actor })),
  memberId.map((actor): TaskRequest => ({ kind: 'confirm', actor })),
  memberId.map((actor): TaskRequest => ({ kind: 'cancel', actor })),
  memberId.map((actor): TaskRequest => ({ kind: 'pay', actor })),
  memberId.map((actor): TaskRequest => ({ kind: 'markDelivered', actor })),
  memberId.map((actor): TaskRequest => ({ kind: 'confirmReceived', actor })),
);

/** A sequence of 1..20 requests (Req 12.3). */
export const requestSequence: fc.Arbitrary<TaskRequest[]> = fc.array(request, {
  minLength: 1,
  maxLength: 20,
});

// ---------------------------------------------------------------------------
// Browse arbitraries (Property 8)
// ---------------------------------------------------------------------------

const BROWSE_CATEGORIES: readonly Category[] = [
  'website',
  'spreadsheet',
  'graphic_design',
  'programming',
  'writing',
  'social_media',
  'other',
] as const;

/** A small pool of towns so the Town contains-filter matches sometimes. */
const TOWN_POOL = ['Boston', 'Cambridge', 'Springfield', 'Austin', 'Albany'] as const;

/** A small keyword/field-word pool shared between content and the keyword filter. */
const WORD_POOL = ['logo', 'website', 'spreadsheet', 'react', 'design', 'flyer'] as const;

/** A short field string built from the shared word pool (so keyword hits occur). */
const fieldText: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...WORD_POOL), { minLength: 1, maxLength: 3 })
  .map((ws) => ws.join(' '));

/** A single TaskSummary across statuses/states/categories/reward types. */
export const taskSummary: fc.Arbitrary<TaskSummary> = fc.record({
  id: fc.integer({ min: 1, max: 9999 }).map((n) => `task-${n}`),
  usState: poolState,
  status: fc.constantFrom(..._TASK_STATUSES) as fc.Arbitrary<TaskStatus>,
  category: fc.constantFrom(...BROWSE_CATEGORIES),
  rewardType: rewardTypeArb,
  title: fieldText,
  description: fieldText,
  skills: fc.array(fc.constantFrom(...WORD_POOL), { minLength: 0, maxLength: 3 }),
  town: fc.constantFrom(...TOWN_POOL),
  createdAt: fc
    .date({ min: new Date(Date.UTC(2020, 0, 1)), max: new Date(Date.UTC(2025, 11, 31)) })
    .map((d) => d.toISOString()),
});

/** A list of 0..12 task summaries. */
export const taskSummaryList: fc.Arbitrary<TaskSummary[]> = fc.array(taskSummary, {
  minLength: 0,
  maxLength: 12,
});

/**
 * A BrowseFilters value. `usState` is sometimes null (Req 4.2); town/keyword
 * mix empty/whitespace (inactive) with pool values that can match task content;
 * category/rewardType are sometimes undefined (inactive).
 */
export const browseFilters: fc.Arbitrary<BrowseFilters> = fc
  .record({
    usState: fc.option(poolState, { nil: null }),
    town: fc.option(
      fc.oneof(fc.constantFrom(...TOWN_POOL), fc.constantFrom('', '   ', 'bos', 'cam')),
      { nil: undefined },
    ),
    category: fc.option(fc.constantFrom(...BROWSE_CATEGORIES), { nil: undefined }),
    rewardType: fc.option(rewardTypeArb, { nil: undefined }),
    keyword: fc.option(
      fc.oneof(fc.constantFrom(...WORD_POOL), fc.constantFrom('', '  ', 'LOGO', 'Design')),
      { nil: undefined },
    ),
  })
  .map((r) => {
    // Build the filter object omitting inactive optional keys entirely, so it
    // conforms to BrowseFilters under exactOptionalPropertyTypes.
    const f: BrowseFilters = { usState: r.usState };
    if (r.town !== undefined) f.town = r.town;
    if (r.category !== undefined) f.category = r.category;
    if (r.rewardType !== undefined) f.rewardType = r.rewardType;
    if (r.keyword !== undefined) f.keyword = r.keyword;
    return f;
  });

// ---------------------------------------------------------------------------
// Reward machine arbitraries (Property 15)
// ---------------------------------------------------------------------------

/** A reward-settlement action. */
export const rewardAction: fc.Arbitrary<RewardAction> = fc.constantFrom(
  'pay',
  'markDelivered',
  'confirmReceived',
);

/**
 * A RewardContext spanning all reward types/statuses and task statuses, with
 * creator/assignee drawn from the pool (assignee sometimes null).
 */
export const rewardContext: fc.Arbitrary<RewardContext> = fc.record({
  rewardType: rewardTypeArb,
  rewardStatus: fc.constantFrom(..._REWARD_STATUSES) as fc.Arbitrary<RewardStatus>,
  taskStatus: fc.constantFrom(..._TASK_STATUSES) as fc.Arbitrary<string>,
  creatorId: memberId,
  assigneeId: fc.option(memberId, { nil: null }),
});

/** A sequence of 1..20 (action, actor) steps for the reward machine. */
export const rewardStepSequence: fc.Arbitrary<{ action: RewardAction; actor: string }[]> =
  fc.array(fc.record({ action: rewardAction, actor: memberId }), {
    minLength: 1,
    maxLength: 20,
  });

// ---------------------------------------------------------------------------
// Dashboard next-action arbitraries (Property 16)
// ---------------------------------------------------------------------------

/**
 * A DashboardTask across every status/reward combination, with creator and
 * assignee drawn from the pool (assignee sometimes null) and a pending count of
 * 0..3 so the "Review applicants" threshold is both met and missed.
 */
export const dashboardTask: fc.Arbitrary<DashboardTask> = fc.record({
  creatorId: memberId,
  assigneeId: fc.option(memberId, { nil: null }),
  status: fc.constantFrom(..._TASK_STATUSES) as fc.Arbitrary<TaskStatus>,
  rewardType: rewardTypeArb,
  rewardStatus: fc.constantFrom(..._REWARD_STATUSES) as fc.Arbitrary<RewardStatus>,
  pendingApplicationCount: fc.integer({ min: 0, max: 3 }),
});

/** The dashboard list kind. */
export const listKind: fc.Arbitrary<'posted' | 'working'> = fc.constantFrom(
  'posted',
  'working',
);

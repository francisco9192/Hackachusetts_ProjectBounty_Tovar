/**
 * Reward domain rules: the single source of truth for how a Task's Reward is
 * validated, stored, read back, and displayed. The trusted backend mirrors
 * these rules as CHECK constraints and trigger logic; this module lets the UI
 * validate instantly and lets the rules be property-tested offline.
 *
 * This module is PURE: no network, no storage, no `Date.now`. Money is always
 * kept as integer cents, never as a float, so the round trip is exact
 * (Req 3.10).
 *
 * _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
 */

import {
  LIMITS,
  NONMONETARY_KINDS,
  REWARD_TYPES,
  isNonmonetaryKind,
  isRewardType,
  type NonmonetaryKind,
} from './constants';
import { humanize } from './labels';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * The outcome of a pure validation. On success it carries the parsed value; on
 * failure it carries one plain-language message per invalid field, keyed by
 * field name. Other domain modules import `Result` from here.
 *
 * Validation never throws: callers branch on `ok`.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

// ---------------------------------------------------------------------------
// Domain Reward (discriminated union) and its storage / form shapes
// ---------------------------------------------------------------------------

/**
 * A validated Reward. Exactly one `type` is present and only the fields that
 * belong to that type exist, so an impossible combination (e.g. a monetary
 * reward with a description) cannot be represented.
 *
 * - `monetary`: an amount in integer cents (1..1,000,000 => $0.01..$10,000.00).
 * - `nonmonetary`: a kind, a trimmed description, and an optional estimated
 *   value in integer cents (`null` when none was given).
 * - `volunteer`: no other fields.
 */
export type Reward =
  | { type: 'monetary'; amountCents: number }
  | {
      type: 'nonmonetary';
      kind: NonmonetaryKind;
      description: string;
      estimatedValueCents: number | null;
    }
  | { type: 'volunteer' };

/**
 * Raw, unparsed reward fields exactly as the task form collects them. Every
 * field is a string (the UI holds text inputs and `<select>` values), so
 * `validateReward` is responsible for parsing and range-checking. Fields that
 * do not belong to the chosen type are expected to be empty strings; a
 * non-empty foreign field is a validation error (Req 3.7).
 */
export interface RewardFormInput {
  /** Chosen Reward_Type: expected to be `'monetary' | 'nonmonetary' | 'volunteer'`. */
  type: string;
  /** Dollar amount for a monetary reward, e.g. `"150"` or `"19.99"`. */
  amount: string;
  /** Nonmonetary_Kind for a nonmonetary reward. */
  kind: string;
  /** Reward description for a nonmonetary reward (trimmed before length checks). */
  description: string;
  /** Optional estimated dollar value for a nonmonetary reward; `""` means none. */
  estimatedValue: string;
}

/**
 * The reward-related columns of the `tasks` row, matching the database schema.
 * A field that does not apply to the reward type is `null`. `toRow`/`fromRow`
 * convert between this shape and {@link Reward}.
 */
export interface RewardRow {
  reward_type: string;
  amount_cents: number | null;
  nonmonetary_kind: string | null;
  reward_description: string | null;
  estimated_value_cents: number | null;
}

// ---------------------------------------------------------------------------
// parseDollars
// ---------------------------------------------------------------------------

/**
 * Parse a US-dollar string into an exact integer number of cents, or return
 * `null` when the string is not a well-formed dollar amount.
 *
 * Accepted format (strict): an optional single leading `$`, then one or more
 * digits for the whole-dollar part, then an optional decimal point followed by
 * one or two digits. No thousands separators (commas), no sign, no whitespace
 * other than what the caller trims, no exponent. Examples that parse:
 * `"150"` -> 15000, `"150.5"` -> 15050, `"19.99"` -> 1999, `"$0.01"` -> 1,
 * `"0"` -> 0, `"$10000"` -> 1000000.
 *
 * Returns `null` for: empty/whitespace-only input, non-numeric text, a negative
 * sign, commas, more than two decimal digits, a trailing/leading decimal point
 * with nothing on one side, or anything the pattern does not match. Because the
 * whole and fractional parts are parsed as integers from their digit strings
 * (never `parseFloat(s) * 100`), the conversion is exact and free of binary
 * floating-point rounding error.
 */
export function parseDollars(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;

  // Optional leading "$", whole digits, optional "." + 1-2 fractional digits.
  const match = /^\$?(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (match === null) return null;

  const whole = Number(match[1]);
  // Pad the fractional part to exactly two digits ("5" -> "50", "" -> "00").
  const fractionDigits = (match[2] ?? '').padEnd(2, '0');
  const fraction = Number(fractionDigits);

  const cents = whole * 100 + fraction;
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

// ---------------------------------------------------------------------------
// validateReward
// ---------------------------------------------------------------------------

/** True when a raw form field is present and non-empty after trimming. */
function isPresent(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validate raw reward form input against Requirement 3 and return a typed
 * {@link Reward} on success. On failure, `errors` holds one message per invalid
 * field, keyed by the field names `'type'`, `'amount'`, `'kind'`,
 * `'description'`, and `'estimatedValue'`.
 *
 * Rules enforced:
 * - Exactly one valid Reward_Type (Req 3.1, 3.2).
 * - Monetary requires a numeric amount $0.01..$10,000.00 with at most two
 *   decimals, and no nonmonetary fields (Req 3.3, 3.7).
 * - Nonmonetary requires one valid kind and a trimmed description 5..300, with
 *   an optional estimated value $0.00..$10,000.00 (empty -> `null`), and no
 *   amount (Req 3.4, 3.5, 3.7).
 * - Volunteer carries no other fields; any present foreign field is an error
 *   (Req 3.6, 3.7).
 */
export function validateReward(input: RewardFormInput): Result<Reward> {
  const errors: Record<string, string> = {};
  const type = input.type.trim();

  if (!isRewardType(type)) {
    errors.type =
      type.length === 0
        ? 'Select a reward type.'
        : `Reward type must be one of ${REWARD_TYPES.join(', ')}.`;
    // Without a known type we cannot judge which other fields are "foreign",
    // so report only the type error.
    return { ok: false, errors };
  }

  if (type === 'monetary') {
    // Amount is required and must parse to cents within range.
    if (!isPresent(input.amount)) {
      errors.amount = 'Enter a dollar amount.';
    } else {
      const cents = parseDollars(input.amount);
      if (cents === null) {
        errors.amount =
          'Enter a valid dollar amount with at most 2 decimal places.';
      } else if (cents < LIMITS.amountCents.min || cents > LIMITS.amountCents.max) {
        errors.amount = 'Amount must be between $0.01 and $10,000.00.';
      }
    }
    // Nonmonetary fields do not belong to a monetary reward (Req 3.7).
    if (isPresent(input.kind)) {
      errors.kind = 'A monetary reward cannot have a kind.';
    }
    if (isPresent(input.description)) {
      errors.description = 'A monetary reward cannot have a description.';
    }
    if (isPresent(input.estimatedValue)) {
      errors.estimatedValue = 'A monetary reward cannot have an estimated value.';
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    // Safe: amount validated above.
    return { ok: true, value: { type: 'monetary', amountCents: parseDollars(input.amount)! } };
  }

  if (type === 'nonmonetary') {
    const kind = input.kind.trim();
    if (!isNonmonetaryKind(kind)) {
      errors.kind =
        kind.length === 0
          ? 'Select a reward kind.'
          : `Kind must be one of ${NONMONETARY_KINDS.join(', ')}.`;
    }

    const description = input.description.trim();
    if (description.length < LIMITS.rewardDescription.min ||
        description.length > LIMITS.rewardDescription.max) {
      errors.description = `Description must be ${LIMITS.rewardDescription.min} to ${LIMITS.rewardDescription.max} characters.`;
    }

    // Estimated value is optional; empty -> null. When present it must parse
    // and sit within $0.00..$10,000.00.
    let estimatedValueCents: number | null = null;
    if (isPresent(input.estimatedValue)) {
      const cents = parseDollars(input.estimatedValue);
      if (cents === null) {
        errors.estimatedValue =
          'Enter a valid dollar amount with at most 2 decimal places.';
      } else if (
        cents < LIMITS.estimatedValueCents.min ||
        cents > LIMITS.estimatedValueCents.max
      ) {
        errors.estimatedValue = 'Estimated value must be between $0.00 and $10,000.00.';
      } else {
        estimatedValueCents = cents;
      }
    }

    // A monetary amount does not belong to a nonmonetary reward (Req 3.7).
    if (isPresent(input.amount)) {
      errors.amount = 'A nonmonetary reward cannot have an amount.';
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
      ok: true,
      value: {
        type: 'nonmonetary',
        kind: kind as NonmonetaryKind,
        description,
        estimatedValueCents,
      },
    };
  }

  // type === 'volunteer': no other field may be present (Req 3.6, 3.7).
  if (isPresent(input.amount)) {
    errors.amount = 'A volunteer reward cannot have an amount.';
  }
  if (isPresent(input.kind)) {
    errors.kind = 'A volunteer reward cannot have a kind.';
  }
  if (isPresent(input.description)) {
    errors.description = 'A volunteer reward cannot have a description.';
  }
  if (isPresent(input.estimatedValue)) {
    errors.estimatedValue = 'A volunteer reward cannot have an estimated value.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { type: 'volunteer' } };
}

// ---------------------------------------------------------------------------
// toRow / fromRow (exact round trip, Req 3.10)
// ---------------------------------------------------------------------------

/**
 * Convert a validated {@link Reward} to its database row shape. Fields that do
 * not apply to the reward type are `null`, matching the table CHECK constraint.
 */
export function toRow(r: Reward): RewardRow {
  switch (r.type) {
    case 'monetary':
      return {
        reward_type: 'monetary',
        amount_cents: r.amountCents,
        nonmonetary_kind: null,
        reward_description: null,
        estimated_value_cents: null,
      };
    case 'nonmonetary':
      return {
        reward_type: 'nonmonetary',
        amount_cents: null,
        nonmonetary_kind: r.kind,
        reward_description: r.description,
        estimated_value_cents: r.estimatedValueCents,
      };
    case 'volunteer':
      return {
        reward_type: 'volunteer',
        amount_cents: null,
        nonmonetary_kind: null,
        reward_description: null,
        estimated_value_cents: null,
      };
  }
}

/**
 * Rebuild a {@link Reward} from a database row. This is the exact inverse of
 * {@link toRow} for any row that `toRow` could have produced, so
 * `fromRow(toRow(r))` deep-equals `r` (Req 3.10).
 *
 * Rows come from our own trusted DB/validator, so a malformed row is a
 * programming error: this function throws a clear `Error` naming the problem
 * rather than guessing a value.
 */
export function fromRow(row: RewardRow): Reward {
  switch (row.reward_type) {
    case 'monetary':
      if (row.amount_cents === null) {
        throw new Error('Malformed reward row: monetary reward has no amount_cents.');
      }
      return { type: 'monetary', amountCents: row.amount_cents };
    case 'nonmonetary':
      if (row.nonmonetary_kind === null || !isNonmonetaryKind(row.nonmonetary_kind)) {
        throw new Error('Malformed reward row: nonmonetary reward has an invalid kind.');
      }
      if (row.reward_description === null) {
        throw new Error('Malformed reward row: nonmonetary reward has no description.');
      }
      return {
        type: 'nonmonetary',
        kind: row.nonmonetary_kind,
        description: row.reward_description,
        estimatedValueCents: row.estimated_value_cents,
      };
    case 'volunteer':
      return { type: 'volunteer' };
    default:
      throw new Error(`Malformed reward row: unknown reward_type "${row.reward_type}".`);
  }
}

// ---------------------------------------------------------------------------
// formatReward (display, Req 3.9)
// ---------------------------------------------------------------------------

/** Distinct display icon tokens, one per Reward_Type (Req 3.9). */
const REWARD_ICONS: Record<Reward['type'], string> = {
  monetary: '💵',
  nonmonetary: '🎁',
  volunteer: '🤝',
};

/**
 * Format an integer-cents amount as a US-dollar string with exactly two decimal
 * places and thousands separators, e.g. `15000` -> `"$150.00"`, `1999` ->
 * `"$19.99"`, `1000000` -> `"$10,000.00"`. The result always matches
 * `^\$[\d,]+\.\d{2}$`.
 */
function formatCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  const dollarsWithSeparators = dollars.toLocaleString('en-US');
  return `$${dollarsWithSeparators}.${remainder.toString().padStart(2, '0')}`;
}

/**
 * Produce the display pieces for a Reward (Req 3.9): a text `label` naming the
 * Reward_Type, an `icon` token unique to that type, and a `detail` string.
 *
 * - Monetary: `detail` is the amount as `"$150.00"` (matches `^\$[\d,]+\.\d{2}$`).
 * - Nonmonetary: `detail` is the humanized kind followed by the description,
 *   e.g. `"Product - A custom cake"`.
 * - Volunteer: `detail` is `"Volunteer"`.
 *
 * The caller renders `label`/`detail` through normal JSX so React escapes any
 * user-provided description text.
 */
export function formatReward(r: Reward): { label: string; icon: string; detail: string } {
  switch (r.type) {
    case 'monetary':
      return {
        label: 'Monetary',
        icon: REWARD_ICONS.monetary,
        detail: formatCents(r.amountCents),
      };
    case 'nonmonetary':
      return {
        label: 'Nonmonetary',
        icon: REWARD_ICONS.nonmonetary,
        detail: `${humanize(r.kind)} - ${r.description}`,
      };
    case 'volunteer':
      return {
        label: 'Volunteer',
        icon: REWARD_ICONS.volunteer,
        detail: 'Volunteer',
      };
  }
}

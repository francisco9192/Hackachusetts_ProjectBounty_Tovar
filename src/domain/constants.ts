/**
 * Domain constants: the fixed value lists and field limits that the trusted
 * backend rules (CHECK constraints, RLS, RPCs) enforce, mirrored here so the
 * UI can validate instantly and the rules can be property-tested offline.
 *
 * This module is PURE: no network, no storage, no `Date.now`. Every list is an
 * `as const` tuple so the derived union types stay in sync with the values.
 *
 * Database columns and enum values are `snake_case` (e.g. `in_progress`,
 * `graphic_design`); the UI humanizes them for display (see `labels.ts`).
 *
 * _Requirements: 1.1, 16.9_
 */

// ---------------------------------------------------------------------------
// US states (50 states + DC = 51 values)
// ---------------------------------------------------------------------------

/**
 * The fixed list of valid locations: the 50 US states plus the District of
 * Columbia (51 entries). Stored as the 2-letter `code`; `name` is the display
 * label used by the browse and profile selectors.
 */
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
] as const;

/** A valid US state/DC 2-letter code, e.g. `'MA'`. Stored on tasks and profiles. */
export type UsState = (typeof US_STATES)[number]['code'];

/** The set of valid state codes, for O(1) membership checks. */
const US_STATE_CODES: ReadonlySet<string> = new Set(US_STATES.map((s) => s.code));

/** True when `value` is one of the 51 valid US state/DC codes. */
export function isUsState(value: string): value is UsState {
  return US_STATE_CODES.has(value);
}

/** The display name for a state code, e.g. `'MA'` -> `'Massachusetts'`. */
export function stateName(code: UsState): string {
  return US_STATES.find((s) => s.code === code)!.name;
}

// ---------------------------------------------------------------------------
// Task categories
// ---------------------------------------------------------------------------

/**
 * The fixed Category list. Stored lowercase `snake_case`; the UI humanizes for
 * display (e.g. `graphic_design` -> "Graphic design").
 */
export const CATEGORIES = [
  'website',
  'spreadsheet',
  'graphic_design',
  'programming',
  'writing',
  'social_media',
  'other',
] as const;

/** One Category value, stored as lowercase snake_case. */
export type Category = (typeof CATEGORIES)[number];

/** True when `value` is a valid Category. */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Task status
// ---------------------------------------------------------------------------

/** The lifecycle states of a Task. */
export const TASK_STATUSES = [
  'open',
  'in_progress',
  'submitted',
  'completed',
  'cancelled',
] as const;

/** One Task_Status value. */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** True when `value` is a valid Task_Status. */
export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Application status
// ---------------------------------------------------------------------------

/** The states of an Application. */
export const APPLICATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

/** One Application_Status value. */
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Alias matching the design's `AppStatus` name. */
export type AppStatus = ApplicationStatus;

/** True when `value` is a valid Application_Status. */
export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Reward type and nonmonetary kind
// ---------------------------------------------------------------------------

/** The three Reward_Type values. */
export const REWARD_TYPES = ['monetary', 'nonmonetary', 'volunteer'] as const;

/** One Reward_Type value. */
export type RewardType = (typeof REWARD_TYPES)[number];

/** True when `value` is a valid Reward_Type. */
export function isRewardType(value: string): value is RewardType {
  return (REWARD_TYPES as readonly string[]).includes(value);
}

/** The Nonmonetary_Kind values for a nonmonetary Reward. */
export const NONMONETARY_KINDS = ['product', 'service', 'experience', 'other'] as const;

/** One Nonmonetary_Kind value. */
export type NonmonetaryKind = (typeof NONMONETARY_KINDS)[number];

/** True when `value` is a valid Nonmonetary_Kind. */
export function isNonmonetaryKind(value: string): value is NonmonetaryKind {
  return (NONMONETARY_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Reward status
// ---------------------------------------------------------------------------

/** The settlement states of a Task's Reward. */
export const REWARD_STATUSES = [
  'not_applicable',
  'pending',
  'simulated_paid',
  'delivered',
  'received',
] as const;

/** One Reward_Status value. */
export type RewardStatus = (typeof REWARD_STATUSES)[number];

/** True when `value` is a valid Reward_Status. */
export function isRewardStatus(value: string): value is RewardStatus {
  return (REWARD_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Age bracket
// ---------------------------------------------------------------------------

/**
 * The declared Age_Bracket. "Under 13" is NOT a stored value: it only exists
 * as a sign-up selector option that blocks submission (Req 1.2). Stored only
 * in the owner-readable `member_private` table, never shown publicly.
 */
export const AGE_BRACKETS = ['13-17', '18+'] as const;

/** One Age_Bracket value. */
export type AgeBracket = (typeof AGE_BRACKETS)[number];

/** True when `value` is a valid (stored) Age_Bracket. */
export function isAgeBracket(value: string): value is AgeBracket {
  return (AGE_BRACKETS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Report reasons
// ---------------------------------------------------------------------------

/** The reasons a Report may cite. */
export const REPORT_REASONS = ['spam', 'inappropriate', 'scam', 'other'] as const;

/** One Report reason value. */
export type ReportReason = (typeof REPORT_REASONS)[number];

/** True when `value` is a valid Report reason. */
export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/** The kinds of thing a Report can target. */
export const REPORT_TARGET_TYPES = ['task', 'profile'] as const;

/** One Report target type. */
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

// ---------------------------------------------------------------------------
// Field length / count / amount limits
// ---------------------------------------------------------------------------

/**
 * The exact field limits the trusted backend enforces, mirrored for instant UI
 * validation. Lengths are counted after trimming leading/trailing whitespace
 * where the requirements say so. Money is integer cents.
 *
 * Monetary amount: $0.01..$10,000.00 => 1..1,000,000 cents (Confirmed
 * Decision 3; design `amount_cents` 1..1,000,000). Estimated value is optional
 * and ranges $0.00..$10,000.00 => 0..1,000,000 cents.
 */
export const LIMITS = {
  /** Profile display name, trimmed. */
  displayName: { min: 1, max: 50 },
  /** Profile bio. */
  bio: { min: 0, max: 500 },
  /** Email address, total length. */
  email: { min: 3, max: 254 },
  /** Account password. */
  password: { min: 8, max: 72 },
  /** Town / city name, trimmed. */
  town: { min: 2, max: 60 },

  /** Each Skill label, trimmed. */
  skill: { min: 1, max: 40 },
  /** Max Skills on a Profile. */
  profileSkills: { maxCount: 20 },
  /** Max Skills on a Task. */
  taskSkills: { maxCount: 10 },

  /** Task title, trimmed. */
  taskTitle: { min: 5, max: 100 },
  /** Task description, trimmed. */
  taskDescription: { min: 20, max: 3000 },

  /** Nonmonetary reward description, trimmed. */
  rewardDescription: { min: 5, max: 300 },

  /** Application cover message, trimmed. */
  cover: { min: 20, max: 1000 },

  /** Submission description, trimmed. */
  submissionDescription: { min: 10, max: 2000 },
  /** Submission URLs: count and per-URL length. */
  submissionUrls: { minCount: 1, maxCount: 5, maxLength: 2048 },

  /** Per-task message body, trimmed. */
  message: { min: 1, max: 2000 },

  /** Optional report note. */
  reportNote: { min: 0, max: 500 },

  /** Browse town filter. */
  browseTown: { min: 1, max: 60 },
  /** Browse search keyword. */
  keyword: { min: 1, max: 100 },

  /** Monetary reward amount, in integer cents ($0.01..$10,000.00). */
  amountCents: { min: 1, max: 1_000_000 },
  /** Optional nonmonetary estimated value, in integer cents ($0.00..$10,000.00). */
  estimatedValueCents: { min: 0, max: 1_000_000 },
} as const;

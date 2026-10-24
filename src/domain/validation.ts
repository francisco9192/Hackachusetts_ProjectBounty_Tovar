/**
 * Form validation rules for every Bounty form except the Reward (which lives in
 * `reward.ts` and is delegated to from here for the task form). These mirror the
 * trusted backend rules (CHECK constraints, RLS, RPC argument checks) so the UI
 * can validate instantly and the rules can be property-tested offline.
 *
 * This module is PURE: no network, no storage, no `Date.now`. The current date
 * is always passed in (see `validateTask`'s `today` argument), never read from
 * the system clock.
 *
 * Every validator returns a {@link Result}: `{ ok: true, value }` on success or
 * `{ ok: false, errors }` where `errors` maps a stable field key to one
 * plain-language message. The test oracles and the UI both depend on these
 * keys, so they are documented per function below and must not drift from the
 * backend field names.
 *
 * _Requirements: 1.1, 1.5, 1.10, 1.11, 1.12, 2.1, 2.3, 2.4, 2.8, 5.1, 5.8,
 * 7.1, 7.2, 7.7, 10.4, 12.1, 13.2, 13.6, 15.2, 15.5_
 */

import {
  LIMITS,
  REPORT_REASONS,
  isAgeBracket,
  isCategory,
  isReportReason,
  isUsState,
  type AgeBracket,
  type Category,
  type ReportReason,
  type UsState,
} from './constants';
import { validateReward, type Reward, type RewardFormInput, type Result } from './reward';

// ---------------------------------------------------------------------------
// Small internal helpers (pure)
// ---------------------------------------------------------------------------

/** Length of `s` after trimming leading/trailing whitespace. */
function trimmedLength(s: string): number {
  return s.trim().length;
}

/** True when the trimmed length of `s` is within `[min, max]` inclusive. */
function inLenRange(s: string, min: number, max: number): boolean {
  const n = trimmedLength(s);
  return n >= min && n <= max;
}

/** Add an error for `key` only if one is not already recorded (first wins). */
function setError(errors: Record<string, string>, key: string, message: string): void {
  if (!(key in errors)) errors[key] = message;
}

// ===========================================================================
// normalizeSkills
// ===========================================================================

/**
 * Normalize a raw Skill list: trim each entry, drop entries that are empty
 * after trimming, and remove case-insensitive duplicates while keeping the
 * first occurrence's original spelling and the original order (Req 1.12, 2.8).
 *
 * This does NOT enforce any maximum count or per-skill length; callers
 * ({@link validateProfile}, {@link validateTask}) normalize first and then
 * apply `LIMITS.profileSkills.maxCount` / `LIMITS.taskSkills.maxCount` and the
 * per-skill 1..40 length rule. Idempotent: `normalizeSkills(normalizeSkills(x))`
 * equals `normalizeSkills(x)`.
 */
export function normalizeSkills(skills: string[]): string[] {
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

/** Validate a normalized skill list against the per-skill length rule. */
function skillsError(normalized: string[]): string | null {
  const bad = normalized.some(
    (s) => s.length < LIMITS.skill.min || s.length > LIMITS.skill.max,
  );
  return bad
    ? `Each skill must be ${LIMITS.skill.min} to ${LIMITS.skill.max} characters.`
    : null;
}

// ===========================================================================
// isHttpUrl
// ===========================================================================

/**
 * True only when `s` is an absolute URL using the `http:` or `https:` scheme,
 * with a non-empty host, and at most 2048 characters in total (Req 7.2, 10.4).
 *
 * Uses the WHATWG `URL` constructor inside a try/catch: a string the parser
 * rejects (relative URLs, missing scheme, malformed input) throws and returns
 * `false`. Non-http(s) schemes (`mailto:`, `javascript:`, `ftp:`, `file:`,
 * ...) and an empty host are rejected explicitly so only safe, clickable web
 * links pass (the UI's `SafeLink` renders an anchor only when this is `true`).
 */
export function isHttpUrl(s: string): boolean {
  if (s.length === 0 || s.length > LIMITS.submissionUrls.maxLength) return false;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.hostname.length === 0) return false;
  return true;
}

// ===========================================================================
// sameState
// ===========================================================================

/**
 * The local-only rule: a Member may act on a Task only when the Task's state
 * matches the Member's profile state (Req 5.2, 6.4). Strict equality on the
 * 2-letter state codes.
 */
export function sameState(taskState: UsState, profileState: UsState): boolean {
  return taskState === profileState;
}

// ===========================================================================
// Shared email validation (Req 1.1)
// ===========================================================================

/**
 * True when `email` matches the sign-up rule in Req 1.1: at most 254
 * characters, exactly one `@`, at least one character before the `@`, and a
 * domain after the `@` that contains at least one `.` (with a dot that is not
 * the first or last character of the domain, so there is a label on each side).
 */
function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > LIMITS.email.max) return false;
  const at = email.indexOf('@');
  // Exactly one '@': first occurrence must be the only one.
  if (at <= 0 || email.indexOf('@', at + 1) !== -1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.indexOf('.');
  // A '.' must exist in the domain and have a non-empty label on each side.
  if (dot <= 0 || dot === domain.length - 1) return false;
  return true;
}

// ===========================================================================
// validateSignUp (Req 1.1, 1.5)
// ===========================================================================

/**
 * Raw sign-up form fields, exactly as collected (all strings). Note the age
 * selector in the UI also offers "Under 13", which disables submit and never
 * reaches here (Req 1.2); this validator only accepts the two stored brackets.
 */
export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  ageBracket: string;
  usState: string;
  town: string;
}

/** A validated sign-up payload: trimmed text, a known age bracket and state. */
export interface SignUp {
  email: string;
  password: string;
  displayName: string;
  ageBracket: AgeBracket;
  usState: UsState;
  town: string;
}

/**
 * Validate the sign-up form (Req 1.1, 1.5). On failure, `errors` keys are:
 * `email`, `password`, `displayName`, `ageBracket`, `usState`, `town`.
 *
 * Rules: email per {@link isValidEmail} (<=254, one `@`, label before and a
 * dotted domain after); password 8..72 (not trimmed - spaces are meaningful);
 * display name 1..50 trimmed; age bracket exactly `13-17` or `18+` (Req 1.2's
 * "Under 13" is a UI-only option, never stored); state in the 51-value list;
 * town 2..60 trimmed.
 */
export function validateSignUp(input: SignUpInput): Result<SignUp> {
  const errors: Record<string, string> = {};

  if (!isValidEmail(input.email.trim())) {
    setError(errors, 'email', 'Enter a valid email address (at most 254 characters).');
  }
  // Password is checked at its raw length: leading/trailing spaces are valid
  // password characters and must not be trimmed away.
  if (input.password.length < LIMITS.password.min || input.password.length > LIMITS.password.max) {
    setError(
      errors,
      'password',
      `Password must be ${LIMITS.password.min} to ${LIMITS.password.max} characters.`,
    );
  }
  if (!inLenRange(input.displayName, LIMITS.displayName.min, LIMITS.displayName.max)) {
    setError(
      errors,
      'displayName',
      `Display name must be ${LIMITS.displayName.min} to ${LIMITS.displayName.max} characters.`,
    );
  }
  if (!isAgeBracket(input.ageBracket.trim())) {
    setError(errors, 'ageBracket', 'Select your age bracket.');
  }
  if (!isUsState(input.usState.trim())) {
    setError(errors, 'usState', 'Select your state.');
  }
  if (!inLenRange(input.town, LIMITS.town.min, LIMITS.town.max)) {
    setError(errors, 'town', `Town must be ${LIMITS.town.min} to ${LIMITS.town.max} characters.`);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const ageBracket = input.ageBracket.trim();
  const usState = input.usState.trim();
  // Narrowed by the guards above.
  return {
    ok: true,
    value: {
      email: input.email.trim(),
      password: input.password,
      displayName: input.displayName.trim(),
      ageBracket: ageBracket as AgeBracket,
      usState: usState as UsState,
      town: input.town.trim(),
    },
  };
}

// ===========================================================================
// validateProfile (Req 1.10, 1.11)
// ===========================================================================

/**
 * Raw profile-edit fields. Age bracket is NOT editable here (Req 1.10 keeps it
 * at the sign-up value), so it is absent from the input and the output.
 */
export interface ProfileInput {
  displayName: string;
  bio: string;
  skills: string[];
  usState: string;
  town: string;
}

/** A validated profile update: trimmed text, normalized skills, known state. */
export interface ProfileUpdate {
  displayName: string;
  bio: string;
  skills: string[];
  usState: UsState;
  town: string;
}

/**
 * Validate the profile-edit form (Req 1.10, 1.11). On failure, `errors` keys
 * are: `displayName`, `bio`, `skills`, `usState`, `town`.
 *
 * Rules: display name 1..50 trimmed; bio 0..500 (trimmed length); skills are
 * normalized first (Req 1.12), then at most 20 and each 1..40 characters; state
 * in the 51-value list; town 2..60 trimmed. The stored bio/skills are the
 * trimmed/normalized values.
 */
export function validateProfile(input: ProfileInput): Result<ProfileUpdate> {
  const errors: Record<string, string> = {};

  if (!inLenRange(input.displayName, LIMITS.displayName.min, LIMITS.displayName.max)) {
    setError(
      errors,
      'displayName',
      `Display name must be ${LIMITS.displayName.min} to ${LIMITS.displayName.max} characters.`,
    );
  }
  if (!inLenRange(input.bio, LIMITS.bio.min, LIMITS.bio.max)) {
    setError(errors, 'bio', `Bio must be at most ${LIMITS.bio.max} characters.`);
  }

  const skills = normalizeSkills(input.skills);
  if (skills.length > LIMITS.profileSkills.maxCount) {
    setError(errors, 'skills', `Use at most ${LIMITS.profileSkills.maxCount} skills.`);
  } else {
    const err = skillsError(skills);
    if (err !== null) setError(errors, 'skills', err);
  }

  if (!isUsState(input.usState.trim())) {
    setError(errors, 'usState', 'Select your state.');
  }
  if (!inLenRange(input.town, LIMITS.town.min, LIMITS.town.max)) {
    setError(errors, 'town', `Town must be ${LIMITS.town.min} to ${LIMITS.town.max} characters.`);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      displayName: input.displayName.trim(),
      bio: input.bio.trim(),
      skills,
      usState: input.usState.trim() as UsState,
      town: input.town.trim(),
    },
  };
}

// ===========================================================================
// validateTask (Req 2.1, 2.3, 2.4, 2.8 + Req 3 via validateReward)
// ===========================================================================

/**
 * Raw task form fields. The reward subfields are the flat {@link RewardFormInput}
 * shape and are delegated to {@link validateReward}. `deadline` is `''` when no
 * deadline is set, otherwise an ISO `YYYY-MM-DD` calendar date.
 */
export interface TaskFormInput {
  title: string;
  description: string;
  category: string;
  skills: string[];
  reward: RewardFormInput;
  /** `''` means no deadline; otherwise a `YYYY-MM-DD` date. */
  deadline: string;
  usState: string;
  town: string;
}

/** A validated new task, ready to hand to the data layer. */
export interface NewTask {
  title: string;
  description: string;
  category: Category;
  skills: string[];
  reward: Reward;
  /** `null` when no deadline was set; otherwise the `YYYY-MM-DD` string. */
  deadline: string | null;
  usState: UsState;
  town: string;
}

/** Strict `YYYY-MM-DD` shape check. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `s` is a real `YYYY-MM-DD` calendar date (correct shape AND a date
 * that round-trips, so `2024-02-30` or `2024-13-01` are rejected). Pure: builds
 * the date in UTC and never reads the clock.
 */
function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Validate the task form (Req 2.1, 2.3, 2.4) together with its Reward (Req 3,
 * delegated to {@link validateReward}). `today` is the current date as
 * `YYYY-MM-DD`, passed in by the caller so this stays pure (Req 12.1).
 *
 * On failure, `errors` keys are: `title`, `description`, `category`, `skills`,
 * `deadline`, `usState`, `town`, and - nested under a `reward.` prefix - any
 * reward field key from {@link validateReward}: `reward.type`, `reward.amount`,
 * `reward.kind`, `reward.description`, `reward.estimatedValue`. The prefix keeps
 * reward keys from colliding with task keys (e.g. task `description` vs reward
 * `reward.description`); the UI strips the `reward.` prefix to map a message
 * back to its reward field.
 *
 * Rules: title 5..100 trimmed; description 20..3000 trimmed; exactly one valid
 * Category; skills normalized (Req 2.8) then at most 10 and each 1..40; deadline
 * absent (`''`) OR a real `YYYY-MM-DD` date that is `>= today` (ISO dates compare
 * correctly as strings); valid state; town 2..60 trimmed.
 */
export function validateTask(input: TaskFormInput, today: string): Result<NewTask> {
  const errors: Record<string, string> = {};

  if (!inLenRange(input.title, LIMITS.taskTitle.min, LIMITS.taskTitle.max)) {
    setError(
      errors,
      'title',
      `Title must be ${LIMITS.taskTitle.min} to ${LIMITS.taskTitle.max} characters.`,
    );
  }
  if (!inLenRange(input.description, LIMITS.taskDescription.min, LIMITS.taskDescription.max)) {
    setError(
      errors,
      'description',
      `Description must be ${LIMITS.taskDescription.min} to ${LIMITS.taskDescription.max} characters.`,
    );
  }
  if (!isCategory(input.category.trim())) {
    setError(errors, 'category', 'Select a category.');
  }

  const skills = normalizeSkills(input.skills);
  if (skills.length > LIMITS.taskSkills.maxCount) {
    setError(errors, 'skills', `Use at most ${LIMITS.taskSkills.maxCount} skills.`);
  } else {
    const err = skillsError(skills);
    if (err !== null) setError(errors, 'skills', err);
  }

  // Deadline: empty is allowed (no deadline). Otherwise it must be a real ISO
  // date that is today or later. ISO `YYYY-MM-DD` strings order correctly with
  // a plain string comparison, so no Date math is needed for the >= check.
  let deadline: string | null = null;
  const rawDeadline = input.deadline.trim();
  if (rawDeadline.length > 0) {
    if (!isRealIsoDate(rawDeadline)) {
      setError(errors, 'deadline', 'Enter a valid calendar date.');
    } else if (rawDeadline < today) {
      setError(errors, 'deadline', 'Deadline must be today or later.');
    } else {
      deadline = rawDeadline;
    }
  }

  if (!isUsState(input.usState.trim())) {
    setError(errors, 'usState', 'Select a state.');
  }
  if (!inLenRange(input.town, LIMITS.town.min, LIMITS.town.max)) {
    setError(errors, 'town', `Town must be ${LIMITS.town.min} to ${LIMITS.town.max} characters.`);
  }

  // Delegate reward validation and merge its errors under the `reward.` prefix.
  const rewardResult = validateReward(input.reward);
  if (!rewardResult.ok) {
    for (const [key, message] of Object.entries(rewardResult.errors)) {
      setError(errors, `reward.${key}`, message);
    }
  }

  if (Object.keys(errors).length > 0 || !rewardResult.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category.trim() as Category,
      skills,
      reward: rewardResult.value,
      deadline,
      usState: input.usState.trim() as UsState,
      town: input.town.trim(),
    },
  };
}

// ===========================================================================
// validateSubmission (Req 7.1, 7.2, 7.7)
// ===========================================================================

/** A validated submission: trimmed description and 1..5 valid http(s) URLs. */
export interface NewSubmission {
  description: string;
  urls: string[];
}

/**
 * Validate a work Submission (Req 7.1, 7.2, 7.7). On failure, `errors` keys are:
 * `description`, `urls` (count out of 1..5), and `url.<i>` for each invalid URL
 * at zero-based index `i` (so the UI can flag exactly which link is bad).
 *
 * Rules: description 10..2000 trimmed; 1..5 URLs, each passing {@link isHttpUrl}
 * (http/https, non-empty host, <=2048 chars). Empty-after-trim URL strings count
 * toward the 1..5 total and are reported as invalid. Stored URLs are trimmed.
 */
export function validateSubmission(input: {
  description: string;
  urls: string[];
}): Result<NewSubmission> {
  const errors: Record<string, string> = {};

  if (
    !inLenRange(
      input.description,
      LIMITS.submissionDescription.min,
      LIMITS.submissionDescription.max,
    )
  ) {
    setError(
      errors,
      'description',
      `Description must be ${LIMITS.submissionDescription.min} to ${LIMITS.submissionDescription.max} characters.`,
    );
  }

  const { minCount, maxCount } = LIMITS.submissionUrls;
  if (input.urls.length < minCount || input.urls.length > maxCount) {
    setError(errors, 'urls', `Provide ${minCount} to ${maxCount} links.`);
  }

  const trimmedUrls: string[] = [];
  input.urls.forEach((raw, i) => {
    const url = raw.trim();
    if (!isHttpUrl(url)) {
      setError(
        errors,
        `url.${i}`,
        'Enter a valid http:// or https:// link (at most 2048 characters).',
      );
    }
    trimmedUrls.push(url);
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, value: { description: input.description.trim(), urls: trimmedUrls } };
}

// ===========================================================================
// validateCover (Req 5.1, 5.8)
// ===========================================================================

/**
 * Validate an Application cover message (Req 5.1, 5.8): 20..1000 characters
 * trimmed. On failure the single `errors` key is `coverMessage`. On success the
 * value is the trimmed cover message.
 */
export function validateCover(input: { coverMessage: string }): Result<string> {
  const errors: Record<string, string> = {};
  if (!inLenRange(input.coverMessage, LIMITS.cover.min, LIMITS.cover.max)) {
    setError(
      errors,
      'coverMessage',
      `Cover message must be ${LIMITS.cover.min} to ${LIMITS.cover.max} characters.`,
    );
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input.coverMessage.trim() };
}

// ===========================================================================
// validateMessage (Req 13.2, 13.6)
// ===========================================================================

/**
 * Validate a per-task message body (Req 13.2, 13.6): 1..2000 characters
 * trimmed (so a whitespace-only message is rejected). On failure the single
 * `errors` key is `body`. On success the value is the trimmed body.
 */
export function validateMessage(input: { body: string }): Result<string> {
  const errors: Record<string, string> = {};
  if (!inLenRange(input.body, LIMITS.message.min, LIMITS.message.max)) {
    setError(
      errors,
      'body',
      `Message must be ${LIMITS.message.min} to ${LIMITS.message.max} characters.`,
    );
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input.body.trim() };
}

// ===========================================================================
// validateReport (Req 15.2, 15.5)
// ===========================================================================

/** A validated report: a known reason and a trimmed note (0..500). */
export interface NewReport {
  reason: ReportReason;
  note: string;
}

/**
 * Validate a Report (Req 15.2, 15.5). On failure, `errors` keys are: `reason`
 * (missing or not one of spam/inappropriate/scam/other) and `note` (> 500
 * characters). The note is optional; an empty note is valid.
 */
export function validateReport(input: { reason: string; note: string }): Result<NewReport> {
  const errors: Record<string, string> = {};

  if (!isReportReason(input.reason.trim())) {
    setError(errors, 'reason', `Select a reason (${REPORT_REASONS.join(', ')}).`);
  }
  if (!inLenRange(input.note, LIMITS.reportNote.min, LIMITS.reportNote.max)) {
    setError(errors, 'note', `Note must be at most ${LIMITS.reportNote.max} characters.`);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { reason: input.reason.trim() as ReportReason, note: input.note.trim() },
  };
}

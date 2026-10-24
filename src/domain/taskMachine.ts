/**
 * The Task status state machine: a PURE, in-memory model of one Task plus its
 * Applications and Simulated_Payment, and a `reduce` function that applies one
 * status-changing request and returns either a brand-new model (on success) or
 * the ORIGINAL model unchanged (on rejection, with an error code).
 *
 * This mirrors the trusted backend rules enforced by the status-changing RPCs
 * (`SELECT ... FOR UPDATE`, `auth.uid()` + current-status checks, all-or-nothing
 * writes). The UI uses it to decide which actions to enable; the property tests
 * fold random request sequences through it and check the invariants after every
 * step.
 *
 * This module is PURE: no network, no storage, no `Date.now`. `reduce` never
 * mutates its input — every success returns a structurally fresh model, and
 * every rejection returns the exact model it was given (Property 11 asserts
 * deep equality on rejection).
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7,
 * 6.8, 7.1, 7.3, 7.5, 7.6, 7.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.3, 9.6,
 * 9.7, 9.9, 9.11, 9.12, 9.13, 9.15, 12.1_
 */

import {
  type AppStatus,
  type RewardStatus,
  type RewardType,
  type TaskStatus,
  type UsState,
} from './constants';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** One Application attached to a Task, as the state machine sees it. */
export interface ModelApplication {
  /** Stable id, unique within one Task's `applications` list. */
  id: string;
  /** The Member who applied. */
  applicantId: string;
  /** Current Application_Status. */
  status: AppStatus;
}

/** One Simulated_Payment attached to a Task. Amount is integer cents. */
export interface ModelPayment {
  /** The settled amount in integer cents; equals the Task's `amountCents`. */
  amountCents: number;
}

/**
 * The in-memory model of a single Task used by the state machine. All actor and
 * profile lookups are self-contained: `profiles` maps a Member id to that
 * Member's current US_State so the same-state rule can be checked without any
 * outside data.
 */
export interface TaskModel {
  /** The Task_Creator's Member id. */
  creatorId: string;
  /** The Task's US_State; applicants must match this to apply or be accepted. */
  usState: UsState;
  /** Current Task_Status. */
  status: TaskStatus;
  /** The Assignee's Member id, or null when there is no Assignee. */
  assigneeId: string | null;
  /** The Reward_Type chosen at creation. */
  rewardType: RewardType;
  /** Current Reward_Status. */
  rewardStatus: RewardStatus;
  /** Monetary reward amount in integer cents, or null for non-monetary/volunteer. */
  amountCents: number | null;
  /** Every Application on this Task. */
  applications: ModelApplication[];
  /** At most one Simulated_Payment on this Task. */
  payments: ModelPayment[];
  /** Each known Member's current US_State, keyed by Member id. */
  profiles: Record<string, { usState: UsState }>;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * One status-changing request. `actor` is always the signed-in Member id (the
 * caller supplies it; "not signed in" is handled by the UI/RLS, not here).
 */
export type Request =
  | { kind: 'apply'; actor: string }
  | { kind: 'accept'; actor: string; applicationId: string }
  | { kind: 'submit'; actor: string }
  | { kind: 'confirm'; actor: string }
  | { kind: 'cancel'; actor: string }
  | { kind: 'pay'; actor: string }
  | { kind: 'markDelivered'; actor: string }
  | { kind: 'confirmReceived'; actor: string };

// ---------------------------------------------------------------------------
// Error codes (mirror the short codes the DB raises; see src/lib/errors.ts)
// ---------------------------------------------------------------------------

/**
 * The reasons `reduce` rejects a request. These mirror the short codes raised
 * by the trusted backend RPCs; `src/lib/errors.ts` maps them to plain-language
 * messages. Raw codes never reach the UI directly.
 *
 * - `NOT_CREATOR` — the actor is not the Task_Creator (accept, confirm, cancel,
 *   pay, markDelivered).
 * - `NOT_ASSIGNEE` — the actor is not the Assignee (submit, confirmReceived).
 * - `CREATOR_CANNOT_APPLY` — the Task_Creator tried to apply to their own Task.
 * - `WRONG_STATUS` — the Task_Status does not permit this transition (covers
 *   "not open", "not in progress", "not submitted", "not completed", a no-op
 *   transition, and any request against a terminal Completed/Cancelled Task).
 * - `NOT_SAME_STATE` — the applicant's US_State does not equal the Task's.
 * - `DUPLICATE_APPLICATION` — the actor already has a pending/accepted
 *   Application on this Task.
 * - `APP_NOT_PENDING` — the referenced Application is not Pending.
 * - `NOT_FOUND` — the referenced Application id does not exist on this Task.
 * - `WRONG_REWARD_TYPE` — the reward action does not match the Reward_Type
 *   (e.g. `pay` on a non-monetary reward).
 * - `WRONG_REWARD_STATUS` — the Reward_Status does not permit this change.
 * - `ALREADY_PAID` — a Simulated_Payment already exists on this Task.
 */
export type ErrorCode =
  | 'NOT_CREATOR'
  | 'NOT_ASSIGNEE'
  | 'CREATOR_CANNOT_APPLY'
  | 'WRONG_STATUS'
  | 'NOT_SAME_STATE'
  | 'DUPLICATE_APPLICATION'
  | 'APP_NOT_PENDING'
  | 'NOT_FOUND'
  | 'WRONG_REWARD_TYPE'
  | 'WRONG_REWARD_STATUS'
  | 'ALREADY_PAID';

/** The result of applying one request through {@link reduce}. */
export type ReduceResult =
  | { ok: true; model: TaskModel }
  | { ok: false; code: ErrorCode; model: TaskModel };

// ---------------------------------------------------------------------------
// Pure structural copy helpers
// ---------------------------------------------------------------------------

/**
 * Deep-copy a model so a successful `reduce` never shares mutable structure
 * with its input. Primitive fields are copied by value; the arrays and the
 * `profiles` record are rebuilt from fresh objects.
 */
function cloneModel(m: TaskModel): TaskModel {
  const profiles: Record<string, { usState: UsState }> = {};
  for (const id of Object.keys(m.profiles)) {
    profiles[id] = { usState: m.profiles[id].usState };
  }
  return {
    creatorId: m.creatorId,
    usState: m.usState,
    status: m.status,
    assigneeId: m.assigneeId,
    rewardType: m.rewardType,
    rewardStatus: m.rewardStatus,
    amountCents: m.amountCents,
    applications: m.applications.map((a) => ({
      id: a.id,
      applicantId: a.applicantId,
      status: a.status,
    })),
    payments: m.payments.map((p) => ({ amountCents: p.amountCents })),
    profiles,
  };
}

/** Build a rejection result: hand back the ORIGINAL model, untouched. */
function reject(m: TaskModel, code: ErrorCode): ReduceResult {
  return { ok: false, code, model: m };
}

/** True when the actor already holds a pending or accepted Application. */
function hasActiveApplication(m: TaskModel, actor: string): boolean {
  return m.applications.some(
    (a) => a.applicantId === actor && (a.status === 'pending' || a.status === 'accepted'),
  );
}

/**
 * Deterministically derive the id for a newly appended Application. Pure and
 * unique within one Task because the list only ever grows: `app-1`, `app-2`, …
 */
function nextApplicationId(m: TaskModel): string {
  return `app-${m.applications.length + 1}`;
}

/** The actor's current US_State, or null if we have no profile for them. */
function actorState(m: TaskModel, actor: string): UsState | null {
  const p = m.profiles[actor];
  return p ? p.usState : null;
}

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

/**
 * Apply one status-changing request to a Task model.
 *
 * PURE and non-mutating: on success returns a structurally fresh model with the
 * change applied; on rejection returns the ORIGINAL model unchanged together
 * with the {@link ErrorCode} explaining why. The rules mirror the trusted
 * backend RPCs exactly (Requirements 5–9).
 */
export function reduce(m: TaskModel, r: Request): ReduceResult {
  switch (r.kind) {
    case 'apply':
      return applyRequest(m, r.actor);
    case 'accept':
      return acceptRequest(m, r.actor, r.applicationId);
    case 'submit':
      return submitRequest(m, r.actor);
    case 'confirm':
      return confirmRequest(m, r.actor);
    case 'cancel':
      return cancelRequest(m, r.actor);
    case 'pay':
      return payRequest(m, r.actor);
    case 'markDelivered':
      return markDeliveredRequest(m, r.actor);
    case 'confirmReceived':
      return confirmReceivedRequest(m, r.actor);
    default: {
      // Exhaustiveness: every Request.kind is handled above.
      const _never: never = r;
      return _never;
    }
  }
}

// --- apply (Req 5) ---------------------------------------------------------

function applyRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 5.3: creators cannot apply to their own Task.
  if (actor === m.creatorId) return reject(m, 'CREATOR_CANNOT_APPLY');
  // Req 5.6: only Open Tasks accept applications.
  if (m.status !== 'open') return reject(m, 'WRONG_STATUS');
  // Req 5.2 / 5.4: applicant's state must match the Task's state.
  if (actorState(m, actor) !== m.usState) return reject(m, 'NOT_SAME_STATE');
  // Req 5.4 / 5.5: at most one pending/accepted Application per Member per Task.
  if (hasActiveApplication(m, actor)) return reject(m, 'DUPLICATE_APPLICATION');

  const next = cloneModel(m);
  next.applications.push({
    id: nextApplicationId(m),
    applicantId: actor,
    status: 'pending',
  });
  return { ok: true, model: next };
}

// --- accept (Req 6, 8) -----------------------------------------------------

function acceptRequest(m: TaskModel, actor: string, applicationId: string): ReduceResult {
  // Req 6.7 / 8.3: only the Task_Creator may accept.
  if (actor !== m.creatorId) return reject(m, 'NOT_CREATOR');
  // Req 6.8 / 8.1: acceptance is only valid while the Task is Open.
  if (m.status !== 'open') return reject(m, 'WRONG_STATUS');

  const target = m.applications.find((a) => a.id === applicationId);
  // Req 6.8: the referenced Application must exist …
  if (!target) return reject(m, 'NOT_FOUND');
  // … and be Pending.
  if (target.status !== 'pending') return reject(m, 'APP_NOT_PENDING');
  // Req 6.3 / 6.4: the applicant's current state must match the Task's state.
  if (actorState(m, target.applicantId) !== m.usState) return reject(m, 'NOT_SAME_STATE');

  // Req 6.2 / 6.5 / 6.6: all-or-nothing — accept this one, reject other pendings,
  // move the Task to In_Progress, and record the Assignee.
  const next = cloneModel(m);
  for (const a of next.applications) {
    if (a.id === applicationId) {
      a.status = 'accepted';
    } else if (a.status === 'pending') {
      a.status = 'rejected';
    }
  }
  next.status = 'in_progress';
  next.assigneeId = target.applicantId;
  return { ok: true, model: next };
}

// --- submit (Req 7) --------------------------------------------------------

function submitRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 7.5: only the Assignee may submit work.
  if (actor !== m.assigneeId) return reject(m, 'NOT_ASSIGNEE');
  // Req 7.8 / 8.1: submission is only valid while the Task is In_Progress.
  if (m.status !== 'in_progress') return reject(m, 'WRONG_STATUS');

  const next = cloneModel(m);
  next.status = 'submitted';
  return { ok: true, model: next };
}

// --- confirm (Req 7) -------------------------------------------------------

function confirmRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 7.6 / 8.3: only the Task_Creator may confirm completion.
  if (actor !== m.creatorId) return reject(m, 'NOT_CREATOR');
  // Req 7.6 / 8.1: confirmation is only valid while the Task is Submitted.
  if (m.status !== 'submitted') return reject(m, 'WRONG_STATUS');

  const next = cloneModel(m);
  next.status = 'completed';
  return { ok: true, model: next };
}

// --- cancel (Req 8.5) ------------------------------------------------------

function cancelRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 8.3: only the Task_Creator may cancel.
  if (actor !== m.creatorId) return reject(m, 'NOT_CREATOR');
  // Req 8.1: the MVP only allows Open -> Cancelled.
  if (m.status !== 'open') return reject(m, 'WRONG_STATUS');

  // Req 8.5: cancel the Task and reject every pending Application; no Assignee.
  const next = cloneModel(m);
  for (const a of next.applications) {
    if (a.status === 'pending') a.status = 'rejected';
  }
  next.status = 'cancelled';
  next.assigneeId = null;
  return { ok: true, model: next };
}

// --- pay (Req 9.3, 9.6, 9.7) -----------------------------------------------

function payRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 9.7: only the Task_Creator may settle.
  if (actor !== m.creatorId) return reject(m, 'NOT_CREATOR');
  // Req 9.2 / 9.7: only a Completed Task can be settled.
  if (m.status !== 'completed') return reject(m, 'WRONG_STATUS');
  // Req 9.7 / 9.15: the simulated payment applies only to Monetary rewards.
  if (m.rewardType !== 'monetary') return reject(m, 'WRONG_REWARD_TYPE');
  // Req 9.7 / 9.15: the reward must still be Pending.
  if (m.rewardStatus !== 'pending') return reject(m, 'WRONG_REWARD_STATUS');
  // Req 9.6 / 9.7: at most one Simulated_Payment per Task.
  if (m.payments.length > 0) return reject(m, 'ALREADY_PAID');

  // Req 9.3 / 9.6: record exactly one payment whose amount equals the Task's
  // amountCents, and move the reward to Simulated_Paid in the same operation.
  const next = cloneModel(m);
  next.payments.push({ amountCents: m.amountCents ?? 0 });
  next.rewardStatus = 'simulated_paid';
  return { ok: true, model: next };
}

// --- markDelivered (Req 9.9) -----------------------------------------------

function markDeliveredRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 9.9: only the Task_Creator may mark the reward delivered.
  if (actor !== m.creatorId) return reject(m, 'NOT_CREATOR');
  // Req 9.9 / 9.15: only while the Task is Completed.
  if (m.status !== 'completed') return reject(m, 'WRONG_STATUS');
  // Req 9.9 / 9.15: delivery applies only to Nonmonetary rewards.
  if (m.rewardType !== 'nonmonetary') return reject(m, 'WRONG_REWARD_TYPE');
  // Req 9.9 / 9.15: the reward must still be Pending.
  if (m.rewardStatus !== 'pending') return reject(m, 'WRONG_REWARD_STATUS');

  const next = cloneModel(m);
  next.rewardStatus = 'delivered';
  return { ok: true, model: next };
}

// --- confirmReceived (Req 9.11) --------------------------------------------

function confirmReceivedRequest(m: TaskModel, actor: string): ReduceResult {
  // Req 9.11: only the Assignee may confirm receipt.
  if (actor !== m.assigneeId) return reject(m, 'NOT_ASSIGNEE');
  // Req 9.15: only while the Task is Completed.
  if (m.status !== 'completed') return reject(m, 'WRONG_STATUS');
  // Req 9.11 / 9.15: receipt applies only to Nonmonetary rewards.
  if (m.rewardType !== 'nonmonetary') return reject(m, 'WRONG_REWARD_TYPE');
  // Req 9.11 / 9.15: the reward must be Delivered.
  if (m.rewardStatus !== 'delivered') return reject(m, 'WRONG_REWARD_STATUS');

  const next = cloneModel(m);
  next.rewardStatus = 'received';
  return { ok: true, model: next };
}

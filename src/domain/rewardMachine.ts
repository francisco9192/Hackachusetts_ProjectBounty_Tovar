/**
 * Reward settlement state machine: the pure mirror of the Reward_Rules
 * (Requirement 9.15). Given a Task's reward facts and a requested action, it
 * returns the new Reward_Status on success or a plain-language rejection,
 * never changing status on a disallowed request (Req 9.12).
 *
 * This module is PURE: no network, no storage, no `Date.now`. It is the single
 * source of truth the UI uses to enable/disable reward actions and that the
 * Reward_Status state-machine property test exercises (Req 9.13). The trusted
 * backend RPCs encode the same rules; `taskMachine.ts` independently encodes
 * them too. The duplication is intentional by design — keep the three copies
 * in agreement, but this module does not import from them.
 *
 * ---------------------------------------------------------------------------
 * Allowed Reward_Status changes (Reward_Rules, Req 9.15)
 *
 * Each change is allowed ONLY while the Task has Task_Status `completed`, and
 * ONLY when performed by the listed Member:
 *
 *   Pending   --pay-->             Simulated_Paid   Monetary,    by Task_Creator
 *                                                   (through the Payment_Simulator)
 *   Pending   --markDelivered-->   Delivered        Nonmonetary, by Task_Creator
 *   Delivered --confirmReceived--> Received         Nonmonetary, by Assignee
 *
 * Not_Applicable (Volunteer), Simulated_Paid, and Received are FINAL: no
 * action changes them. Initial status is Not_Applicable for a Volunteer reward
 * and Pending otherwise (Req 9.1), so every reachable status is reachable from
 * the initial one using only these edges (Property 15 / Req 9.13).
 * ---------------------------------------------------------------------------
 *
 * _Requirements: 9.1, 9.9, 9.11, 9.12, 9.13, 9.15_
 */

import type { RewardStatus, RewardType } from './constants';
import type { Result } from './reward';

/** The reward-settlement actions a Member can request on a Completed Task. */
export type RewardAction = 'pay' | 'markDelivered' | 'confirmReceived';

/**
 * The reward facts of one Task needed to judge a reward-status change: the
 * Reward_Type, the current Reward_Status, the current Task_Status (a reward
 * change is allowed only while this is `'completed'`), and the ids of the
 * Task_Creator and the Assignee (`null` when the Task has no Assignee yet).
 */
export interface RewardContext {
  rewardType: RewardType;
  rewardStatus: RewardStatus;
  taskStatus: string;
  creatorId: string;
  assigneeId: string | null;
}

/**
 * The single plain-language rejection returned for any disallowed request. The
 * message matches Requirement 9.12 ("the reward status could not be changed");
 * the raw reason stays out of the UI. Keyed by `'rewardStatus'`.
 */
function rejected(): Result<RewardStatus> {
  return {
    ok: false,
    errors: { rewardStatus: 'The reward status could not be changed.' },
  };
}

/**
 * Apply a reward-settlement action to a Task's reward facts and return the new
 * Reward_Status on success, or a rejection that leaves the status unchanged
 * (Req 9.12). Every allowed change requires `taskStatus === 'completed'`.
 *
 * - `pay`: Monetary reward, Reward_Status `pending`, performed by the
 *   Task_Creator -> `simulated_paid` (Req 9.15; through the Payment_Simulator).
 * - `markDelivered`: Nonmonetary reward, Reward_Status `pending`, performed by
 *   the Task_Creator -> `delivered` (Req 9.9, 9.15).
 * - `confirmReceived`: Nonmonetary reward, Reward_Status `delivered`,
 *   performed by the Assignee -> `received` (Req 9.11, 9.15).
 *
 * Any request not matching the `(rewardType, rewardStatus, actor)` tuple above
 * — including any action on a final status (`not_applicable`, `simulated_paid`,
 * `received`) or on a Task whose status is not `completed` — is rejected and
 * the status is left unchanged.
 */
export function rewardTransition(
  t: RewardContext,
  action: RewardAction,
  actor: string,
): Result<RewardStatus> {
  // Every Reward_Rules change requires the Task to be Completed (Req 9.15).
  if (t.taskStatus !== 'completed') return rejected();

  switch (action) {
    case 'pay':
      // Pending -> Simulated_Paid, Monetary, by the Task_Creator.
      if (
        t.rewardType === 'monetary' &&
        t.rewardStatus === 'pending' &&
        actor === t.creatorId
      ) {
        return { ok: true, value: 'simulated_paid' };
      }
      return rejected();

    case 'markDelivered':
      // Pending -> Delivered, Nonmonetary, by the Task_Creator.
      if (
        t.rewardType === 'nonmonetary' &&
        t.rewardStatus === 'pending' &&
        actor === t.creatorId
      ) {
        return { ok: true, value: 'delivered' };
      }
      return rejected();

    case 'confirmReceived':
      // Delivered -> Received, Nonmonetary, by the Assignee.
      if (
        t.rewardType === 'nonmonetary' &&
        t.rewardStatus === 'delivered' &&
        t.assigneeId !== null &&
        actor === t.assigneeId
      ) {
        return { ok: true, value: 'received' };
      }
      return rejected();
  }
}

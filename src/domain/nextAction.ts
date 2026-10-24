/**
 * Dashboard next-action label (Req 14.4, 14.5).
 *
 * This module is PURE: no network, no storage, no `Date.now`. Given one Task
 * snapshot, the viewing member, and which dashboard list it appears in,
 * `nextActionLabel` returns the single plain-language label that tells the
 * member their next step.
 *
 * The invariant (Req 14.5 / Property 16) is that a label other than
 * "No action needed" is returned only when the member is the correct party for
 * that action (creator for Posted actions, assignee for Working On actions)
 * AND the Task's Task_Status and Reward_Status actually permit that action.
 * The `memberId` guards below hold even if the function is called with a
 * mismatched `list`.
 *
 * _Requirements: 14.4, 14.5_
 */

import type { TaskStatus, RewardType, RewardStatus } from './constants';

/** The fixed set of next-action labels a dashboard row can show (Req 14.4). */
export type NextAction =
  | 'Review applicants'
  | 'Confirm completion'
  | 'Settle reward'
  | 'Submit work'
  | 'Confirm reward received'
  | 'No action needed';

/**
 * The Task fields needed to choose a next-action label. `pendingApplicationCount`
 * is the number of Applications currently in Application_Status Pending.
 */
export interface DashboardTask {
  creatorId: string;
  assigneeId: string | null;
  status: TaskStatus;
  rewardType: RewardType;
  rewardStatus: RewardStatus;
  pendingApplicationCount: number;
}

/**
 * Choose the next-action label for one dashboard row, implementing Req 14.4
 * exactly and enforcing the Req 14.5 invariant.
 *
 * Posted list (member must be the creator):
 * - status `open` with >= 1 pending Application -> "Review applicants";
 * - status `submitted`                          -> "Confirm completion";
 * - status `completed` with Reward_Status `pending` -> "Settle reward".
 *
 * Working On list (member must be the assignee):
 * - status `in_progress`                              -> "Submit work";
 * - nonmonetary Reward with Reward_Status `delivered` -> "Confirm reward received".
 *
 * Every other combination, or a member/list mismatch, -> "No action needed".
 */
export function nextActionLabel(
  t: DashboardTask,
  memberId: string,
  list: 'posted' | 'working',
): NextAction {
  if (list === 'posted') {
    // Invariant: Posted actions belong to the Task_Creator only.
    if (t.creatorId !== memberId) return 'No action needed';
    if (t.status === 'open' && t.pendingApplicationCount >= 1) return 'Review applicants';
    if (t.status === 'submitted') return 'Confirm completion';
    if (t.status === 'completed' && t.rewardStatus === 'pending') return 'Settle reward';
    return 'No action needed';
  }

  // list === 'working': actions belong to the Assignee only.
  if (t.assigneeId !== memberId) return 'No action needed';
  if (t.status === 'in_progress') return 'Submit work';
  if (t.rewardType === 'nonmonetary' && t.rewardStatus === 'delivered') {
    return 'Confirm reward received';
  }
  return 'No action needed';
}

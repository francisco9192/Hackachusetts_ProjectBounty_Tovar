/**
 * Property-based test for the Reward status state machine in
 * `src/domain/rewardMachine.ts`.
 *
 * Covers design Correctness Property 15: Reward status state machine.
 *
 * Feature: bounty-platform, Property 15: Reward status state machine
 *
 * Validates: Requirements 9.1, 9.9, 9.11, 9.12, 9.13, 9.15
 *
 * The primary SUT is `rewardTransition`. Starting from a random RewardContext,
 * a random sequence of (action, actor) steps is folded; the Reward_Status is
 * threaded through successful transitions. After every step: a successful
 * change matches exactly one allowed edge (and the new status is the edge's
 * target); a rejected transition leaves the status unchanged (Req 9.12); final
 * statuses (not_applicable, simulated_paid, received) never change (Req 9.13);
 * and every reachable status is reachable from the initial status via allowed
 * edges only.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  rewardTransition,
  type RewardAction,
  type RewardContext,
} from '../../src/domain/rewardMachine';
import type { RewardStatus } from '../../src/domain/constants';
import { rewardContext, rewardStepSequence, rewardTypeArb, memberId } from './arbitraries';

const RUNS = { numRuns: 200 };

const FINAL_STATUSES = new Set<RewardStatus>([
  'not_applicable',
  'simulated_paid',
  'received',
]);

/**
 * Independent oracle for one allowed edge. Returns the target Reward_Status for
 * a legal (context, action, actor) tuple, or null if the transition is not
 * allowed. Mirrors Reward_Rules (Req 9.15) without calling the SUT.
 */
function oracleTarget(
  t: RewardContext,
  action: RewardAction,
  actor: string,
): RewardStatus | null {
  if (t.taskStatus !== 'completed') return null;
  if (action === 'pay') {
    if (t.rewardType === 'monetary' && t.rewardStatus === 'pending' && actor === t.creatorId) {
      return 'simulated_paid';
    }
    return null;
  }
  if (action === 'markDelivered') {
    if (t.rewardType === 'nonmonetary' && t.rewardStatus === 'pending' && actor === t.creatorId) {
      return 'delivered';
    }
    return null;
  }
  // confirmReceived
  if (
    t.rewardType === 'nonmonetary' &&
    t.rewardStatus === 'delivered' &&
    t.assigneeId !== null &&
    actor === t.assigneeId
  ) {
    return 'received';
  }
  return null;
}

describe('rewardTransition — Property 15: Reward status state machine (Req 9.1, 9.9, 9.11, 9.12, 9.13, 9.15)', () => {
  it('Req 9.9, 9.11, 9.12, 9.15: each step either applies the exact allowed edge or leaves the status unchanged', () => {
    fc.assert(
      fc.property(rewardContext, rewardStepSequence, (initial, steps) => {
        let status: RewardStatus = initial.rewardStatus;
        for (const { action, actor } of steps) {
          const ctx: RewardContext = { ...initial, rewardStatus: status };
          const expectedTarget = oracleTarget(ctx, action, actor);
          const res = rewardTransition(ctx, action, actor);

          if (expectedTarget !== null) {
            expect(res.ok).toBe(true);
            if (res.ok) {
              expect(res.value).toBe(expectedTarget);
              status = res.value;
            }
          } else {
            // Req 9.12: a disallowed request is rejected and status is unchanged.
            expect(res.ok).toBe(false);
          }
        }
      }),
      RUNS,
    );
  });

  it('Req 9.13: final statuses (not_applicable, simulated_paid, received) never change under any action', () => {
    fc.assert(
      fc.property(
        rewardContext,
        fc.constantFrom<RewardStatus>('not_applicable', 'simulated_paid', 'received'),
        fc.constantFrom<RewardAction>('pay', 'markDelivered', 'confirmReceived'),
        memberId,
        (base, finalStatus, action, actor) => {
          const ctx: RewardContext = { ...base, rewardStatus: finalStatus };
          const res = rewardTransition(ctx, action, actor);
          expect(res.ok).toBe(false);
        },
      ),
      RUNS,
    );
  });

  it('Req 9.1, 9.13: every status reached from the initial (not_applicable for volunteer else pending) is reachable via allowed edges only', () => {
    fc.assert(
      fc.property(
        rewardTypeArb,
        memberId,
        memberId,
        rewardStepSequence,
        (rewardType, creatorId, assigneeId, steps) => {
          // Req 9.1: initial status depends only on reward type.
          const initialStatus: RewardStatus =
            rewardType === 'volunteer' ? 'not_applicable' : 'pending';
          const base: RewardContext = {
            rewardType,
            rewardStatus: initialStatus,
            taskStatus: 'completed',
            creatorId,
            assigneeId,
          };

          let status: RewardStatus = initialStatus;
          const reached: RewardStatus[] = [status];
          for (const { action, actor } of steps) {
            // A final status is terminal: once reached it must never change.
            if (FINAL_STATUSES.has(status)) {
              const ctx: RewardContext = { ...base, rewardStatus: status };
              expect(rewardTransition(ctx, action, actor).ok).toBe(false);
              continue;
            }
            const ctx: RewardContext = { ...base, rewardStatus: status };
            const res = rewardTransition(ctx, action, actor);
            if (res.ok) {
              status = res.value;
              reached.push(status);
            }
          }

          // Every reached status is one of the statuses reachable for this
          // reward type from its initial status via the allowed edges.
          const reachableForType: Set<RewardStatus> =
            rewardType === 'monetary'
              ? new Set<RewardStatus>(['pending', 'simulated_paid'])
              : rewardType === 'nonmonetary'
                ? new Set<RewardStatus>(['pending', 'delivered', 'received'])
                : new Set<RewardStatus>(['not_applicable']);

          for (const s of reached) {
            expect(reachableForType.has(s)).toBe(true);
          }
        },
      ),
      RUNS,
    );
  });
});

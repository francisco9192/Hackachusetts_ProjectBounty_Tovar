/**
 * Property-based test for simulated payment in `src/domain/taskMachine.ts`.
 *
 * Covers design Correctness Property 14: Simulated payment at most once with
 * the agreed amount.
 *
 * Feature: bounty-platform, Property 14: Simulated payment at most once with the agreed amount
 *
 * Validates: Requirements 9.3, 9.6, 9.7
 *
 * Folded over a random request sequence, after every step: `payments.length`
 * is at most 1; a payment exists only when the reward is Monetary, the Task is
 * Completed, and Reward_Status is Simulated_Paid; and the recorded amount
 * equals the Task's `amountCents`.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { reduce, type TaskModel } from '../../src/domain/taskMachine';
import { taskModel, requestSequence } from './arbitraries';

const RUNS = { numRuns: 200 };

/** Assert the Property-14 invariant on a single model snapshot. */
function assertInvariant(m: TaskModel): void {
  // Req 9.6: at most one simulated payment per task.
  expect(m.payments.length).toBeLessThanOrEqual(1);

  if (m.payments.length === 1) {
    // Req 9.3, 9.7: a payment implies monetary + completed + simulated_paid.
    expect(m.rewardType).toBe('monetary');
    expect(m.status).toBe('completed');
    expect(m.rewardStatus).toBe('simulated_paid');
    // Req 9.3: the settled amount equals the agreed amount.
    expect(m.payments[0].amountCents).toBe(m.amountCents);
  }
}

describe('reduce — Property 14: simulated payment at most once with the agreed amount (Req 9.3, 9.6, 9.7)', () => {
  it('Req 9.3, 9.6, 9.7: payment invariant holds after every step of a random request sequence', () => {
    fc.assert(
      fc.property(taskModel, requestSequence, (initial, requests) => {
        let model = initial;
        assertInvariant(model);
        for (const req of requests) {
          const res = reduce(model, req);
          if (res.ok) model = res.model;
          assertInvariant(model);
        }
      }),
      RUNS,
    );
  });
});

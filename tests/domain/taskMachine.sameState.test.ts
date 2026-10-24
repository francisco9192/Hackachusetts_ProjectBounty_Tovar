/**
 * Property-based test for same-state acceptance in `src/domain/taskMachine.ts`.
 *
 * Covers design Correctness Property 10: Same-state acceptance.
 *
 * Feature: bounty-platform, Property 10: Same-state acceptance
 *
 * Validates: Requirements 6.3, 6.4
 *
 * The Task's US_State is fixed for the life of the model, so "the applicant's
 * state equals the Task state at the step it was accepted" reduces to: every
 * accepted Application belongs to an applicant whose profile state equals the
 * Task state. Checked after every step of a random request sequence.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { reduce, type TaskModel } from '../../src/domain/taskMachine';
import { taskModel, requestSequence } from './arbitraries';

const RUNS = { numRuns: 200 };

/** Assert the Property-10 invariant on a single model snapshot. */
function assertInvariant(m: TaskModel): void {
  for (const a of m.applications) {
    if (a.status === 'accepted') {
      // Req 6.3, 6.4: an accepted applicant must be in the Task's state.
      expect(m.profiles[a.applicantId]?.usState).toBe(m.usState);
    }
  }
}

describe('reduce — Property 10: same-state acceptance (Req 6.3, 6.4)', () => {
  it('Req 6.3, 6.4: every accepted Application belongs to a same-state applicant after every step', () => {
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

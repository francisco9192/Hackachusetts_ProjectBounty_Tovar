/**
 * Property-based test for Application uniqueness in `src/domain/taskMachine.ts`.
 *
 * Covers design Correctness Property 9: At most one active Application per
 * Member per Task.
 *
 * Feature: bounty-platform, Property 9: At most one active Application per Member per Task
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 *
 * A random initial model and a random 1-20 request sequence are folded through
 * `reduce`; only successful results are threaded forward. The invariant is
 * checked after EVERY step (Req 12.3): at most one pending-or-accepted
 * Application per applicant, and no active Application whose applicant is the
 * Task_Creator.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { reduce, type TaskModel } from '../../src/domain/taskMachine';
import { taskModel, requestSequence } from './arbitraries';

const RUNS = { numRuns: 200 };

/** Count active (pending or accepted) applications per applicant id. */
function activeCountByApplicant(m: TaskModel): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of m.applications) {
    if (a.status === 'pending' || a.status === 'accepted') {
      counts.set(a.applicantId, (counts.get(a.applicantId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Assert the Property-9 invariant on a single model snapshot. */
function assertInvariant(m: TaskModel): void {
  const counts = activeCountByApplicant(m);
  for (const [applicantId, n] of counts) {
    // Req 5.4, 5.5: at most one active application per member per task.
    expect(n).toBeLessThanOrEqual(1);
    // Req 5.3: the creator never holds an active application on their own task.
    expect(applicantId).not.toBe(m.creatorId);
  }
  // Req 5.2: an accepted/pending application only exists for a same-state member.
  for (const a of m.applications) {
    if (a.status === 'pending' || a.status === 'accepted') {
      expect(m.profiles[a.applicantId]?.usState).toBe(m.usState);
    }
  }
}

describe('reduce — Property 9: at most one active Application per Member per Task (Req 5.1-5.6)', () => {
  it('Req 5.1, 5.2, 5.3, 5.4, 5.5, 5.6: invariant holds after every step of a random request sequence', () => {
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

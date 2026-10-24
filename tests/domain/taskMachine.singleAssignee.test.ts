/**
 * Property-based test for the single-Assignee invariant in
 * `src/domain/taskMachine.ts`.
 *
 * Covers design Correctness Property 12: Single Assignee.
 *
 * Feature: bounty-platform, Property 12: Single Assignee
 *
 * Validates: Requirements 6.2, 6.5, 6.6, 8.5, 8.7
 *
 * Folded over a random request sequence, after every step: at most one accepted
 * Application; `assigneeId` is non-null exactly when status is in_progress /
 * submitted / completed and null when open / cancelled; when non-null it equals
 * the applicant of the single accepted Application; and no pending Application
 * coexists with an accepted one (after an accept, others are rejected).
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { reduce, type TaskModel } from '../../src/domain/taskMachine';
import { taskModel, requestSequence } from './arbitraries';

const RUNS = { numRuns: 200 };

const ASSIGNED_STATUSES = new Set(['in_progress', 'submitted', 'completed']);

/** Assert the Property-12 invariant on a single model snapshot. */
function assertInvariant(m: TaskModel): void {
  const accepted = m.applications.filter((a) => a.status === 'accepted');

  // Req 6.2, 6.5: at most one accepted application.
  expect(accepted.length).toBeLessThanOrEqual(1);

  // Req 6.6, 8.5, 8.7: assignee presence matches the lifecycle stage.
  if (ASSIGNED_STATUSES.has(m.status)) {
    expect(m.assigneeId).not.toBeNull();
  } else {
    // open / cancelled -> no assignee.
    expect(m.assigneeId).toBeNull();
  }

  // Req 6.5, 6.6: when there is an assignee it equals the accepted applicant.
  if (m.assigneeId !== null) {
    expect(accepted.length).toBe(1);
    expect(accepted[0].applicantId).toBe(m.assigneeId);
  }

  // Req 6.6: once a task has an accepted application, no application is pending.
  if (accepted.length === 1) {
    expect(m.applications.some((a) => a.status === 'pending')).toBe(false);
  }
}

describe('reduce — Property 12: single Assignee (Req 6.2, 6.5, 6.6, 8.5, 8.7)', () => {
  it('Req 6.2, 6.5, 6.6, 8.5, 8.7: invariant holds after every step of a random request sequence', () => {
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

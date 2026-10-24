/**
 * Property-based test for the dashboard next-action label in
 * `src/domain/nextAction.ts`.
 *
 * Covers design Correctness Property 16: Dashboard next-action invariant.
 *
 * Feature: bounty-platform, Property 16: Dashboard next-action invariant
 *
 * Validates: Requirements 14.4, 14.5
 *
 * An independent oracle re-derives the expected label from the raw
 * (task, memberId, list) tuple per Requirement 14.4 and the Req 14.5 guard
 * (Posted actions require the creator, Working actions require the assignee).
 * The test asserts `nextActionLabel` equals the oracle for every combination,
 * and separately that any non-"No action needed" label is only ever returned to
 * the correct party when the status/reward actually permit the action.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  nextActionLabel,
  type DashboardTask,
  type NextAction,
} from '../../src/domain/nextAction';
import { dashboardTask, memberId, listKind } from './arbitraries';

const RUNS = { numRuns: 200 };

/**
 * Independent oracle for Req 14.4 + 14.5. Returns the exact label the UI must
 * show for this (task, member, list) tuple without calling the SUT.
 */
function oracleLabel(
  t: DashboardTask,
  memberId: string,
  list: 'posted' | 'working',
): NextAction {
  if (list === 'posted') {
    if (t.creatorId !== memberId) return 'No action needed';
    if (t.status === 'open' && t.pendingApplicationCount >= 1) return 'Review applicants';
    if (t.status === 'submitted') return 'Confirm completion';
    if (t.status === 'completed' && t.rewardStatus === 'pending') return 'Settle reward';
    return 'No action needed';
  }
  if (t.assigneeId !== memberId) return 'No action needed';
  if (t.status === 'in_progress') return 'Submit work';
  if (t.rewardType === 'nonmonetary' && t.rewardStatus === 'delivered') {
    return 'Confirm reward received';
  }
  return 'No action needed';
}

describe('nextActionLabel — Property 16: dashboard next-action invariant (Req 14.4, 14.5)', () => {
  it('Req 14.4: the label exactly equals the independently-derived expected label for every combination', () => {
    fc.assert(
      fc.property(dashboardTask, memberId, listKind, (t, member, list) => {
        expect(nextActionLabel(t, member, list)).toBe(oracleLabel(t, member, list));
      }),
      RUNS,
    );
  });

  it('Req 14.5: a non-"No action needed" label is returned only to the correct party when status/reward permit it', () => {
    fc.assert(
      fc.property(dashboardTask, memberId, listKind, (t, member, list) => {
        const label = nextActionLabel(t, member, list);
        if (label === 'No action needed') return;

        if (list === 'posted') {
          // Posted actions belong to the creator only (Req 14.5).
          expect(t.creatorId).toBe(member);
          if (label === 'Review applicants') {
            expect(t.status).toBe('open');
            expect(t.pendingApplicationCount).toBeGreaterThanOrEqual(1);
          } else if (label === 'Confirm completion') {
            expect(t.status).toBe('submitted');
          } else if (label === 'Settle reward') {
            expect(t.status).toBe('completed');
            expect(t.rewardStatus).toBe('pending');
          } else {
            throw new Error(`Unexpected posted label: ${label}`);
          }
        } else {
          // Working actions belong to the assignee only (Req 14.5).
          expect(t.assigneeId).toBe(member);
          if (label === 'Submit work') {
            expect(t.status).toBe('in_progress');
          } else if (label === 'Confirm reward received') {
            expect(t.rewardType).toBe('nonmonetary');
            expect(t.rewardStatus).toBe('delivered');
          } else {
            throw new Error(`Unexpected working label: ${label}`);
          }
        }
      }),
      RUNS,
    );
  });
});

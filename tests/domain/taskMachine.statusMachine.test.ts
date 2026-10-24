/**
 * Property-based test for the Task status state machine in
 * `src/domain/taskMachine.ts`.
 *
 * Covers design Correctness Property 13: Task status state machine.
 *
 * Feature: bounty-platform, Property 13: Task status state machine
 *
 * Validates: Requirements 7.3, 8.1, 8.4, 8.6
 *
 * Folding a random sequence, every successful status change must be one of the
 * allowed edges (Open->In_Progress, In_Progress->Submitted, Submitted->
 * Completed, Open->Cancelled); the observed status history is always a prefix
 * of [open, in_progress, submitted, completed] OR exactly [open, cancelled];
 * and completed / cancelled are terminal (never change afterward).
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { reduce } from '../../src/domain/taskMachine';
import type { TaskStatus } from '../../src/domain/constants';
import { taskModel, requestSequence } from './arbitraries';

const RUNS = { numRuns: 200 };

// Allowed single-step transitions (Req 7.3, 8.1, 8.4).
const ALLOWED_EDGES = new Set<string>([
  'open->in_progress',
  'in_progress->submitted',
  'submitted->completed',
  'open->cancelled',
]);

const LINEAR_PATH: TaskStatus[] = ['open', 'in_progress', 'submitted', 'completed'];
const CANCEL_PATH: TaskStatus[] = ['open', 'cancelled'];

/** Is `seq` a prefix of `path`? */
function isPrefixOf(seq: TaskStatus[], path: TaskStatus[]): boolean {
  if (seq.length > path.length) return false;
  return seq.every((s, i) => s === path[i]);
}

describe('reduce — Property 13: Task status state machine (Req 7.3, 8.1, 8.4, 8.6)', () => {
  it('Req 7.3, 8.1, 8.4, 8.6: successful transitions follow the allowed edges and history stays on a valid path', () => {
    fc.assert(
      fc.property(taskModel, requestSequence, (initial, requests) => {
        let model = initial;
        // Collapsed status history (consecutive duplicates removed).
        const history: TaskStatus[] = [model.status];

        for (const req of requests) {
          const prev = model.status;
          const res = reduce(model, req);
          if (!res.ok) continue;
          model = res.model;
          const next = model.status;

          if (next !== prev) {
            // Req 7.3/8.1/8.4: only the allowed edges may occur.
            expect(ALLOWED_EDGES.has(`${prev}->${next}`)).toBe(true);
            // Req 8.6: terminal statuses never change.
            expect(prev).not.toBe('completed');
            expect(prev).not.toBe('cancelled');
            history.push(next);
          }
        }

        // The collapsed history must be a prefix of the linear path OR the
        // exact cancel path.
        const validLinear = isPrefixOf(history, LINEAR_PATH);
        const validCancel =
          history.length === CANCEL_PATH.length &&
          history.every((s, i) => s === CANCEL_PATH[i]);
        const validOpenOnly = history.length === 1 && history[0] === 'open';
        expect(validLinear || validCancel || validOpenOnly).toBe(true);
      }),
      RUNS,
    );
  });
});

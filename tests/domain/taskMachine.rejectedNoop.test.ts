/**
 * Property-based test for rejection no-ops in `src/domain/taskMachine.ts`.
 *
 * Covers design Correctness Property 11: Rejected requests change nothing.
 *
 * Feature: bounty-platform, Property 11: Rejected requests change nothing
 *
 * Validates: Requirements 5.3, 5.6, 6.7, 6.8, 7.5, 7.6, 7.8, 8.2, 8.3, 8.4,
 * 9.7, 9.12
 *
 * For a random model and a single random request, if `reduce` returns
 * `ok: false` the returned model must deep-equal the input. The same no-op
 * guarantee is also checked at every step while folding a random sequence, so
 * rejections encountered mid-run never mutate the threaded model.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { reduce } from '../../src/domain/taskMachine';
import { taskModel, request, requestSequence } from './arbitraries';

const RUNS = { numRuns: 200 };

describe('reduce — Property 11: rejected requests change nothing (Req 5.3, 5.6, 6.7, 6.8, 7.5, 7.6, 7.8, 8.2, 8.3, 8.4, 9.7, 9.12)', () => {
  it('Req 5.3-9.12: a single rejected request returns the input model deeply unchanged', () => {
    fc.assert(
      fc.property(taskModel, request, (model, req) => {
        const before = structuredClone(model);
        const res = reduce(model, req);
        if (!res.ok) {
          expect(res.model).toEqual(before);
          // And the SUT must not have mutated the caller's model in place.
          expect(model).toEqual(before);
        }
      }),
      RUNS,
    );
  });

  it('Req 5.3-9.12: in a folded sequence, every rejected step leaves the threaded model unchanged', () => {
    fc.assert(
      fc.property(taskModel, requestSequence, (initial, requests) => {
        let model = initial;
        for (const req of requests) {
          const before = structuredClone(model);
          const res = reduce(model, req);
          if (res.ok) {
            model = res.model;
          } else {
            expect(res.model).toEqual(before);
            expect(model).toEqual(before);
          }
        }
      }),
      RUNS,
    );
  });
});

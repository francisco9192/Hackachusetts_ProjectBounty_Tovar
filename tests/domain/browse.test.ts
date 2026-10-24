/**
 * Property-based test for browse filtering in `src/domain/browse.ts`.
 *
 * Covers design Correctness Property 8: Browse filter soundness and
 * monotonicity.
 *
 * Feature: bounty-platform, Property 8: Browse filter soundness and monotonicity
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 *
 * Soundness is checked directly against the raw filter state (an independent
 * re-derivation of each predicate), not by calling `filterTasks` to decide what
 * the answer "should" be. Monotonicity compares id-sets of results with and
 * without one added filter.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { filterTasks, type BrowseFilters, type TaskSummary } from '../../src/domain/browse';
import { taskSummaryList, browseFilters, poolState } from './arbitraries';

const RUNS = { numRuns: 200 };

/** Case-insensitive substring, matching the implementation's `containsCI`. */
function containsCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Independent oracle: does this task satisfy the active filters? (Req 4.2-4.7) */
function oracleMatches(t: TaskSummary, f: BrowseFilters): boolean {
  if (f.usState === null) return false;
  if (t.status !== 'open') return false;
  if (t.usState !== f.usState) return false;

  const town = (f.town ?? '').trim();
  if (town !== '' && !containsCI(t.town, town)) return false;

  if (f.category !== undefined && t.category !== f.category) return false;
  if (f.rewardType !== undefined && t.rewardType !== f.rewardType) return false;

  const keyword = (f.keyword ?? '').trim();
  if (keyword !== '') {
    const hit =
      containsCI(t.title, keyword) ||
      containsCI(t.description, keyword) ||
      t.skills.some((s) => containsCI(s, keyword));
    if (!hit) return false;
  }
  return true;
}

describe('filterTasks — Property 8: browse filter soundness and monotonicity (Req 4.1-4.8)', () => {
  it('Req 4.2, 4.3, 4.4, 4.5, 4.6, 4.7: every returned task is open, in-state, and matches every active filter', () => {
    fc.assert(
      fc.property(taskSummaryList, browseFilters, (tasks, f) => {
        const result = filterTasks(tasks, f);
        for (const t of result) {
          expect(t.status).toBe('open');
          expect(t.usState).toBe(f.usState);
          expect(oracleMatches(t, f)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('Req 4.2, 4.3, 4.4, 4.5, 4.6, 4.7: result equals the independently-derived matching set (completeness + soundness)', () => {
    fc.assert(
      fc.property(taskSummaryList, browseFilters, (tasks, f) => {
        const expectedIds = new Set(tasks.filter((t) => oracleMatches(t, f)).map((t) => t.id));
        const gotIds = new Set(filterTasks(tasks, f).map((t) => t.id));
        expect(gotIds).toEqual(expectedIds);
      }),
      RUNS,
    );
  });

  it('Req 4.2: a null US_State yields an empty list', () => {
    fc.assert(
      fc.property(taskSummaryList, browseFilters, (tasks, f) => {
        const result = filterTasks(tasks, { ...f, usState: null });
        expect(result).toEqual([]);
      }),
      RUNS,
    );
  });

  it('Req 4.1, 4.3: results are sorted by createdAt descending, ties broken by id ascending', () => {
    fc.assert(
      fc.property(taskSummaryList, browseFilters, (tasks, f) => {
        const result = filterTasks(tasks, f);
        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1];
          const cur = result[i];
          const ordered =
            prev.createdAt > cur.createdAt ||
            (prev.createdAt === cur.createdAt && prev.id < cur.id);
          expect(ordered).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('Req 4.8: adding any one active filter yields a subset of the result without it (metamorphic)', () => {
    fc.assert(
      fc.property(
        taskSummaryList,
        poolState,
        // One extra filter to add on top of the state-only base.
        fc.record({
          town: fc.constantFrom('Boston', 'Cambridge', 'bos'),
          category: fc.constantFrom('website', 'programming', 'writing') as fc.Arbitrary<
            TaskSummary['category']
          >,
          rewardType: fc.constantFrom('monetary', 'nonmonetary', 'volunteer') as fc.Arbitrary<
            TaskSummary['rewardType']
          >,
          keyword: fc.constantFrom('logo', 'design', 'react'),
        }),
        fc.constantFrom('town', 'category', 'rewardType', 'keyword') as fc.Arbitrary<
          'town' | 'category' | 'rewardType' | 'keyword'
        >,
        (tasks, state, extra, which) => {
          const base: BrowseFilters = { usState: state };
          const withFilter: BrowseFilters = { ...base, [which]: extra[which] };

          const baseIds = new Set(filterTasks(tasks, base).map((t) => t.id));
          const withIds = filterTasks(tasks, withFilter).map((t) => t.id);

          for (const id of withIds) {
            expect(baseIds.has(id)).toBe(true);
          }
        },
      ),
      RUNS,
    );
  });

  it('Req 4.4, 4.7: empty/whitespace town and keyword filters are inactive (same result as omitting them)', () => {
    fc.assert(
      fc.property(taskSummaryList, poolState, (tasks, state) => {
        const omitted = filterTasks(tasks, { usState: state });
        const blank = filterTasks(tasks, { usState: state, town: '   ', keyword: '  ' });
        expect(blank.map((t) => t.id)).toEqual(omitted.map((t) => t.id));
      }),
      RUNS,
    );
  });
});

/**
 * Browse filtering for the public task list (Req 4).
 *
 * This module is PURE: no network, no storage, no `Date.now`. `filterTasks`
 * takes a snapshot of task summaries and the active filter state and returns
 * the deterministic result set the browse page should display.
 *
 * The filters combine with logical AND and only match Open Tasks, which yields
 * the metamorphic property (Property 8 / Req 4.8): adding any single active
 * filter produces a result set that is a subset of the result without it.
 *
 * _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
 */

import type { UsState, Category, RewardType, TaskStatus } from './constants';

/**
 * The fields of a Task needed to filter and sort the browse list. `createdAt`
 * is an ISO timestamp string; `town`, `title`, `description`, and `skills`
 * feed the Town and keyword filters.
 */
export interface TaskSummary {
  id: string;
  usState: UsState;
  status: TaskStatus;
  category: Category;
  rewardType: RewardType;
  title: string;
  description: string;
  skills: string[];
  town: string;
  /** ISO timestamp of Task creation, used to sort newest first. */
  createdAt: string;
}

/**
 * The active browse filter state. A `null` `usState` means no state has been
 * picked yet (Req 4.2): the result is always empty. `town` and `keyword` that
 * are empty after trimming are treated as inactive.
 */
export interface BrowseFilters {
  usState: UsState | null;
  town?: string;
  category?: Category;
  rewardType?: RewardType;
  keyword?: string;
}

/** True when `haystack` contains `needle`, compared case-insensitively. */
function containsCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Filter and sort tasks for the browse page.
 *
 * A task is included only when ALL of the following hold:
 * - `f.usState` is not null (otherwise the result is empty — Req 4.2);
 * - `task.status === 'open'`;
 * - `task.usState === f.usState`;
 * - Town filter inactive (empty after trim) OR `task.town` contains the
 *   trimmed filter text, case-insensitively (Req 4.4);
 * - Category filter inactive OR `task.category === f.category` (Req 4.5);
 * - Reward_Type filter inactive OR `task.rewardType === f.rewardType` (Req 4.6);
 * - keyword filter inactive (empty after trim) OR the trimmed keyword appears
 *   case-insensitively in the title, description, or any skill (Req 4.7).
 *
 * Results are sorted by `createdAt` descending (newest first); ties break by
 * `id` ascending so the output is fully deterministic (Req 4.1, 4.3).
 */
export function filterTasks(tasks: TaskSummary[], f: BrowseFilters): TaskSummary[] {
  // Req 4.2: no active state selected -> show nothing.
  if (f.usState === null) return [];
  const activeState = f.usState;

  const town = (f.town ?? '').trim();
  const keyword = (f.keyword ?? '').trim();
  const category = f.category;
  const rewardType = f.rewardType;

  const matched = tasks.filter((t) => {
    if (t.status !== 'open') return false;
    if (t.usState !== activeState) return false;
    if (town !== '' && !containsCI(t.town, town)) return false;
    if (category !== undefined && t.category !== category) return false;
    if (rewardType !== undefined && t.rewardType !== rewardType) return false;
    if (keyword !== '') {
      const inText =
        containsCI(t.title, keyword) ||
        containsCI(t.description, keyword) ||
        t.skills.some((s) => containsCI(s, keyword));
      if (!inText) return false;
    }
    return true;
  });

  return matched.sort((a, b) => {
    if (a.createdAt < b.createdAt) return 1;
    if (a.createdAt > b.createdAt) return -1;
    // Stable, deterministic tie-break on equal createdAt.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

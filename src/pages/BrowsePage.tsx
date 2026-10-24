/**
 * BrowsePage — the public task browser at `/browse` (Req 4.1-4.10).
 *
 * PUBLIC route: both Visitors and Members reach it. The ACTIVE US_State drives
 * what the server fetches:
 *   - Member (signed in): the active state DEFAULTS to the member's own profile
 *     state (Req 4.1). The state <Select> still renders so they can look at
 *     other states (Req 4.3). The default is loaded once via
 *     `getCurrentUserId` -> `getProfile`; if that lookup fails the page still
 *     works — the member just starts with no state picked.
 *   - Visitor (not signed in): NO default. The state <Select> shows a
 *     "Select a state" prompt and NO tasks appear until one is chosen (Req 4.2).
 *
 * DATA: whenever the active state changes we call `getOpenTasksByState` (the
 * server already filters to open + that state) and keep the raw
 * `TaskSummary[]`. A `<Loading/>` covers the fetch and `<ErrorState onRetry/>`
 * covers a failure. The remaining filters are applied CLIENT-SIDE through the
 * pure `filterTasks`, which is what makes the metamorphic subset property hold
 * (Req 4.8): adding a filter can only shrink the result.
 *
 * FILTERS (Req 4.4-4.7): a Town text input, a Category select, a Reward_Type
 * select, and a keyword search input. They are assembled into a
 * {@link BrowseFilters} object `{ usState, town, category, rewardType, keyword }`
 * where empty strings are omitted (left `undefined`), so an empty Town/keyword
 * is inactive and the "All …" select option maps to `undefined`. "Clear
 * filters" (Req 4.9) resets town/category/rewardType/keyword but keeps the
 * active state.
 *
 * CARDS (Req 4.10): each card shows the title (link to `/tasks/:id`), the
 * humanized Category badge, a Reward summary, the Skills, Town + full state
 * name, and a short description preview. `TaskSummary` carries only the
 * Reward_Type (not the amount, deadline, or creator name), so the reward
 * summary is the `RewardTypeBadge`; no amount is fabricated. Enriching the
 * summary with the dollar amount is left to a later polish task.
 *
 * All data access goes through `src/lib/api.ts`; all user text renders through
 * normal JSX so React escapes it.
 *
 * _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  AppLayout,
  Badge,
  Card,
  ErrorState,
  Input,
  Loading,
  RewardTypeBadge,
  Select,
} from '../components';
import { getCurrentUserId, getOpenTasksByState, getProfile } from '../lib/api';
import { useAuth } from '../lib/auth';
import { filterTasks, type BrowseFilters, type TaskSummary } from '../domain/browse';
import {
  CATEGORIES,
  REWARD_TYPES,
  US_STATES,
  isCategory,
  isRewardType,
  isUsState,
  stateName,
  type Category,
  type RewardType,
  type UsState,
} from '../domain/constants';
import { humanize } from '../domain/labels';

/** Load status for the tasks fetch of the active state. */
type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'loaded'; tasks: TaskSummary[] };

/** The client-side filter values (raw strings from the controls). */
interface FilterValues {
  town: string;
  category: string;
  rewardType: string;
  keyword: string;
}

const EMPTY_FILTERS: FilterValues = {
  town: '',
  category: '',
  rewardType: '',
  keyword: '',
};

/**
 * DEMO: default the active state so Browse shows listings immediately for
 * everyone (all seeded demo data is in Massachusetts). Change this one constant
 * to revert to a no-default, user-picks-a-state experience.
 */
const DEMO_DEFAULT_STATE: UsState = 'MA';

export function BrowsePage() {
  const { userId, loading: authLoading } = useAuth();

  /** The active state: null until a member default loads or a user picks one. */
  const [activeState, setActiveState] = useState<UsState | null>(DEMO_DEFAULT_STATE);
  /** True while we are resolving the member's default state on first load. */
  const [resolvingDefault, setResolvingDefault] = useState(false);

  const [load, setLoad] = useState<LoadState>({ phase: 'idle' });
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);

  /**
   * On first load for a signed-in member, default the active state to their
   * profile state (Req 4.1). Best-effort: any failure leaves `activeState`
   * null, so the member simply picks a state like a visitor. Visitors skip
   * this entirely (Req 4.2).
   */
  useEffect(() => {
    if (authLoading) return;
    if (userId === null) return;
    let cancelled = false;
    setResolvingDefault(true);
    (async () => {
      try {
        const ownId = await getCurrentUserId();
        if (ownId === null) return;
        const data = await getProfile(ownId);
        if (!cancelled && data !== null) {
          setActiveState((prev) => prev ?? data.profile.usState);
        }
      } catch {
        // Default is a convenience; leave the state unpicked on failure.
      } finally {
        if (!cancelled) setResolvingDefault(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Resolve the default exactly once per auth resolution.
  }, [authLoading, userId]);

  /** Fetch the active state's open tasks (server filters to open + state). */
  const loadTasks = useCallback(async (state: UsState) => {
    setLoad({ phase: 'loading' });
    try {
      const tasks = await getOpenTasksByState(state);
      setLoad({ phase: 'loaded', tasks });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not load tasks for this state.';
      setLoad({ phase: 'error', message });
    }
  }, []);

  useEffect(() => {
    if (activeState === null) {
      setLoad({ phase: 'idle' });
      return;
    }
    void loadTasks(activeState);
  }, [activeState, loadTasks]);

  function handleStateChange(value: string) {
    setActiveState(isUsState(value) ? value : null);
  }

  function setFilter(key: keyof FilterValues, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  /**
   * Assemble the {@link BrowseFilters}: empty strings become omitted/undefined
   * so a blank Town/keyword is inactive and the "All …" option clears the
   * category/reward-type filter. Validated against the domain unions so a
   * stray value can never slip through as the wrong type.
   */
  const browseFilters: BrowseFilters = useMemo(() => {
    const town = filters.town.trim();
    const keyword = filters.keyword.trim();
    const category: Category | undefined = isCategory(filters.category)
      ? filters.category
      : undefined;
    const rewardType: RewardType | undefined = isRewardType(filters.rewardType)
      ? filters.rewardType
      : undefined;
    return {
      usState: activeState,
      ...(town !== '' ? { town } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(rewardType !== undefined ? { rewardType } : {}),
      ...(keyword !== '' ? { keyword } : {}),
    };
  }, [activeState, filters]);

  const rawTasks = load.phase === 'loaded' ? load.tasks : [];
  const visibleTasks = useMemo(
    () => filterTasks(rawTasks, browseFilters),
    [rawTasks, browseFilters],
  );

  const anyFilterActive =
    browseFilters.town !== undefined ||
    browseFilters.category !== undefined ||
    browseFilters.rewardType !== undefined ||
    browseFilters.keyword !== undefined;

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-ink">Browse local tasks</h1>
      <p className="mt-1 text-ink-muted">
        Find open opportunities near you. Work stays in your local community, so
        you only see and apply to tasks in one state at a time.
      </p>

      {/* DEMO fine print for signed-out visitors: all seeded tasks are in MA. */}
      {userId === null ? (
        <p className="mt-4 rounded-card border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Note: during the demo, tasks are currently posted only in the state of
          Massachusetts. Select Massachusetts to see open tasks.
        </p>
      ) : null}

      {/* For a signed-in member the state is known from their profile, so we
          show it as read-only context instead of a selector. A signed-out
          visitor still needs the selector to choose a state to browse. */}
      {userId !== null && activeState !== null ? (
        <p className="mt-6 text-sm text-ink-muted">
          Showing open tasks in{' '}
          <span className="font-semibold text-ink">{stateName(activeState)}</span>{' '}
          - your local community.
        </p>
      ) : null}

      {/* Filters (state selector only shown to signed-out visitors). */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {userId === null ? (
          <Select
            id="browse-state"
            label="State"
            hint="Choose a state to see its open tasks."
            value={activeState ?? ''}
            onChange={(e) => handleStateChange(e.target.value)}
          >
            <option value="">Select a state</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Input
          id="browse-town"
          label="Town"
          hint="Filter by town or city."
          value={filters.town}
          onChange={(e) => setFilter('town', e.target.value)}
          maxLength={60}
          disabled={activeState === null}
        />

        <Select
          id="browse-category"
          label="Category"
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value)}
          disabled={activeState === null}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </Select>

        <Select
          id="browse-reward-type"
          label="Reward type"
          value={filters.rewardType}
          onChange={(e) => setFilter('rewardType', e.target.value)}
          disabled={activeState === null}
        >
          <option value="">All reward types</option>
          {REWARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </Select>

        <Input
          id="browse-keyword"
          label="Search"
          hint="Match title, description, or a skill."
          value={filters.keyword}
          onChange={(e) => setFilter('keyword', e.target.value)}
          maxLength={100}
          disabled={activeState === null}
        />
      </div>

      {anyFilterActive ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-card border border-surface-border bg-surface px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {/* Results region */}
      <div className="mt-8">
        {activeState === null ? (
          <ChooseStatePrompt resolving={resolvingDefault} />
        ) : load.phase === 'loading' ? (
          <Loading label="Loading tasks" />
        ) : load.phase === 'error' ? (
          <ErrorState message={load.message} onRetry={() => void loadTasks(activeState)} />
        ) : visibleTasks.length === 0 ? (
          <EmptyState anyFilterActive={anyFilterActive} onClear={clearFilters} />
        ) : (
          <TaskList tasks={visibleTasks} />
        )}
      </div>
    </AppLayout>
  );
}

/** Prompt shown when no state is active yet (Req 4.2). */
function ChooseStatePrompt({ resolving }: { resolving: boolean }) {
  if (resolving) {
    return <Loading label="Finding your state" />;
  }
  return (
    <div className="rounded-card border border-surface-border bg-surface p-6 text-center">
      <p className="text-ink">Choose a state to see its open tasks.</p>
      <p className="mt-1 text-sm text-ink-muted">
        Tasks are local, so pick a state above to get started.
      </p>
    </div>
  );
}

/** Empty-state message plus a Clear filters action (Req 4.9). */
function EmptyState({
  anyFilterActive,
  onClear,
}: {
  anyFilterActive: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-card border border-surface-border bg-surface p-6 text-center">
      <p className="text-ink">No open tasks match your filters right now.</p>
      <p className="mt-1 text-sm text-ink-muted">
        Try widening your search or checking back later.
      </p>
      {anyFilterActive ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={onClear}
            className="rounded-card border border-surface-border bg-surface px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The responsive grid of task cards (Req 4.10). */
function TaskList({ tasks }: { tasks: TaskSummary[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} />
        </li>
      ))}
    </ul>
  );
}

/** A single task summary card. */
function TaskCard({ task }: { task: TaskSummary }) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          <Link
            to={`/tasks/${task.id}`}
            className="text-brand-700 underline hover:text-brand-600"
          >
            {task.title}
          </Link>
        </h2>
        <RewardTypeBadge type={task.rewardType} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge label={humanize(task.category)} tone="brand" />
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-ink">{task.description}</p>

      {task.skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {task.skills.map((skill) => (
            <li key={skill}>
              <Badge label={skill} />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-sm text-ink-muted">
        {task.town}, {stateName(task.usState)}
      </p>
    </Card>
  );
}

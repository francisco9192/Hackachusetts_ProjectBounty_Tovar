/**
 * DashboardPage — the member's "one page for my next step" at `/dashboard`
 * (Req 14.1-14.7).
 *
 * MEMBER-ONLY route: it lives under `<RequireAuth/>` in `App.tsx`, which
 * redirects Visitors to `/signin` (Req 14.7). We still guard defensively: the
 * current user id is resolved on mount and, if it is somehow absent, the page
 * shows a sign-in prompt rather than calling the data layer with no user.
 *
 * DATA: a single `getMyDashboard(userId)` call returns the three lists already
 * sorted newest first by the server (Req 14.1-14.3). A `<Loading/>` covers the
 * fetch and `<ErrorState onRetry/>` covers a failure, matching BrowsePage.
 *
 * THREE SECTIONS, each always rendered (so an empty list never hides the
 * others, Req 14.6) with its own empty-state message:
 *   1. "Posted"      — every task where the member is creator, in every status
 *                      including Cancelled. Row: title link, TaskStatusBadge,
 *                      RewardStatusBadge, and the next-action label from
 *                      `nextActionLabel(postedTask, userId, 'posted')`. The
 *                      posted items are already {@link DashboardTask}-shaped
 *                      (they carry `pendingApplicationCount`) plus `.task`.
 *   2. "Working On"  — every task where the member is the assignee
 *                      (in_progress / submitted / completed). Row: title link,
 *                      TaskStatusBadge, RewardStatusBadge, and the next-action
 *                      label. `Dashboard.working` is `Task[]`, so we build a
 *                      {@link DashboardTask} from each Task
 *                      (`pendingApplicationCount: 0` — unused for the working
 *                      list) and call `nextActionLabel(built, userId,
 *                      'working')`.
 *   3. "Applications"— every application the member submitted, in every status.
 *                      Row: related task title link + ApplicationStatusBadge.
 *
 * The next-action label is a hint pill, not a button (Req 14.4 is satisfied by
 * a label); the real actions live on the task detail page. Each row links to
 * the task so the member can go act there. The Req 14.5 invariant (only the
 * correct party sees a real action) is already enforced inside
 * `nextActionLabel`; we render exactly what it returns.
 *
 * All data access goes through `src/lib/api.ts`; all user text renders through
 * normal JSX so React escapes it; statuses are humanized via the Badge helpers.
 *
 * _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  AppLayout,
  ApplicationStatusBadge,
  Card,
  ErrorState,
  Loading,
  RewardStatusBadge,
  TaskStatusBadge,
} from '../components';
import { getCurrentUserId, getMyDashboard, type Dashboard, type Task } from '../lib/api';
import { nextActionLabel, type DashboardTask, type NextAction } from '../domain/nextAction';

/** Load status for the dashboard fetch. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'no-user' }
  | { phase: 'error'; message: string }
  | { phase: 'loaded'; userId: string; data: Dashboard };

export function DashboardPage() {
  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });

  const loadDashboard = useCallback(async () => {
    setLoad({ phase: 'loading' });
    try {
      const userId = await getCurrentUserId();
      // RequireAuth should prevent this, but guard anyway (Req 14.7).
      if (userId === null) {
        setLoad({ phase: 'no-user' });
        return;
      }
      const data = await getMyDashboard(userId);
      setLoad({ phase: 'loaded', userId, data });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not load your dashboard.';
      setLoad({ phase: 'error', message });
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-ink">Your dashboard</h1>
      <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand-600" />
      <p className="mt-3 text-ink-muted">
        Tasks you posted, tasks you are working on, and the applications you sent
        — with your next step on each.
      </p>

      <div className="mt-8">
        {load.phase === 'loading' ? (
          <Loading label="Loading your dashboard" />
        ) : load.phase === 'no-user' ? (
          <ErrorState
            message="Please sign in to see your dashboard."
            onRetry={() => void loadDashboard()}
          />
        ) : load.phase === 'error' ? (
          <ErrorState message={load.message} onRetry={() => void loadDashboard()} />
        ) : (
          <DashboardLists userId={load.userId} data={load.data} />
        )}
      </div>
    </AppLayout>
  );
}

/** The three stacked sections, each always shown with its own empty state. */
function DashboardLists({ userId, data }: { userId: string; data: Dashboard }) {
  return (
    <div className="flex flex-col gap-10">
      <Section
        title="Posted"
        count={data.posted.length}
        emptyMessage="You have not posted any tasks yet."
      >
        {data.posted.map((posted) => (
          <TaskRow
            key={posted.task.id}
            taskId={posted.task.id}
            title={posted.task.title}
            task={posted.task}
            action={nextActionLabel(posted, userId, 'posted')}
          />
        ))}
      </Section>

      <Section
        title="Working On"
        count={data.working.length}
        emptyMessage="You are not working on any tasks yet."
      >
        {data.working.map((task) => (
          <TaskRow
            key={task.id}
            taskId={task.id}
            title={task.title}
            task={task}
            action={nextActionLabel(toDashboardTask(task), userId, 'working')}
          />
        ))}
      </Section>

      <Section
        title="Applications"
        count={data.applications.length}
        emptyMessage="You have not applied to any tasks yet."
      >
        {data.applications.map(({ application, task }) => (
          <li key={application.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">
                <Link
                  to={`/tasks/${task.id}`}
                  className="text-brand-700 underline hover:text-brand-600"
                >
                  {task.title}
                </Link>
              </h3>
              <ApplicationStatusBadge status={application.status} />
            </Card>
          </li>
        ))}
      </Section>
    </div>
  );
}

/**
 * Build a {@link DashboardTask} from a full {@link Task} so the working-list
 * rows can call `nextActionLabel`. `pendingApplicationCount` is only consulted
 * for the Posted "Review applicants" case, so a working-list task can safely
 * use 0 — the label for a working row never depends on it.
 */
function toDashboardTask(task: Task): DashboardTask {
  return {
    creatorId: task.creatorId,
    assigneeId: task.assigneeId,
    status: task.status,
    rewardType: task.rewardType,
    rewardStatus: task.rewardStatus,
    pendingApplicationCount: 0,
  };
}

/**
 * One dashboard section: a heading and either the given rows (in a `<ul>`) or
 * an empty-state message when the list is empty (Req 14.6). The section is
 * always rendered so the other sections stay visible.
 */
function Section({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 border-b border-brand-100 pb-2">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="mt-2 rounded-card border border-surface-border bg-surface p-4 text-sm text-ink-muted">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">{children}</ul>
      )}
    </section>
  );
}

/** A Posted/Working row: title link, status + reward-status text, next action. */
function TaskRow({
  taskId,
  title,
  task,
  action,
}: {
  taskId: string;
  title: string;
  task: Task;
  action: NextAction;
}) {
  return (
    <li>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">
            <Link
              to={`/tasks/${taskId}`}
              className="text-brand-700 underline hover:text-brand-600"
            >
              {title}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              Status:
              <TaskStatusBadge status={task.status} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              Reward:
              <RewardStatusBadge status={task.rewardStatus} />
            </span>
          </div>
        </div>
        <NextActionPill action={action} />
      </Card>
    </li>
  );
}

/**
 * The next-action hint. "No action needed" is shown muted; a real action is
 * highlighted so the member spots their next step at a glance. It is a label,
 * not a button — the action itself lives on the task detail page (Req 14.4).
 */
function NextActionPill({ action }: { action: NextAction }) {
  const isActionable = action !== 'No action needed';
  const classes = [
    'inline-flex items-center rounded-card border px-2.5 py-1 text-xs font-medium',
    isActionable
      ? 'border-brand-100 bg-brand-50 text-brand-700'
      : 'border-surface-border bg-surface-alt text-ink-muted',
  ].join(' ');
  return <span className={classes}>{action}</span>;
}

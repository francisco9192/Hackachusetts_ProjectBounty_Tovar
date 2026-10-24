/**
 * TaskDetailPage — the task detail page at `/tasks/:id` (PUBLIC route).
 *
 * This page is reachable by Visitors and Members alike; it renders the task
 * info for everyone and gates every ACTION on the viewer's role, which is
 * derived from `useAuth().userId` against `task.creatorId` / `task.assigneeId`:
 *   - isVisitor    — not signed in (userId === null)
 *   - isCreator    — userId === task.creatorId
 *   - isAssignee   — userId === task.assigneeId
 *   - isOtherMember — signed in but neither creator nor assignee
 *
 * SCOPE (tasks 12.1 + 12.2 + 13 + 14): this build covers the task INFO panel,
 * the APPLY section (Req 5), the APPLICANT REVIEW / ACCEPT section (Req 6, 8),
 * the WORKFLOW actions on the assigned/open task (Req 7, 8): the assignee's
 * submit-work form, the submitted-work view, the creator's confirm-completion
 * action, and the creator's cancel action on an Open task — and REWARD
 * SETTLEMENT (Req 9). The message thread (task 21) and the report button
 * (task 23) are intentionally NOT built here — each has a clearly marked TODO
 * placeholder where it will slot in.
 *
 * REWARD SETTLEMENT (Req 9): inside the participant area (creator or assignee),
 * the `RewardSettlement` sub-component always shows the current Reward_Status as
 * TEXT via `RewardStatusBadge` (Req 9.14, 16.8) and surfaces the one settlement
 * action available to THIS viewer once the Task is Completed:
 *   - Monetary + Completed + Pending + creator: a "Simulated payment (demo
 *     only)" button (Req 9.2) calling `simulatePayment`, with the DemoNotice
 *     ("Demo only - no real money is moved") shown next to it and in the result
 *     (Req 9.5). After payment the Simulated_Payment record shows the amount
 *     with the same DemoNotice (Req 9.5). No card/bank fields exist anywhere
 *     (Req 9.4).
 *   - Nonmonetary + Completed + Pending + creator: a "Mark reward delivered"
 *     button calling `markRewardDelivered` (Req 9.8, 9.9).
 *   - Nonmonetary + Completed + Delivered + assignee: a "Confirm reward
 *     received" button calling `confirmRewardReceived` (Req 9.10, 9.11).
 *   - Volunteer: a brief "no reward to settle" line; no actions.
 * Where no action is available to the viewer, only the status text shows. All
 * settlement actions re-fetch via `loadDetail` on success, Toast success, and
 * surface mapped errors in the notice banner; buttons are disabled while in
 * flight. The server enforces every rule regardless (Req 9.7, 9.12).
 *
 * SUBMIT WORK (Req 7.1, 7.2, 7.7, 8.1): when the viewer is the assignee and the
 * task is In_Progress, a form collects a description (10-2000) and 1..5 links.
 * Links use a DYNAMIC ROW list — one URL input to start, an "Add another link"
 * button up to 5, and a remove button on extra rows — so each URL maps to a
 * fixed zero-based index. `validateSubmission` reports count errors under the
 * `urls` key (shown once, above the rows) and per-URL errors under `url.<i>`
 * (shown inline on the i-th row); focus moves to the first invalid control.
 * On success `submit_work` runs, a Toast shows, and we re-fetch so the task
 * flips to Submitted.
 *
 * VIEW SUBMISSION (Req 7.9): once the task is Submitted or Completed, the
 * creator and the assignee see the submission description (pre-line) and every
 * URL rendered via `SafeLink` (an anchor only for safe http(s) links).
 *
 * CONFIRM COMPLETION (Req 7.3, 8.1): the creator sees a Confirm-completion
 * button while the task is Submitted; it calls `confirm_completion` and we
 * re-fetch so the task shows Completed.
 *
 * CANCEL (Req 8.5): the creator sees a Cancel action while the task is Open. It
 * uses a two-click inline confirm (accessible, no native dialog) before calling
 * `cancel_task`; on success we re-fetch so the task shows Cancelled and pending
 * applications show Rejected.
 *
 * DATA: the page loads everything through `getTaskDetail(id)` into a load-state
 * machine (`<Loading/>` while loading, `<ErrorState onRetry/>` on failure). A
 * missing task makes `getTaskDetail` throw `NOT_FOUND`; we detect that via
 * `codeOf` and show a friendly "Task not found" panel rather than a scary
 * error. When signed in we ALSO best-effort load the viewer's own profile so we
 * know whether their state matches the task's state (to enable/annotate the
 * apply form, Req 5.2), and — for a creator — we load each applicant's public
 * profile so the applicants list can show name, town, skills and completed
 * count (Req 6.1).
 *
 * APPLY (Req 5): the apply form shows ONLY when the viewer is a signed-in
 * non-creator, the task is Open, and the viewer has no existing pending/accepted
 * application. The cover message is validated with the pure `validateCover`
 * (20-1000 chars); the submit button is disabled while the request is in flight
 * so one click creates at most one application. On success we re-fetch the
 * detail so the form hides and the viewer's pending application shows instead.
 * All backend rejections arrive already mapped to friendly messages by
 * `src/lib/api.ts`.
 *
 * ACCEPT (Req 6, 8): a creator sees every application (sorted ascending by
 * submission time by the api) with each applicant's details and a link to their
 * profile. Each PENDING application shows an Accept button (only while the task
 * is Open) that calls `acceptApplication`; on success we re-fetch so the task
 * flips to In_Progress, the accepted applicant becomes the assignee, and the
 * other pending applications show Rejected. A creator's task with zero
 * applications shows the "no one has applied yet" empty state (Req 6.9).
 *
 * All data access goes through `src/lib/api.ts`; all user text renders through
 * normal JSX so React escapes it.
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9, 6.1, 6.2, 6.3, 6.5,
 * 6.7, 6.8, 6.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.1, 8.2, 8.3,
 * 8.4, 8.5_
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  AppLayout,
  ApplicationStatusBadge,
  Badge,
  Button,
  Card,
  DemoNotice,
  ErrorState,
  Input,
  Loading,
  RewardDisplay,
  RewardStatusBadge,
  RewardTypeBadge,
  SafeLink,
  TaskStatusBadge,
  Textarea,
  Toast,
} from '../components';
import {
  acceptApplication,
  applyToTask,
  cancelTask,
  confirmCompletion,
  confirmRewardReceived,
  getCurrentUserId,
  getProfile,
  getTaskDetail,
  markRewardDelivered,
  simulatePayment,
  submitWork,
  type Application,
  type ProfileWithProjects,
  type SimulatedPayment,
  type Submission,
  type Task,
  type TaskDetail,
} from '../lib/api';
import { codeOf } from '../lib/errors';
import { useAuth } from '../lib/auth';
import { LIMITS, stateName } from '../domain/constants';
import { humanize } from '../domain/labels';
import { formatReward } from '../domain/reward';
import { validateCover, validateSubmission } from '../domain/validation';

/** Load status for the task-detail fetch. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'notFound' }
  | { phase: 'loaded'; detail: TaskDetail };

/** A transient banner message (success or error) shown above the content. */
interface Notice {
  variant: 'success' | 'error';
  message: string;
}

const COVER_ID = 'apply-cover';

/** Format an ISO date string as a readable local date, or a fallback. */
function readableDate(iso: string | null): string {
  if (iso === null) return 'No deadline';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();

  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
  const [notice, setNotice] = useState<Notice | null>(null);

  /** The viewer's own profile state (best-effort), for the same-state check. */
  const [viewerState, setViewerState] = useState<string | null>(null);

  /**
   * Public profiles (with completed projects) of the task's applicants, keyed by
   * applicant id (creator view). Carries completedProjects so the list can show
   * each applicant's completed-project count (Req 6.1).
   */
  const [applicantProfiles, setApplicantProfiles] = useState<
    Map<string, ProfileWithProjects>
  >(new Map());

  /** Fetch (or re-fetch) the full task detail bundle. */
  const loadDetail = useCallback(async () => {
    if (id === undefined) {
      setLoad({ phase: 'notFound' });
      return;
    }
    setLoad({ phase: 'loading' });
    try {
      const detail = await getTaskDetail(id);
      setLoad({ phase: 'loaded', detail });
    } catch (err) {
      // A missing task surfaces as NOT_FOUND — show a friendly not-found panel
      // rather than a generic error (the message is already user-safe either way).
      if (codeOf(err) === 'NOT_FOUND') {
        setLoad({ phase: 'notFound' });
        return;
      }
      const message =
        err instanceof Error ? err.message : 'We could not load this task.';
      setLoad({ phase: 'error', message });
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  /**
   * Best-effort: resolve the signed-in viewer's own profile state so we can tell
   * whether they are in the same state as the task (Req 5.2). Any failure leaves
   * `viewerState` null, which the apply section treats as "unknown" (it lets the
   * server enforce the same-state rule rather than hard-blocking the form).
   */
  useEffect(() => {
    if (authLoading) return;
    if (userId === null) {
      setViewerState(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ownId = await getCurrentUserId();
        if (ownId === null) return;
        const data = await getProfile(ownId);
        if (!cancelled && data !== null) setViewerState(data.profile.usState);
      } catch {
        // Same-state hint is a convenience; ignore failures.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  const detail = load.phase === 'loaded' ? load.detail : null;
  const task = detail?.task ?? null;

  const isVisitor = userId === null;
  const isCreator = task !== null && userId !== null && userId === task.creatorId;
  const isAssignee = task !== null && userId !== null && userId === task.assigneeId;

  /**
   * For a creator, load each applicant's public profile so the list can show
   * name, town, skills and completed-project count (Req 6.1). Done with
   * `Promise.all` over the applications; individual failures are tolerated (that
   * applicant simply shows without the enriched details). Re-runs whenever the
   * application set changes (e.g. after an accept re-fetch).
   */
  const applicantIdsKey = useMemo(
    () => (detail?.applications ?? []).map((a) => a.applicantId).join(','),
    [detail],
  );
  useEffect(() => {
    if (!isCreator || detail === null) {
      setApplicantProfiles(new Map());
      return;
    }
    const ids = [...new Set(detail.applications.map((a) => a.applicantId))];
    if (ids.length === 0) {
      setApplicantProfiles(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (applicantId): Promise<[string, ProfileWithProjects] | null> => {
          try {
            const data = await getProfile(applicantId);
            return data === null ? null : [applicantId, data];
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next = new Map<string, ProfileWithProjects>();
      for (const entry of entries) {
        if (entry !== null) next.set(entry[0], entry[1]);
      }
      setApplicantProfiles(next);
    })();
    return () => {
      cancelled = true;
    };
    // applicantIdsKey captures the set of applicant ids; isCreator gates it.
  }, [isCreator, detail, applicantIdsKey]);

  // ------------------------------------------------------------------ states
  if (load.phase === 'loading') {
    return (
      <AppLayout>
        <Loading label="Loading task" />
      </AppLayout>
    );
  }

  if (load.phase === 'error') {
    return (
      <AppLayout>
        <ErrorState message={load.message} onRetry={() => void loadDetail()} />
      </AppLayout>
    );
  }

  if (load.phase === 'notFound' || task === null || detail === null) {
    return (
      <AppLayout>
        <h1 className="text-2xl font-bold text-ink">Task not found</h1>
        <p className="mt-3 text-ink-muted">
          We couldn&apos;t find that task. It may have been removed or the link
          is incorrect.
        </p>
        <div className="mt-4">
          <Link
            to="/browse"
            className="text-brand-700 underline hover:text-brand-600"
          >
            Browse open tasks
          </Link>
        </div>
      </AppLayout>
    );
  }

  // ---------------------------------------------------------- derived values
  // The viewer's own application on this task (RLS only returns the viewer's
  // own applications to a non-creator, so this check is safe for everyone).
  const myApplication: Application | null =
    userId === null
      ? null
      : detail.applications.find((a) => a.applicantId === userId) ?? null;
  const hasActiveApplication =
    myApplication !== null &&
    (myApplication.status === 'pending' || myApplication.status === 'accepted');

  const sameStateKnown = viewerState !== null;
  const sameState = sameStateKnown && viewerState === task.usState;

  // Apply form shows only to a signed-in non-creator, on an Open task, with no
  // active application yet (Req 5.1, 5.4, 5.6).
  const canSeeApplyForm =
    !isVisitor && !isCreator && task.status === 'open' && !hasActiveApplication;

  async function handleAccept(appId: string) {
    setNotice(null);
    try {
      await acceptApplication(appId);
      setNotice({
        variant: 'success',
        message: 'Applicant accepted — the task is now in progress.',
      });
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not accept that applicant.';
      setNotice({ variant: 'error', message });
    }
  }

  // Submit work (assignee, Req 7.1): store the submission, announce success,
  // and re-fetch so the task flips to Submitted and the submitted work shows.
  async function handleSubmitWork(description: string, urls: string[]) {
    setNotice(null);
    await submitWork(task!.id, description, urls);
    setNotice({
      variant: 'success',
      message: 'Your work was submitted for review.',
    });
    await loadDetail();
  }

  // Confirm completion (creator, Req 7.3): mark the task complete, announce, and
  // re-fetch so it shows Completed. Errors surface in the notice banner.
  async function handleConfirmCompletion() {
    setNotice(null);
    try {
      await confirmCompletion(task!.id);
      setNotice({ variant: 'success', message: 'Task marked complete.' });
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not confirm completion.';
      setNotice({ variant: 'error', message });
    }
  }

  // Reward settlement — demo payment (creator, monetary, Req 9.3): record the
  // simulated payment and flip Reward_Status to Simulated_Paid, then re-fetch so
  // the payment record and new status show. Errors surface in the notice banner.
  async function handleSimulatePayment() {
    setNotice(null);
    try {
      await simulatePayment(task!.id);
      setNotice({
        variant: 'success',
        message: 'Simulated payment recorded. Demo only - no real money is moved.',
      });
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not settle the reward.';
      setNotice({ variant: 'error', message });
    }
  }

  // Reward settlement — mark delivered (creator, nonmonetary, Req 9.9): set
  // Reward_Status to Delivered, announce, and re-fetch.
  async function handleMarkDelivered() {
    setNotice(null);
    try {
      await markRewardDelivered(task!.id);
      setNotice({ variant: 'success', message: 'Reward marked as delivered.' });
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not update the reward.';
      setNotice({ variant: 'error', message });
    }
  }

  // Reward settlement — confirm received (assignee, nonmonetary, Req 9.11): set
  // Reward_Status to Received, announce, and re-fetch.
  async function handleConfirmReceived() {
    setNotice(null);
    try {
      await confirmRewardReceived(task!.id);
      setNotice({ variant: 'success', message: 'Reward confirmed as received.' });
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not update the reward.';
      setNotice({ variant: 'error', message });
    }
  }

  // Cancel an open task (creator, Req 8.5): cancel, announce, and re-fetch so the
  // task shows Cancelled and pending applications show Rejected.
  async function handleCancel() {
    setNotice(null);
    try {
      await cancelTask(task!.id);
      setNotice({ variant: 'success', message: 'Task cancelled.' });
      await loadDetail();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not cancel this task.';
      setNotice({ variant: 'error', message });
    }
  }

  return (
    <AppLayout>
      {notice !== null ? (
        <div className="mb-4">
          <Toast
            variant={notice.variant}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}

      {/* -------------------------------------------------- Task info panel */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{task.title}</h1>
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          Status:
          <TaskStatusBadge status={task.status} />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <RewardDisplay reward={task.reward} />
        <RewardTypeBadge type={task.rewardType} />
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-ink-muted">Category</dt>
          <dd className="text-ink">{humanize(task.category)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-muted">Location</dt>
          <dd className="text-ink">
            {task.town}, {stateName(task.usState)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-muted">Deadline</dt>
          <dd className="text-ink">{readableDate(task.deadline)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-ink-muted">Posted by</dt>
          <dd>
            <Link
              to={`/profile/${task.creatorId}`}
              className="text-brand-700 underline hover:text-brand-600"
            >
              View creator profile
            </Link>
          </dd>
        </div>
      </dl>

      {task.skills.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {task.skills.map((skill) => (
            <li key={skill}>
              <Badge label={skill} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        <h2 className="text-sm font-medium text-ink-muted">Description</h2>
        <p className="mt-1 whitespace-pre-line text-ink">{task.description}</p>
      </div>

      {/* --------------------------------------------- Assignee ("in progress") */}
      {task.assigneeId !== null && (isCreator || isAssignee) ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold text-ink">
            {humanize(task.status)}
          </h2>
          <p className="mt-1 text-ink">
            {isAssignee ? (
              <>You are assigned to this task.</>
            ) : (
              <>
                Assigned to{' '}
                <Link
                  to={`/profile/${task.assigneeId}`}
                  className="text-brand-700 underline hover:text-brand-600"
                >
                  this member
                </Link>
                .
              </>
            )}
          </p>
          {/* Assignee submits work while the task is In_Progress (Req 7.1). */}
          {isAssignee && task.status === 'in_progress' ? (
            <SubmitWorkForm onSubmit={handleSubmitWork} />
          ) : null}

          {/* Submitted work is visible to both participants once stored (Req 7.9). */}
          {(task.status === 'submitted' || task.status === 'completed') &&
          detail.submissions.length > 0 ? (
            <SubmissionView submission={detail.submissions[0]} />
          ) : null}

          {/* Creator confirms completion while the task is Submitted (Req 7.3). */}
          {isCreator && task.status === 'submitted' ? (
            <CreatorCompletionActions onConfirm={handleConfirmCompletion} />
          ) : null}

          {/* Reward settlement: current status + the one action for this viewer (Req 9). */}
          <RewardSettlement
            task={task}
            payment={detail.payment}
            isCreator={isCreator}
            isAssignee={isAssignee}
            onSimulatePayment={handleSimulatePayment}
            onMarkDelivered={handleMarkDelivered}
            onConfirmReceived={handleConfirmReceived}
          />

          {/* TODO(task 21): per-task message thread between creator and assignee. */}
        </Card>
      ) : null}

      {/* -------------------------------------------- Cancel (creator, open task) */}
      {isCreator && task.status === 'open' ? (
        <CancelTaskAction onCancel={handleCancel} />
      ) : null}

      {/* ----------------------------------------------------- Apply section */}
      <ApplySection
        isVisitor={isVisitor}
        isCreator={isCreator}
        taskStatus={task.status}
        canSeeApplyForm={canSeeApplyForm}
        myApplication={myApplication}
        sameStateKnown={sameStateKnown}
        sameState={sameState}
        taskStateName={stateName(task.usState)}
        onSignIn={() => navigate('/signin')}
        onApplied={() => {
          setNotice({ variant: 'success', message: 'Your application was sent.' });
          void loadDetail();
        }}
        onApply={(cover) => applyToTask(task.id, cover)}
      />

      {/* ------------------------------------------- Applicants (creator only) */}
      {isCreator ? (
        <ApplicantsSection
          applications={detail.applications}
          profiles={applicantProfiles}
          taskStatus={task.status}
          onAccept={handleAccept}
        />
      ) : null}

      {/* TODO(task 23): Report button for this task (any signed-in member). */}
    </AppLayout>
  );
}

// ===========================================================================
// Apply section (Req 5)
// ===========================================================================

interface ApplySectionProps {
  isVisitor: boolean;
  isCreator: boolean;
  taskStatus: string;
  canSeeApplyForm: boolean;
  myApplication: Application | null;
  sameStateKnown: boolean;
  sameState: boolean;
  taskStateName: string;
  onSignIn: () => void;
  onApplied: () => void;
  onApply: (cover: string) => Promise<string>;
}

function ApplySection({
  isVisitor,
  isCreator,
  taskStatus,
  canSeeApplyForm,
  myApplication,
  sameStateKnown,
  sameState,
  taskStateName,
  onSignIn,
  onApplied,
  onApply,
}: ApplySectionProps) {
  const [cover, setCover] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The creator never applies; show nothing here (the applicants list is theirs).
  if (isCreator) return null;

  // If the viewer already has an application, show its status instead of a form
  // (Req 5.4 shows one active application per member per task).
  if (myApplication !== null) {
    return (
      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-ink">Your application</h2>
        <p className="mt-2 flex items-center gap-2 text-ink">
          <span>Status:</span>
          <ApplicationStatusBadge status={myApplication.status} />
        </p>
        <div className="mt-3">
          <h3 className="text-sm font-medium text-ink-muted">Your cover message</h3>
          <p className="mt-1 whitespace-pre-line text-ink">
            {myApplication.coverMessage}
          </p>
        </div>
      </Card>
    );
  }

  // A visitor sees a prompt to sign in before applying (Req 5.9).
  if (isVisitor) {
    if (taskStatus !== 'open') return null;
    return (
      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-ink">Apply to this task</h2>
        <p className="mt-2 text-ink">Sign in to apply to this task.</p>
        <div className="mt-3">
          <Button onClick={onSignIn}>Sign in to apply</Button>
        </div>
      </Card>
    );
  }

  // Signed-in non-creator, no existing application: show the form only when the
  // task is still open (Req 5.6).
  if (!canSeeApplyForm) {
    if (taskStatus !== 'open') {
      return (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold text-ink">Apply to this task</h2>
          <p className="mt-2 text-ink">
            This task is no longer accepting applications.
          </p>
        </Card>
      );
    }
    return null;
  }

  // When we know the viewer's state differs, proactively disable the form and
  // explain why (Req 5.2); the server still enforces the rule on submit.
  const blockedByState = sameStateKnown && !sameState;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || blockedByState) return;

    setSubmitError(null);

    const result = validateCover({ coverMessage: cover });
    if (!result.ok) {
      const message = result.errors.coverMessage ?? 'Please check your cover message.';
      setFieldError(message);
      document.getElementById(COVER_ID)?.focus();
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    try {
      await onApply(result.value);
      setCover('');
      onApplied();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not send your application.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-semibold text-ink">Apply to this task</h2>
      {blockedByState ? (
        <p className="mt-2 text-ink" role="alert">
          You can only apply to tasks in your own state. This task is in{' '}
          {taskStateName}.
        </p>
      ) : (
        <form className="mt-3 space-y-4" onSubmit={handleSubmit} noValidate>
          {submitError !== null ? (
            <div role="alert" aria-live="assertive">
              <ErrorState message={submitError} />
            </div>
          ) : null}

          <Textarea
            id={COVER_ID}
            label="Cover message"
            hint="20 to 1000 characters. Tell the creator why you're a good fit."
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            error={fieldError ?? ''}
            rows={5}
            maxLength={1000}
          />

          <Button type="submit" loading={submitting}>
            Send application
          </Button>
        </form>
      )}
    </Card>
  );
}

// ===========================================================================
// Applicants section (Req 6, 8) — creator only
// ===========================================================================

interface ApplicantsSectionProps {
  applications: Application[];
  profiles: Map<string, ProfileWithProjects>;
  taskStatus: string;
  onAccept: (appId: string) => Promise<void>;
}

function ApplicantsSection({
  applications,
  profiles,
  taskStatus,
  onAccept,
}: ApplicantsSectionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-ink">Applicants</h2>

      {applications.length === 0 ? (
        <Card className="mt-3">
          <p className="text-ink">No one has applied yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Applications will appear here as members apply.
          </p>
        </Card>
      ) : (
        <ul className="mt-3 space-y-4">
          {applications.map((application) => (
            <li key={application.id}>
              <ApplicantRow
                application={application}
                profile={profiles.get(application.applicantId) ?? null}
                taskStatus={taskStatus}
                onAccept={onAccept}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ApplicantRowProps {
  application: Application;
  profile: ProfileWithProjects | null;
  taskStatus: string;
  onAccept: (appId: string) => Promise<void>;
}

function ApplicantRow({ application, profile, taskStatus, onAccept }: ApplicantRowProps) {
  const [accepting, setAccepting] = useState(false);

  const completedCount = profile?.completedProjects.length ?? 0;

  // An Accept button shows only for a pending application on an open task
  // (Req 6.2, 6.8, 8.1). Once the task leaves Open, no accept actions appear.
  const canAccept = taskStatus === 'open' && application.status === 'pending';

  async function handleClick() {
    if (accepting) return;
    setAccepting(true);
    try {
      await onAccept(application.id);
      // On success the parent re-fetches and this row unmounts/updates; on
      // failure the parent shows the error. Either way, release the busy state.
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">
            <Link
              to={`/profile/${application.applicantId}`}
              className="text-brand-700 underline hover:text-brand-600"
            >
              {profile !== null ? profile.profile.displayName : 'View applicant profile'}
            </Link>
          </h3>
          {profile !== null ? (
            <p className="mt-0.5 text-sm text-ink-muted">
              {profile.profile.town}, {stateName(profile.profile.usState)} ·{' '}
              {completedCount === 1
                ? '1 completed project'
                : `${completedCount} completed projects`}
            </p>
          ) : null}
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      {profile !== null && profile.profile.skills.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {profile.profile.skills.map((skill) => (
            <li key={skill}>
              <Badge label={skill} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <h4 className="text-sm font-medium text-ink-muted">Cover message</h4>
        <p className="mt-1 whitespace-pre-line text-ink">{application.coverMessage}</p>
      </div>

      {canAccept ? (
        <div className="mt-4">
          <Button loading={accepting} onClick={handleClick}>
            Accept applicant
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

// ===========================================================================
// Submit work form (Req 7.1, 7.2, 7.7, 8.1) — assignee only, task in_progress
// ===========================================================================

const SUBMIT_DESC_ID = 'submit-description';
/** The per-row URL input id: index i => `submit-url-i` (so focus can target it). */
function urlInputId(i: number): string {
  return `submit-url-${i}`;
}

interface SubmitWorkFormProps {
  /** Store the submission; resolves on success, throws a friendly Error on failure. */
  onSubmit: (description: string, urls: string[]) => Promise<void>;
}

/**
 * The assignee's submission form: a description Textarea plus a dynamic list of
 * 1..5 URL rows. Validation runs through the pure `validateSubmission`, which
 * reports a count problem under `urls` (rendered once above the rows) and a
 * per-URL problem under `url.<i>` (rendered inline on row i). On a validation
 * failure we move focus to the first invalid control; on a backend rejection we
 * show the already-friendly message inline and keep every entered value (Req 7.7).
 */
function SubmitWorkForm({ onSubmit }: SubmitWorkFormProps) {
  const { minCount, maxCount } = LIMITS.submissionUrls;

  const [description, setDescription] = useState('');
  // Start with a single empty URL row (minCount is 1).
  const [urls, setUrls] = useState<string[]>(['']);
  const [descError, setDescError] = useState<string | null>(null);
  const [urlsError, setUrlsError] = useState<string | null>(null);
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setUrlAt(i: number, value: string) {
    setUrls((prev) => prev.map((u, idx) => (idx === i ? value : u)));
  }

  function addUrl() {
    setUrls((prev) => (prev.length >= maxCount ? prev : [...prev, '']));
  }

  function removeUrl(i: number) {
    setUrls((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
    // Drop the per-URL error for the removed row (others re-validate on submit).
    setUrlErrors((prev) => {
      const next: Record<number, string> = {};
      for (const [key, msg] of Object.entries(prev)) {
        const idx = Number(key);
        if (idx < i) next[idx] = msg;
        else if (idx > i) next[idx - 1] = msg;
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitError(null);

    const result = validateSubmission({ description, urls });
    if (!result.ok) {
      const { errors } = result;
      // Split the flat error map into description / count / per-URL buckets.
      const nextUrlErrors: Record<number, string> = {};
      for (const [key, message] of Object.entries(errors)) {
        if (key.startsWith('url.')) {
          const idx = Number(key.slice('url.'.length));
          if (!Number.isNaN(idx)) nextUrlErrors[idx] = message;
        }
      }
      setDescError(errors.description ?? null);
      setUrlsError(errors.urls ?? null);
      setUrlErrors(nextUrlErrors);

      // Move focus to the first invalid control: description, then the earliest
      // bad URL row.
      if (errors.description !== undefined) {
        document.getElementById(SUBMIT_DESC_ID)?.focus();
      } else {
        const firstBad = Object.keys(nextUrlErrors)
          .map(Number)
          .sort((a, b) => a - b)[0];
        if (firstBad !== undefined) {
          document.getElementById(urlInputId(firstBad))?.focus();
        }
      }
      return;
    }

    setDescError(null);
    setUrlsError(null);
    setUrlErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.value.description, result.value.urls);
      // On success the parent re-fetches and this form unmounts (task leaves
      // In_Progress), so there is no need to reset local state.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not submit your work.';
      setSubmitError(message);
      setSubmitting(false);
    }
  }

  const canAddUrl = urls.length < maxCount;

  return (
    <div className="mt-4 border-t border-surface-border pt-4">
      <h3 className="text-base font-semibold text-ink">Submit your work</h3>
      <form className="mt-3 space-y-4" onSubmit={handleSubmit} noValidate>
        {submitError !== null ? (
          <div role="alert" aria-live="assertive">
            <ErrorState message={submitError} />
          </div>
        ) : null}

        <Textarea
          id={SUBMIT_DESC_ID}
          label="Description"
          hint={`${LIMITS.submissionDescription.min} to ${LIMITS.submissionDescription.max} characters. Describe what you did.`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={descError ?? ''}
          rows={5}
          maxLength={LIMITS.submissionDescription.max}
        />

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">
            Links to your work
          </legend>
          <p className="text-sm text-ink-muted">
            Add {minCount} to {maxCount} links (http:// or https://).
          </p>
          {urlsError !== null ? (
            <p className="text-sm text-danger" role="alert">
              {urlsError}
            </p>
          ) : null}

          {urls.map((url, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  id={urlInputId(i)}
                  label={`Link ${i + 1}`}
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrlAt(i, e.target.value)}
                  error={urlErrors[i] ?? ''}
                  maxLength={LIMITS.submissionUrls.maxLength}
                  placeholder="https://example.com/my-work"
                />
              </div>
              {urls.length > 1 ? (
                <div className="pt-7">
                  <Button
                    variant="secondary"
                    onClick={() => removeUrl(i)}
                    aria-label={`Remove link ${i + 1}`}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {canAddUrl ? (
            <Button variant="secondary" onClick={addUrl}>
              Add another link
            </Button>
          ) : null}
        </fieldset>

        <Button type="submit" loading={submitting}>
          Submit work
        </Button>
      </form>
    </div>
  );
}

// ===========================================================================
// Submission view (Req 7.9) — creator or assignee, task submitted/completed
// ===========================================================================

interface SubmissionViewProps {
  submission: Submission;
}

/**
 * Show the stored submission: its description (whitespace preserved) and every
 * URL rendered through `SafeLink`, which renders an anchor only for safe http(s)
 * links and plain text otherwise (Req 7.9, 10.4).
 */
function SubmissionView({ submission }: SubmissionViewProps) {
  return (
    <div className="mt-4 border-t border-surface-border pt-4">
      <h3 className="text-base font-semibold text-ink">Submitted work</h3>
      <p className="mt-2 whitespace-pre-line text-ink">{submission.description}</p>
      {submission.urls.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {submission.urls.map((url, i) => (
            <li key={`${i}-${url}`}>
              <SafeLink url={url} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ===========================================================================
// Creator completion action (Req 7.3, 8.1) — creator only, task submitted
// ===========================================================================

interface CreatorCompletionActionsProps {
  onConfirm: () => Promise<void>;
}

/** The creator's "Confirm completion" button, busy-guarded while in flight. */
function CreatorCompletionActions({ onConfirm }: CreatorCompletionActionsProps) {
  const [confirming, setConfirming] = useState(false);

  async function handleClick() {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
      // On success the parent re-fetches and this action unmounts (task leaves
      // Submitted); on failure the parent shows the error. Release the busy state.
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="mt-4 border-t border-surface-border pt-4">
      <p className="text-ink">
        This work has been submitted. Review it above, then confirm completion.
      </p>
      <div className="mt-3">
        <Button loading={confirming} onClick={handleClick}>
          Confirm completion
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// Cancel task action (Req 8.5) — creator only, task open
// ===========================================================================

interface CancelTaskActionProps {
  onCancel: () => Promise<void>;
}

/**
 * The creator's cancel action on an Open task. Cancelling is mildly destructive
 * (it rejects every pending application), so it uses a two-click inline confirm
 * rather than a native dialog: the first click reveals an explicit
 * "Yes, cancel this task" button alongside a "Keep task" button. This keeps the
 * confirmation keyboard-accessible and announced in the page (Req 8.5).
 */
function CancelTaskAction({ onCancel }: CancelTaskActionProps) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleConfirm() {
    if (cancelling) return;
    setCancelling(true);
    try {
      await onCancel();
      // On success the parent re-fetches and this action unmounts (task leaves
      // Open); on failure the parent shows the error. Release the busy state.
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-semibold text-ink">Cancel this task</h2>
      <p className="mt-2 text-ink">
        Cancelling closes the task and rejects every pending application. This
        cannot be undone.
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" loading={cancelling} onClick={handleConfirm}>
            Yes, cancel this task
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Keep task
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Cancel task
          </Button>
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// Reward settlement (Req 9) — creator or assignee, inside the participant area
// ===========================================================================

interface RewardSettlementProps {
  task: Task;
  payment: SimulatedPayment | null;
  isCreator: boolean;
  isAssignee: boolean;
  /** Record the demo payment (creator, monetary). */
  onSimulatePayment: () => Promise<void>;
  /** Mark the nonmonetary reward delivered (creator). */
  onMarkDelivered: () => Promise<void>;
  /** Confirm the nonmonetary reward received (assignee). */
  onConfirmReceived: () => Promise<void>;
}

/**
 * The reward-settlement block shown to a Task's participants. It mirrors the
 * trusted Reward_Rules (Req 9.15): it always shows the current Reward_Status as
 * text (Req 9.14) and renders the SINGLE action available to THIS viewer, and
 * only once the Task is Completed. When no action applies to the viewer it
 * shows just the status. The server enforces every condition regardless
 * (Req 9.7, 9.12), so this is purely a mirror for a clean UI.
 *
 * - Monetary: creator sees the demo-payment button while Pending; after payment
 *   both participants see the Simulated_Payment record. The demo-only notice
 *   appears next to the action and next to the record (Req 9.4, 9.5).
 * - Nonmonetary: creator marks delivered (Pending), assignee confirms received
 *   (Delivered); flows Pending -> Delivered -> Received (Req 9.8-9.11).
 * - Volunteer: Reward_Status is Not_Applicable; show a brief note, no actions.
 */
function RewardSettlement({
  task,
  payment,
  isCreator,
  isAssignee,
  onSimulatePayment,
  onMarkDelivered,
  onConfirmReceived,
}: RewardSettlementProps) {
  const [busy, setBusy] = useState(false);

  // Run a settlement action with a busy guard. On success the parent re-fetches
  // and this block re-renders with the new status; on failure the parent shows
  // the error. Either way, release the busy state.
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const isCompleted = task.status === 'completed';

  // The demo-only amount text for the payment record: prefer the Reward's own
  // formatted amount (exact agreed amount); the payment row carries the same
  // amount in cents (Req 9.6) as a belt-and-suspenders source.
  const amountText =
    task.reward.type === 'monetary'
      ? formatReward(task.reward).detail
      : null;

  return (
    <div className="mt-4 border-t border-surface-border pt-4">
      <h3 className="text-base font-semibold text-ink">Reward settlement</h3>

      {/* Current Reward_Status as text, to both participants (Req 9.14, 16.8). */}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-ink">
        <span>Reward status:</span>
        <RewardStatusBadge status={task.rewardStatus} />
      </p>

      {/* Volunteer: nothing to settle (Req 9.1 — Not_Applicable). */}
      {task.rewardType === 'volunteer' ? (
        <p className="mt-2 text-ink-muted">
          This is a volunteer task — no reward to settle.
        </p>
      ) : null}

      {/* -------------------------------------------------- Monetary reward */}
      {task.rewardType === 'monetary' ? (
        <>
          {/* Demo-payment action: creator only, Completed + Pending (Req 9.2). */}
          {isCreator && isCompleted && task.rewardStatus === 'pending' ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button loading={busy} onClick={() => void run(onSimulatePayment)}>
                  Simulated payment (demo only)
                </Button>
                <DemoNotice />
              </div>
            </div>
          ) : null}

          {/* Settled: show the Simulated_Payment record with the demo notice
              and the amount, to both participants (Req 9.3, 9.5). */}
          {task.rewardStatus === 'simulated_paid' ? (
            <div className="mt-3 rounded-card border border-surface-border bg-surface-alt p-3">
              <p className="flex flex-wrap items-center gap-2 text-ink">
                <span className="font-medium">Simulated payment</span>
                {amountText !== null ? <span>{amountText}</span> : null}
                <DemoNotice />
              </p>
              {payment !== null ? (
                <p className="mt-1 text-sm text-ink-muted">
                  Recorded {readableDate(payment.createdAt)}. No real money moved.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {/* ------------------------------------------------ Nonmonetary reward */}
      {task.rewardType === 'nonmonetary' ? (
        <>
          {/* Mark delivered: creator only, Completed + Pending (Req 9.8, 9.9). */}
          {isCreator && isCompleted && task.rewardStatus === 'pending' ? (
            <div className="mt-3">
              <Button loading={busy} onClick={() => void run(onMarkDelivered)}>
                Mark reward delivered
              </Button>
            </div>
          ) : null}

          {/* Confirm received: assignee only, Completed + Delivered (Req 9.10, 9.11). */}
          {isAssignee && isCompleted && task.rewardStatus === 'delivered' ? (
            <div className="mt-3">
              <Button loading={busy} onClick={() => void run(onConfirmReceived)}>
                Confirm reward received
              </Button>
            </div>
          ) : null}

          {/* When no action is available to this viewer, the status text above
              already tells them where things stand (e.g. a creator waiting on
              the assignee after Delivered, or an assignee waiting for delivery
              while Pending). Keep it quiet — nothing more to render here. */}
        </>
      ) : null}
    </div>
  );
}

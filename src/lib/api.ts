/**
 * Data access layer: the ONLY module in the app that talks to Supabase. Pages
 * and components call these typed functions; they never touch `supabase`
 * directly (steering: tech.md). Browser code uses the anon key only — every
 * read is guarded by Row Level Security and every status change goes through a
 * `security definer` RPC whose name and argument names match
 * `supabase/schema.sql` exactly.
 *
 * Error convention (consistent across this module): every function wraps its
 * network call in {@link withTimeout} and, on ANY failure, throws a plain
 * `Error` whose `message` is already user-safe (run through
 * {@link messageForError}). Pages therefore `try/catch` and show the caught
 * `error.message` in an `ErrorState`/`Toast` without any further mapping. Reads
 * that legitimately find nothing return an empty array or `null`; only real
 * failures throw.
 *
 * Mapping: database rows are `snake_case`; this module converts them to the
 * `camelCase` shapes the pure domain and the UI expect, routing reward columns
 * through `fromRow`/`toRow` so the UI always gets a {@link Reward} union.
 *
 * _Requirements: 8.2, 16.9, 17.4_
 */

import { supabase } from './supabase';
import { messageForError } from './errors';
import { withTimeout } from './withTimeout';

import { fromRow, toRow, type Reward, type RewardRow } from '../domain/reward';
import type {
  AgeBracket,
  ApplicationStatus,
  Category,
  RewardStatus,
  RewardType,
  TaskStatus,
  UsState,
} from '../domain/constants';
import type { TaskSummary } from '../domain/browse';
import type { DashboardTask } from '../domain/nextAction';
import type { NewReport, NewTask, ProfileUpdate } from '../domain/validation';
import type { ReportTargetType } from '../domain/constants';

// ---------------------------------------------------------------------------
// Untyped client view
// ---------------------------------------------------------------------------
// The shared `supabase` client is intentionally typed with an empty `Database`
// (`Record<string, never>`), so its `.from(...)`/`.rpc(...)` builders refuse
// concrete insert rows and rpc args at compile time. Rather than widen the
// shared type for the whole app, this module accesses those builders through a
// minimal local interface that accepts the operations loosely. ALL real type
// safety for this layer lives in the explicit Row types, arg objects, and
// mapped return shapes below — never leaking `any` outside this file.

interface QueryBuilderLike {
  select: (cols?: string) => QueryBuilderLike;
  insert: (row: unknown) => QueryBuilderLike;
  update: (row: unknown) => QueryBuilderLike;
  eq: (col: string, value: unknown) => QueryBuilderLike;
  in: (col: string, values: readonly unknown[]) => QueryBuilderLike;
  order: (col: string, opts?: { ascending?: boolean }) => QueryBuilderLike;
  maybeSingle: () => QueryBuilderLike;
  single: () => QueryBuilderLike;
}

interface SupabaseDataView {
  from: (table: string) => QueryBuilderLike;
  rpc: (fn: string, args: Record<string, unknown>) => QueryBuilderLike;
}

/** The single loose entry point for this module's queries and RPC calls. */
const db = supabase as unknown as SupabaseDataView;

// ===========================================================================
// Raw DB row shapes (explicit, so strict TS has no `any`)
// ===========================================================================
// We keep these minimal: exactly the columns the selects below request. The
// Supabase client in this repo is untyped (`Database = Record<string, never>`),
// so `.select()` returns loosely-typed data; we assert the returned data to
// these row shapes at the single mapping boundary and nowhere else.

interface ProfileRow {
  id: string;
  display_name: string;
  bio: string;
  skills: string[];
  us_state: string;
  town: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  reward_type: string;
  amount_cents: number | null;
  nonmonetary_kind: string | null;
  reward_description: string | null;
  estimated_value_cents: number | null;
  deadline: string | null;
  us_state: string;
  town: string;
  status: string;
  reward_status: string;
  assignee_id: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ApplicationRow {
  id: string;
  task_id: string;
  applicant_id: string;
  cover_message: string;
  status: string;
  created_at: string;
}

interface SubmissionRow {
  id: string;
  task_id: string;
  assignee_id: string;
  description: string;
  urls: string[];
  created_at: string;
}

interface SimulatedPaymentRow {
  id: string;
  task_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

interface MessageRow {
  id: number;
  task_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

// ===========================================================================
// Mapped (camelCase) shapes returned to the domain / UI
// ===========================================================================

/** A member's public profile (never includes email or age bracket). */
export interface Profile {
  id: string;
  displayName: string;
  bio: string;
  skills: string[];
  usState: UsState;
  town: string;
  createdAt: string;
}

/** An application as the UI shows it on the task detail / dashboard. */
export interface Application {
  id: string;
  taskId: string;
  applicantId: string;
  coverMessage: string;
  status: ApplicationStatus;
  createdAt: string;
}

/** A work submission with its links. */
export interface Submission {
  id: string;
  taskId: string;
  assigneeId: string;
  description: string;
  urls: string[];
  createdAt: string;
}

/** The simulated (demo-only) payment record for a completed monetary task. */
export interface SimulatedPayment {
  id: string;
  taskId: string;
  amountCents: number;
  status: 'simulated_paid';
  createdAt: string;
}

/** A message in a task's thread. */
export interface Message {
  id: number;
  taskId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** The full task shape the UI works with: reward is a {@link Reward} union. */
export interface Task {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  category: Category;
  skills: string[];
  reward: Reward;
  deadline: string | null;
  usState: UsState;
  town: string;
  status: TaskStatus;
  rewardType: RewardType;
  rewardStatus: RewardStatus;
  assigneeId: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Everything the task detail page needs in one bundle. */
export interface TaskDetail {
  task: Task;
  applications: Application[];
  submissions: Submission[];
  payment: SimulatedPayment | null;
}

/** A completed project shown on a public profile (task + its submission). */
export interface CompletedProject {
  task: Task;
  submission: Submission | null;
}

/** A public profile plus the member's completed work for the profile page. */
export interface ProfileWithProjects {
  profile: Profile;
  completedProjects: CompletedProject[];
}

/** A posted task on the dashboard, carrying its next-action inputs. */
export interface PostedTask extends DashboardTask {
  task: Task;
}

/** The three lists the dashboard renders. */
export interface Dashboard {
  posted: PostedTask[];
  working: Task[];
  applications: { application: Application; task: Task }[];
}

// ===========================================================================
// Column lists (kept in one place so selects and row types stay in step)
// ===========================================================================

const TASK_COLS =
  'id,creator_id,title,description,category,skills,reward_type,amount_cents,' +
  'nonmonetary_kind,reward_description,estimated_value_cents,deadline,us_state,' +
  'town,status,reward_status,assignee_id,completed_at,created_at';
const APPLICATION_COLS = 'id,task_id,applicant_id,cover_message,status,created_at';
const SUBMISSION_COLS = 'id,task_id,assignee_id,description,urls,created_at';
const PAYMENT_COLS = 'id,task_id,amount_cents,status,created_at';
const PROFILE_COLS = 'id,display_name,bio,skills,us_state,town,created_at';
const MESSAGE_COLS = 'id,task_id,sender_id,body,created_at';

// ===========================================================================
// Row -> domain mappers (the single conversion boundary)
// ===========================================================================

function toReward(row: TaskRow): Reward {
  const rewardRow: RewardRow = {
    reward_type: row.reward_type,
    amount_cents: row.amount_cents,
    nonmonetary_kind: row.nonmonetary_kind,
    reward_description: row.reward_description,
    estimated_value_cents: row.estimated_value_cents,
  };
  return fromRow(rewardRow);
}

/** Map a full task row to the UI {@link Task}, reward via `fromRow`. */
function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    category: row.category as Category,
    skills: row.skills ?? [],
    reward: toReward(row),
    deadline: row.deadline,
    usState: row.us_state as UsState,
    town: row.town,
    status: row.status as TaskStatus,
    rewardType: row.reward_type as RewardType,
    rewardStatus: row.reward_status as RewardStatus,
    assigneeId: row.assignee_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/** Map a task row to the lighter {@link TaskSummary} used by `browse.ts`. */
function mapTaskSummary(row: TaskRow): TaskSummary {
  return {
    id: row.id,
    usState: row.us_state as UsState,
    status: row.status as TaskStatus,
    category: row.category as Category,
    rewardType: row.reward_type as RewardType,
    title: row.title,
    description: row.description,
    skills: row.skills ?? [],
    town: row.town,
    createdAt: row.created_at,
  };
}

function mapApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    taskId: row.task_id,
    applicantId: row.applicant_id,
    coverMessage: row.cover_message,
    status: row.status as ApplicationStatus,
    createdAt: row.created_at,
  };
}

function mapSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    taskId: row.task_id,
    assigneeId: row.assignee_id,
    description: row.description,
    urls: row.urls ?? [],
    createdAt: row.created_at,
  };
}

function mapPayment(row: SimulatedPaymentRow): SimulatedPayment {
  return {
    id: row.id,
    taskId: row.task_id,
    amountCents: row.amount_cents,
    status: 'simulated_paid',
    createdAt: row.created_at,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    bio: row.bio,
    skills: row.skills ?? [],
    usState: row.us_state as UsState,
    town: row.town,
    createdAt: row.created_at,
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    taskId: row.task_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

// ===========================================================================
// Internal call helpers (timeout + uniform friendly-error throwing)
// ===========================================================================

/** The slice of a supabase-js result this module reads. */
interface QueryResult<T> {
  data: T | null;
  error: unknown;
}

/**
 * Run a Supabase query/rpc thenable under the timeout budget, then normalize
 * the result: throw a friendly `Error` if the call errored or timed out,
 * otherwise return `data`. This is the single place errors become user-safe.
 */
async function run<T>(builder: PromiseLike<QueryResult<T>>): Promise<T | null> {
  let result: QueryResult<T>;
  try {
    result = await withTimeout(builder);
  } catch (err) {
    // Timeout (or an unexpected thrown value): map to a safe message.
    throw new Error(messageForError(err));
  }
  if (result.error) {
    throw new Error(messageForError(result.error));
  }
  return result.data;
}

/** Like {@link run} but asserts a non-null payload (for single-row reads/rpcs). */
async function runRequired<T>(builder: PromiseLike<QueryResult<T>>): Promise<T> {
  const data = await run(builder);
  if (data === null) {
    // No row where the caller required one.
    throw new Error(messageForError({ message: 'NOT_FOUND' }));
  }
  return data;
}

// ===========================================================================
// Auth helpers
// ===========================================================================

/**
 * The current signed-in user's id, or `null` for a Visitor. Reads the local
 * session first (no network), falling back to `getUser`.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user?.id;
  if (typeof sessionUser === 'string') return sessionUser;

  const userResult = await supabase.auth.getUser();
  return userResult.data.user?.id ?? null;
}

/** Like {@link getCurrentUserId} but throws the sign-in message when absent. */
async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (id === null) throw new Error(messageForError({ message: 'NOT_SIGNED_IN' }));
  return id;
}

// ===========================================================================
// Reads
// ===========================================================================

/**
 * Open tasks in `state`, newest first, mapped to {@link TaskSummary} for the
 * browse page (the pure `filterTasks` applies the remaining filters).
 */
export async function getOpenTasksByState(state: UsState): Promise<TaskSummary[]> {
  const rows = await run<TaskRow[]>(
    db
      .from('tasks')
      .select(TASK_COLS)
      .eq('status', 'open')
      .eq('us_state', state)
      .order('created_at', { ascending: false }) as unknown as PromiseLike<QueryResult<TaskRow[]>>,
  );
  return (rows ?? []).map(mapTaskSummary);
}

/**
 * Everything the task detail page needs: the task, the applications visible to
 * the caller under RLS (applicant or creator), the submission(s), and the
 * simulated payment if the caller may see it.
 */
export async function getTaskDetail(id: string): Promise<TaskDetail> {
  const taskRow = await runRequired<TaskRow>(
    db
      .from('tasks')
      .select(TASK_COLS)
      .eq('id', id)
      .maybeSingle() as unknown as PromiseLike<QueryResult<TaskRow>>,
  );

  const applicationRows = await run<ApplicationRow[]>(
    db
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('task_id', id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }) as unknown as PromiseLike<QueryResult<ApplicationRow[]>>,
  );

  const submissionRows = await run<SubmissionRow[]>(
    db
      .from('submissions')
      .select(SUBMISSION_COLS)
      .eq('task_id', id)
      .order('created_at', { ascending: true }) as unknown as PromiseLike<
      QueryResult<SubmissionRow[]>
    >,
  );

  const paymentRow = await run<SimulatedPaymentRow>(
    db
      .from('simulated_payments')
      .select(PAYMENT_COLS)
      .eq('task_id', id)
      .maybeSingle() as unknown as PromiseLike<QueryResult<SimulatedPaymentRow>>,
  );

  return {
    task: mapTask(taskRow),
    applications: (applicationRows ?? []).map(mapApplication),
    submissions: (submissionRows ?? []).map(mapSubmission),
    payment: paymentRow === null ? null : mapPayment(paymentRow),
  };
}

/**
 * A public profile plus that member's completed projects: completed tasks where
 * they are the assignee, each with its submission (readable publicly once the
 * task is completed). Returns `null` when the profile does not exist (Req 1.16).
 */
export async function getProfile(id: string): Promise<ProfileWithProjects | null> {
  const profileRow = await run<ProfileRow>(
    db
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', id)
      .maybeSingle() as unknown as PromiseLike<QueryResult<ProfileRow>>,
  );
  if (profileRow === null) return null;

  const taskRows = await run<TaskRow[]>(
    db
      .from('tasks')
      .select(TASK_COLS)
      .eq('assignee_id', id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false }) as unknown as PromiseLike<
      QueryResult<TaskRow[]>
    >,
  );
  const tasks = (taskRows ?? []).map(mapTask);

  // Fetch submissions for those completed tasks in one query, then group.
  // Rows arrive newest-first; we keep the first (newest) submission per task.
  const taskIds = tasks.map((t) => t.id);
  const submissionsByTask = new Map<string, Submission>();
  if (taskIds.length > 0) {
    const subRows = await run<SubmissionRow[]>(
      db
        .from('submissions')
        .select(SUBMISSION_COLS)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false }) as unknown as PromiseLike<
        QueryResult<SubmissionRow[]>
      >,
    );
    for (const row of subRows ?? []) {
      const sub = mapSubmission(row);
      if (!submissionsByTask.has(sub.taskId)) submissionsByTask.set(sub.taskId, sub);
    }
  }

  const completedProjects: CompletedProject[] = tasks.map((task) => ({
    task,
    submission: submissionsByTask.get(task.id) ?? null,
  }));

  return { profile: mapProfile(profileRow), completedProjects };
}

/**
 * The dashboard bundle for `userId`: tasks they posted (with the pending
 * application count for the next-action label), tasks they're working on (as
 * assignee), and their own applications with each application's task.
 */
export async function getMyDashboard(userId: string): Promise<Dashboard> {
  const postedRows = await run<TaskRow[]>(
    db
      .from('tasks')
      .select(TASK_COLS)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false }) as unknown as PromiseLike<QueryResult<TaskRow[]>>,
  );
  const postedTasks = (postedRows ?? []).map(mapTask);

  const workingRows = await run<TaskRow[]>(
    db
      .from('tasks')
      .select(TASK_COLS)
      .eq('assignee_id', userId)
      .order('created_at', { ascending: false }) as unknown as PromiseLike<QueryResult<TaskRow[]>>,
  );
  const working = (workingRows ?? []).map(mapTask);

  const myAppRows = await run<ApplicationRow[]>(
    db
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false }) as unknown as PromiseLike<
      QueryResult<ApplicationRow[]>
    >,
  );
  const myApplications = (myAppRows ?? []).map(mapApplication);

  // Pending-application counts for the posted tasks (visible to the creator
  // under RLS). One query across all posted task ids, then tallied per task.
  const pendingCount = new Map<string, number>();
  if (postedTasks.length > 0) {
    const pendRows = await run<Pick<ApplicationRow, 'task_id' | 'status'>[]>(
      db
        .from('applications')
        .select('task_id,status')
        .in('task_id', postedTasks.map((t) => t.id))
        .eq('status', 'pending') as unknown as PromiseLike<
        QueryResult<Pick<ApplicationRow, 'task_id' | 'status'>[]>
      >,
    );
    for (const r of pendRows ?? []) {
      pendingCount.set(r.task_id, (pendingCount.get(r.task_id) ?? 0) + 1);
    }
  }

  const posted: PostedTask[] = postedTasks.map((task) => ({
    task,
    creatorId: task.creatorId,
    assigneeId: task.assigneeId,
    status: task.status,
    rewardType: task.rewardType,
    rewardStatus: task.rewardStatus,
    pendingApplicationCount: pendingCount.get(task.id) ?? 0,
  }));

  // Attach each of my applications' task. Fetch the needed tasks once.
  const appTaskIds = [...new Set(myApplications.map((a) => a.taskId))];
  const appTasksById = new Map<string, Task>();
  if (appTaskIds.length > 0) {
    const appTaskRows = await run<TaskRow[]>(
      db
        .from('tasks')
        .select(TASK_COLS)
        .in('id', appTaskIds) as unknown as PromiseLike<QueryResult<TaskRow[]>>,
    );
    for (const row of appTaskRows ?? []) appTasksById.set(row.id, mapTask(row));
  }
  const applications = myApplications
    .map((application) => {
      const task = appTasksById.get(application.taskId);
      return task === undefined ? null : { application, task };
    })
    .filter((x): x is { application: Application; task: Task } => x !== null);

  return { posted, working, applications };
}

/** A task's message thread, ordered oldest-first with a stable id tie-break. */
export async function getMessages(taskId: string): Promise<Message[]> {
  const rows = await run<MessageRow[]>(
    db
      .from('messages')
      .select(MESSAGE_COLS)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }) as unknown as PromiseLike<QueryResult<MessageRow[]>>,
  );
  return (rows ?? []).map(mapMessage);
}

/**
 * Whether either participant of a task is a youth (13-17), so the UI can show
 * the Youth_Safety_Notice without revealing who. Calls the `task_has_youth`
 * RPC, which reads the owner-only `member_private` table.
 */
export async function taskHasYouth(taskId: string): Promise<boolean> {
  const value = await run<boolean>(
    db.rpc('task_has_youth', { p_task: taskId }) as unknown as PromiseLike<
      QueryResult<boolean>
    >,
  );
  return value ?? false;
}

// ===========================================================================
// Simple writes (inserts/updates guarded by RLS + domain validators)
// ===========================================================================

/**
 * Insert a new task from an already-validated {@link NewTask} and return its id.
 * The DB trigger forces `creator_id`, `status`, `assignee_id`, `completed_at`,
 * and `reward_status`, so we send only the author-chosen columns. Reward fields
 * come from `toRow` so they always satisfy the table CHECK constraint.
 */
export async function createTask(newTask: NewTask): Promise<string> {
  const reward = toRow(newTask.reward);
  // Generate the id on the client so we do NOT need the inserted row returned.
  // A plain insert without `.select()...single()` avoids the PostgREST
  // "return=representation" path, which returned a 409 here because the row's
  // own RLS/trigger interaction made reading it back ambiguous. We already know
  // the id, so there is nothing to read back.
  const id = crypto.randomUUID();
  const insertRow = {
    id,
    title: newTask.title,
    description: newTask.description,
    category: newTask.category,
    skills: newTask.skills,
    deadline: newTask.deadline,
    us_state: newTask.usState,
    town: newTask.town,
    reward_type: reward.reward_type,
    amount_cents: reward.amount_cents,
    nonmonetary_kind: reward.nonmonetary_kind,
    reward_description: reward.reward_description,
    estimated_value_cents: reward.estimated_value_cents,
  };
  await run(
    db.from('tasks').insert(insertRow) as unknown as PromiseLike<QueryResult<unknown>>,
  );
  return id;
}

/**
 * Create the signed-in member's own profile and private age-bracket rows, right
 * after sign-up. This replaces the former on_auth_user_created trigger on
 * uth.users: a trigger that raised inside Supabase Auth rolled back the whole
 * sign-up and surfaced only an opaque error, so no user or profile was created.
 * Creating the rows from the app — guarded by the profiles_insert_self /
 * member_private_insert_self RLS policies (id = auth.uid()) and the table
 * CHECK constraints — is the reliable pattern. Idempotent: a duplicate-key error
 * (the rows already exist) is treated as success so a retry never hard-fails.
 */
export async function createMyProfile(input: {
  displayName: string;
  ageBracket: AgeBracket;
  usState: UsState;
  town: string;
}): Promise<void> {
  const userId = await requireUserId();
  try {
    await run(
      db.from('profiles').insert({
        id: userId,
        display_name: input.displayName,
        bio: '',
        skills: [],
        us_state: input.usState,
        town: input.town,
      }) as unknown as PromiseLike<QueryResult<unknown>>,
    );
    await run(
      db.from('member_private').insert({
        id: userId,
        age_bracket: input.ageBracket,
      }) as unknown as PromiseLike<QueryResult<unknown>>,
    );
  } catch (err) {
    // Treat an existing row (duplicate primary key) as success so a retried
    // sign-up or a re-entry is idempotent; rethrow anything else.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('duplicate') || msg.includes('23505')) return;
    throw err;
  }
}

/**
 * Update the caller's own profile from an already-validated {@link ProfileUpdate}.
 * RLS restricts the update to the owner's row; a trigger pins the immutable
 * columns.
 */
export async function upsertProfile(update: ProfileUpdate): Promise<void> {
  const userId = await requireUserId();
  await run(
    db
      .from('profiles')
      .update({
        display_name: update.displayName,
        bio: update.bio,
        skills: update.skills,
        us_state: update.usState,
        town: update.town,
      })
      .eq('id', userId) as unknown as PromiseLike<QueryResult<unknown>>,
  );
}

/** Send a message on a task thread as the current user (RLS enforces the rest). */
export async function sendMessage(taskId: string, body: string): Promise<void> {
  const senderId = await requireUserId();
  await run(
    db
      .from('messages')
      .insert({ task_id: taskId, sender_id: senderId, body }) as unknown as PromiseLike<
      QueryResult<unknown>
    >,
  );
}

/** File a report against a task or profile (one per target per reporter). */
export async function createReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: NewReport['reason'],
  note: string,
): Promise<void> {
  const reporterId = await requireUserId();
  await run(
    db.from('reports').insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason,
      note,
    }) as unknown as PromiseLike<QueryResult<unknown>>,
  );
}

// ===========================================================================
// Writes via RPC (status / reward changes) — names match schema.sql exactly
// ===========================================================================

/** Apply to a task; returns the new application id. RPC: `apply_to_task`. */
export async function applyToTask(taskId: string, cover: string): Promise<string> {
  const id = await run<string>(
    db.rpc('apply_to_task', { p_task: taskId, p_cover: cover }) as unknown as PromiseLike<
      QueryResult<string>
    >,
  );
  // apply_to_task returns the new uuid; guard the (shouldn't-happen) null.
  if (id === null) throw new Error(messageForError({ message: 'UNKNOWN' }));
  return id;
}

/** Accept one application (creator only). RPC: `accept_application`. */
export async function acceptApplication(appId: string): Promise<void> {
  await run(
    db.rpc('accept_application', { p_app: appId }) as unknown as PromiseLike<
      QueryResult<unknown>
    >,
  );
}

/** Cancel an open task (creator only). RPC: `cancel_task`. */
export async function cancelTask(taskId: string): Promise<void> {
  await run(
    db.rpc('cancel_task', { p_task: taskId }) as unknown as PromiseLike<QueryResult<unknown>>,
  );
}

/** Submit work (assignee only); returns the new submission id. RPC: `submit_work`. */
export async function submitWork(
  taskId: string,
  desc: string,
  urls: string[],
): Promise<string> {
  const id = await run<string>(
    db.rpc('submit_work', {
      p_task: taskId,
      p_desc: desc,
      p_urls: urls,
    }) as unknown as PromiseLike<QueryResult<string>>,
  );
  if (id === null) throw new Error(messageForError({ message: 'UNKNOWN' }));
  return id;
}

/** Confirm a submitted task as complete (creator only). RPC: `confirm_completion`. */
export async function confirmCompletion(taskId: string): Promise<void> {
  await run(
    db.rpc('confirm_completion', { p_task: taskId }) as unknown as PromiseLike<
      QueryResult<unknown>
    >,
  );
}

/** Run the demo-only payment simulation (creator, monetary). RPC: `simulate_payment`. */
export async function simulatePayment(taskId: string): Promise<void> {
  await run(
    db.rpc('simulate_payment', { p_task: taskId }) as unknown as PromiseLike<
      QueryResult<unknown>
    >,
  );
}

/** Mark a nonmonetary reward delivered (creator). RPC: `mark_reward_delivered`. */
export async function markRewardDelivered(taskId: string): Promise<void> {
  await run(
    db.rpc('mark_reward_delivered', { p_task: taskId }) as unknown as PromiseLike<
      QueryResult<unknown>
    >,
  );
}

/** Confirm a nonmonetary reward received (assignee). RPC: `confirm_reward_received`. */
export async function confirmRewardReceived(taskId: string): Promise<void> {
  await run(
    db.rpc('confirm_reward_received', { p_task: taskId }) as unknown as PromiseLike<
      QueryResult<unknown>
    >,
  );
}

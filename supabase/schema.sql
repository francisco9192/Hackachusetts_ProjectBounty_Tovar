-- =============================================================================
-- Bounty - Database schema, constraints, RLS, RPC functions, and triggers
-- =============================================================================
--
-- HOW TO USE (developer):
--   1. Open your Supabase project > SQL editor.
--   2. Paste this ENTIRE file and run it. It is idempotent and safe to re-run:
--      every object uses CREATE OR REPLACE / IF NOT EXISTS / DROP ... IF EXISTS,
--      so running it again restores the intended definitions without errors.
--   3. In Authentication > Providers > Email, turn OFF "Confirm email" so judges
--      (and the demo seed users) can sign in immediately without a confirmation
--      step. (Remaining Assumption 2.)
--   4. Then run supabase/seed.sql the same way to load the demo data.
--
-- DESIGN NOTES:
--   * All trusted business rules live here: CHECK constraints, RLS policies, and
--     SECURITY DEFINER functions (RPCs). The browser uses the anon key only.
--   * Status tables (tasks, applications, simulated_payments) have NO UPDATE
--     policy. RPCs are the only way to change status. Each status-changing RPC
--     locks the task row (SELECT ... FOR UPDATE), checks auth.uid() and the
--     current status, and writes all-or-nothing (one function = one transaction).
--   * RLS is enabled on every table, so with no matching policy Postgres denies
--     by default.
--   * Money is integer cents, never floats.
--   * Age bracket lives in member_private; public profiles can never leak it.
--   * Enum-like columns are text + CHECK (not Postgres enums) for easy editing.
--   * RPCs raise short error codes (e.g. NOT_SAME_STATE) that src/lib/errors.ts
--     maps to plain-language messages; raw DB text never reaches the UI. The
--     codes mirror src/domain/taskMachine.ts ErrorCode.
-- =============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid(), crypt() (seed)

-- =============================================================================
-- SECTION 1: Helper functions (immutable where possible)
-- =============================================================================

-- True when `code` is one of the 51 valid US state / DC 2-letter codes.
-- Kept identical to US_STATES in src/domain/constants.ts (50 states + DC).
create or replace function us_state_valid(code text)
returns boolean
language sql
immutable
as $$
  select code in (
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
    'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
    'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
    'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  );
$$;

-- True when `skills` is a valid skill list: at most `max_count` items, and each
-- item, after trimming, is 1..40 characters. NULL is treated as the empty list.
create or replace function valid_skills(skills text[], max_count int)
returns boolean
language sql
immutable
as $$
  select
    coalesce(array_length(skills, 1), 0) <= max_count
    and not exists (
      select 1
      from unnest(coalesce(skills, '{}'::text[])) as s
      where char_length(btrim(s)) < 1 or char_length(btrim(s)) > 40
    );
$$;

-- True when `urls` is a valid submission URL list: 1..5 items, each <= 2048
-- chars and matching an http/https scheme with a non-empty host.
create or replace function valid_urls(urls text[])
returns boolean
language sql
immutable
as $$
  select
    coalesce(array_length(urls, 1), 0) between 1 and 5
    and not exists (
      select 1
      from unnest(coalesce(urls, '{}'::text[])) as u
      where char_length(u) > 2048
         or u !~ '^https?://[^/\s?#]+'
    );
$$;

-- =============================================================================
-- SECTION 2: Tables, CHECK constraints, and indexes
-- =============================================================================

-- --- profiles (public read) -------------------------------------------------
-- No email, no age, no street address (Req 1.14, 1.15). Age lives in
-- member_private; email lives in auth.users.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  bio         text not null default '' check (char_length(bio) <= 500),
  skills      text[] not null default '{}' check (valid_skills(skills, 20)),
  us_state    text not null check (us_state_valid(us_state)),
  town        text not null check (char_length(btrim(town)) between 2 and 60),
  created_at  timestamptz not null default now()
);

-- --- member_private (owner read only) ---------------------------------------
create table if not exists member_private (
  id          uuid primary key references auth.users(id) on delete cascade,
  age_bracket text not null check (age_bracket in ('13-17','18+'))
);

-- --- tasks (public read) ----------------------------------------------------
create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references profiles(id),
  title         text not null check (char_length(btrim(title)) between 5 and 100),
  description   text not null check (char_length(btrim(description)) between 20 and 3000),
  category      text not null check (category in
                  ('website','spreadsheet','graphic_design','programming','writing','social_media','other')),
  skills        text[] not null default '{}' check (valid_skills(skills, 10)),
  reward_type   text not null check (reward_type in ('monetary','nonmonetary','volunteer')),
  amount_cents  int check (amount_cents between 1 and 1000000),
  nonmonetary_kind text check (nonmonetary_kind in ('product','service','experience','other')),
  reward_description text check (char_length(btrim(reward_description)) between 5 and 300),
  estimated_value_cents int check (estimated_value_cents between 0 and 1000000),
  deadline      date,
  us_state      text not null check (us_state_valid(us_state)),
  town          text not null check (char_length(btrim(town)) between 2 and 60),
  status        text not null default 'open' check (status in
                  ('open','in_progress','submitted','completed','cancelled')),
  reward_status text not null check (reward_status in
                  ('not_applicable','pending','simulated_paid','delivered','received')),
  assignee_id   uuid references profiles(id),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),

  -- Reward_Type / field consistency (design Data Models, Req 3.1-3.7).
  constraint tasks_reward_fields_ck check (
       (reward_type = 'monetary'    and amount_cents is not null
          and nonmonetary_kind is null and reward_description is null and estimated_value_cents is null)
    or (reward_type = 'nonmonetary' and amount_cents is null
          and nonmonetary_kind is not null and reward_description is not null)
    or (reward_type = 'volunteer'   and amount_cents is null
          and nonmonetary_kind is null and reward_description is null and estimated_value_cents is null)
  ),
  -- An Assignee exists exactly when the Task has left the open/cancelled states (Req 8.7).
  constraint tasks_assignee_ck check ((status in ('open','cancelled')) = (assignee_id is null)),
  -- completed_at is set exactly when the Task is Completed.
  constraint tasks_completed_ck check ((status = 'completed') = (completed_at is not null)),
  -- Volunteer Tasks always carry reward_status = not_applicable.
  constraint tasks_volunteer_reward_ck check
    (reward_status = case when reward_type = 'volunteer' then 'not_applicable' else reward_status end),
  -- A settled reward (simulated_paid/delivered/received) only occurs on a Completed Task.
  constraint tasks_reward_settle_ck check
    (reward_status in ('not_applicable','pending') or status = 'completed')
);

-- --- applications (read: applicant or task creator) -------------------------
create table if not exists applications (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references tasks(id) on delete cascade,
  applicant_id  uuid not null references profiles(id),
  cover_message text not null check (char_length(btrim(cover_message)) between 20 and 1000),
  status        text not null default 'pending' check (status in
                  ('pending','accepted','rejected','withdrawn')),
  created_at    timestamptz not null default now()
);

-- At most one pending/accepted Application per Member per Task (Req 5.5).
create unique index if not exists one_active_app
  on applications(task_id, applicant_id)
  where status in ('pending','accepted');

-- At most one Accepted Application per Task -> single Assignee (Req 6.6).
create unique index if not exists one_accepted_app
  on applications(task_id)
  where status = 'accepted';

-- --- submissions (read: participants, or anyone when task completed) --------
create table if not exists submissions (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  assignee_id uuid not null references profiles(id),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  urls        text[] not null check (valid_urls(urls)),
  created_at  timestamptz not null default now()
);

-- --- simulated_payments (read: task creator or assignee) --------------------
-- NO card or bank columns (Req 9.4). At most one per Task via unique task_id (Req 9.6).
create table if not exists simulated_payments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null unique references tasks(id) on delete cascade,
  amount_cents int not null check (amount_cents between 1 and 1000000),
  status       text not null default 'simulated_paid' check (status = 'simulated_paid'),
  created_at   timestamptz not null default now()
);

-- --- messages (read/insert: participants while task active-or-completed) ----
create table if not exists messages (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references tasks(id) on delete cascade,
  sender_id  uuid not null references profiles(id) check (sender_id = auth.uid()),
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- --- reports (read: own only) ----------------------------------------------
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) check (reporter_id = auth.uid()),
  target_type text not null check (target_type in ('task','profile')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam','inappropriate','scam','other')),
  note        text not null default '' check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- =============================================================================
-- SECTION 3: Row Level Security (deny by default)
-- =============================================================================
-- Enabling RLS with no matching policy denies the operation (Req 10.1). We add
-- only the policies the design's RLS Summary lists; everything else is denied.

alter table profiles           enable row level security;
alter table member_private     enable row level security;
alter table tasks              enable row level security;
alter table applications       enable row level security;
alter table submissions        enable row level security;
alter table simulated_payments enable row level security;
alter table messages           enable row level security;
alter table reports            enable row level security;

-- Column-level defense in depth: no client role may UPDATE the status tables
-- directly; status changes go only through the SECURITY DEFINER RPCs.
revoke update on tasks              from anon, authenticated;
revoke update on applications       from anon, authenticated;
revoke update on simulated_payments from anon, authenticated;
revoke update on submissions        from anon, authenticated;

-- Table-level privileges the RLS policies below rely on. RLS only takes effect
-- when the role ALSO holds the table privilege for the operation, so these
-- grants are required for the policies to work (without them PostgREST rejects
-- the request outright). RLS still gates WHICH rows each user may touch.
grant select on profiles    to anon, authenticated;
grant select on tasks       to anon, authenticated;
grant select on submissions to anon, authenticated;
grant select on member_private    to authenticated;
grant select on applications       to authenticated;
grant select on simulated_payments to authenticated;
grant select on messages           to authenticated;
grant select on reports            to authenticated;
grant insert on profiles       to authenticated;
grant insert on member_private to authenticated;
grant insert on tasks          to authenticated;
grant insert on messages       to authenticated;
grant insert on reports        to authenticated;

-- --- profiles ---------------------------------------------------------------
-- select: everyone (anon + authenticated). insert: none (trigger only).
-- update: owner only. delete: none.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to anon, authenticated
  using (true);

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only the editable columns may be changed by the owner (Req 1.10). id and
-- created_at are never granted; a trigger (profiles_guard) also pins them so a
-- client can never change identity even if column grants are relaxed.
revoke update on profiles from anon, authenticated;
grant update (display_name, bio, skills, us_state, town) on profiles to authenticated;

-- --- member_private ---------------------------------------------------------
-- select: owner only. No insert/update/delete policy -> denied (trigger inserts).
drop policy if exists member_private_select on member_private;
create policy member_private_select on member_private
  for select to authenticated
  using (id = auth.uid());

-- --- tasks ------------------------------------------------------------------
-- select: everyone. insert: authenticated (trigger forces owner/status/etc.).
-- No update/delete policy -> RPC only.
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks
  for select to anon, authenticated
  using (true);

drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks
  for insert to authenticated
  with check (creator_id = auth.uid());

-- --- applications -----------------------------------------------------------
-- select: the applicant or the task's creator. No write policy -> RPC only.
drop policy if exists applications_select on applications;
create policy applications_select on applications
  for select to authenticated
  using (
    applicant_id = auth.uid()
    or exists (select 1 from tasks t where t.id = applications.task_id and t.creator_id = auth.uid())
  );

-- --- submissions ------------------------------------------------------------
-- select: task participants (creator or assignee), OR anyone if the task is
-- completed (so Completed_Project links show on public profiles). No write
-- policy -> RPC only.
drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions
  for select to anon, authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = submissions.task_id
        and (
          t.status = 'completed'
          or t.creator_id = auth.uid()
          or t.assignee_id = auth.uid()
        )
    )
  );

-- --- simulated_payments -----------------------------------------------------
-- select: task creator or assignee. No write policy -> RPC only.
drop policy if exists simulated_payments_select on simulated_payments;
create policy simulated_payments_select on simulated_payments
  for select to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = simulated_payments.task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid())
    )
  );

-- --- messages ---------------------------------------------------------------
-- select: task creator or assignee. insert: a participant sending as themselves
-- while the task is in_progress/submitted/completed, body trimmed 1..2000.
-- No update/delete policy (Req 13.8).
drop policy if exists messages_select on messages;
create policy messages_select on messages
  for select to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = messages.task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid())
    )
  );

drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and char_length(btrim(body)) between 1 and 2000
    and exists (
      select 1 from tasks t
      where t.id = messages.task_id
        and t.status in ('in_progress','submitted','completed')
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid())
    )
  );

-- --- reports ----------------------------------------------------------------
-- select: own only. insert: reporter = self AND the target exists.
-- No update/delete policy.
drop policy if exists reports_select on reports;
create policy reports_select on reports
  for select to authenticated
  using (reporter_id = auth.uid());

drop policy if exists reports_insert on reports;
create policy reports_insert on reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and (
      (target_type = 'task'    and exists (select 1 from tasks    t where t.id = target_id))
      or (target_type = 'profile' and exists (select 1 from profiles p where p.id = target_id))
    )
  );

-- =============================================================================
-- SECTION 4: RPC functions (SECURITY DEFINER; RPC-only status changes)
-- =============================================================================
-- Every function: language plpgsql, security definer, set search_path = public,
-- rejects anonymous callers, locks the task row with FOR UPDATE before checking
-- status, and writes all-or-nothing (a raised exception rolls the whole thing
-- back). Error codes mirror src/domain/taskMachine.ts so src/lib/errors.ts can
-- map them. Execute is revoked from public/anon and granted to authenticated.

-- --- apply_to_task (Req 5) --------------------------------------------------
create or replace function apply_to_task(p_task uuid, p_cover text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  caller_state text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.creator_id = auth.uid() then raise exception 'CREATOR_CANNOT_APPLY'; end if;
  if t.status <> 'open' then raise exception 'WRONG_STATUS'; end if;

  select us_state into caller_state from profiles where id = auth.uid();
  if caller_state is distinct from t.us_state then raise exception 'NOT_SAME_STATE'; end if;

  if char_length(btrim(p_cover)) not between 20 and 1000 then
    raise exception 'INVALID_COVER';
  end if;

  -- Block a duplicate active application early with a clear code; the partial
  -- unique index one_active_app is the final guard against races (Req 5.5).
  if exists (
    select 1 from applications
    where task_id = t.id and applicant_id = auth.uid()
      and status in ('pending','accepted')
  ) then
    raise exception 'DUPLICATE_APPLICATION';
  end if;

  insert into applications (task_id, applicant_id, cover_message, status)
  values (t.id, auth.uid(), btrim(p_cover), 'pending')
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    -- Lost a race on one_active_app: treat as a duplicate (Req 5.5).
    raise exception 'DUPLICATE_APPLICATION';
end $$;
revoke all on function apply_to_task(uuid, text) from public, anon;
grant execute on function apply_to_task(uuid, text) to authenticated;

-- --- accept_application (Req 6, 8) ------------------------------------------
create or replace function accept_application(p_app uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a applications;
  t tasks;
  applicant_state text;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into a from applications where id = p_app;
  if not found then raise exception 'NOT_FOUND'; end if;

  select * into t from tasks where id = a.task_id for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.creator_id <> auth.uid() then raise exception 'NOT_CREATOR'; end if;
  if t.status <> 'open' then raise exception 'WRONG_STATUS'; end if;
  if a.status <> 'pending' then raise exception 'APP_NOT_PENDING'; end if;

  select us_state into applicant_state from profiles where id = a.applicant_id;
  if applicant_state is distinct from t.us_state then raise exception 'NOT_SAME_STATE'; end if;

  -- All-or-nothing: reject other pendings, accept this one, start the work,
  -- record the Assignee (Req 6.2, 6.5, 6.6; single Assignee invariant).
  update applications set status = 'rejected'
    where task_id = t.id and status = 'pending' and id <> a.id;
  update applications set status = 'accepted' where id = a.id;
  update tasks set status = 'in_progress', assignee_id = a.applicant_id where id = t.id;
end $$;
revoke all on function accept_application(uuid) from public, anon;
grant execute on function accept_application(uuid) to authenticated;

-- --- cancel_task (Req 8.5) --------------------------------------------------
create or replace function cancel_task(p_task uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.creator_id <> auth.uid() then raise exception 'NOT_CREATOR'; end if;
  if t.status <> 'open' then raise exception 'WRONG_STATUS'; end if;

  update applications set status = 'rejected' where task_id = t.id and status = 'pending';
  update tasks set status = 'cancelled' where id = t.id;
end $$;
revoke all on function cancel_task(uuid) from public, anon;
grant execute on function cancel_task(uuid) to authenticated;

-- --- submit_work (Req 7) ----------------------------------------------------
create or replace function submit_work(p_task uuid, p_desc text, p_urls text[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.assignee_id is distinct from auth.uid() then raise exception 'NOT_ASSIGNEE'; end if;
  if t.status <> 'in_progress' then raise exception 'WRONG_STATUS'; end if;

  -- Same validity rules as the submissions CHECK constraints (Req 7.1, 7.2, 7.7).
  if char_length(btrim(p_desc)) not between 10 and 2000 then raise exception 'INVALID_SUBMISSION'; end if;
  if not valid_urls(p_urls) then raise exception 'INVALID_SUBMISSION'; end if;

  insert into submissions (task_id, assignee_id, description, urls)
  values (t.id, auth.uid(), btrim(p_desc), p_urls)
  returning id into new_id;

  update tasks set status = 'submitted' where id = t.id;
  return new_id;
end $$;
revoke all on function submit_work(uuid, text, text[]) from public, anon;
grant execute on function submit_work(uuid, text, text[]) to authenticated;

-- --- confirm_completion (Req 7.3) -------------------------------------------
create or replace function confirm_completion(p_task uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.creator_id <> auth.uid() then raise exception 'NOT_CREATOR'; end if;
  if t.status <> 'submitted' then raise exception 'WRONG_STATUS'; end if;

  update tasks set status = 'completed', completed_at = now() where id = t.id;
end $$;
revoke all on function confirm_completion(uuid) from public, anon;
grant execute on function confirm_completion(uuid) to authenticated;

-- --- simulate_payment (Req 9.3, 9.6, 9.7) -----------------------------------
create or replace function simulate_payment(p_task uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.creator_id <> auth.uid() then raise exception 'NOT_CREATOR'; end if;
  if t.status <> 'completed' then raise exception 'WRONG_STATUS'; end if;
  if t.reward_type <> 'monetary' then raise exception 'WRONG_REWARD_TYPE'; end if;
  if t.reward_status <> 'pending' then raise exception 'WRONG_REWARD_STATUS'; end if;
  if exists (select 1 from simulated_payments where task_id = t.id) then
    raise exception 'ALREADY_PAID';
  end if;

  insert into simulated_payments (task_id, amount_cents, status)
  values (t.id, t.amount_cents, 'simulated_paid');
  update tasks set reward_status = 'simulated_paid' where id = t.id;
exception
  when unique_violation then
    -- Lost a race on simulated_payments.task_id unique (Req 9.6).
    raise exception 'ALREADY_PAID';
end $$;
revoke all on function simulate_payment(uuid) from public, anon;
grant execute on function simulate_payment(uuid) to authenticated;

-- --- mark_reward_delivered (Req 9.9) ----------------------------------------
create or replace function mark_reward_delivered(p_task uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.creator_id <> auth.uid() then raise exception 'NOT_CREATOR'; end if;
  if t.status <> 'completed' then raise exception 'WRONG_STATUS'; end if;
  if t.reward_type <> 'nonmonetary' then raise exception 'WRONG_REWARD_TYPE'; end if;
  if t.reward_status <> 'pending' then raise exception 'WRONG_REWARD_STATUS'; end if;

  update tasks set reward_status = 'delivered' where id = t.id;
end $$;
revoke all on function mark_reward_delivered(uuid) from public, anon;
grant execute on function mark_reward_delivered(uuid) to authenticated;

-- --- confirm_reward_received (Req 9.11) -------------------------------------
create or replace function confirm_reward_received(p_task uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task for update;  -- row lock
  if not found then raise exception 'NOT_FOUND'; end if;

  if t.assignee_id is distinct from auth.uid() then raise exception 'NOT_ASSIGNEE'; end if;
  if t.status <> 'completed' then raise exception 'WRONG_STATUS'; end if;
  if t.reward_type <> 'nonmonetary' then raise exception 'WRONG_REWARD_TYPE'; end if;
  if t.reward_status <> 'delivered' then raise exception 'WRONG_REWARD_STATUS'; end if;

  update tasks set reward_status = 'received' where id = t.id;
end $$;
revoke all on function confirm_reward_received(uuid) from public, anon;
grant execute on function confirm_reward_received(uuid) to authenticated;

-- --- task_has_youth (Req 13.4, 10.9) ----------------------------------------
-- Tells the two participants whether either of them is a Youth_Member so the
-- UI can show the Youth_Safety_Notice, WITHOUT exposing who or the bracket.
-- Reads member_private, which no client can select except its owner.
create or replace function task_has_youth(p_task uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  select * into t from tasks where id = p_task;
  if not found then raise exception 'NOT_FOUND'; end if;
  if auth.uid() not in (t.creator_id, coalesce(t.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'NOT_PERMITTED';
  end if;

  return exists (
    select 1 from member_private mp
    where mp.age_bracket = '13-17'
      and mp.id in (t.creator_id, t.assignee_id)
  );
end $$;
revoke all on function task_has_youth(uuid) from public, anon;
grant execute on function task_has_youth(uuid) to authenticated;

-- =============================================================================
-- SECTION 5: Triggers
-- =============================================================================

-- --- Profile creation on sign-up (NO auth.users trigger) --------------------
-- A trigger on auth.users that raised rolled back the whole Supabase Auth
-- sign-up and surfaced only an opaque error, so neither the user nor the
-- profile was created. Instead, the app creates the profile + member_private
-- rows right after sign-up (src/lib/api.ts createMyProfile), guarded by the
-- INSERT policies below (id = auth.uid()) and the table CHECK constraints. The
-- former handle_new_user() function and on_auth_user_created trigger are
-- dropped here so a re-run of this file never recreates them.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists member_private_insert_self on member_private;
create policy member_private_insert_self on member_private
  for insert to authenticated
  with check (id = auth.uid());

-- --- tasks_before_insert: force server-trusted defaults + normalize ---------
-- When a signed-in Member inserts a Task, pin creator_id, status, assignee,
-- completed_at and reward_status to trusted values regardless of what the
-- client sent (Req 2.7, 2.8, 9.1); trim text and normalize the skill list
-- (trim each, drop blanks, drop case-insensitive duplicates keeping the first).
-- When auth.uid() is null (the seed runs as the postgres role) the provided
-- values pass through so the seed can create tasks in any state/status.
create or replace function tasks_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  normalized text[];
  item text;
  seen text[] := '{}';
  key text;
begin
  -- Normalize skills: trim, drop blanks, dedupe case-insensitively (keep first).
  normalized := '{}';
  if new.skills is not null then
    foreach item in array new.skills loop
      item := btrim(item);
      if item = '' then continue; end if;
      key := lower(item);
      if key = any(seen) then continue; end if;
      seen := array_append(seen, key);
      normalized := array_append(normalized, item);
    end loop;
  end if;
  new.skills := normalized;

  -- Trim free-text columns.
  new.title := btrim(new.title);
  new.description := btrim(new.description);
  new.town := btrim(new.town);
  if new.reward_description is not null then
    new.reward_description := btrim(new.reward_description);
  end if;

  if auth.uid() is not null then
    -- Trusted-server pinning for client inserts.
    new.creator_id   := auth.uid();
    new.status       := 'open';
    new.assignee_id  := null;
    new.completed_at := null;
    new.reward_status := case when new.reward_type = 'volunteer' then 'not_applicable' else 'pending' end;
  else
    -- Seed path (postgres role): fill reward_status only if the seed left it null.
    if new.reward_status is null then
      new.reward_status := case when new.reward_type = 'volunteer' then 'not_applicable' else 'pending' end;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists tasks_before_insert on tasks;
create trigger tasks_before_insert
  before insert on tasks
  for each row execute function tasks_before_insert();

-- --- profiles_guard: pin identity columns on update -------------------------
-- The owner update policy already restricts WHO can update; this prevents the
-- few immutable columns from ever being changed (defense in depth for Req 1.10).
create or replace function profiles_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard
  before update on profiles
  for each row execute function profiles_guard();

-- =============================================================================
-- End of schema. Safe to re-run.
-- =============================================================================

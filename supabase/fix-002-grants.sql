-- =============================================================================
-- Bounty - FIX 002: restore table privileges so RLS can govern access
-- =============================================================================
-- WHY: schema.sql revoked privileges from anon/authenticated to lock down the
-- status tables, but it revoked too broadly: the `authenticated` role ended up
-- with NO insert/select/update on `profiles` (and the other tables). In
-- Postgres, a Row Level Security policy only takes effect if the role ALSO
-- holds the table-level privilege for that operation. With the grant missing,
-- PostgREST rejected the profile insert outright, so sign-up created the auth
-- user but no profile row.
--
-- FIX: grant the correct table-level privileges to match the intended RLS
-- design, then let the existing RLS policies gate WHICH rows each user may
-- touch. We deliberately keep UPDATE off the status tables (tasks,
-- applications, simulated_payments, submissions) so status changes still go
-- only through the SECURITY DEFINER RPCs.
--
-- HOW TO USE: paste this whole file into the Supabase SQL editor and run it.
-- Idempotent and safe to re-run.
-- =============================================================================

-- Public read tables: anon + authenticated may SELECT (RLS still filters rows).
grant select on profiles    to anon, authenticated;
grant select on tasks       to anon, authenticated;
grant select on submissions to anon, authenticated;

-- Authenticated-only reads (RLS restricts to the owner / participants).
grant select on member_private     to authenticated;
grant select on applications        to authenticated;
grant select on simulated_payments  to authenticated;
grant select on messages            to authenticated;
grant select on reports             to authenticated;

-- Inserts the app performs directly (RLS WITH CHECK gates them):
--   profiles / member_private : the member creates their own rows at sign-up
--   tasks                     : the member posts a task (trigger pins owner/status)
--   messages / reports        : the member sends a message / files a report
grant insert on profiles        to authenticated;
grant insert on member_private  to authenticated;
grant insert on tasks           to authenticated;
grant insert on messages        to authenticated;
grant insert on reports         to authenticated;

-- Profile edits: only the editable columns, only the owner's row (RLS).
-- (Re-assert the column-scoped UPDATE grant in case it was lost.)
grant update (display_name, bio, skills, us_state, town) on profiles to authenticated;

-- NOTE: we intentionally do NOT grant UPDATE/DELETE on tasks, applications,
-- submissions, or simulated_payments to anon/authenticated. All status and
-- reward changes go through the SECURITY DEFINER RPCs (apply_to_task,
-- accept_application, submit_work, confirm_completion, simulate_payment, ...),
-- which run with the function owner's rights.
-- =============================================================================

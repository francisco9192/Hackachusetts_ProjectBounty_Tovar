-- =============================================================================
-- Bounty - FIX 001: move profile creation out of the auth.users trigger
-- =============================================================================
-- WHY: a trigger on auth.users that raises (or fails for any reason) rolls back
-- the whole sign-up inside Supabase Auth and surfaces only an opaque 500, so no
-- user and no profile are created. We replace it with the standard, reliable
-- pattern: the app creates the profile + member_private rows right after
-- sign-up, guarded by RLS INSERT policies (id = auth.uid()). All validation
-- stays in the database via the existing CHECK constraints.
--
-- HOW TO USE: paste this whole file into the Supabase SQL editor and run it.
-- Idempotent and safe to re-run. (Re-running schema.sql later would re-create
-- the trigger, so this fix is also folded into schema.sql.)
-- =============================================================================

-- 1) Remove the fragile auth trigger and its function.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- 2) Allow a signed-in member to create THEIR OWN profile row (once), and only
--    with their own auth uid. The existing CHECK constraints still enforce the
--    field rules (display name 1..50, valid state, town 2..60, etc.).
drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = auth.uid());

-- 3) Same for the private age-bracket row.
drop policy if exists member_private_insert_self on member_private;
create policy member_private_insert_self on member_private
  for insert to authenticated
  with check (id = auth.uid());

-- Note: profiles already denies changing id/created_at via the profiles_guard
-- trigger and the column-restricted UPDATE grant, so a member can create their
-- row once and then only edit the allowed columns.
-- =============================================================================

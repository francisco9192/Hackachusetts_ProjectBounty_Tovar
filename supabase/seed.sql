-- =============================================================================
-- Bounty - Idempotent demo seed v2 (business + INDIVIDUAL posters, 8 tasks)
-- =============================================================================
--
-- WHY THIS APPROACH
--   On hosted Supabase, inserting into auth.users from SQL is unreliable, so the
--   developer creates the demo auth users ONCE in the dashboard and this seed
--   looks them up BY EMAIL. The seed never touches auth.users itself.
--
-- ONE-TIME DASHBOARD STEPS (before running this file):
--   1. Authentication > Providers > Email: "Confirm email" OFF.
--   2. Authentication > Users > "Add user" > "Create new user", with
--      "Auto Confirm User" checked and this shared password:  DemoPass123!
--      Create these FOUR users:
--
--        Email                        Role / who they are        Age    Town
--        ---------------------------  -------------------------  -----  -----------
--        demo.business@bounty.test    business (posts tasks)      18+    Boston, MA
--        demo.individual@bounty.test  individual (posts tasks)    18+    Worcester, MA
--        demo.student@bounty.test     adult student (helper)      18+    Cambridge, MA
--        demo.youth@bounty.test       youth helper (13-17)        13-17  Somerville, MA
--
--   3. Open the SQL editor, paste this ENTIRE file, and run it.
--
-- RESET (wipe-data-only) BEFORE RESEEDING, optional but recommended for a clean
-- demo: this file begins by deleting ALL app data (not the auth users), so a
-- re-run always yields the same fresh state. It does NOT delete auth users, so
-- you keep your four logins. (If you ever want to wipe users too, delete them in
-- Authentication > Users.)
--
-- RE-RUNNABLE: one transaction; wipes app tables, then re-inserts. Safe to run
-- any number of times. Fails cleanly (writes nothing) if a demo user is missing.
--
-- VARIETY (for the demo video): 8 tasks across BOTH poster types (business and
-- individual), every Category, every Reward_Type, and every Task_Status.
-- =============================================================================

begin;

-- Wipe-data-only reset: clear all app rows (keeps auth users). FK order matters.
truncate table
  public.reports,
  public.messages,
  public.simulated_payments,
  public.submissions,
  public.applications,
  public.tasks,
  public.member_private,
  public.profiles
restart identity cascade;

do $$
declare
  v_business   uuid;
  v_individual uuid;
  v_student    uuid;
  v_youth      uuid;

  -- Fixed task ids t1..t8.
  t1 constant uuid := '00000000-0000-0000-0000-000000000a01'; -- Business, monetary, Open (showcase website)
  t2 constant uuid := '00000000-0000-0000-0000-000000000a02'; -- Individual, nonmonetary, Open (birthday flyers)
  t3 constant uuid := '00000000-0000-0000-0000-000000000a03'; -- Individual, volunteer, Open (budget spreadsheet)
  t4 constant uuid := '00000000-0000-0000-0000-000000000a04'; -- Individual, monetary, Open + pending applicant (resume)
  t5 constant uuid := '00000000-0000-0000-0000-000000000a05'; -- Business, nonmonetary, In_Progress (social media)
  t6 constant uuid := '00000000-0000-0000-0000-000000000a06'; -- Individual, monetary, Submitted (python script)
  t7 constant uuid := '00000000-0000-0000-0000-000000000a07'; -- Business, monetary, Completed + simulated payment (menu)
  t8 constant uuid := '00000000-0000-0000-0000-000000000a08'; -- Individual, monetary, Open, NH (same-state demo)

  -- Fixed child-row ids.
  ap1 constant uuid := '00000000-0000-0000-0000-000000000b01'; -- pending app on t4 (student)
  ap2 constant uuid := '00000000-0000-0000-0000-000000000b02'; -- accepted app on t5 (student)
  ap3 constant uuid := '00000000-0000-0000-0000-000000000b03'; -- accepted app on t6 (student)
  ap4 constant uuid := '00000000-0000-0000-0000-000000000b04'; -- accepted app on t7 (student)
  ap5 constant uuid := '00000000-0000-0000-0000-000000000b05'; -- pending app on t2 (youth) - extra variety
  s1  constant uuid := '00000000-0000-0000-0000-000000000c01'; -- submission on t6
  p1  constant uuid := '00000000-0000-0000-0000-000000000d01'; -- simulated payment on t7
begin
  select id into v_business   from auth.users where email = 'demo.business@bounty.test';
  select id into v_individual from auth.users where email = 'demo.individual@bounty.test';
  select id into v_student    from auth.users where email = 'demo.student@bounty.test';
  select id into v_youth      from auth.users where email = 'demo.youth@bounty.test';

  if v_business is null then raise notice 'Missing demo.business@bounty.test - add it in Authentication > Users.'; end if;
  if v_individual is null then raise notice 'Missing demo.individual@bounty.test - add it in Authentication > Users.'; end if;
  if v_student is null then raise notice 'Missing demo.student@bounty.test - add it in Authentication > Users.'; end if;
  if v_youth is null then raise notice 'Missing demo.youth@bounty.test - add it in Authentication > Users.'; end if;
  if v_business is null or v_individual is null or v_student is null or v_youth is null then
    raise exception 'DEMO_USERS_MISSING: create the four demo users above, then re-run seed.sql. Nothing was written.';
  end if;

  -- ---- Profiles ------------------------------------------------------------
  insert into profiles (id, display_name, bio, skills, us_state, town) values
    (v_business, 'Bay State Bakery',
     'A family bakery in Boston. We hire local students for our website, flyers, and social media, and love giving back with products and experience.',
     array['small business','baking','community'], 'MA', 'Boston'),
    (v_individual, 'Maria Chen',
     'A Worcester mom and freelancer. I post everyday tasks - party flyers, resume help, little spreadsheets and scripts - and offer fair rewards to local helpers.',
     array['community','parent','organizer'], 'MA', 'Worcester'),
    (v_student, 'Alex Rivera',
     'Computer science student in Cambridge. I build websites, spreadsheets, and small scripts, and I am always looking for real projects to grow my portfolio.',
     array['web development','spreadsheets','python','react'], 'MA', 'Cambridge'),
    (v_youth, 'Jordan Lee',
     'High school student in Somerville who loves graphic design and writing. Excited to help neighbors and local businesses and earn community experience.',
     array['graphic design','writing','social media'], 'MA', 'Somerville');

  insert into member_private (id, age_bracket) values
    (v_business, '18+'), (v_individual, '18+'), (v_student, '18+'), (v_youth, '13-17');

  -- ===========================================================================
  -- TASKS. Seed runs as postgres (auth.uid() null) so it may set any
  -- status/reward_status directly, but every row still satisfies the CHECKs.
  -- ===========================================================================

  -- t1: BUSINESS, monetary, Open (showcase).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t1, v_business, 'Build a simple website for our bakery',
     'We need a clean one-page website for Bay State Bakery with our menu, hours, location, and a contact form. Mobile-friendly and easy for customers to read.',
     'website', array['html','css','responsive design'],
     'monetary', 15000, null, null, null, null, 'MA', 'Boston', 'open', 'pending', null, null);

  -- t2: INDIVIDUAL, nonmonetary, Open (personal use - birthday flyers).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t2, v_individual, 'Design birthday party flyers for my son',
     'I am throwing a dinosaur-themed 7th birthday party and need a fun, colorful flyer to text and print for family and friends. I will share the details and a few photos.',
     'graphic_design', array['graphic design','illustration'],
     'nonmonetary', null, 'service', 'A home-cooked three-course dinner for two at my place, or a gift card of similar value.', 5000,
     null, 'MA', 'Worcester', 'open', 'pending', null, null);

  -- t3: INDIVIDUAL, volunteer, Open (personal use - budget spreadsheet).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t3, v_individual, 'Help fix the formulas in my household budget spreadsheet',
     'My monthly budget spreadsheet has broken formulas and I cannot get the totals to add up. Looking for a patient volunteer to fix it and show me what went wrong.',
     'spreadsheet', array['excel','spreadsheets'],
     'volunteer', null, null, null, null, null, 'MA', 'Worcester', 'open', 'not_applicable', null, null);

  -- t4: INDIVIDUAL, monetary, Open + a pending applicant (resume).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t4, v_individual, 'Polish and format my resume',
     'I am applying for jobs and need my two-page resume cleaned up - consistent formatting, clearer wording, and a modern but simple layout. I will provide the current version.',
     'writing', array['writing','resume','formatting'],
     'monetary', 6000, null, null, null, null, 'MA', 'Worcester', 'open', 'pending', null, null);

  -- t5: BUSINESS, nonmonetary, In_Progress (social media; assignee = student).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t5, v_business, 'Set up our Instagram and first few posts',
     'Help us start our bakery Instagram: set up the profile, plan a simple look, and draft our first five posts. Work is in progress with a local helper.',
     'social_media', array['social media','content'],
     'nonmonetary', null, 'product', 'A standing order of a dozen pastries a week for one month.', 6000,
     null, 'MA', 'Boston', 'in_progress', 'pending', v_student, null);

  -- t6: INDIVIDUAL, monetary, Submitted (python script; assignee = student).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t6, v_individual, 'Small script to rename and organize my photo files',
     'I have thousands of vacation photos with messy names. I need a small, safe script that renames them by date and sorts them into folders. Work has been submitted for review.',
     'programming', array['python','scripting'],
     'monetary', 4000, null, null, null, null, 'MA', 'Worcester', 'submitted', 'pending', v_student, null);

  -- t7: BUSINESS, monetary, Completed + simulated payment (menu; assignee = student).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t7, v_business, 'Build a printable menu we can update ourselves',
     'A simple, printable menu document we can edit in-house whenever prices change. This project is complete and the reward has been settled as a demo payment.',
     'other', array['design','documents'],
     'monetary', 12000, null, null, null, null, 'MA', 'Boston', 'completed', 'simulated_paid', v_student, now());

  -- t8: INDIVIDUAL, monetary, Open, NEW HAMPSHIRE (same-state rejection demo).
  insert into tasks (id, creator_id, title, description, category, skills,
      reward_type, amount_cents, nonmonetary_kind, reward_description, estimated_value_cents,
      deadline, us_state, town, status, reward_status, assignee_id, completed_at) values
    (t8, v_individual, 'Logo for my New Hampshire weekend craft stall',
     'A simple logo for the craft stall I run up north on weekends. Posted in New Hampshire, so it should only be open to New Hampshire members.',
     'graphic_design', array['graphic design','branding'],
     'monetary', 9000, null, null, null, null, 'NH', 'Manchester', 'open', 'pending', null, null);

  -- ===========================================================================
  -- APPLICATIONS. Accepted applicant == assignee, same state (MA) (Req 11.9).
  -- ===========================================================================
  insert into applications (id, task_id, applicant_id, cover_message, status) values
    (ap1, t4, v_student,
     'I rewrite and format resumes for classmates all the time. I can tighten the wording, make the layout consistent, and keep it to a clean two pages for you.',
     'pending'),
    (ap5, t2, v_youth,
     'I love doing colorful, playful design and a dinosaur theme would be so fun. I can make a bright flyer that prints well and looks great as a text message too.',
     'pending'),
    (ap2, t5, v_student,
     'I can set up your Instagram, pick a simple consistent look, and draft your first posts with friendly captions that fit a neighborhood bakery.',
     'accepted'),
    (ap3, t6, v_student,
     'I write small Python tools often. I can build a safe renamer that previews changes first, then sorts your photos into dated folders without losing anything.',
     'accepted'),
    (ap4, t7, v_student,
     'I can build you an editable, printable menu with a clean one-page layout you can update yourself whenever prices change.',
     'accepted');

  -- ===========================================================================
  -- SUBMISSION on the submitted task t6.
  -- ===========================================================================
  insert into submissions (id, task_id, assignee_id, description, urls) values
    (s1, t6, v_student,
     'Here is the finished photo-organizer script with a short README explaining how to run it. It previews every rename before applying, so nothing is lost.',
     array['https://example.com/bounty-demo/photo-organizer',
           'https://example.com/bounty-demo/photo-organizer-readme']);

  -- ===========================================================================
  -- SIMULATED PAYMENT on completed monetary task t7 (amount == task amount).
  -- ===========================================================================
  insert into simulated_payments (id, task_id, amount_cents, status) values
    (p1, t7, 12000, 'simulated_paid');

  raise notice 'Demo seed v2 complete: 4 members (2 posters: business + individual), 8 tasks (7 MA + 1 NH), 5 applications, 1 submission, 1 simulated payment.';
end $$;

commit;

-- =============================================================================
-- End of seed v2. Safe to re-run (it wipes app data first, then reseeds).
-- =============================================================================

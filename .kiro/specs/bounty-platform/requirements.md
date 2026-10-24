# Requirements Document

## Introduction

Bounty is a community-driven web platform built for the Hackachusetts hackathon (Civic Action track). Bounty connects local small businesses and individuals who need help with digital tasks (websites, spreadsheets, graphic design, programming, and other online work) to local students and other people with the skills to complete those tasks.

Bounty's distinguishing feature is a flexible reward system: a task creator can offer a monetary reward, a nonmonetary reward (a product, service, experience, or other benefit, such as a custom cake for a spreadsheet or free meals for a website), or mark the task as a volunteer opportunity. Monetary rewards are agreed in-app and settled with a clearly labeled demo payment simulator; Bounty processes no real payments. Bounty is local by design: every Task and Profile belongs to one US state, and Members apply only to Tasks in their own state.

The goal is to help high school students, college students, and aspiring professionals gain real-world experience, build portfolios and community connections, make digital services accessible to small businesses, and keep work in the local community.

### Delivery Constraints and Build Priority

Bounty is built by one developer in about 7.5 hours, including deployment, demo video, and write-up. The MVP is limited to the core demo loop: post Task, apply, accept, submit work, confirm completion, settle Reward. Requirements are numbered in build priority order. Requirements marked **(MVP)** are built in that order. Requirements marked **(STRETCH)** are built only after every MVP requirement works on the deployed site.

- Priority 1 (core loop, 1 to 9): accounts and profiles, task posting, reward validation, browsing, applying, accepting, submitting and confirming, the status state machine, and reward settlement.
- Priority 2 (ship and prove, 10 to 12): security, demo readiness, testability.
- Priority 3 (supporting MVP, 13 to 17): message thread, minimal dashboard, report button, accessibility, responsive interface and landing page.
- Stretch (18 to 22): task editing and revisions, manual applicant rejection and withdrawal, skill-based recommendations, portfolio generation, completion testimonials.

### Confirmed Decisions

1. A single account type exists. Any Member can both post Tasks and apply to Tasks.
2. Each Task has exactly one Assignee.
3. Monetary rewards are capped at $10,000 and are settled only through the Payment_Simulator, which collects no card or bank data and is labeled as a demo everywhere it appears.
4. Members must be at least 13 years old. Members select an Age_Bracket of 13-17 or 18+ at sign-up.
5. Every Task and Profile has a required US_State and a required town or city. Members apply only to Tasks in their own US_State. Maps, geolocation APIs, and paid services are out of scope.
6. Moderation is limited to a Report button. No moderator role, moderation page, or content hiding exists.
7. Per-task messaging between the Task_Creator and the Assignee keeps contact in-app so that email addresses and phone numbers are never exposed. Realtime delivery is out of scope; messages appear on page load or refresh.
8. The stack is React, Tailwind CSS, Supabase free tier (Postgres, Auth, Row Level Security), GitHub, and Vercel free tier, with a total budget of $0.

### Remaining Assumptions

1. Bounty serves the United States only, and all amounts are in US dollars.
2. Supabase email confirmation is turned off for the demo so judges can sign up and sign in immediately.
3. A Member's age bracket is self-declared. Bounty performs no identity or age verification.

## Glossary

- **Bounty**: The complete web application described in this document.
- **Web_App**: The React and Tailwind CSS front end of Bounty, served from Vercel.
- **Backend**: The Supabase project (Postgres database, Supabase Auth, and Row Level Security policies) that stores and protects all Bounty data.
- **Auth_Service**: The Supabase Auth component responsible for account creation, sign-in, sign-out, and sessions.
- **Visitor**: A person using the Web_App without being signed in.
- **Member**: A person with a Bounty account who is signed in. A Member can act as a Task_Creator, an Applicant, or both.
- **Age_Bracket**: The age range a Member declares at sign-up: 13-17 or 18+.
- **Youth_Member**: A Member whose Age_Bracket is 13-17.
- **Youth_Safety_Notice**: A plain-language notice advising the reader to keep personal contact information (phone number, email address, home address, social media handles) out of Bounty and to involve a parent or guardian for any in-person Reward pickup.
- **US_State**: One value from the fixed list of the 50 US states plus the District of Columbia.
- **Town**: A required free-text town or city name of 2 to 60 characters.
- **Task**: A request for digital work posted by a Member, consisting of a title, description, Category, required Skills, Reward, optional deadline, US_State, Town, Task_Status, and Reward_Status.
- **Task_Creator**: The Member who posted a given Task.
- **Applicant**: A Member who has submitted an Application to a given Task.
- **Assignee**: The Applicant whose Application the Task_Creator accepted for a given Task.
- **Application**: A record linking one Applicant to one Task, containing a cover message and an Application_Status.
- **Category**: One value from the fixed list: Website, Spreadsheet, Graphic_Design, Programming, Writing, Social_Media, Other.
- **Skill**: A short text label (1 to 40 characters) describing a capability, such as "Excel" or "React".
- **Reward**: The compensation declared on a Task, consisting of a Reward_Type and the fields required for that Reward_Type.
- **Reward_Type**: One of Monetary, Nonmonetary, or Volunteer.
- **Nonmonetary_Kind**: For a Nonmonetary Reward, one of Product, Service, Experience, or Other.
- **Task_Status**: The lifecycle state of a Task: Open, In_Progress, Submitted, Completed, or Cancelled.
- **Application_Status**: The state of an Application: Pending, Accepted, Rejected, or Withdrawn.
- **Reward_Status**: The settlement state of a Task's Reward: Not_Applicable (Volunteer Rewards), Pending, Simulated_Paid (Monetary Rewards), Delivered, or Received (Nonmonetary Rewards).
- **Reward_Rules**: The set of allowed Reward_Status changes and the Member allowed to perform each change, as defined in Requirement 9.15.
- **Payment_Simulator**: The demo-only Bounty feature that records a Simulated_Payment for a Completed Task with a Monetary Reward without moving any money.
- **Simulated_Payment**: A record created by the Payment_Simulator containing the Task, the amount in US dollars, a timestamp, and the status Simulated_Paid.
- **Submission**: The record of delivered work for a Task, containing a description and at least one link (URL) to the work.
- **Message_Thread**: The set of text messages exchanged between the Task_Creator and the Assignee on one Task.
- **Profile**: The public page of a Member showing display name, bio, Skills, Town, US_State, and Completed_Projects.
- **Completed_Project**: A Task with Task_Status Completed, shown on the Assignee's Profile.
- **Report**: A record created by a Member flagging a Task or Profile as inappropriate, with a reason and an optional note.
- **Demo_Seed**: A repeatable script that loads demo Members, Tasks, Applications, Completed_Projects, and Reward settlements into the Backend for judges.
- **Status_Transition_Rules**: The set of allowed Task_Status changes and the Member allowed to perform each change, as defined in Requirement 8.1.

## Requirements

### Requirement 1: Account Registration, Age Bracket, and Profiles (MVP, Priority 1)

**User Story:** As a local student or business owner, I want to create an account with my age bracket and location and keep a simple profile, so that I can take part in local tasks safely and show my skills.

#### Acceptance Criteria

1. WHEN a Visitor submits the sign-up form with an email address of at most 254 characters containing exactly one "@" with at least one character before it and a domain containing at least one "." after it, a password of 8 to 72 characters, a display name of 1 to 50 characters after trimming leading and trailing whitespace, an Age_Bracket of 13-17 or 18+, a US_State from the US_State list, and a Town of 2 to 60 characters after trimming leading and trailing whitespace, THE Auth_Service SHALL create a Member account and sign the Member in.
2. IF a Visitor selects the "Under 13" option in the sign-up form's age selector (which offers exactly the options Under 13, 13-17, and 18+), THEN THE Web_App SHALL disable form submission, THE Auth_Service SHALL create no account, and THE Web_App SHALL display a message stating that Members must be at least 13 years old.
3. WHEN a Visitor selects the Age_Bracket 13-17 on the sign-up form, THE Web_App SHALL display the Youth_Safety_Notice within the sign-up form above the submit button and keep it displayed until the Visitor selects a different Age_Bracket.
4. IF a Visitor submits the sign-up form with an email address already registered (compared case-insensitively), THEN THE Auth_Service SHALL create no account and THE Web_App SHALL display a message stating that the email address is already in use, keeping all entered field values except the password filled in.
5. IF a Visitor submits the sign-up form with any field that does not meet the rules in criterion 1, THEN THE Auth_Service SHALL create no account and THE Web_App SHALL display an error message next to each invalid field identifying the rule that failed, keeping every valid field value filled in.
6. WHEN a Visitor submits a registered email address and its matching password on the sign-in form, THE Auth_Service SHALL start a session and THE Web_App SHALL display the Member's dashboard.
7. IF a Visitor submits a sign-in email address that is not registered or a password that does not match, THEN THE Web_App SHALL display the same message in both cases stating that the email or password is incorrect, start no session, and keep the entered email address filled in.
8. WHEN a Member selects sign out, THE Auth_Service SHALL end the session and THE Web_App SHALL display the public landing page with no Member-only navigation shown.
9. WHEN a Member account is created, THE Backend SHALL create exactly one Profile linked to that Member containing the trimmed display name, Age_Bracket, US_State, and trimmed Town from the sign-up form, an empty bio, and an empty Skill list.
10. WHEN a Member saves the Profile edit form, THE Backend SHALL store the display name (1 to 50 characters after trimming), bio (0 to 500 characters), Skills (0 to 20 Skills, each 1 to 40 characters after trimming), US_State (from the US_State list), and Town (2 to 60 characters after trimming), and SHALL keep the Age_Bracket unchanged from the value chosen at sign-up.
11. IF a Member saves a Profile with a field outside the allowed length, count, or value list in criterion 10, THEN THE Web_App SHALL display an error next to each such field identifying the rule that failed and THE Backend SHALL keep every field of the previously stored Profile unchanged.
12. WHEN a Member saves a Skill list containing duplicate Skills (compared case-insensitively after trimming whitespace), THE Backend SHALL store each distinct Skill once, keeping the first occurrence's spelling and order.
13. WHEN any Visitor or Member opens a Profile, THE Web_App SHALL display the display name, bio, Skills, Town, US_State, and the list of Completed_Projects sorted by completion date newest first, each with Task title, Category, Task_Creator display name, completion date, and Submission links, or a message stating that no projects are completed yet if the list is empty.
14. THE Web_App SHALL omit the Member's email address and Age_Bracket from every Profile page.
15. THE Backend SHALL store Member location only as US_State and Town, with no street address field.
16. IF a Member or Visitor requests a change to a Profile they do not own, THEN THE Backend SHALL reject the request and keep every field of that Profile unchanged.
17. IF a Visitor attempts to open the Profile edit form, THEN THE Web_App SHALL redirect the Visitor to the sign-in page.
18. IF any Visitor or Member opens a Profile that does not exist, THEN THE Web_App SHALL display a message stating that the Profile was not found.

### Requirement 2: Posting a Task (MVP, Priority 1)

**User Story:** As a small business owner, I want to post a local task with a reward I choose, so that I can get digital help from people in my community.

#### Acceptance Criteria

1. WHEN a Member submits the task form with a title of 5 to 100 characters, a description of 20 to 3000 characters (both lengths counted after trimming leading and trailing whitespace), exactly one Category, 0 to 10 Skills, a Reward that is valid under Requirement 3, an optional deadline given as a calendar date, a US_State, and a Town, THE Backend SHALL create one Task with Task_Status Open, the Reward_Status defined in Requirement 9.1, and the signed-in Member as Task_Creator.
2. WHEN a Member opens the task form, THE Web_App SHALL prefill the US_State and Town fields with the values stored on the Member's Profile, and SHALL allow the Member to change both fields before submitting.
3. IF a Member submits the task form with a deadline earlier than the current calendar date in the Member's browser time zone, THEN THE Web_App SHALL display an error next to the deadline field stating that the deadline must be today or later, and THE Backend SHALL create no Task.
4. IF a Member submits the task form with any field outside the allowed length, count, or value list (including a Skill outside 1 to 40 characters, more than 10 Skills, a Town outside 2 to 60 characters, a US_State not in the US_State list, or no Category), THEN THE Web_App SHALL display an error next to each invalid field, keep every entered field value filled in, and THE Backend SHALL create no Task.
5. WHEN a Task is created, THE Web_App SHALL display the Task detail page for the new Task showing the stored title, description, Category, Skills, Reward, deadline, US_State, Town, and Task_Status Open.
6. IF a Visitor attempts to open the task form, THEN THE Web_App SHALL redirect the Visitor to the sign-in page and display no task form fields.
7. WHEN the Backend creates a Task, THE Backend SHALL set the Task_Creator to the signed-in Member and the Task_Status to Open regardless of any Task_Creator or Task_Status value included in the request.
8. WHEN a Member submits a Skill list on the task form containing duplicate Skills (compared case-insensitively after trimming whitespace), THE Backend SHALL store each distinct Skill once.
9. IF the Backend fails to store a submitted Task, THEN THE Web_App SHALL display an error message stating that the Task was not posted, keep every entered field value filled in, and THE Backend SHALL hold no partial Task record.
10. WHILE a task form submission is awaiting a Backend response, THE Web_App SHALL disable the submit control so that one form submission creates at most one Task.

### Requirement 3: Flexible Reward Validation (MVP, Priority 1)

**User Story:** As a task creator, I want to offer money, a product, a service, an experience, or a volunteer opportunity, so that I can compensate helpers in a way that fits my business.

#### Acceptance Criteria

1. WHEN a Member submits a Task with a Reward, THE Backend SHALL accept the Reward only if the Reward has exactly one Reward_Type, and that Reward_Type is Monetary, Nonmonetary, or Volunteer.
2. IF a submitted Reward has no Reward_Type, more than one Reward_Type, or a Reward_Type not in the list Monetary, Nonmonetary, Volunteer, THEN THE Backend SHALL reject the Reward and create no Task, and THE Web_App SHALL display an error next to the Reward_Type field.
3. WHEN a Member submits a Reward with Reward_Type Monetary, THE Backend SHALL require a numeric amount in US dollars from 0.01 to 10,000.00 inclusive, with at most 2 decimal places.
4. WHEN a Member submits a Reward with Reward_Type Nonmonetary, THE Backend SHALL require exactly one Nonmonetary_Kind from the list Product, Service, Experience, Other, and a reward description of 5 to 300 characters, counted after removing leading and trailing whitespace.
5. WHEN a Member submits a Reward with Reward_Type Nonmonetary, THE Backend SHALL accept either no estimated value or an estimated value in US dollars from 0.00 to 10,000.00 inclusive, with at most 2 decimal places.
6. WHEN a Member submits a Reward with Reward_Type Volunteer, THE Backend SHALL store the Reward with no amount, no Nonmonetary_Kind, no reward description, and no estimated value.
7. IF a submitted Reward contains a field that does not belong to the chosen Reward_Type (an amount on a Nonmonetary or Volunteer Reward, or a Nonmonetary_Kind, reward description, or estimated value on a Monetary or Volunteer Reward), THEN THE Backend SHALL reject the Reward and create no Task, and THE Web_App SHALL display a validation error.
8. IF a Monetary amount, Nonmonetary_Kind, reward description, or estimated value is missing when required, non-numeric where a number is required, outside its allowed range, or has more than 2 decimal places, THEN THE Backend SHALL reject the Reward and create no Task, and THE Web_App SHALL display an error next to each invalid Reward field and keep the other entered form values filled in.
9. THE Web_App SHALL display every Reward with a text label that names its Reward_Type ("Monetary", "Nonmonetary", or "Volunteer") and an icon that is different for each Reward_Type. Monetary Rewards SHALL also show the amount formatted as US dollars with 2 decimal places (for example "$150.00"). Nonmonetary Rewards SHALL also show the Nonmonetary_Kind and the reward description.
10. FOR ALL valid Rewards, converting the Reward to its storage format and reading the stored Reward back SHALL produce an equivalent Reward, meaning the same Reward_Type, the same amount to the cent, the same Nonmonetary_Kind, the same reward description, and the same estimated value or absence of an estimated value (round-trip property).

### Requirement 4: Browsing Local Tasks (MVP, Priority 1)

**User Story:** As a student, I want to browse open tasks in my state, so that I can find local opportunities that match my skills.

#### Acceptance Criteria

1. WHEN a Member opens the browse page, THE Web_App SHALL set the active US_State to the US_State on the Member's Profile and display every Open Task whose US_State equals the active US_State, sorted by Task creation timestamp in descending order (newest first).
2. WHEN a Visitor opens the browse page, THE Web_App SHALL display a US_State selector with no US_State selected and a prompt to select a US_State, and SHALL display no Tasks until the Visitor selects a US_State.
3. WHEN a Visitor or Member selects a US_State in the browse page US_State selector, THE Web_App SHALL set the selected US_State as the active US_State and display only Open Tasks whose US_State equals the active US_State, sorted by Task creation timestamp in descending order.
4. WHEN a Visitor or Member enters a Town filter of 1 to 60 characters, THE Web_App SHALL display only Open Tasks in the active US_State whose Town contains the entered text after trimming leading and trailing whitespace, compared case-insensitively.
5. WHEN a Visitor or Member selects one Category in the Category filter, THE Web_App SHALL display only Open Tasks in the active US_State whose Category equals the selected Category.
6. WHEN a Visitor or Member selects one Reward_Type in the Reward_Type filter, THE Web_App SHALL display only Open Tasks in the active US_State whose Reward_Type equals the selected Reward_Type.
7. WHEN a Visitor or Member enters a search keyword of 1 to 100 characters, THE Web_App SHALL display only Open Tasks in the active US_State whose title, description, or at least one Skill contains the keyword after trimming leading and trailing whitespace, compared case-insensitively.
8. FOR ALL combinations of the active US_State, Town, Category, Reward_Type, and keyword filters, THE Web_App SHALL display a result set in which every Task has Task_Status Open and satisfies every active filter (filters combined with logical AND, and a Town or keyword filter that is empty after trimming treated as inactive), and adding a filter SHALL produce a result set that is a subset of the result set without that filter (metamorphic property).
9. IF no Open Task matches the active filters, THEN THE Web_App SHALL display an empty-state message and a "Clear filters" control that, when selected, resets the Town, Category, Reward_Type, and keyword filters to inactive while keeping the active US_State unchanged.
10. THE Web_App SHALL display for each Task in the browse list the title, Category, Reward summary (for Monetary: the US dollar amount; for Nonmonetary: the Nonmonetary_Kind and reward description; for Volunteer: the text "Volunteer"), Skills, Town, US_State, deadline (or the text "No deadline" when none is set), and Task_Creator display name.

### Requirement 5: Applying to a Local Task (MVP, Priority 1)

**User Story:** As a student, I want to apply to a task in my state with a short message, so that the task creator can choose me.

#### Acceptance Criteria

1. WHEN a Member submits an Application with a cover message of 20 to 1000 characters (counted after trimming leading and trailing whitespace) to a Task with Task_Status Open whose US_State equals the US_State on the Member's Profile, THE Backend SHALL create exactly one Application linking that Member to that Task with Application_Status Pending and the trimmed cover message.
2. IF a Member attempts to apply to a Task whose US_State differs from the US_State on the Member's Profile, THEN THE Backend SHALL reject the Application and create no Application record, and THE Web_App SHALL display a message stating that Members can apply only to Tasks in their own state.
3. IF a Member attempts to apply to a Task the same Member created, THEN THE Backend SHALL reject the Application and create no Application record, and THE Web_App SHALL display a message stating that creators cannot apply to their own Tasks.
4. IF a Member attempts to apply to a Task where the Member already has an Application with Application_Status Pending or Accepted, THEN THE Backend SHALL reject the new Application, leave the existing Application unchanged, and THE Web_App SHALL display a message stating that the Member has already applied to this Task.
5. FOR ALL sequences of Application attempts, including repeated or simultaneous submissions by the same Member, THE Backend SHALL hold at most one Application with Application_Status Pending or Accepted per Member per Task (uniqueness invariant).
6. IF a Member attempts to apply to a Task with a Task_Status other than Open, THEN THE Backend SHALL reject the Application and create no Application record, and THE Web_App SHALL display a message stating that the Task is no longer accepting applications.
7. THE Backend SHALL return an Application, including its cover message and Application_Status, only to the Applicant and the Task_Creator of the related Task, and SHALL return no Application data to any other Member or to any Visitor.
8. IF a Member submits an Application with a cover message shorter than 20 characters or longer than 1000 characters after trimming leading and trailing whitespace, THEN THE Backend SHALL create no Application, and THE Web_App SHALL display an error next to the cover message field stating the allowed length of 20 to 1000 characters and keep the entered cover message text in the field.
9. IF a Visitor attempts to apply to a Task, THEN THE Backend SHALL reject the request and create no Application, and THE Web_App SHALL redirect the Visitor to the sign-in page.

### Requirement 6: Reviewing and Accepting an Applicant (MVP, Priority 1)

**User Story:** As a task creator, I want to review applicants and accept one, so that the right local person works on my task.

#### Acceptance Criteria

1. WHEN a Task_Creator opens the Task detail page of one of the Task_Creator's Tasks, THE Web_App SHALL display every Application for that Task, in ascending order of Application submission time, with the Applicant display name, Skills, Town, Completed_Project count, cover message, Application_Status, and a link to the Applicant's Profile.
2. WHEN a Task_Creator accepts an Application with Application_Status Pending on a Task with Task_Status Open, and the Applicant's current Profile US_State at the time of acceptance equals the Task US_State, THE Backend SHALL, as a single all-or-nothing operation, set that Application_Status to Accepted, set the Task_Status to In_Progress, and record the Applicant as the Assignee.
3. IF a Task_Creator attempts to accept an Application whose Applicant's current Profile US_State differs from the Task US_State, THEN THE Backend SHALL reject the action, leave every Application_Status, the Task_Status, and the Assignee unchanged, and THE Web_App SHALL display a message stating that only Applicants in the Task's state can be accepted.
4. FOR ALL Members and Tasks, THE Backend SHALL set an Application to Accepted only when the Task US_State equals the Applicant's Profile US_State at the time of acceptance (same-state invariant).
5. WHEN a Task_Creator accepts an Application, THE Backend SHALL, within the same all-or-nothing operation as criterion 2, set every other Application with Application_Status Pending on the same Task to Rejected, and leave Applications with Application_Status Rejected or Withdrawn unchanged.
6. FOR ALL Tasks and all sequences of accept requests, including two accept requests on the same Task submitted at the same time, THE Backend SHALL hold at most one Application with Application_Status Accepted per Task (single Assignee invariant).
7. IF a Member other than the Task_Creator attempts to accept an Application, THEN THE Backend SHALL reject the action and leave every Application_Status, the Task_Status, and the Assignee unchanged.
8. IF a Task_Creator attempts to accept an Application whose Application_Status is not Pending, or on a Task whose Task_Status is not Open, THEN THE Backend SHALL reject the action, leave every Application_Status, the Task_Status, and the Assignee unchanged, and THE Web_App SHALL display a message stating that the Application can no longer be accepted.
9. WHEN a Task_Creator opens the Task detail page of one of the Task_Creator's Tasks that has zero Applications, THE Web_App SHALL display an empty-state message stating that no one has applied yet.

### Requirement 7: Submitting Work and Confirming Completion (MVP, Priority 1)

**User Story:** As an assignee, I want to submit my finished work and have the task creator confirm it, so that the project counts toward my portfolio.

#### Acceptance Criteria

1. WHEN the Assignee submits a Submission with a description of 10 to 2000 characters (after trimming leading and trailing whitespace) and 1 to 5 URLs, each 1 to 2048 characters long, using the http or https scheme, and including a host name, on a Task with Task_Status In_Progress, THE Backend SHALL store the Submission linked to that Task and set the Task_Status to Submitted.
2. IF a Submission contains a URL that does not use the http or https scheme, has no host name, or is longer than 2048 characters, THEN THE Backend SHALL reject the Submission, THE Web_App SHALL display an error identifying each invalid URL, and THE Backend SHALL leave the Task_Status as In_Progress with no Submission stored.
3. WHEN the Task_Creator confirms completion of a Task with Task_Status Submitted, THE Backend SHALL set the Task_Status to Completed and record the completion date as the date on which the confirmation was stored.
4. WHEN any Visitor or Member opens the Assignee's Profile after the Task reaches Task_Status Completed, THE Web_App SHALL display the Task as a Completed_Project on that Profile.
5. IF a Member other than the Assignee attempts to submit work on a Task, THEN THE Backend SHALL reject the Submission, store no Submission, and leave the Task_Status unchanged.
6. IF a Member other than the Task_Creator attempts to confirm completion, or the Task_Creator attempts to confirm completion of a Task whose Task_Status is not Submitted, THEN THE Backend SHALL reject the action and leave the Task_Status unchanged.
7. IF the Assignee submits a Submission with a description shorter than 10 or longer than 2000 characters, with 0 URLs, or with more than 5 URLs, THEN THE Backend SHALL reject the Submission, THE Web_App SHALL display an error next to each invalid field and keep the entered description and URLs filled in, and THE Backend SHALL leave the Task_Status as In_Progress.
8. IF the Assignee attempts to submit work on a Task whose Task_Status is not In_Progress, THEN THE Backend SHALL reject the Submission, store no Submission, and leave the Task_Status unchanged.
9. WHEN the Task_Creator or the Assignee opens the detail page of a Task with Task_Status Submitted or Completed, THE Web_App SHALL display the Submission description and every Submission URL as a link.

### Requirement 8: Task Status State Machine and Authorization (MVP, Priority 1)

**User Story:** As a developer and as a judge, I want task status changes to follow strict rules, so that the workflow is reliable and no one can act on tasks they do not own.

#### Acceptance Criteria

1. THE Backend SHALL allow only the following four Task_Status transitions in the MVP, each performed only by the listed Member: Open to In_Progress (Task_Creator, only by accepting a Pending Application under Requirement 6); In_Progress to Submitted (Assignee, only by storing a Submission under Requirement 7); Submitted to Completed (Task_Creator, only by confirming completion under Requirement 7); Open to Cancelled (Task_Creator).
2. IF any Member requests a Task_Status transition that is not listed in the Status_Transition_Rules, including a transition from a Task_Status to the same Task_Status or a request based on a Task_Status that is no longer current, THEN THE Backend SHALL reject the request and leave the Task_Status, Assignee, and every Application_Status on that Task unchanged, and THE Web_App SHALL display an error message stating that the action is not allowed in the Task's current status and SHALL display the Task's current Task_Status.
3. IF a Visitor, or a Member who is not the Member listed for a requested transition in the Status_Transition_Rules, requests that transition, THEN THE Backend SHALL reject the request and leave the Task_Status, Assignee, and every Application_Status on that Task unchanged, and THE Web_App SHALL display an error message stating that the Member is not permitted to perform the action.
4. WHILE a Task has Task_Status Completed or Cancelled, THE Backend SHALL reject every Task_Status change request on that Task from any Member, including the Task_Creator and the Assignee.
5. WHEN a Task_Creator cancels an Open Task, THE Backend SHALL set the Task_Status to Cancelled and set every Pending Application on that Task to Rejected, leaving the Task with no Assignee.
6. FOR ALL sequences of transition requests by any Members, THE Backend SHALL keep every Task in a Task_Status reachable from its initial Task_Status Open using only the Status_Transition_Rules, so that a Task with Task_Status Submitted has previously been In_Progress and a Task with Task_Status Completed has previously been Submitted (state machine invariant).
7. FOR ALL Tasks, THE Backend SHALL hold exactly one Assignee for every Task with Task_Status In_Progress, Submitted, or Completed, and no Assignee for every Task with Task_Status Open or Cancelled (invariant).
8. THE Backend SHALL enforce the Status_Transition_Rules, the same-state rule, and authorization checks in the database layer (Row Level Security policies or database functions), so that a request sent directly to the Backend with the Supabase public anonymous key, without using the Web_App, is accepted or rejected with the same outcome as the same request sent from the Web_App.
9. IF any part of a Task_Status transition fails, including recording the Assignee, setting the accepted Application to Accepted, or setting other Pending Applications to Rejected, THEN THE Backend SHALL apply none of the changes of that transition and leave the Task_Status, Assignee, and every Application_Status on that Task as they were before the request.
10. IF two transition requests on the same Task are received at the same time, THEN THE Backend SHALL apply at most one of them and reject every other request whose starting Task_Status no longer matches the Task's current Task_Status.

### Requirement 9: Reward Settlement and Demo Payment Simulator (MVP, Priority 1)

**User Story:** As a task creator and assignee, I want to settle the agreed reward after the work is confirmed, so that the demo shows the full loop from posting to reward.

#### Acceptance Criteria

1. WHEN a Task is created, THE Backend SHALL set the Reward_Status to Not_Applicable for a Volunteer Reward and to Pending for a Monetary or Nonmonetary Reward.
2. WHILE a Task with a Monetary Reward has Task_Status Completed and Reward_Status Pending, THE Web_App SHALL display an action labeled "Simulated payment (demo only)" on the Task detail page to the Task_Creator only. THE Web_App SHALL NOT display this action to any other Member, to any Visitor, or for a Task in any other Task_Status, Reward_Status, or Reward_Type.
3. WHEN the Task_Creator selects "Simulated payment (demo only)" on a Task that meets the conditions in criterion 2, THE Payment_Simulator SHALL create exactly one Simulated_Payment with an amount equal to the Monetary Reward amount stored on the Task, the current timestamp, and status Simulated_Paid, and THE Backend SHALL set the Reward_Status to Simulated_Paid in the same operation, so that either both changes are stored or neither is stored.
4. THE Payment_Simulator SHALL include no input field for, and SHALL store no, card number, bank account number, routing number, or other payment credential.
5. THE Web_App SHALL display the text "Demo only - no real money is moved" next to the "Simulated payment (demo only)" action, in the confirmation message shown after a Simulated_Payment is created, and next to every Simulated_Payment record displayed.
6. FOR ALL Tasks, THE Backend SHALL hold at most one Simulated_Payment per Task, and the Simulated_Payment amount SHALL equal the agreed Monetary Reward amount of that Task (invariant).
7. IF a Member requests a Simulated_Payment on a Task that does not have Task_Status Completed, does not have a Monetary Reward, does not have Reward_Status Pending, already has a Simulated_Payment, or was not created by that Member, THEN THE Backend SHALL reject the request, create no Simulated_Payment, and leave the Reward_Status unchanged, and THE Web_App SHALL display an error message stating that the reward could not be settled.
8. WHILE a Task with a Nonmonetary Reward has Task_Status Completed and Reward_Status Pending, THE Web_App SHALL display an action to mark the Reward as delivered on the Task detail page to the Task_Creator only.
9. WHEN the Task_Creator marks the Nonmonetary Reward as delivered on a Task with Task_Status Completed and Reward_Status Pending, THE Backend SHALL set the Reward_Status to Delivered.
10. WHILE a Task with a Nonmonetary Reward has Task_Status Completed and Reward_Status Delivered, THE Web_App SHALL display an action to confirm receipt of the Reward on the Task detail page to the Assignee only.
11. WHEN the Assignee confirms receipt of the Nonmonetary Reward on a Task with Reward_Status Delivered, THE Backend SHALL set the Reward_Status to Received.
12. IF a Member requests a Reward_Status change that is not listed in the Reward_Rules, or the requesting Member is not the Member listed for that change, THEN THE Backend SHALL reject the request and leave the Reward_Status unchanged, and THE Web_App SHALL display an error message stating that the reward status could not be changed.
13. FOR ALL sequences of Reward_Status change requests, THE Backend SHALL keep every Task in a Reward_Status reachable from the initial Reward_Status using only the Reward_Rules, with Pending to Simulated_Paid only for Monetary Rewards and Pending to Delivered to Received only for Nonmonetary Rewards (state machine invariant).
14. THE Web_App SHALL display the current Reward_Status as text on the Task detail page to the Task_Creator and the Assignee.
15. THE Backend SHALL allow only the following Reward_Status changes (the Reward_Rules), each only while the Task has Task_Status Completed and each performed only by the listed Member: Pending to Simulated_Paid for a Monetary Reward (Task_Creator, through the Payment_Simulator); Pending to Delivered for a Nonmonetary Reward (Task_Creator); Delivered to Received for a Nonmonetary Reward (Assignee). Not_Applicable, Simulated_Paid, and Received are final states with no further changes allowed.

### Requirement 10: Security and Data Protection (MVP, Priority 2)

**User Story:** As a member, I want my account and data protected, so that I can trust the platform.

#### Acceptance Criteria

1. THE Backend SHALL enable Row Level Security on every table that stores Profiles, Tasks, Applications, Submissions, Simulated_Payments, messages, or Reports, and SHALL deny every read or write on those tables that no Row Level Security policy explicitly allows.
2. THE Web_App SHALL use only the Supabase public anonymous key in browser code, and THE repository SHALL contain no Supabase service role key, database password, or other secret credential in any committed file.
3. THE Web_App SHALL render all user-provided text (display names, bios, Skills, Towns, Task fields, Reward descriptions, cover messages, Submission descriptions, messages, and Report notes) as plain text, so that input such as `<script>alert(1)</script>` or `<b>x</b>` displays as the literal characters typed and no user-provided HTML or script runs.
4. THE Web_App SHALL render a Submission link as a clickable link only when the URL uses the http or https scheme, and SHALL display any other stored value as non-clickable plain text.
5. THE Backend SHALL validate, at the database layer, every field length, count, format, and allowed value defined in Requirements 1, 2, 3, 5, 7, 13, and 15, in addition to validation in the Web_App.
6. IF a write request sent directly to the Backend violates any database-layer validation rule, THEN THE Backend SHALL reject the entire request and leave all stored data unchanged.
7. IF a Visitor attempts to create, edit, or delete any Profile, Task, Application, Submission, Simulated_Payment, message, or Report, THEN THE Backend SHALL reject the request and leave all stored data unchanged.
8. IF a Visitor attempts to read any Application, message, Report, or Simulated_Payment, THEN THE Backend SHALL return no records.
9. THE Backend SHALL return a Member's email address only to that Member, and SHALL return a Member's Age_Bracket only to that Member and to the other participant (Task_Creator or Assignee) of a Task they share, for display of the Youth_Safety_Notice under Requirement 13.4.

### Requirement 11: Demo Readiness for Judges (MVP, Priority 2)

**User Story:** As a hackathon judge, I want a working test link with demo accounts and realistic local data, so that I can evaluate the full workflow in a few minutes.

#### Acceptance Criteria

1. THE Demo_Seed SHALL create at least 3 demo Members whose Profiles have US_State Massachusetts and a Massachusetts Town: at least one small business Task_Creator with Age_Bracket 18+, one adult student with Age_Bracket 18+, and one Youth_Member with Age_Bracket 13-17, each with a display name, a bio of 1 to 500 characters, and 1 to 20 Skills.
2. THE Demo_Seed SHALL create at least 6 Tasks with US_State Massachusetts covering every Reward_Type (Monetary, Nonmonetary, and Volunteer) and at least 3 distinct Categories, plus at least 1 Task with Task_Status Open in a US_State other than Massachusetts so that a Massachusetts demo Member can attempt to apply and see the same-state rejection defined in Requirement 5.2.
3. THE Demo_Seed SHALL include at least one Massachusetts Task in each Task_Status of Open, In_Progress, Submitted, and Completed, at least one Open Massachusetts Task with at least one Pending Application, and at least one Completed Task with a Monetary Reward and one Simulated_Payment whose amount equals that Task's Monetary Reward amount.
4. WHEN the Demo_Seed runs on a Backend that already contains demo data, THE Demo_Seed SHALL produce the same demo Members, Tasks, Applications, Submissions, Simulated_Payments, and Reward_Status values as a single run on an empty Backend, with no duplicated demo records and no change to records that the Demo_Seed did not create (idempotence property).
5. THE repository README SHALL list the public test link; the email address, password, Age_Bracket, and role (small business Task_Creator, adult student, or Youth_Member) of every demo Member; the local setup steps to install dependencies, run the Web_App, and run the test suite; and the Supabase setup steps to create the project, apply the database schema and Row Level Security policies, set the Supabase URL and public anonymous key, and run the Demo_Seed.
6. THE repository SHALL contain the .kiro folder with the specs, steering files, and hooks used to build Bounty.
7. THE Web_App SHALL be deployed on the Vercel free tier, and WHEN a Visitor opens the public test link listed in the README without signing in, THE Web_App SHALL display the public landing page.
8. WHEN a Visitor signs in on the deployed Web_App with any demo Member credentials listed in the README, THE Auth_Service SHALL start a session and THE Web_App SHALL display that Member's dashboard.
9. THE Demo_Seed SHALL create only records that satisfy every field length, value list, Status_Transition_Rules, Reward_Rules, same-state, and single Assignee rule defined in Requirements 1 through 9, so that every seeded Accepted Application belongs to an Applicant whose Profile US_State equals the Task US_State.

### Requirement 12: Testability of Core Logic (MVP, Priority 2)

**User Story:** As a developer, I want core rules isolated in pure functions with automated tests, so that the workflow stays correct and the project demonstrates property-based testing.

#### Acceptance Criteria

1. THE Web_App SHALL implement Reward validation (Requirement 3), Task field validation (Requirement 2), the same-state rule (Requirements 5.2 and 6.4), Status_Transition_Rules checks (Requirement 8), Reward_Rules checks (Requirement 9), and browse filtering (Requirement 4) as pure functions, where a pure function returns the same output for the same inputs and makes no network, database, browser storage, or system clock calls (the current date is passed in as an input).
2. THE Bounty test suite SHALL include one property-based test for each of Requirement 3.10 (Reward round-trip), Requirement 4.8 (filter metamorphic property), Requirement 5.5 (Application uniqueness), Requirement 6.4 (same-state acceptance), Requirement 6.6 (single Assignee), Requirement 8.6 (Task_Status state machine), Requirement 9.6 (Simulated_Payment amount and at-most-once), Requirement 9.13 (Reward_Status state machine), and Requirement 14.5 (dashboard next-action invariant), with each test name containing the number of the Requirement it verifies.
3. THE Bounty test suite SHALL run each property-based test against at least 100 randomly generated inputs, where the invariant tests (Requirements 5.5, 6.6, 8.6, 9.6, and 9.13) generate random sequences of 1 to 20 requests from randomly chosen Members and apply them to the pure functions of criterion 1.
4. WHEN a developer runs the single test command documented in the README, THE Bounty test suite SHALL run once in non-watch mode, report pass or fail for each test, and finish within 120 seconds.
5. WHEN the Bounty test suite finishes, THE test command SHALL exit with status 0 if every test passed and with a non-zero status if any test failed.
6. IF a property-based test fails, THEN THE Bounty test suite SHALL report the generated input that caused the failure.
7. THE Bounty test suite SHALL run without network access and without a connection to the Backend.

### Requirement 13: Task Message Thread (MVP, Priority 3)

**User Story:** As a task creator or assignee, I want to message the other person on a task, so that we can clarify details and arrange the reward without sharing personal contact information.

#### Acceptance Criteria

1. WHILE a Task has Task_Status In_Progress, Submitted, or Completed, THE Web_App SHALL display the Message_Thread and a message input on the Task detail page to the Task_Creator and the Assignee of that Task, and SHALL display no Message_Thread and no message input to any other Member or Visitor.
2. WHEN the Task_Creator or the Assignee sends a message whose text is 1 to 2000 characters after trimming leading and trailing whitespace on a Task with Task_Status In_Progress, Submitted, or Completed, THE Backend SHALL store the trimmed message text with the sender and a timestamp set by the Backend, and THE Web_App SHALL clear the message input and display the sent message at the end of the Message_Thread without a page refresh.
3. WHEN the Task_Creator or the Assignee opens or refreshes the Task detail page, THE Web_App SHALL display every stored message in the Message_Thread in ascending order of timestamp (messages with equal timestamps in the order they were stored), each showing the sender display name, the send date and time, and the message text rendered as plain text, and SHALL display messages sent by the other participant after page load only after the next page load or refresh.
4. WHILE the Task_Creator or the Assignee of a Task is a Youth_Member, THE Web_App SHALL display the Youth_Safety_Notice directly above the Message_Thread to both participants every time the Message_Thread is displayed, with no user action required to reveal it.
5. IF a Member other than the Task_Creator or the Assignee, or a Visitor, requests to read or write messages in a Message_Thread, THEN THE Backend SHALL reject the request, return no messages, and store no message.
6. IF the Task_Creator or the Assignee sends a message that is empty after trimming whitespace, exceeds 2000 characters, or is sent on a Task with Task_Status Open or Cancelled, THEN THE Backend SHALL store no message and THE Web_App SHALL display an error indicating the reason and keep the entered text in the message input.
7. IF the Backend fails to store a sent message, THEN THE Web_App SHALL display an error indicating the message was not sent with an option to retry, keep the entered text in the message input, and add no message to the displayed Message_Thread.
8. THE Backend SHALL reject every request to edit or delete a stored message.

### Requirement 14: Minimal Dashboard (MVP, Priority 3)

**User Story:** As a member, I want one page showing tasks I posted and tasks I am working on, so that I can find my next step.

#### Acceptance Criteria

1. WHEN a Member opens the dashboard, THE Web_App SHALL display a "Posted" list containing every Task where the Member is the Task_Creator, in every Task_Status including Cancelled, sorted by Task creation time newest first, showing for each Task the title (linked to the Task detail page), the Task_Status as text, and the Reward_Status as text.
2. WHEN a Member opens the dashboard, THE Web_App SHALL display a "Working On" list containing every Task where the Member is the Assignee, in Task_Status In_Progress, Submitted, or Completed, sorted by Task creation time newest first, showing for each Task the title (linked to the Task detail page), the Task_Status as text, and the Reward_Status as text.
3. WHEN a Member opens the dashboard, THE Web_App SHALL display an "Applications" list containing every Application the Member submitted, in every Application_Status, sorted by Application creation time newest first, showing for each Application the related Task title (linked to the Task detail page) and the Application_Status as text.
4. THE Web_App SHALL display one next-action label for each Task in the "Posted" and "Working On" lists, chosen as follows: "Review applicants" for a Posted Task with Task_Status Open and at least 1 Pending Application; "Confirm completion" for a Posted Task with Task_Status Submitted; "Settle reward" for a Posted Task with Task_Status Completed and Reward_Status Pending; "Submit work" for a Working On Task with Task_Status In_Progress; "Confirm reward received" for a Working On Task with a Nonmonetary Reward and Reward_Status Delivered; and "No action needed" for every other combination.
5. FOR ALL Tasks and Members, THE Web_App SHALL show a next-action label other than "No action needed" only when the Member is the Member listed for that action in the Status_Transition_Rules or Reward_Rules and the Task's current Task_Status and Reward_Status allow that action (invariant).
6. IF a dashboard list contains no items, THEN THE Web_App SHALL display an empty-state message for that list in place of the list items, while still showing the other lists.
7. IF a Visitor attempts to open the dashboard, THEN THE Web_App SHALL redirect the Visitor to the sign-in page.

### Requirement 15: Report Button (MVP, Priority 3)

**User Story:** As a member, I want to report an inappropriate task or profile, so that the community stays safe.

#### Acceptance Criteria

1. WHILE a Member is signed in, THE Web_App SHALL display a "Report" button on every Task detail page and every Profile page, and WHILE a Visitor is not signed in, THE Web_App SHALL hide the "Report" button.
2. WHEN a Member submits a Report on a Task or Profile with exactly one reason from the list Spam, Inappropriate, Scam, Other and an optional note of 0 to 500 characters, THE Backend SHALL store one Report containing the reporting Member, the reported Task or Profile, the reason, the note, and the submission timestamp, and THE Web_App SHALL display a confirmation that the Report was received.
3. IF a Member submits a Report on a Task or Profile that the same Member has already reported, THEN THE Backend SHALL reject the duplicate Report and store no new Report, and THE Web_App SHALL display a message stating that the Report was already received.
4. THE Backend SHALL restrict reading of a Report to the Member who created the Report.
5. IF a Member submits a Report with no reason selected or with a note longer than 500 characters, THEN THE Backend SHALL store no Report and THE Web_App SHALL display an error next to the invalid field and keep the entered note text filled in.
6. THE Backend SHALL leave the reported Task or Profile unchanged and visible after a Report is stored.

### Requirement 16: Accessibility (MVP, Priority 3)

**User Story:** As a user with a disability or limited technical experience, I want the platform to be usable with a keyboard, screen reader, and plain language, so that I can participate fully.

#### Acceptance Criteria

1. THE Web_App SHALL make every interactive control (links, buttons, form fields, selectors, and filter controls) reachable with the Tab and Shift+Tab keys and operable with the Enter or Space key, in a focus order that matches the visual reading order of the page (top to bottom, left to right), with no point at which keyboard focus cannot be moved away using the Tab or Shift+Tab keys.
2. WHEN an interactive control receives keyboard focus, THE Web_App SHALL display a focus indicator of at least 2 CSS pixels in thickness around or beneath the control, with a contrast ratio of at least 3:1 against the adjacent background.
3. THE Web_App SHALL provide a visible text label for every form field that is programmatically associated with the field, and an accessible name describing the action for every icon-only button (for example, the Reward_Type icons and any close or menu buttons).
4. THE Web_App SHALL use text and background color combinations with a contrast ratio of at least 4.5:1 for body text and at least 3:1 for large text (at least 24 CSS pixels regular weight or at least 18.66 CSS pixels bold) and for the boundaries of interface components such as buttons and form fields.
5. THE Web_App SHALL render on every page exactly one header, one nav, one main, and one footer landmark using semantic HTML elements, and exactly one level-1 heading inside the main landmark.
6. WHEN a form submission fails validation, THE Web_App SHALL move keyboard focus to the first invalid field in visual order and SHALL programmatically associate each field error message with its field so that a screen reader reads the error message when the field receives focus.
7. IF a form submission fails because of a Backend error rather than a field validation error, THEN THE Web_App SHALL display the error message in a region that screen readers announce automatically without moving focus, and SHALL keep all entered field values filled in.
8. THE Web_App SHALL convey Task_Status, Reward_Type, and Reward_Status with a visible text label in addition to any color or icon, so that each value remains identifiable when the page is viewed in grayscale.
9. THE Web_App SHALL display Task_Status, Application_Status, Reward_Status, Reward_Type, Nonmonetary_Kind, and Category values as human-readable words with spaces instead of underscores (for example, "In progress" instead of "In_Progress"), and SHALL display no raw database error text, error codes, or stack traces in interface text, help text, or error messages.

### Requirement 17: Responsive Interface and Landing Page (MVP, Priority 3)

**User Story:** As a user on a phone or computer, I want a clean, professional interface, so that the platform feels trustworthy and easy to use.

#### Acceptance Criteria

1. THE Web_App SHALL render every page at every viewport width from 360 pixels to 1920 pixels with no horizontal scrollbar, with no text or interactive control cut off or overlapping other content, and with every interactive control visible and operable.
2. THE Web_App SHALL take every color, font family, font size, and spacing value on every page only from one shared Tailwind CSS theme configuration. Buttons, form fields, cards, and status labels of the same kind SHALL look the same on every page.
3. WHILE a Backend request for page content has not yet returned, THE Web_App SHALL display a loading indicator with the text label "Loading" in place of the pending content, and SHALL remove the indicator once the request succeeds or fails.
4. IF a Backend request returns an error, fails because of a network error, or returns no response within 15 seconds, THEN THE Web_App SHALL display an error message in plain language that names the action that failed, contains no error codes or technical details, and offers a "Retry" control.
5. WHEN a Member selects "Retry" after a failed Backend request, THE Web_App SHALL send the failed request again and keep every value the Member entered in the related form.
6. WHEN a Backend request succeeds for posting a Task, submitting an Application, accepting an Application, submitting a Submission, confirming completion, or changing a Reward_Status, THE Web_App SHALL display a confirmation message that names the completed action. The message SHALL be announced to screen readers and stay visible for at least 5 seconds or until the Member dismisses it.
7. WHEN a Visitor or Member opens the root URL of the Web_App, THE Web_App SHALL display the public landing page without requiring sign-in.
8. THE landing page SHALL contain text sections that state each of the following: what Bounty is; that Members apply only to Tasks in their own US_State; the task workflow steps (post, apply, accept, submit work, confirm completion, settle Reward); the three Reward_Types (Monetary, Nonmonetary, Volunteer); and that monetary payments are simulated for the demo and no real money is moved. The landing page SHALL also contain a control that opens the sign-up form.

### Requirement 18: Task Editing, Cancellation After Acceptance, and Revisions (STRETCH)

**User Story:** As a task creator, I want to edit open tasks, cancel tasks in progress, and request revisions, so that I can handle changes after posting.

#### Acceptance Criteria

1. WHERE task editing is enabled, WHILE a Task has Task_Status Open and has no Application with Application_Status Accepted, WHEN the Task_Creator saves the task edit form with values that pass the validation rules of Requirement 2.1, Requirement 2.3, and Requirement 3, THE Backend SHALL store the edited title, description, Category, Skills, Reward, deadline, US_State, and Town and keep the Task_Status Open.
2. WHERE task editing is enabled, IF a Member other than the Task_Creator submits a Task edit, or the Task has a Task_Status other than Open, or any edited field fails the validation rules of Requirement 2.1, Requirement 2.3, or Requirement 3, THEN THE Backend SHALL reject the edit and keep the previously stored Task unchanged, and THE Web_App SHALL display an error next to each invalid field or a message stating that the Task can no longer be edited.
3. WHERE task editing is enabled, WHEN the Task_Creator saves a Task edit that changes the Reward_Type, THE Backend SHALL set the Reward_Status to Not_Applicable for a Volunteer Reward and to Pending for a Monetary or Nonmonetary Reward.
4. WHERE revisions are enabled, WHEN the Task_Creator requests revisions with a note of 10 to 1000 characters on a Task with Task_Status Submitted, THE Backend SHALL set the Task_Status to In_Progress, store the revision note with a timestamp, and keep every earlier Submission stored, adding Submitted to In_Progress (Task_Creator) to the Status_Transition_Rules.
5. WHERE revisions are enabled, IF a revision request has a note outside 10 to 1000 characters, targets a Task with a Task_Status other than Submitted, or comes from a Member other than the Task_Creator, THEN THE Backend SHALL reject the request and leave the Task_Status unchanged, and THE Web_App SHALL display an error stating the reason.
6. WHERE cancellation after acceptance is enabled, WHEN the Task_Creator cancels a Task with Task_Status In_Progress, THE Backend SHALL set the Task_Status to Cancelled and leave the Accepted Application_Status and the Reward_Status unchanged, adding In_Progress to Cancelled (Task_Creator) to the Status_Transition_Rules.

### Requirement 19: Manual Rejection and Withdrawal of Applications (STRETCH)

**User Story:** As a task creator or applicant, I want to reject or withdraw a single application, so that applicant lists stay current.

#### Acceptance Criteria

1. WHERE manual rejection is enabled, WHEN a Task_Creator rejects a Pending Application on an Open Task, THE Backend SHALL set that Application_Status to Rejected and leave the Task_Status and every other Application_Status on that Task unchanged.
2. WHERE withdrawal is enabled, WHEN an Applicant withdraws the Applicant's own Application with Application_Status Pending, THE Backend SHALL set that Application_Status to Withdrawn and leave the Task_Status unchanged.
3. WHERE manual rejection or withdrawal is enabled, IF a Member other than the Task_Creator requests a rejection, a Member other than the Applicant requests a withdrawal, or the targeted Application has an Application_Status other than Pending, THEN THE Backend SHALL reject the request and leave every Application_Status unchanged.
4. WHERE manual rejection or withdrawal is enabled, THE Backend SHALL treat Applications with Application_Status Rejected or Withdrawn as inactive under Requirement 5.4, so that the same Member may submit one new Pending Application to the same Open Task.

### Requirement 20: Skill-Based Recommendations (STRETCH)

**User Story:** As a student, I want to see local tasks that match my skills, so that I find relevant opportunities faster.

#### Acceptance Criteria

1. WHERE skill-based recommendations are enabled, WHEN a Member with at least one Skill opens the dashboard, THE Web_App SHALL display up to 5 Open Tasks in the Member's US_State that share at least 1 Skill with the Member, ranked by the number of matching Skills in descending order, with Skills compared case-insensitively after trimming whitespace and ties ordered newest first.
2. WHERE skill-based recommendations are enabled, THE Web_App SHALL exclude from recommendations every Task the Member created and every Task on which the Member has an Application in any Application_Status.
3. WHERE skill-based recommendations are enabled, THE Web_App SHALL compute recommendations using only Task and Profile data stored in the Backend, with no call to any external or paid service.
4. FOR ALL Members and Task sets, the recommendation list SHALL contain at most 5 Tasks, every recommended Task SHALL have Task_Status Open, share at least one Skill with the Member, and have the Member's US_State, and the list SHALL be sorted by match count in descending order (invariant).
5. WHERE skill-based recommendations are enabled, IF a Member with zero Skills opens the dashboard, THEN THE Web_App SHALL display a message prompting the Member to add Skills to the Profile in place of the recommendation list.
6. WHERE skill-based recommendations are enabled, IF no Open Task meets the recommendation rules for a Member with at least one Skill, THEN THE Web_App SHALL display an empty-state message stating that no recommended Tasks are available.

### Requirement 21: Automatic Portfolio Generation (STRETCH)

**User Story:** As a student, I want a shareable portfolio page generated from my completed projects, so that I can add it to my resume and applications.

#### Acceptance Criteria

1. WHERE automatic portfolio generation is enabled, WHEN any Visitor or Member opens a Member's portfolio page, THE Web_App SHALL display the Member's display name, bio, Skills, and every Completed_Project with Task title, Category, Task_Creator display name, completion date, Task description, and Submission links, sorted by completion date newest first, and SHALL omit the Member's email address and Age_Bracket.
2. WHERE automatic portfolio generation is enabled, THE Web_App SHALL provide each Member one public portfolio URL that stays the same across visits and opens without sign-in.
3. WHERE automatic portfolio generation is enabled, WHEN a user selects print on the portfolio page, THE Web_App SHALL produce a single-column layout that excludes the header, navigation, footer, and buttons.
4. WHERE automatic portfolio generation is enabled, THE Web_App SHALL include in the portfolio exactly the Member's Completed_Projects, with no Tasks in any other Task_Status (invariant).
5. WHERE automatic portfolio generation is enabled, IF the Member has zero Completed_Projects, THEN THE Web_App SHALL display the portfolio page with the Profile details and a message stating that no completed projects exist yet.
6. WHERE automatic portfolio generation is enabled, IF a portfolio URL refers to no existing Member, THEN THE Web_App SHALL display a not-found message with a link to the landing page.

### Requirement 22: Completion Testimonials (STRETCH)

**User Story:** As a student, I want task creators to leave a short testimonial when confirming completion, so that my profile shows credible references.

#### Acceptance Criteria

1. WHERE completion testimonials are enabled, WHEN the Task_Creator opens the confirm-completion action on a Task with Task_Status Submitted, THE Web_App SHALL display an optional testimonial field accepting 0 to 500 characters.
2. WHERE completion testimonials are enabled, WHEN the Task_Creator confirms completion with a testimonial of 1 to 500 characters, THE Backend SHALL store the testimonial linked to the Task in the same operation that sets the Task_Status to Completed.
3. WHERE completion testimonials are enabled, WHEN the Task_Creator confirms completion with an empty testimonial field, THE Backend SHALL set the Task_Status to Completed and store no testimonial.
4. WHERE completion testimonials are enabled, IF the testimonial exceeds 500 characters, THEN THE Backend SHALL reject the confirmation, leave the Task_Status Submitted with no testimonial stored, and THE Web_App SHALL display an error next to the testimonial field.
5. WHERE completion testimonials are enabled, THE Web_App SHALL display each stored testimonial with the Task_Creator display name next to the related Completed_Project on the Assignee's Profile.
6. WHERE completion testimonials are enabled, IF a Member other than the Task_Creator attempts to create a testimonial, or a testimonial already exists for the Task, THEN THE Backend SHALL reject the request and leave any stored testimonial unchanged.

/**
 * SignUpPage — account registration at `/signup` (Req 1.1-1.5, 1.9).
 *
 * The age selector offers EXACTLY three options: "Under 13", "13-17", and
 * "18+" (Req 1.2). Its raw selected value is stored in form state:
 *   - "Under 13" disables the submit button and shows a minimum-age message;
 *     submission is blocked and `supabase.auth.signUp` is never called (Req 1.2).
 *   - "13-17" renders the {@link YouthSafetyNotice} above the submit button and
 *     keeps it visible while 13-17 stays selected (Req 1.3).
 *
 * On submit we build a {@link SignUpInput} (the selected age value becomes
 * `ageBracket`; "Under 13" is rejected by `validateSignUp` as a defence in
 * depth) and validate. On invalid input we show per-field errors and move focus
 * to the first invalid field (Req 1.5). On valid input we call
 * `supabase.auth.signUp` with the snake_case metadata keys the new-user trigger
 * reads: `display_name`, `age_bracket`, `us_state`, `town` (design "Auth and
 * Sign-up Flow"). Because email confirmation is OFF, a session is returned on
 * success and we navigate to the attempted location (if a guard bounced the
 * Member here) or `/dashboard`.
 *
 * Errors — including an already-registered email (Req 1.4) and any metadata
 * rejection raised by the trigger (Req 1.5, 1.9) — are mapped through
 * `messageForError` so raw database text never reaches the user, and shown in a
 * `role="alert"` region without clearing the entered values (the password is
 * never echoed back by React's controlled input beyond what the user typed).
 * The submit button is disabled while a request is in flight so one click
 * creates at most one account.
 *
 * All user text renders through normal JSX (React escapes it); no
 * `dangerouslySetInnerHTML`. `supabase.auth` is used directly here — the one
 * allowed exception to the "data access via api.ts" rule, since `api.ts` does
 * not wrap auth sign-up / sign-in.
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.9_
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AppLayout, Button, Input, Select, YouthSafetyNotice } from '../components';
import { supabase } from '../lib/supabase';
import { messageForError } from '../lib/errors';
import { createMyProfile } from '../lib/api';
import { validateSignUp } from '../domain/validation';

/** The three age selector options (Req 1.2). Only the first is a blocker. */
const AGE_OPTIONS = ['Under 13', '13-17', '18+'] as const;
type AgeOption = (typeof AGE_OPTIONS)[number];

/** The field keys `validateSignUp` reports, in display (focus) order. */
const FIELD_ORDER = ['email', 'password', 'displayName', 'ageBracket', 'usState', 'town'] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

/** Stable DOM ids so focus-first-invalid-field works (the Field primitives do
 * not forward refs, so we focus by id). */
const FIELD_ID: Record<FieldKey, string> = {
  email: 'signup-email',
  password: 'signup-password',
  displayName: 'signup-display-name',
  ageBracket: 'signup-age',
  usState: 'signup-state',
  town: 'signup-town',
};

/** The controlled form values (all strings; `age` holds the raw selector value). */
interface FormValues {
  email: string;
  password: string;
  displayName: string;
  age: string;
  usState: string;
  town: string;
}

const EMPTY_FORM: FormValues = {
  email: '',
  password: '',
  displayName: '',
  age: '',
  usState: 'MA',
  town: '',
};

/**
 * The location a route guard tried to reach before bouncing the Visitor here.
 * `RequireAuth` sets `state.from` to a react-router Location. We read its
 * pathname to send a freshly-signed-up Member back where they were headed.
 */
function redirectTarget(state: unknown): string {
  if (state !== null && typeof state === 'object' && 'from' in state) {
    const from = (state as { from?: unknown }).from;
    if (from !== null && typeof from === 'object' && 'pathname' in from) {
      const pathname = (from as { pathname?: unknown }).pathname;
      if (typeof pathname === 'string' && pathname.length > 0) return pathname;
    }
  }
  return '/dashboard';
}

export function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isUnder13 = values.age === ('Under 13' satisfies AgeOption);
  const isYouth = values.age === ('13-17' satisfies AgeOption);

  function setField(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Move focus to the first field (in display order) that has an error. */
  function focusFirstError(fieldErrors: Partial<Record<FieldKey, string>>) {
    for (const key of FIELD_ORDER) {
      if (fieldErrors[key] !== undefined) {
        document.getElementById(FIELD_ID[key])?.focus();
        return;
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Under 13 can never submit (Req 1.2): the button is disabled, but guard here too.
    if (submitting || isUnder13) return;

    setFormError(null);

    const result = validateSignUp({
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      ageBracket: values.age,
      usState: values.usState,
      town: values.town,
    });

    if (!result.ok) {
      setErrors(result.errors as Partial<Record<FieldKey, string>>);
      focusFirstError(result.errors as Partial<Record<FieldKey, string>>);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: result.value.email,
        password: result.value.password,
        options: {
          // Kept for reference on the auth user; profile creation now happens
          // in the app (createMyProfile) rather than an auth.users trigger.
          data: {
            display_name: result.value.displayName,
            age_bracket: result.value.ageBracket,
            us_state: result.value.usState,
            town: result.value.town,
          },
        },
      });
      if (error !== null) {
        // Email-in-use (Req 1.4) surfaces here, mapped to a safe message.
        setFormError(messageForError(error));
        return;
      }
      // With email confirmation OFF, sign-up returns a session, so auth.uid()
      // is set and we can create the profile rows under RLS. If there is no
      // session, ask the member to sign in rather than failing an RLS insert.
      if (data.session === null) {
        setFormError('Your account was created. Please sign in to continue.');
        return;
      }
      // Create the profile + private age row (replaces the old auth trigger).
      await createMyProfile({
        displayName: result.value.displayName,
        ageBracket: result.value.ageBracket,
        usState: result.value.usState,
        town: result.value.town,
      });
      // Go where the Member was headed, or to the dashboard.
      navigate(redirectTarget(location.state), { replace: true });
    } catch (err) {
      setFormError(messageForError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 text-ink-muted">
          Join Bounty to post tasks or help with local work. Your email and age
          are never shown on your profile.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {formError !== null ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-surface p-3 text-sm text-danger"
            >
              <span className="font-semibold">Error:</span>{' '}
              <span className="text-ink">{formError}</span>
            </div>
          ) : null}

          <Input
            id={FIELD_ID.email}
            label="Email address"
            type="email"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email ?? ''}
            autoComplete="email"
            maxLength={254}
          />

          <Input
            id={FIELD_ID.password}
            label="Password"
            type="password"
            hint="8 to 72 characters."
            value={values.password}
            onChange={(e) => setField('password', e.target.value)}
            error={errors.password ?? ''}
            autoComplete="new-password"
          />

          <Input
            id={FIELD_ID.displayName}
            label="Display name"
            value={values.displayName}
            onChange={(e) => setField('displayName', e.target.value)}
            error={errors.displayName ?? ''}
            maxLength={50}
            autoComplete="name"
          />

          <Select
            id={FIELD_ID.ageBracket}
            label="Your age"
            value={values.age}
            onChange={(e) => setField('age', e.target.value)}
            error={errors.ageBracket ?? ''}
          >
            <option value="">Select your age</option>
            {AGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>

          {isUnder13 ? (
            <p role="alert" className="text-sm text-danger">
              You must be at least 13 years old to join Bounty.
            </p>
          ) : null}

          {/* DEMO: restricted to Massachusetts so new sign-ups land where the
              seeded demo data lives and immediately see listings. */}
          <Select
            id={FIELD_ID.usState}
            label="State"
            hint="Bounty is running its demo in Massachusetts."
            value={values.usState}
            onChange={(e) => setField('usState', e.target.value)}
            error={errors.usState ?? ''}
          >
            <option value="MA">Massachusetts</option>
          </Select>

          <Input
            id={FIELD_ID.town}
            label="Town or city"
            value={values.town}
            onChange={(e) => setField('town', e.target.value)}
            error={errors.town ?? ''}
            maxLength={60}
          />

          {/* Youth safety notice shown above submit while 13-17 is selected (Req 1.3). */}
          {isYouth ? <YouthSafetyNotice /> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting} disabled={isUnder13}>
              Create account
            </Button>
          </div>
        </form>

        <p className="mt-6 text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/signin" className="text-brand-700 underline hover:text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </AppLayout>
  );
}

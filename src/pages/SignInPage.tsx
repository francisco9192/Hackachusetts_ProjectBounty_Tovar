/**
 * SignInPage — session start at `/signin` (Req 1.6, 1.7).
 *
 * Collects an email and password and calls
 * `supabase.auth.signInWithPassword`. On success it navigates to the location a
 * route guard tried to reach (`state.from` set by `RequireAuth`) or to
 * `/dashboard` (Req 1.6). On any failure — unknown email OR wrong password — it
 * shows the SAME single generic message ("Incorrect email or password.", via
 * `messageForError`) so the form never reveals which field was wrong (Req 1.7);
 * the entered email is preserved and the password field is left for the user to
 * retype. The submit button is disabled while the request is in flight.
 *
 * Sign out (Req 1.8) is handled by the shared {@link AppLayout} nav, not here.
 *
 * `supabase.auth` is used directly — the one allowed exception to the "data
 * access via api.ts" rule, since `api.ts` does not wrap auth sign-in. All user
 * text renders through normal JSX; no `dangerouslySetInnerHTML`.
 *
 * _Requirements: 1.6, 1.7, 1.8_
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AppLayout, Button, Input } from '../components';
import { supabase } from '../lib/supabase';
import { messageForError } from '../lib/errors';

/**
 * The location a route guard tried to reach before bouncing the Visitor here.
 * `RequireAuth` sets `state.from` to a react-router Location; we read its
 * pathname so a signed-in Member lands back where they were headed (Req 1.6).
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

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error !== null) {
        // One generic message for both bad email and bad password (Req 1.7);
        // the email value stays filled in.
        setFormError(messageForError(error));
        return;
      }
      navigate(redirectTarget(location.state), { replace: true });
    } catch (err) {
      setFormError(messageForError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-ink">Sign in</h1>
        <p className="mt-1 text-ink-muted">Welcome back to Bounty.</p>

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
            id="signin-email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={254}
          />

          <Input
            id="signin-password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting}>
              Sign in
            </Button>
          </div>
        </form>

        <p className="mt-6 text-sm text-ink-muted">
          New to Bounty?{' '}
          <Link to="/signup" className="text-brand-700 underline hover:text-brand-600">
            Create an account
          </Link>
        </p>
      </div>
    </AppLayout>
  );
}

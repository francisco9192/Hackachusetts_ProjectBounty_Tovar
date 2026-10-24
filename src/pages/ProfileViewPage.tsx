/**
 * ProfileViewPage — the public profile at `/profile/:id` (Req 1.13, 1.14, 1.18).
 *
 * Shows a member's display name, bio, skills, town + full state name, and the
 * list of Completed_Projects (each with task title linking to `/tasks/:id`, the
 * humanized Category, the readable completion date, and Submission links shown
 * through `SafeLink`). When the profile does not exist we show a plain
 * "Profile not found" message (Req 1.18). The data layer never exposes the
 * member's email or age bracket, so neither is (or can be) rendered here
 * (Req 1.14).
 *
 * All data access goes through `src/lib/api.ts` (no direct Supabase). All
 * user-provided text is rendered through normal JSX so React escapes it.
 *
 * _Requirements: 1.13, 1.14, 1.15, 1.16, 1.18, 7.4_
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  AppLayout,
  Badge,
  Card,
  ErrorState,
  Loading,
  SafeLink,
} from '../components';
import { getProfile, type ProfileWithProjects } from '../lib/api';
import { stateName } from '../domain/constants';
import { humanize } from '../domain/labels';

/** Load status for the profile fetch. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'loaded'; data: ProfileWithProjects | null };

/**
 * Format an ISO timestamp (or date) as a readable date, e.g. "Jan 5, 2025".
 * Falls back to the raw value if it is not a parseable date, so a bad value
 * never throws or shows "Invalid Date".
 */
function formatDate(iso: string | null): string {
  if (iso === null || iso.length === 0) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ProfileViewPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  const load = useCallback(async () => {
    if (id === undefined || id.length === 0) {
      setState({ phase: 'loaded', data: null });
      return;
    }
    setState({ phase: 'loading' });
    try {
      const data = await getProfile(id);
      setState({ phase: 'loaded', data });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not load this profile.';
      setState({ phase: 'error', message });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout>
      {state.phase === 'loading' ? <Loading label="Loading profile" /> : null}

      {state.phase === 'error' ? (
        <ErrorState message={state.message} onRetry={() => void load()} />
      ) : null}

      {state.phase === 'loaded' && state.data === null ? (
        <div>
          <h1 className="text-2xl font-bold text-ink">Profile not found</h1>
          <p className="mt-3 text-ink-muted">
            We could not find a profile for this member. The link may be
            incorrect, or the member may no longer exist.
          </p>
          <p className="mt-4">
            <Link to="/browse" className="text-brand-700 underline">
              Browse local tasks
            </Link>
          </p>
        </div>
      ) : null}

      {state.phase === 'loaded' && state.data !== null ? (
        <ProfileBody data={state.data} />
      ) : null}
    </AppLayout>
  );
}

/** The loaded profile with its completed projects. */
function ProfileBody({ data }: { data: ProfileWithProjects }) {
  const { profile, completedProjects } = data;

  return (
    <div className="space-y-8">
      <Card>
        <h1 className="text-2xl font-bold text-ink">{profile.displayName}</h1>
        <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-accent-500" />
        <p className="mt-2 text-ink-muted">
          {profile.town}, {stateName(profile.usState)}
        </p>

        {profile.bio.length > 0 ? (
          <p className="mt-4 whitespace-pre-line text-ink">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-ink-muted">This member has not added a bio yet.</p>
        )}

        <div className="mt-4">
          <h2 className="text-sm font-semibold text-ink">Skills</h2>
          {profile.skills.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <li key={skill}>
                  <Badge label={skill} tone="brand" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-muted">No skills listed yet.</p>
          )}
        </div>
      </Card>

      <section>
        <h2 className="text-lg font-semibold text-ink">Completed projects</h2>
        <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-brand-600" />
        {completedProjects.length > 0 ? (
          <ul className="mt-3 space-y-4">
            {completedProjects.map(({ task, submission }) => (
              <li key={task.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-ink">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="text-brand-700 underline hover:text-brand-600"
                      >
                        {task.title}
                      </Link>
                    </h3>
                    <Badge label={humanize(task.category)} />
                  </div>

                  <p className="mt-1 text-sm text-ink-muted">
                    Completed {formatDate(task.completedAt)}
                  </p>

                  {submission !== null && submission.urls.length > 0 ? (
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-ink">
                        Submitted work
                      </h4>
                      <ul className="mt-1 space-y-1">
                        {submission.urls.map((url, i) => (
                          <li key={`${task.id}-url-${i}`} className="text-sm">
                            <SafeLink url={url} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-ink-muted">No projects completed yet.</p>
        )}
      </section>
    </div>
  );
}

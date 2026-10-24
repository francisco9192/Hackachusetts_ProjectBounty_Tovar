import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Route guard for Member-only pages (`/tasks/new`, `/profile/edit`,
 * `/dashboard`). Usage is the nested-route `<Outlet/>` pattern:
 *
 * ```tsx
 * <Route element={<RequireAuth />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 *   <Route path="/tasks/new" element={<NewTaskPage />} />
 * </Route>
 * ```
 *
 * Behavior:
 * - While the initial session check is pending (`loading`), render a minimal
 *   placeholder so the redirect never flashes before we know the auth state.
 * - When signed out, redirect to `/signin` with `replace` (so Back doesn't land
 *   on the guarded page), preserving the attempted location in `state.from` so
 *   the sign-in page can bounce the Member back after signing in
 *   (Req 1.17, 2.6, 14.7).
 * - When signed in, render the matched child route via `<Outlet/>`.
 */
export function RequireAuth() {
  const { userId, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p>Loading</p>;
  }

  if (userId === null) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

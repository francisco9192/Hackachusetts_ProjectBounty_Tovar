/**
 * Auth plumbing barrel.
 *
 * - {@link AuthProvider} — wraps the app, mirrors the Supabase session into
 *   React state, and exposes `signOut`.
 * - {@link useAuth} — read `{ userId, session, loading, signOut }`.
 * - {@link RequireAuth} — nested-route (`<Outlet/>`) guard that redirects
 *   Visitors to `/signin`.
 * - {@link AuthContextValue} — the context shape.
 */
export { AuthProvider } from './AuthProvider';
export { useAuth } from './useAuth';
export { RequireAuth } from './RequireAuth';
export type { AuthContextValue } from './context';

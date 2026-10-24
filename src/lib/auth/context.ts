import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

/**
 * The value exposed by {@link AuthProvider} and read with `useAuth()`.
 *
 * This is pure UI plumbing: it mirrors the Supabase session into React state so
 * pages can render based on who is signed in. It holds NO business rules — all
 * trusted checks live in the database (RLS + `security definer` RPCs).
 */
export interface AuthContextValue {
  /** The signed-in user's id, or `null` for a Visitor. */
  userId: string | null;
  /** The raw Supabase session, or `null` when signed out. */
  session: Session | null;
  /**
   * `true` until the initial session check resolves. Routes wait on this so a
   * freshly-loaded protected page does not flash the sign-in redirect before we
   * know whether a session exists.
   */
  loading: boolean;
  /** Sign the current user out (clears the Supabase session). */
  signOut: () => Promise<void>;
}

/**
 * The auth context. `undefined` is the "no provider" sentinel so `useAuth` can
 * throw a clear error when used outside an {@link AuthProvider}.
 *
 * Kept in its own module (no component export) so React Fast Refresh stays
 * happy about the component files that import it.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { AuthContext, type AuthContextValue } from './context';

/**
 * Provides the app-wide auth state. On mount it reads the current Supabase
 * session once, then subscribes to auth changes so sign-in / sign-out / token
 * refresh keep React state in sync. It unsubscribes on unmount.
 *
 * Pure UI plumbing: it only reflects the session into state and offers a
 * `signOut`. No trusted business logic lives here — that stays in the database.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Initial read: resolve `loading` once we know whether a session exists so
    // protected routes don't flash the sign-in redirect on first paint.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Keep state in sync with later auth events (sign-in, sign-out, refresh).
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId: session?.user?.id ?? null,
      session,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

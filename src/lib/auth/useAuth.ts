import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './context';

/**
 * Read the current auth state: `{ userId, session, loading, signOut }`.
 *
 * Throws if called outside an {@link AuthProvider} so a missing provider is a
 * loud developer error rather than a silent `undefined`.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return value;
}

/**
 * AppLayout: the auth-aware wrapper around the presentational {@link Layout}.
 *
 * `Layout` deliberately takes no dependency on `src/lib/auth` — it receives its
 * auth-dependent nav bits as props. This component is the composition seam: it
 * reads `useAuth()` and feeds `Layout` a real `signedIn` flag plus an
 * `onSignOut` handler that ends the session and returns the Member to the
 * public landing page (Req 1.8). Every page renders its content inside
 * `<AppLayout>` so the header, nav, and sign-out are wired through `useAuth`
 * everywhere, with no hardcoded sign-in state.
 *
 * Presentational-only boundary still holds: this file lives in `components` but
 * is the single exception that imports auth, exactly as Layout's own doc notes
 * ("a wiring component … reads useAuth and passes these props down").
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { Layout } from './Layout';

export interface AppLayoutProps {
  children: ReactNode;
  /** When true, show the footer with the GitHub link (landing page only). */
  showHomeFooter?: boolean;
}

export function AppLayout({ children, showHomeFooter = false }: AppLayoutProps) {
  const { userId, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout
      signedIn={userId !== null}
      showHomeFooter={showHomeFooter}
      profileHref={userId !== null ? `/profile/${userId}` : '/profile/edit'}
      onSignOut={async () => {
        await signOut();
        // Return to the public landing page with no Member-only nav (Req 1.8).
        navigate('/');
      }}
    >
      {children}
    </Layout>
  );
}

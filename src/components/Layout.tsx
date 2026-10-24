/**
 * Layout: the single page shell. It renders exactly one `<header>`, `<nav>`,
 * `<main>`, and `<footer>` landmark (Req 16.5 foundation); pages supply only the
 * `<main>` content via `children` and their own single `<h1>`.
 *
 * AUTH DEPENDENCY, DELIBERATELY AVOIDED: the auth context/`useAuth` is built in
 * parallel (task 8.1). To keep this component free of a hard import on
 * `src/lib/auth`, the auth-dependent nav bits arrive as PROPS:
 *   - `signedIn` toggles the default Member links (Dashboard, New task, Profile,
 *     Sign out) vs the Visitor link (Sign in);
 *   - `onSignOut` is invoked by the default "Sign out" button;
 *   - `navSlot` lets a caller replace the whole right-hand nav region once the
 *     auth module exists, overriding the default links entirely.
 * A wiring component (added with the router) reads `useAuth` and passes these
 * props down, so the composition root owns the auth coupling, not this view.
 *
 * All links are react-router `<Link>`/`<NavLink>`. No user text is rendered
 * here; `dangerouslySetInnerHTML` is never used.
 */
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from './Button';

export interface LayoutProps {
  children: ReactNode;
  /** When true, show Member nav links; otherwise show the Sign in link. */
  signedIn?: boolean;
  /** Invoked by the default "Sign out" button (only shown when signed in). */
  onSignOut?: () => void;
  /**
   * Optional replacement for the entire right-hand nav region. When provided it
   * overrides `signedIn`/`onSignOut` default links, letting the auth-aware
   * wrapper inject fully wired controls.
   */
  navSlot?: ReactNode;
  /**
   * Where the "Profile" nav link points. The public profile route is
   * `/profile/:id`, so the auth-aware wrapper passes the signed-in member's
   * own `/profile/<id>`. Falls back to the profile editor when unknown.
   */
  profileHref?: string;
  /**
   * When true, render the footer with a link to the project's GitHub repo.
   * Only the public landing page passes this; every other page renders no
   * footer, keeping inner pages clean.
   */
  showHomeFooter?: boolean;
}

const NAV_LINK_BASE = 'rounded px-2 py-1 text-sm font-medium text-ink hover:text-brand-700';
const NAV_LINK_ACTIVE = 'text-brand-700 underline';

/**
 * Inline brand mark: a small on-brand SVG (a location pin cradling a coin) that
 * ties together Bounty's "local" (pin) and "reward" (coin) ideas. Inline so it
 * costs no network request and ships offline ($0). Decorative — the adjacent
 * "Bounty" wordmark is the accessible name — so it is `aria-hidden`.
 */
function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-12 w-12 shrink-0 text-brand-700"
      fill="none"
    >
      <path
        d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"
        fill="currentColor"
      />
      <circle cx="12" cy="10" r="3.75" className="fill-accent-500" />
      <path
        d="M12 8.2v3.6M10.7 9.1h2.1a.9.9 0 0 1 0 1.8h-1.6a.9.9 0 0 0 0 1.8h2.1"
        stroke="#ffffff"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A single nav entry styled for active vs inactive state. */
function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [NAV_LINK_BASE, isActive ? NAV_LINK_ACTIVE : ''].filter(Boolean).join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

/** Default nav links derived from the `signedIn`/`onSignOut` props. */
function DefaultNav({
  signedIn,
  onSignOut,
  profileHref,
}: {
  signedIn: boolean;
  onSignOut: (() => void) | undefined;
  profileHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <NavItem to="/browse">Browse</NavItem>
      {signedIn ? (
        <>
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/tasks/new">New task</NavItem>
          <NavItem to={profileHref}>Profile</NavItem>
          <Button
            variant="secondary"
            onClick={onSignOut}
            className="px-2 py-1 text-sm"
          >
            Sign out
          </Button>
        </>
      ) : (
        <NavItem to="/signin">Sign in</NavItem>
      )}
    </div>
  );
}

export function Layout({ children, signedIn = false, onSignOut, navSlot, profileHref = '/profile/edit', showHomeFooter = false }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-surface-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 rounded text-2xl font-bold text-brand-700"
          >
            <BrandMark />
            <span>Bounty</span>
          </Link>
          <nav aria-label="Primary" className="min-w-0">
            {navSlot ?? <DefaultNav signedIn={signedIn} onSignOut={onSignOut} profileHref={profileHref} />}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      {showHomeFooter ? (
        <footer className="border-t border-brand-100 bg-surface-tint">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-ink-muted sm:px-6">
            <p>Bounty - a Hackachusetts project.</p>
            <a
              href="https://github.com/francisco9192/Hackachusetts_Tovar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded font-medium text-brand-700 underline hover:text-brand-600"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              View source on GitHub
            </a>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

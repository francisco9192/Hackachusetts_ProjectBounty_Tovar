import { Route, Routes } from 'react-router-dom'

import { AppLayout } from './components'
import { RequireAuth } from './lib/auth'
import { ProfileViewPage } from './pages/ProfileViewPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { NewTaskPage } from './pages/NewTaskPage'
import { BrowsePage } from './pages/BrowsePage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { SignUpPage } from './pages/SignUpPage'
import { SignInPage } from './pages/SignInPage'
import { LandingPage } from './pages/LandingPage'

/**
 * Root application component and route table.
 *
 * Public routes: `/` (the landing page, task 25), `/signup`, `/signin`, and
 * `/profile/:id`. Member-only routes live under a
 * `<RequireAuth/>` guard that redirects Visitors to `/signin` (task 9.2's
 * `/profile/edit`). A catch-all `*` renders a plain "Page not found" page.
 *
 * The member dashboard lives at `/dashboard` under the same guard. The sign-up
 * / sign-in pages wrap
 * themselves in the auth-aware `AppLayout`, so the header, nav, and sign-out
 * (Req 1.8) are wired through `useAuth` on every page.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Public auth pages (task 9.1) */}
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signin" element={<SignInPage />} />

      {/* Public profile view (task 9.2) */}
      <Route path="/profile/:id" element={<ProfileViewPage />} />

      {/* Public browse: Visitors pick a state, Members default to theirs (task 11) */}
      <Route path="/browse" element={<BrowsePage />} />

      {/* Public task detail: info for everyone; actions gated by role (task 12) */}
      <Route path="/tasks/:id" element={<TaskDetailPage />} />

      {/* Member-only routes: redirect Visitors to /signin (task 9.2) */}
      <Route element={<RequireAuth />}>
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/tasks/new" element={<NewTaskPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/** Catch-all page for unknown routes. */
function NotFound() {
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-3 text-ink-muted">
        We couldn&apos;t find the page you were looking for.
      </p>
    </AppLayout>
  )
}

export default App

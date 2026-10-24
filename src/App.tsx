import { Route, Routes } from 'react-router-dom'

/**
 * Root application component.
 *
 * This is an intentionally minimal placeholder for the scaffold. Real routes
 * and pages (landing, browse, task detail, dashboard, auth, profiles) are
 * added by later tasks and wired in here.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
    </Routes>
  )
}

function Placeholder() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-ink">Bounty</h1>
      <p className="mt-4 text-ink-muted">
        Connecting local businesses and individuals with nearby students and
        skilled volunteers. The app is under construction.
      </p>
    </main>
  )
}

export default App

import { useEffect, useState } from 'react'
import './App.css'

interface HealthStatus {
  status: string
  version: string
  environment: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to reach backend')
        }
        return response.json()
      })
      .then(setHealth)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <main className="app-shell">
      <header>
        <h1>Helpdesk Ticket System</h1>
        <p>Phase 0 foundation for the full stack helpdesk project.</p>
      </header>

      <section className="status-card">
        <h2>Backend health</h2>
        {health ? (
          <pre>{JSON.stringify(health, null, 2)}</pre>
        ) : (
          <p>{error ?? 'Checking backend status...'}</p>
        )}
      </section>

      <section className="roadmap-card">
        <h2>Phase 0 delivered</h2>
        <ul>
          <li>ASP.NET Core backend scaffold with Identity, JWT, and data model</li>
          <li>React + Vite frontend with API proxy to `/api`</li>
          <li>Docker Compose configuration for local development</li>
        </ul>
      </section>
    </main>
  )
}

export default App

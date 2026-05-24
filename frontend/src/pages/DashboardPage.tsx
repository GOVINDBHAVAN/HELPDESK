import { Link } from 'react-router-dom'

export function DashboardPage() {
  return (
    <main className="page-content">
      <h1>Dashboard</h1>
      <nav>
        <Link to="/tickets">Tickets</Link>
      </nav>
      <p>Dashboard content coming in Phase 3.</p>
    </main>
  )
}

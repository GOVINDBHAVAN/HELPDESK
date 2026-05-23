import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <main>
      <header>
        <h1>Dashboard</h1>
        <span>Signed in as {user?.email}</span>
        <button onClick={logout}>Sign out</button>
      </header>
      <nav>
        <Link to="/tickets">Tickets</Link>
      </nav>
      <p>Dashboard content coming in Phase 3.</p>
    </main>
  )
}

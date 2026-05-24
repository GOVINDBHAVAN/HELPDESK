import { Link } from 'react-router-dom'

export function DashboardPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-medium text-foreground mb-6">Dashboard</h1>
      <nav>
        <Link to="/tickets" className="text-primary hover:underline">Tickets</Link>
      </nav>
      <p className="text-muted-foreground mt-4">Dashboard content coming in Phase 3.</p>
    </main>
  )
}

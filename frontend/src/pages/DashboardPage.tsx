import { Link } from 'react-router-dom'

export function DashboardPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-medium text-gray-900 mb-6">Dashboard</h1>
      <nav>
        <Link to="/tickets" className="text-violet-500 hover:underline">Tickets</Link>
      </nav>
      <p className="text-gray-500 mt-4">Dashboard content coming in Phase 3.</p>
    </main>
  )
}

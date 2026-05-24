import { Link } from 'react-router-dom'

export function TicketsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-medium text-gray-900 mb-6">Tickets</h1>
      <Link to="/" className="text-violet-500 hover:underline">Back to dashboard</Link>
      <p className="text-gray-500 mt-4">Ticket list coming in Phase 1.</p>
    </main>
  )
}

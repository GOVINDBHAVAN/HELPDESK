import { Link } from 'react-router-dom'

export function TicketsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-medium text-foreground mb-6">Tickets</h1>
      <Link to="/" className="text-primary hover:underline">Back to dashboard</Link>
      <p className="text-muted-foreground mt-4">Ticket list coming in Phase 1.</p>
    </main>
  )
}

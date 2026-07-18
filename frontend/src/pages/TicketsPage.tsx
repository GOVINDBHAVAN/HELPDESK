import { TicketTable } from '../components/TicketTable'

export function TicketsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-medium text-foreground mb-6">Tickets</h1>
      <TicketTable />
    </main>
  )
}

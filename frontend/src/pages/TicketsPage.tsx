import { TicketTable } from '../components/TicketTable'

export function TicketsPage() {
  return (
    <main className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden px-6 py-8">
      <h1 className="shrink-0 text-3xl font-medium text-foreground mb-6">Tickets</h1>
      <TicketTable />
    </main>
  )
}

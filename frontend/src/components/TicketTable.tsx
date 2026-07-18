import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table'
import { Badge } from './ui/badge'

interface TicketRow {
  id: number
  subject: string
  status: string
  priority: string
  category: string
  studentEmail: string
  createdAt: string
}

const STATUS_BADGE: Record<string, string> = {
  Open: 'bg-primary/10 text-primary hover:bg-primary/10',
  InProgress: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/10',
  Resolved: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10',
  Closed: 'bg-muted text-muted-foreground hover:bg-muted',
}

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-muted text-muted-foreground hover:bg-muted',
  Medium: 'bg-primary/10 text-primary hover:bg-primary/10',
  High: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
}

export function TicketTable() {
  const { data: tickets = [], isLoading, error } = useQuery<TicketRow[]>({
    queryKey: ['tickets'],
    queryFn: () => api.get<TicketRow[]>('/tickets').then((r) => r.data),
  })

  return (
    <>
      {error && (
        <p className="text-destructive text-sm">{error.message}</p>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Subject</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-48 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-40 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-5 w-16 rounded-full bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-5 w-14 rounded-full bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-20 ml-auto rounded bg-muted animate-pulse" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && tickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No tickets found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-foreground">{t.subject}</TableCell>
                <TableCell className="text-muted-foreground">{t.studentEmail}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE[t.status] ?? 'bg-muted text-muted-foreground hover:bg-muted'}
                  >
                    {t.status || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={PRIORITY_BADGE[t.priority] ?? 'bg-muted text-muted-foreground hover:bg-muted'}
                  >
                    {t.priority || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.category}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

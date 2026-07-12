import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
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
import { Button } from './ui/button'
import { DeleteUserModal } from './DeleteUserModal'

interface UserRow {
  id: string
  email: string
  displayName: string
  role: string
}

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
  Agent: 'bg-primary/10 text-primary hover:bg-primary/10',
  Student: 'bg-muted text-muted-foreground hover:bg-muted',
}

export function UserTable() {
  const { data: users = [], isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api.get<UserRow[]>('/users').then((r) => r.data),
  })
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null)

  return (
    <>
      {error && (
        <p className="text-destructive text-sm">{error.message}</p>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-48 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-5 w-14 rounded-full bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-8 w-8 ml-auto rounded bg-muted animate-pulse" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">
                  {u.displayName || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={ROLE_BADGE[u.role] ?? 'bg-muted text-muted-foreground hover:bg-muted'}
                  >
                    {u.role || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${u.displayName || u.email}`}
                    disabled={u.role === 'Admin'}
                    onClick={() => setUserToDelete(u)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteUserModal
        user={userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      />
    </>
  )
}

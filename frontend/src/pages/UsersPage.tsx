import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { CreateUserModal } from '../components/CreateUserModal'

interface UserRow {
  id: string
  email: string
  displayName: string
  role: string
}

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-destructive/10 text-destructive',
  Agent: 'bg-primary/10 text-primary',
  Student: 'bg-muted text-muted-foreground',
}

export function UsersPage() {
  const { data: users = [], isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api.get<UserRow[]>('/users').then((r) => r.data),
  })

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-medium text-foreground">Users</h1>
        <CreateUserModal />
      </div>

      {error && (
        <p className="text-destructive text-sm">{error.message}</p>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && [...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-muted animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-4 w-48 rounded bg-muted animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-muted animate-pulse" /></td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
            {!isLoading && users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium">
                  {u.displayName || '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {u.role || 'Unknown'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

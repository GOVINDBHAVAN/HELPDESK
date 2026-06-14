import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'

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
  const { token } = useAuth()

  const { data: users = [], isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`)
      return res.json()
    },
  })

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-medium text-foreground mb-6">Users</h1>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm">{error.message}</p>
      )}

      {!isLoading && !error && (
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => (
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
      )}
    </main>
  )
}

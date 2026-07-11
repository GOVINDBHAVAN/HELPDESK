import { CreateUserModal } from '../components/CreateUserModal'
import { UserTable } from '../components/UserTable'

export function UsersPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-medium text-foreground">Users</h1>
        <CreateUserModal />
      </div>

      <UserTable />
    </main>
  )
}

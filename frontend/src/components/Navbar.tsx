import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
    isActive
      ? 'bg-secondary text-foreground'
      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
  )

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="sticky top-0 z-100 flex items-center justify-between px-6 h-14 bg-background border-b border-border shadow-sm">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold text-foreground no-underline">
          Helpdesk
        </Link>
        <div className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/tickets" className={navLinkClass}>
            Tickets
          </NavLink>
          {user?.role === 'Admin' && (
            <NavLink to="/users" className={navLinkClass}>
              Users
            </NavLink>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  )
}

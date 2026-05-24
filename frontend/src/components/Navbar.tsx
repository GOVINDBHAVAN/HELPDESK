import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="sticky top-0 z-100 flex items-center justify-between px-6 h-14 bg-background border-b border-border shadow-sm">
      <Link to="/" className="text-lg font-semibold text-foreground no-underline">
        Helpdesk
      </Link>
      <div className="flex items-center gap-4">
        {user?.role === 'Admin' && (
          <Link to="/users" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Users
          </Link>
        )}
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <button
          onClick={handleSignOut}
          className="text-sm px-3.5 py-1.5 border border-border rounded-md bg-transparent text-foreground cursor-pointer hover:bg-secondary transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

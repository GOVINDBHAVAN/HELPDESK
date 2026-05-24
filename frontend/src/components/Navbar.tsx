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
    <nav className="sticky top-0 z-100 flex items-center justify-between px-6 h-14 bg-white border-b border-gray-200 shadow-sm">
      <Link to="/" className="text-lg font-semibold text-violet-500 no-underline">
        Helpdesk
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user?.email}</span>
        <button
          onClick={handleSignOut}
          className="text-sm px-3.5 py-1.5 border border-gray-200 rounded-md bg-transparent text-gray-900 cursor-pointer hover:bg-violet-50 hover:border-violet-300 hover:text-violet-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

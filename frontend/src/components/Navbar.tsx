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
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Helpdesk</Link>
      <div className="navbar-user">
        <span className="navbar-email">{user?.email}</span>
        <button className="navbar-signout" onClick={handleSignOut}>Sign out</button>
      </div>
    </nav>
  )
}

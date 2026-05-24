import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface User {
  id: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string) => void
  logout: () => void
}

const TOKEN_KEY = 'helpdesk_token'

function parseToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { id: payload.sub, email: payload.email, role: payload.role ?? '' }
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    return stored ? parseToken(stored) : null
  })

  function login(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(parseToken(newToken))
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

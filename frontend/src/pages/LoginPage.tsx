import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, token } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  if (token) return <Navigate to="/" replace />

  async function onSubmit(data: LoginFormData) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        setError('root', { message: 'Invalid email or password.' })
        return
      }
      const { token } = await res.json()
      login(token)
      navigate('/', { replace: true })
    } catch {
      setError('root', { message: 'Network error. Please try again.' })
    }
  }

  return (
    <main className="login-page">
      <h1>Sign in to Helpdesk</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="login-form">
        <label>
          Email
          <input
            type="text"
            autoComplete="email"
            className={errors.email ? 'input-error' : undefined}
            {...register('email')}
          />
          {errors.email && <p role="alert" className="error">{errors.email.message}</p>}
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            className={errors.password ? 'input-error' : undefined}
            {...register('password')}
          />
          {errors.password && <p role="alert" className="error">{errors.password.message}</p>}
        </label>
        {errors.root && <p role="alert" className="error">{errors.root.message}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

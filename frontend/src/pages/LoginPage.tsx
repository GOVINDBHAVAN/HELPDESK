import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cn } from '@/lib/utils'

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
    <main className="min-h-svh flex flex-col items-center justify-center p-6 bg-background">
      <h1 className="text-3xl font-medium mb-6 text-foreground">Sign in to Helpdesk</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm p-8 border border-border rounded-xl bg-card shadow-md flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Email
          <input
            type="text"
            autoComplete="email"
            className={cn(
              'w-full px-3 py-2.5 border rounded-md bg-background text-foreground text-sm outline-none transition-colors',
              errors.email
                ? 'border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'border-input focus:border-ring focus:ring-2 focus:ring-ring/20'
            )}
            {...register('email')}
          />
          {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Password
          <input
            type="password"
            autoComplete="current-password"
            className={cn(
              'w-full px-3 py-2.5 border rounded-md bg-background text-foreground text-sm outline-none transition-colors',
              errors.password
                ? 'border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'border-input focus:border-ring focus:ring-2 focus:ring-ring/20'
            )}
            {...register('password')}
          />
          {errors.password && <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
        </label>
        {errors.root && (
          <p role="alert" className="text-sm text-destructive px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-md text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

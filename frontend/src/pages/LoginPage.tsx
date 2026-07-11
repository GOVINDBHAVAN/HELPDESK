import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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
        <Label className="flex flex-col gap-1.5 items-start">
          Email
          <Input
            type="text"
            autoComplete="email"
            className={cn(
              errors.email && 'border-destructive focus-visible:ring-destructive/20'
            )}
            {...register('email')}
          />
          {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
        </Label>
        <Label className="flex flex-col gap-1.5 items-start">
          Password
          <Input
            type="password"
            autoComplete="current-password"
            className={cn(
              errors.password && 'border-destructive focus-visible:ring-destructive/20'
            )}
            {...register('password')}
          />
          {errors.password && <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
        </Label>
        {errors.root && (
          <p role="alert" className="text-sm text-destructive px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}

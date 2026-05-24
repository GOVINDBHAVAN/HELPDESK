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

const inputBase = 'w-full px-3 py-2.5 border rounded-md bg-white text-gray-900 text-sm outline-none transition-colors'
const inputValid = 'border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100'
const inputError = 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'

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
    <main className="min-h-svh flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-medium mb-6 text-gray-900">Sign in to Helpdesk</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm p-8 border border-gray-200 rounded-xl bg-white shadow-md flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-900">
          Email
          <input
            type="text"
            autoComplete="email"
            className={`${inputBase} ${errors.email ? inputError : inputValid}`}
            {...register('email')}
          />
          {errors.email && <p role="alert" className="text-sm text-red-600">{errors.email.message}</p>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-900">
          Password
          <input
            type="password"
            autoComplete="current-password"
            className={`${inputBase} ${errors.password ? inputError : inputValid}`}
            {...register('password')}
          />
          {errors.password && <p role="alert" className="text-sm text-red-600">{errors.password.message}</p>}
        </label>
        {errors.root && (
          <p role="alert" className="text-sm text-red-600 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-violet-500 text-white border-none rounded-md text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

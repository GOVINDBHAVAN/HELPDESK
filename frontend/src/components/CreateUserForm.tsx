import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import api from '../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DialogFooter } from '@/components/ui/dialog'

const createUserSchema = z.object({
  displayName: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type CreateUserFormData = z.infer<typeof createUserSchema>

interface CreateUserFormProps {
  onSuccess: () => void
}

export function CreateUserForm({ onSuccess }: CreateUserFormProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<CreateUserFormData>({ resolver: zodResolver(createUserSchema) })

  const createUser = useMutation({
    mutationFn: (data: CreateUserFormData) => api.post('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      onSuccess()
    },
    onError: (error) => {
      const message = isAxiosError(error) && Array.isArray(error.response?.data)
        ? error.response.data.join(' ')
        : 'Failed to create user. Please try again.'
      setError('root', { message })
    },
  })

  function onSubmit(data: CreateUserFormData) {
    createUser.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Name</Label>
        <Input id="displayName" autoComplete="name" {...register('displayName')} />
        {errors.displayName && (
          <p role="alert" className="text-sm text-destructive">{errors.displayName.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        {errors.password && (
          <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      {errors.root && (
        <p role="alert" className="text-sm text-destructive px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
          {errors.root.message}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? 'Creating…' : 'Create user'}
        </Button>
      </DialogFooter>
    </form>
  )
}

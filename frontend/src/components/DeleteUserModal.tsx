import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import api from '../lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface DeleteUserModalUser {
  id: string
  displayName: string
  email: string
}

interface DeleteUserModalProps {
  user: DeleteUserModalUser | null
  onOpenChange: (open: boolean) => void
}

export function DeleteUserModal({ user, onOpenChange }: DeleteUserModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setError(null)
      onOpenChange(false)
    },
    onError: (err) => {
      const message = isAxiosError(err) && typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : 'Failed to delete user. Please try again.'
      setError(message)
    },
  })

  function handleOpenChange(open: boolean) {
    if (!open) setError(null)
    onOpenChange(open)
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {user?.displayName || user?.email}? This action cannot be undone by the user.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={deleteUser.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => user && deleteUser.mutate(user.id)}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

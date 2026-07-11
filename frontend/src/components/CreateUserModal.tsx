import { useState } from 'react'
import { CreateUserForm } from './CreateUserForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function CreateUserModal() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <CreateUserForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteUserModal } from './DeleteUserModal'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/api', () => ({
  default: { delete: vi.fn() },
}))

import api from '../lib/api'

const mockedDelete = vi.mocked(api.delete)

const user = { id: '1', displayName: 'Jane Doe', email: 'jane@example.com' }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DeleteUserModal', () => {
  it('renders nothing when user is null', () => {
    renderWithProviders(<DeleteUserModal user={null} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a confirmation dialog naming the user when open', () => {
    renderWithProviders(<DeleteUserModal user={user} onOpenChange={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn()
    const u = userEvent.setup()
    renderWithProviders(<DeleteUserModal user={user} onOpenChange={onOpenChange} />)

    await u.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('deletes the user and closes the modal on confirm', async () => {
    mockedDelete.mockResolvedValue({ data: null })
    const onOpenChange = vi.fn()
    const u = userEvent.setup()
    renderWithProviders(<DeleteUserModal user={user} onOpenChange={onOpenChange} />)

    await u.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith('/users/1')
    })
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('shows a server error message when deletion fails', async () => {
    mockedDelete.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'Admin users cannot be deleted.' } },
    })
    const u = userEvent.setup()
    renderWithProviders(<DeleteUserModal user={user} onOpenChange={vi.fn()} />)

    await u.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Admin users cannot be deleted.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateUserModal } from './CreateUserModal'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/api', () => ({
  default: { post: vi.fn() },
}))

import api from '../lib/api'

const mockedPost = vi.mocked(api.post)

beforeEach(() => {
  vi.resetAllMocks()
})

async function openModal() {
  const user = userEvent.setup()
  renderWithProviders(<CreateUserModal />)
  await user.click(screen.getByRole('button', { name: 'New user' }))
  return user
}

describe('CreateUserModal', () => {
  it('renders a "New user" button', () => {
    renderWithProviders(<CreateUserModal />)
    expect(screen.getByRole('button', { name: 'New user' })).toBeInTheDocument()
  })

  it('shows the modal with 3 fields when the button is clicked', async () => {
    await openModal()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows validation errors for invalid input', async () => {
    const user = await openModal()

    await user.type(screen.getByLabelText('Name'), 'ab')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('submits the form and closes the modal on success', async () => {
    mockedPost.mockResolvedValue({ data: { id: '1', email: 'jane@example.com' } })
    const user = await openModal()

    await user.type(screen.getByLabelText('Name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create user' }))

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith('/auth/register', {
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
      })
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows a server error message when creation fails', async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { data: ['Email already taken.'] },
    })
    const user = await openModal()

    await user.type(screen.getByLabelText('Name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Email already taken.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

import { screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsersPage } from './UsersPage'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../lib/api'

const mockedGet = vi.mocked(api.get)


beforeEach(() => {
  vi.resetAllMocks()
})

describe('UsersPage', () => {
  it('shows skeleton rows while loading', () => {
    // Never resolves — keeps component in loading state
    mockedGet.mockReturnValue(new Promise(() => { }))

    renderWithProviders(<UsersPage />)

    // 5 skeleton rows × 4 cells each = 20 animated divs
    const pulsingDivs = document.querySelectorAll('.animate-pulse')
    expect(pulsingDivs.length).toBe(20)
  })

  it('renders a row for each user after data loads', async () => {
    mockedGet.mockResolvedValue({
      data: [
        { id: '1', displayName: 'Alice Smith', email: 'alice@example.com', role: 'Admin' },
        { id: '2', displayName: 'Bob Jones', email: 'bob@example.com', role: 'Agent' },
        { id: '3', displayName: '', email: 'carol@example.com', role: 'Student' },
      ],
    })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    // Empty displayName falls back to em-dash
    expect(screen.getByText('—')).toBeInTheDocument()

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('carol@example.com')).toBeInTheDocument()
  })

  it('renders role badges with correct text', async () => {
    mockedGet.mockResolvedValue({
      data: [
        { id: '1', displayName: 'Alice', email: 'alice@example.com', role: 'Admin' },
        { id: '2', displayName: 'Bob', email: 'bob@example.com', role: 'Agent' },
        { id: '3', displayName: 'Carol', email: 'carol@example.com', role: 'Student' },
      ],
    })

    renderWithProviders(<UsersPage />)

    await screen.findByText('Alice')

    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('Student')).toBeInTheDocument()
  })

  it('applies the correct badge class for each role', async () => {
    mockedGet.mockResolvedValue({
      data: [
        { id: '1', displayName: 'Alice', email: 'alice@example.com', role: 'Admin' },
        { id: '2', displayName: 'Bob', email: 'bob@example.com', role: 'Agent' },
        { id: '3', displayName: 'Carol', email: 'carol@example.com', role: 'Student' },
      ],
    })

    renderWithProviders(<UsersPage />)

    await screen.findByText('Alice')

    expect(screen.getByText('Admin').className).toContain('text-destructive')
    expect(screen.getByText('Agent').className).toContain('text-primary')
    expect(screen.getByText('Student').className).toContain('text-muted-foreground')
  })

  it('shows "No users found." when the list is empty', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('Network Error'))

    renderWithProviders(<UsersPage />)

    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })

  it('falls back to "Unknown" for an unrecognised role', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: '1', displayName: 'Dave', email: 'dave@example.com', role: '' }],
    })

    renderWithProviders(<UsersPage />)

    await screen.findByText('Dave')
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('renders the page heading', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderWithProviders(<UsersPage />)

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
  })

  it('renders the table column headers', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderWithProviders(<UsersPage />)

    const thead = document.querySelector('thead')!
    expect(within(thead).getByText('Name')).toBeInTheDocument()
    expect(within(thead).getByText('Email')).toBeInTheDocument()
    expect(within(thead).getByText('Role')).toBeInTheDocument()
  })
})

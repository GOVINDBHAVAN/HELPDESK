import { screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TicketsPage } from './TicketsPage'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../lib/api'

const mockedGet = vi.mocked(api.get)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('TicketsPage', () => {
  it('shows skeleton rows while loading', () => {
    mockedGet.mockReturnValue(new Promise(() => { }))

    renderWithProviders(<TicketsPage />)

    // 5 skeleton rows × 6 cells each = 30 animated divs
    const pulsingDivs = document.querySelectorAll('.animate-pulse')
    expect(pulsingDivs.length).toBe(30)
  })

  it('renders a row for each ticket after data loads, newest first', async () => {
    mockedGet.mockResolvedValue({
      data: [
        {
          id: 2,
          subject: 'Cannot access portal',
          status: 'Open',
          priority: 'High',
          category: 'Technical',
          studentEmail: 'bob@example.com',
          createdAt: '2026-07-18T10:00:00Z',
        },
        {
          id: 1,
          subject: 'Refund question',
          status: 'Resolved',
          priority: 'Low',
          category: 'Refund',
          studentEmail: 'alice@example.com',
          createdAt: '2026-07-17T10:00:00Z',
        },
      ],
    })

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByText('Cannot access portal')).toBeInTheDocument()
    expect(screen.getByText('Refund question')).toBeInTheDocument()

    const rows = document.querySelectorAll('tbody tr')
    expect(within(rows[0] as HTMLElement).getByText('Cannot access portal')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Refund question')).toBeInTheDocument()
  })

  it('renders the Student column with the ticket studentEmail', async () => {
    mockedGet.mockResolvedValue({
      data: [
        {
          id: 1,
          subject: 'Cannot access course materials',
          status: 'Open',
          priority: 'High',
          category: 'Technical',
          studentEmail: 'dana@example.com',
          createdAt: '2026-07-18T10:00:00Z',
        },
      ],
    })

    renderWithProviders(<TicketsPage />)

    await screen.findByText('Cannot access course materials')

    expect(screen.getByText('dana@example.com')).toBeInTheDocument()
  })

  it('renders status and priority badges', async () => {
    mockedGet.mockResolvedValue({
      data: [
        {
          id: 1,
          subject: 'Billing issue',
          status: 'InProgress',
          priority: 'Medium',
          category: 'Billing',
          studentEmail: 'carol@example.com',
          createdAt: '2026-07-18T10:00:00Z',
        },
      ],
    })

    renderWithProviders(<TicketsPage />)

    await screen.findByText('Billing issue')

    expect(screen.getByText('InProgress')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
  })

  it('shows "No tickets found." when the list is empty', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByText('No tickets found.')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('Network Error'))

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })

  it('renders the page heading', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('renders the table column headers', async () => {
    mockedGet.mockResolvedValue({ data: [] })

    renderWithProviders(<TicketsPage />)

    const thead = document.querySelector('thead')!
    expect(within(thead).getByText('Subject')).toBeInTheDocument()
    expect(within(thead).getByText('Student')).toBeInTheDocument()
    expect(within(thead).getByText('Status')).toBeInTheDocument()
    expect(within(thead).getByText('Priority')).toBeInTheDocument()
    expect(within(thead).getByText('Category')).toBeInTheDocument()
    expect(within(thead).getByText('Created')).toBeInTheDocument()
  })
})

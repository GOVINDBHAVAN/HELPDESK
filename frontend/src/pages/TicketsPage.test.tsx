import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TicketsPage } from './TicketsPage'
import { renderWithProviders } from '../test/renderWithProviders'

vi.mock('../lib/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../lib/api'

const mockedGet = vi.mocked(api.get)

interface TicketRow {
  id: number
  subject: string
  status: string
  priority: string
  category: string
  studentEmail: string
  createdAt: string
}

function pagedResponse(items: TicketRow[], overrides: { totalCount?: number; page?: number; pageSize?: number } = {}) {
  return {
    data: {
      items,
      totalCount: overrides.totalCount ?? items.length,
      page: overrides.page ?? 1,
      pageSize: overrides.pageSize ?? 10,
    },
  }
}

function makeTicket(id: number): TicketRow {
  return {
    id,
    subject: `Ticket ${id}`,
    status: 'Open',
    priority: 'Medium',
    category: 'General',
    studentEmail: `student${id}@example.com`,
    createdAt: '2026-07-18T10:00:00Z',
  }
}

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
    mockedGet.mockResolvedValue(pagedResponse([
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
    ]))

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByText('Cannot access portal')).toBeInTheDocument()
    expect(screen.getByText('Refund question')).toBeInTheDocument()

    const rows = document.querySelectorAll('tbody tr')
    expect(within(rows[0] as HTMLElement).getByText('Cannot access portal')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Refund question')).toBeInTheDocument()
  })

  it('renders the Student column with the ticket studentEmail', async () => {
    mockedGet.mockResolvedValue(pagedResponse([
      {
        id: 1,
        subject: 'Cannot access course materials',
        status: 'Open',
        priority: 'High',
        category: 'Technical',
        studentEmail: 'dana@example.com',
        createdAt: '2026-07-18T10:00:00Z',
      },
    ]))

    renderWithProviders(<TicketsPage />)

    await screen.findByText('Cannot access course materials')

    expect(screen.getByText('dana@example.com')).toBeInTheDocument()
  })

  it('renders status and priority badges', async () => {
    mockedGet.mockResolvedValue(pagedResponse([
      {
        id: 1,
        subject: 'Billing issue',
        status: 'InProgress',
        priority: 'Medium',
        category: 'Billing',
        studentEmail: 'carol@example.com',
        createdAt: '2026-07-18T10:00:00Z',
      },
    ]))

    renderWithProviders(<TicketsPage />)

    await screen.findByText('Billing issue')

    expect(screen.getByText('InProgress')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
  })

  it('shows "No tickets found." when the list is empty, with no pagination footer', async () => {
    mockedGet.mockResolvedValue(pagedResponse([]))

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByText('No tickets found.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next/i })).not.toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    mockedGet.mockRejectedValue(new Error('Network Error'))

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })

  it('renders the page heading', async () => {
    mockedGet.mockResolvedValue(pagedResponse([]))

    renderWithProviders(<TicketsPage />)

    expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('renders the table column headers', async () => {
    mockedGet.mockResolvedValue(pagedResponse([]))

    renderWithProviders(<TicketsPage />)

    const thead = document.querySelector('thead')!
    expect(within(thead).getByText('Subject')).toBeInTheDocument()
    expect(within(thead).getByText('Student')).toBeInTheDocument()
    expect(within(thead).getByText('Status')).toBeInTheDocument()
    expect(within(thead).getByText('Priority')).toBeInTheDocument()
    expect(within(thead).getByText('Category')).toBeInTheDocument()
    expect(within(thead).getByText('Created')).toBeInTheDocument()
  })

  it('requests tickets sorted by createdAt desc, page 1 of 10, by default', async () => {
    mockedGet.mockResolvedValue(pagedResponse([]))

    renderWithProviders(<TicketsPage />)

    await screen.findByText('No tickets found.')

    expect(mockedGet).toHaveBeenCalledWith('/tickets', {
      params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10 },
    })
  })

  it('sorts ascending on first click of a column header, then descending on second click', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue(pagedResponse([]))

    renderWithProviders(<TicketsPage />)
    await screen.findByText('No tickets found.')
    mockedGet.mockClear()

    await user.click(screen.getByRole('button', { name: /Subject/i }))

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('/tickets', {
        params: { sortBy: 'subject', sortDir: 'asc', page: 1, pageSize: 10 },
      })
    )

    await user.click(screen.getByRole('button', { name: /Subject/i }))

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('/tickets', {
        params: { sortBy: 'subject', sortDir: 'desc', page: 1, pageSize: 10 },
      })
    )
  })

  it('shows a sort direction indicator only on the actively sorted column', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue(pagedResponse([]))

    renderWithProviders(<TicketsPage />)
    await screen.findByText('No tickets found.')

    const subjectButton = screen.getByRole('button', { name: /Subject/i })
    const studentButton = screen.getByRole('button', { name: /Student/i })

    await user.click(subjectButton)

    await waitFor(() =>
      expect(subjectButton.querySelector('svg')?.className.baseVal).toContain('lucide-arrow-up')
    )
    expect(studentButton.querySelector('svg')?.className.baseVal).toContain('lucide-arrow-up-down')
  })

  describe('pagination', () => {
    it('shows the total count and current range', async () => {
      mockedGet.mockResolvedValue(
        pagedResponse([makeTicket(1), makeTicket(2)], { totalCount: 42 })
      )

      renderWithProviders(<TicketsPage />)

      expect(await screen.findByText('Showing 1-2 of 42 tickets')).toBeInTheDocument()
      expect(screen.getByText('Page 1 of 5')).toBeInTheDocument()
    })

    it('disables Previous on the first page and enables Next when more pages exist', async () => {
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)

      expect(screen.getByRole('button', { name: /Previous/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Next/i })).toBeEnabled()
    })

    it('clicking Next requests page 2 and clicking Previous returns to page 1', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)
      mockedGet.mockClear()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(11)], { totalCount: 20, page: 2 }))

      await user.click(screen.getByRole('button', { name: /Next/i }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'createdAt', sortDir: 'desc', page: 2, pageSize: 10 },
        })
      )
      expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled()

      mockedGet.mockClear()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20, page: 1 }))

      await user.click(screen.getByRole('button', { name: /Previous/i }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10 },
        })
      )
    })

    it('resets to page 1 when sorting changes', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)
      mockedGet.mockClear()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(11)], { totalCount: 20, page: 2 }))

      await user.click(screen.getByRole('button', { name: /Next/i }))
      await screen.findByText('Page 2 of 2')

      mockedGet.mockClear()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      await user.click(screen.getByRole('button', { name: /Subject/i }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'subject', sortDir: 'asc', page: 1, pageSize: 10 },
        })
      )
    })
  })

  describe('filtering', () => {
    it('does not show a Clear filters button by default', async () => {
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)

      expect(screen.queryByRole('button', { name: /Clear filters/i })).not.toBeInTheDocument()
    })

    it('sends the status param and resets to page 1 when a status is selected', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)
      mockedGet.mockClear()

      await user.click(screen.getByRole('combobox', { name: 'Filter by status' }))
      await user.click(await screen.findByRole('option', { name: 'Open' }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10, status: 'Open' },
        })
      )
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument()
    })

    it('sends the priority param when a priority is selected', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)
      mockedGet.mockClear()

      await user.click(screen.getByRole('combobox', { name: 'Filter by priority' }))
      await user.click(await screen.findByRole('option', { name: 'High' }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10, priority: 'High' },
        })
      )
    })

    it('sends the category param when a category is selected', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)
      mockedGet.mockClear()

      await user.click(screen.getByRole('combobox', { name: 'Filter by category' }))
      await user.click(await screen.findByRole('option', { name: 'Billing' }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10, category: 'Billing' },
        })
      )
    })

    it('debounces search input and sends the search param', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)
      mockedGet.mockClear()

      await user.type(screen.getByPlaceholderText(/Search subject or student email/i), 'refund')

      // Debounced - no request should fire immediately after typing.
      expect(mockedGet).not.toHaveBeenCalled()

      await waitFor(
        () =>
          expect(mockedGet).toHaveBeenCalledWith('/tickets', {
            params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10, search: 'refund' },
          }),
        { timeout: 2000 }
      )
    })

    it('clears all filters and re-fetches unfiltered results when Clear filters is clicked', async () => {
      const user = userEvent.setup()
      mockedGet.mockResolvedValue(pagedResponse([makeTicket(1)], { totalCount: 20 }))

      renderWithProviders(<TicketsPage />)
      await screen.findByText(/Page 1 of/)

      await user.click(screen.getByRole('combobox', { name: 'Filter by status' }))
      await user.click(await screen.findByRole('option', { name: 'Open' }))
      await screen.findByRole('button', { name: /Clear filters/i })

      mockedGet.mockClear()

      await user.click(screen.getByRole('button', { name: /Clear filters/i }))

      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith('/tickets', {
          params: { sortBy: 'createdAt', sortDir: 'desc', page: 1, pageSize: 10 },
        })
      )
      expect(screen.queryByRole('button', { name: /Clear filters/i })).not.toBeInTheDocument()
    })
  })
})

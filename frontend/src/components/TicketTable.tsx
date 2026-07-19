import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type OnChangeFn,
  type Column,
} from '@tanstack/react-table'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, X } from 'lucide-react'
import api from '../lib/api'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

const STATUS_OPTIONS = ['Open', 'InProgress', 'Resolved', 'Closed']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']
const CATEGORY_OPTIONS = ['Billing', 'Enrollment', 'Technical', 'Refund', 'General']

interface TicketRow {
  id: number
  subject: string
  status: string
  priority: string
  category: string
  studentEmail: string
  createdAt: string
}

interface PagedTickets {
  items: TicketRow[]
  totalCount: number
  page: number
  pageSize: number
}

const STATUS_BADGE: Record<string, string> = {
  Open: 'bg-primary/10 text-primary hover:bg-primary/10',
  InProgress: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/10',
  Resolved: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10',
  Closed: 'bg-muted text-muted-foreground hover:bg-muted',
}

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-muted text-muted-foreground hover:bg-muted',
  Medium: 'bg-primary/10 text-primary hover:bg-primary/10',
  High: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
}

function SortableHeader({ column, label, align }: { column: Column<TicketRow, unknown>; label: string; align?: 'right' }) {
  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className={align === 'right' ? '-mr-3 flex ml-auto' : '-ml-3 flex'}
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {label}
      {sorted === 'asc' && <ArrowUp className="ml-2 h-4 w-4" />}
      {sorted === 'desc' && <ArrowDown className="ml-2 h-4 w-4" />}
      {!sorted && <ArrowUpDown className="ml-2 h-4 w-4" />}
    </Button>
  )
}

const columns: ColumnDef<TicketRow>[] = [
  {
    accessorKey: 'subject',
    header: ({ column }) => <SortableHeader column={column} label="Subject" />,
    cell: ({ row }) => (
      <span
        className="block max-w-xs truncate font-medium text-foreground"
        title={row.original.subject}
      >
        {row.original.subject}
      </span>
    ),
  },
  {
    accessorKey: 'studentEmail',
    header: ({ column }) => <SortableHeader column={column} label="Student" />,
    cell: ({ row }) => (
      <span className="block max-w-56 truncate text-muted-foreground" title={row.original.studentEmail}>
        {row.original.studentEmail}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={STATUS_BADGE[row.original.status] ?? 'bg-muted text-muted-foreground hover:bg-muted'}
      >
        {row.original.status || 'Unknown'}
      </Badge>
    ),
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <SortableHeader column={column} label="Priority" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={PRIORITY_BADGE[row.original.priority] ?? 'bg-muted text-muted-foreground hover:bg-muted'}
      >
        {row.original.priority || 'Unknown'}
      </Badge>
    ),
  },
  {
    accessorKey: 'category',
    header: ({ column }) => <SortableHeader column={column} label="Category" />,
    cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{row.original.category}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <SortableHeader column={column} label="Created" align="right" />,
    sortDescFirst: true,
    cell: ({ row }) => (
      <span className="block whitespace-nowrap text-right text-muted-foreground">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
]

export function TicketTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const activeSort = sorting[0]
  const sortBy = activeSort?.id ?? 'createdAt'
  const sortDir = activeSort?.desc === false ? 'asc' : 'desc'
  const { pageIndex, pageSize } = pagination
  const hasActiveFilters =
    statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || search !== ''

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  function handlePriorityFilterChange(value: string) {
    setPriorityFilter(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  function handleClearFilters() {
    setStatusFilter('all')
    setPriorityFilter('all')
    setCategoryFilter('all')
    setSearch('')
    setDebouncedSearch('')
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  // Debounce free-text search so it doesn't fire a request per keystroke.
  // Skip the initial mount so an untouched search box never schedules a
  // page-reset that could land later and clobber unrelated pagination/sort clicks.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  const { data, isLoading, error } = useQuery<PagedTickets>({
    queryKey: [
      'tickets',
      sortBy,
      sortDir,
      pageIndex,
      pageSize,
      statusFilter,
      priorityFilter,
      categoryFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      api
        .get<PagedTickets>('/tickets', {
          params: {
            sortBy,
            sortDir,
            page: pageIndex + 1,
            pageSize,
            status: statusFilter === 'all' ? undefined : statusFilter,
            priority: priorityFilter === 'all' ? undefined : priorityFilter,
            category: categoryFilter === 'all' ? undefined : categoryFilter,
            search: debouncedSearch === '' ? undefined : debouncedSearch,
          },
        })
        .then((r) => r.data),
  })

  const tickets = data?.items ?? []

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    manualSorting: true,
    manualPagination: true,
    rowCount: data?.totalCount ?? 0,
    getCoreRowModel: getCoreRowModel(),
  })

  const totalCount = data?.totalCount ?? 0
  const pageCount = table.getPageCount()
  const rangeStart = totalCount === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min(totalCount, pageIndex * pageSize + tickets.length)

  return (
    <>
      <div className="shrink-0 flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search subject or student email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={handlePriorityFilterChange}>
          <SelectTrigger className="w-40" aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority} value={priority}>{priority}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
          <SelectTrigger className="w-40" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <p className="shrink-0 text-destructive text-sm mb-4">{error.message}</p>
      )}

      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-auto scrollbar-gutter-stable">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && [...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-48 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-40 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-5 w-16 rounded-full bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-5 w-14 rounded-full bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                <TableCell><div className="h-4 w-20 ml-auto rounded bg-muted animate-pulse" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && tickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  No tickets found.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <div className="shrink-0 flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {totalCount} tickets
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

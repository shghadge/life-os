import React from 'react'
import { Archive, Check, X } from 'lucide-react'
import { JobFilters, JobStatus } from '@/types/job'
import { STATUS_CONFIG } from '@/lib/status'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface JobFilterBarProps {
  filters: JobFilters
  onFiltersChange: (filters: JobFilters) => void
  statusCounts: Record<JobStatus, number>
  totalMatches: number
  hasActiveFilters: boolean
  onClearFilters: () => void
}

const PIPELINE_STATUSES: JobStatus[] = [
  'not_applied',
  'applied',
  'screening',
  'interviewing',
  'offer',
]

const CLOSED_STATUSES: JobStatus[] = ['rejected', 'withdrawn']

export const JobFilterBar: React.FC<JobFilterBarProps> = ({
  filters,
  onFiltersChange,
  statusCounts,
  totalMatches,
  hasActiveFilters,
  onClearFilters,
}) => {
  const selectedStatus = filters.statusFilter || 'all'
  const closedCount = CLOSED_STATUSES.reduce((total, status) => total + statusCounts[status], 0)
  const isClosedSelected = CLOSED_STATUSES.includes(selectedStatus as JobStatus)

  const selectStatus = (status: JobStatus | 'all') => {
    onFiltersChange({ ...filters, statusFilter: status })
  }

  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border bg-card/45 px-5 py-2 select-none">
      <div className="flex min-w-0 items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-foreground">
          Pipeline
        </span>

        <button
          type="button"
          onClick={() => selectStatus('all')}
          aria-pressed={selectedStatus === 'all'}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors',
            selectedStatus === 'all'
              ? 'border-primary/40 bg-primary/15 text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          All
        </button>

        <div className="h-5 w-px bg-border" />

        {PIPELINE_STATUSES.map((status) => {
          const config = STATUS_CONFIG[status]
          const isSelected = selectedStatus === status

          return (
            <button
              key={status}
              type="button"
              onClick={() => selectStatus(status)}
              aria-pressed={isSelected}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                isSelected
                  ? 'border-primary/40 bg-primary/15 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
              <span>{status === 'offer' ? 'Offer' : config.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{statusCounts[status]}</span>
            </button>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-pressed={isClosedSelected}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                isClosedSelected
                  ? 'border-primary/40 bg-primary/15 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              Closed
              <span className="text-xs tabular-nums text-muted-foreground">{closedCount}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Closed applications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CLOSED_STATUSES.map((status) => {
              const config = STATUS_CONFIG[status]
              return (
                <DropdownMenuItem key={status} onClick={() => selectStatus(status)}>
                  <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
                  <span>{config.label}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {statusCounts[status]}
                  </span>
                  {selectedStatus === status && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {totalMatches} {totalMatches === 1 ? 'application' : 'applications'}
        </span>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}

import React, { useRef } from 'react'
import {
  Star,
  ExternalLink,
  FileText,
  MessageSquareText,
  Paperclip,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Check,
} from 'lucide-react'
import { JobApplication, JobFilters, JobStatus } from '@/types/job'
import { STATUS_CONFIG, ALL_STATUSES } from '@/lib/status'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate, formatFullDate, formatRelativeTime, cn } from '@/lib/utils'

interface JobTableProps {
  jobs: JobApplication[]
  selectedJobId: string | null
  onSelectJob: (job: JobApplication) => void
  onUpdateJob: (job: JobApplication) => void
  sortBy: JobFilters['sortBy']
  sortDirection: JobFilters['sortDirection']
  onToggleSort: (sortField: 'company' | 'appliedDate' | 'status') => void
}

export const JobTable: React.FC<JobTableProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onUpdateJob,
  sortBy,
  sortDirection,
  onToggleSort,
}) => {
  const tableRef = useRef<HTMLTableElement>(null)

  const handleToggleStar = (e: React.MouseEvent, job: JobApplication) => {
    e.stopPropagation()
    onUpdateJob({ ...job, starred: !job.starred })
  }

  const handleStatusChange = (e: React.MouseEvent, job: JobApplication, newStatus: JobStatus) => {
    e.stopPropagation()
    onUpdateJob({ ...job, status: newStatus })
  }

  // Keyboard navigation for table rows
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSelectJob(jobs[index])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = Math.min(index + 1, jobs.length - 1)
      onSelectJob(jobs[nextIndex])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = Math.max(index - 1, 0)
      onSelectJob(jobs[prevIndex])
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      onUpdateJob({ ...jobs[index], starred: !jobs[index].starred })
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center border-b border-border/40 p-14 text-center text-muted-foreground">
        <p className="font-heading text-base font-semibold text-foreground">No applications in this view</p>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Clear the filters above or press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">N</kbd> to capture a new application.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full px-5 py-4 select-none font-sans">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <Table ref={tableRef}>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/70 bg-muted/30">
              <TableHead className="w-9 px-2 text-center"></TableHead>

              {/* Company Header with Sort */}
              <TableHead className="w-52 sm:w-56 font-semibold text-foreground">
                <button
                  type="button"
                  onClick={() => onToggleSort('company')}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group"
                  title="Sort by company"
                >
                  <span>Company</span>
                  {sortBy === 'company' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-primary" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  )}
                </button>
              </TableHead>

              {/* Role Header */}
              <TableHead className="font-semibold text-foreground">Role</TableHead>

              {/* Status Header with Sort */}
              <TableHead className="w-36 font-semibold text-foreground hidden sm:table-cell">
                <button
                  type="button"
                  onClick={() => onToggleSort('status')}
                  className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group"
                  title="Sort by status"
                >
                  <span>Status</span>
                  {sortBy === 'status' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-primary" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  )}
                </button>
              </TableHead>

              {/* Applied On Header with Sort */}
              <TableHead className="w-36 text-right font-semibold text-foreground">
                <button
                  type="button"
                  onClick={() => onToggleSort('appliedDate')}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group ml-auto"
                  title="Sort by applied date"
                >
                  <span>Applied</span>
                  {sortBy === 'appliedDate' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-primary" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  )}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job, index) => {
              const isSelected = selectedJobId === job.id
              const currentStatus = STATUS_CONFIG[job.status || 'not_applied'] || STATUS_CONFIG.not_applied

              return (
                <TableRow
                  key={job.id}
                  tabIndex={0}
                  aria-label={`${job.company}, ${job.role}, ${currentStatus.label}, applied ${formatFullDate(job.appliedDate)}`}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onClick={() => onSelectJob(job)}
                  className={cn(
                    'group cursor-pointer font-sans transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    isSelected
                      ? '!bg-primary/12 text-foreground border-l-4 border-l-primary hover:!bg-primary/16 shadow-xs'
                      : 'hover:bg-muted/50'
                  )}
                >
                  {/* Star Button */}
                  <TableCell className="px-2 py-3 text-center">
                    <button
                      onClick={(e) => handleToggleStar(e, job)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-amber-500 cursor-pointer"
                      title={job.starred ? 'Starred' : 'Star application'}
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          job.starred ? 'fill-amber-400 text-amber-500' : 'group-hover:text-muted-foreground'
                        )}
                      />
                    </button>
                  </TableCell>

                  {/* Company Name */}
                  <TableCell className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-semibold font-heading transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-transparent'
                          : 'bg-muted text-foreground border-border/60'
                      )}>
                        {job.company.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
                        <span className="truncate">{job.company}</span>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground inline-block shrink-0"
                            title="Open job URL"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Role and saved artifacts */}
                  <TableCell className="py-3 font-sans">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', isSelected ? 'font-semibold text-foreground' : 'text-foreground/90')}>
                        {job.role}
                      </span>
                      {(job.rawDescription || job.qaList?.length > 0 || job.resume?.pdfDataUrl) && (
                        <div className="flex shrink-0 items-center gap-3 text-[13px] font-medium text-muted-foreground">
                          {job.rawDescription && (
                            <span className="inline-flex items-center gap-1.5" title="Job description saved">
                              <FileText className="h-3.5 w-3.5" />
                              Description
                            </span>
                          )}
                          {job.qaList && job.qaList.length > 0 && (
                            <span className="inline-flex items-center gap-1.5" title={`${job.qaList.length} saved ${job.qaList.length === 1 ? 'response' : 'responses'}`}>
                              <MessageSquareText className="h-3.5 w-3.5" />
                              {job.qaList.length} {job.qaList.length === 1 ? 'response' : 'responses'}
                            </span>
                          )}
                          {job.resume?.pdfDataUrl && (
                            <span
                              className="inline-flex items-center gap-1.5"
                              title={`Attached resume: ${job.resume.name || 'Resume.pdf'}`}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              Resume
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Status Pill with Quick Dropdown */}
                  <TableCell className="hidden py-3 text-sm font-sans sm:table-cell" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'inline-flex h-8 w-32 items-center justify-between gap-1.5 whitespace-nowrap rounded-md border border-border bg-background/80 px-2.5 text-[13px] font-medium text-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-muted cursor-pointer',
                            isSelected && 'border-primary/30 bg-card'
                          )}
                          title="Change status"
                        >
                          <span className={cn('h-2 w-2 rounded-full shrink-0', currentStatus.dotClass)} />
                          <span>{currentStatus.label}</span>
                          <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-55" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40 font-sans">
                        {ALL_STATUSES.map((st) => {
                          const conf = STATUS_CONFIG[st]
                          const isActive = (job.status || 'not_applied') === st
                          return (
                            <DropdownMenuItem
                              key={st}
                              onClick={(e) => handleStatusChange(e, job, st)}
                              className="flex items-center justify-between text-[13px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn('h-2 w-2 rounded-full', conf.dotClass)} />
                                <span>{conf.label}</span>
                              </div>
                              {isActive && <Check className="h-3 w-3 text-primary" />}
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  {/* Applied Date */}
                  <TableCell className="py-3 text-right text-sm font-sans">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">{formatDate(job.appliedDate)}</span>
                      <span className={cn('text-xs', isSelected ? 'text-foreground/75' : 'text-muted-foreground')}>
                        {formatRelativeTime(job.appliedDate)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

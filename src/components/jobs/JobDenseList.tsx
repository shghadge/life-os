import React from 'react'
import { Star } from 'lucide-react'
import { JobApplication } from '@/types/job'
import { formatDate, formatRelativeTime, cn } from '@/lib/utils'

interface JobDenseListProps {
  jobs: JobApplication[]
  selectedJobId: string | null
  onSelectJob: (job: JobApplication) => void
  onUpdateJob: (job: JobApplication) => void
}

export const JobDenseList: React.FC<JobDenseListProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onUpdateJob,
}) => {
  const handleToggleStar = (e: React.MouseEvent, job: JobApplication) => {
    e.stopPropagation()
    onUpdateJob({ ...job, starred: !job.starred })
  }

  return (
    <div className="divide-y divide-border/40 select-none">
      {jobs.map((job) => {
        const isSelected = selectedJobId === job.id
        return (
          <div
            key={job.id}
            onClick={() => onSelectJob(job)}
            className={cn(
              'flex items-center justify-between px-4 py-2 hover:bg-muted/30 cursor-pointer transition-colors text-xs',
              isSelected && 'bg-accent/60 font-medium'
            )}
          >
            {/* Left side: Star, Company, Title, Tags */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={(e) => handleToggleStar(e, job)}
                className="text-muted-foreground/40 hover:text-amber-500 cursor-pointer shrink-0"
              >
                <Star className={cn('h-3.5 w-3.5', job.starred ? 'fill-amber-400 text-amber-500' : '')} />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-foreground truncate">{job.company}</span>
                <span className="text-muted-foreground/60">—</span>
                <span className="text-muted-foreground truncate">{job.role}</span>
              </div>

              {job.qaList && job.qaList.length > 0 && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-primary/10 text-primary font-mono hidden sm:inline">
                  {job.qaList.length} {job.qaList.length === 1 ? 'response' : 'responses'}
                </span>
              )}
            </div>

            {/* Right side: Applied Date */}
            <div className="flex items-center gap-2.5 shrink-0 pl-2">
              <span className="text-[11px] font-mono text-muted-foreground">
                {formatDate(job.appliedDate)}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 w-16 text-right hidden md:inline">
                {formatRelativeTime(job.appliedDate)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

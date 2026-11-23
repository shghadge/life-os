import React, { useEffect, useState } from 'react'
import { Bot, User } from 'lucide-react'
import { jobsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { JobActivity } from '@/types/job'

interface JobActivityLogProps {
  jobId: string
  /** Server revision; a change means someone (dashboard or agent) wrote data, so the log is refetched. */
  revision: number
}

const VISIBLE_ENTRIES = 8

export const JobActivityLog: React.FC<JobActivityLogProps> = ({ jobId, revision }) => {
  const [activity, setActivity] = useState<JobActivity[]>([])

  useEffect(() => {
    let cancelled = false
    jobsApi
      .activity(jobId)
      .then(({ activity }) => !cancelled && setActivity(activity))
      .catch(() => !cancelled && setActivity([]))
    return () => {
      cancelled = true
    }
  }, [jobId, revision])

  if (activity.length === 0) return null

  return (
    <section aria-label="Activity" className="space-y-2 border-t border-border/70 pt-3">
      <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
      <ol className="space-y-1.5">
        {activity.slice(0, VISIBLE_ENTRIES).map((entry) => {
          const ActorIcon = entry.actor === 'agent' ? Bot : User
          return (
            <li key={entry.id} className="flex items-start gap-2 text-xs">
              <ActorIcon
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${entry.actor === 'agent' ? 'text-primary' : 'text-muted-foreground'}`}
                aria-label={entry.actor === 'agent' ? 'Agent' : 'You'}
              />
              <span className="min-w-0 flex-1 text-foreground/85">{entry.summary}</span>
              <time dateTime={entry.createdAt} className="shrink-0 text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </time>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

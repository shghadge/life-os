import { JobStatus } from '@/types/job'

export interface StatusConfig {
  id: JobStatus
  label: string
  dotClass: string
  badgeClass: string
}

export const STATUS_CONFIG: Record<JobStatus, StatusConfig> = {
  not_applied: {
    id: 'not_applied',
    label: 'Saved',
    dotClass: 'bg-muted-foreground/60',
    badgeClass: 'bg-muted/60 text-muted-foreground border-border/70',
  },
  applied: {
    id: 'applied',
    label: 'Applied',
    dotClass: 'bg-primary',
    badgeClass: 'bg-muted text-foreground border-border',
  },
  screening: {
    id: 'screening',
    label: 'Screening',
    dotClass: 'bg-secondary-foreground/70',
    badgeClass: 'bg-secondary text-secondary-foreground border-border',
  },
  interviewing: {
    id: 'interviewing',
    label: 'Interviewing',
    dotClass: 'bg-accent-foreground',
    badgeClass: 'bg-accent text-accent-foreground border-border font-medium',
  },
  offer: {
    id: 'offer',
    label: 'Offer Received',
    dotClass: 'bg-primary',
    badgeClass: 'bg-primary/20 text-foreground border-primary/40 font-semibold',
  },
  rejected: {
    id: 'rejected',
    label: 'Rejected',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  withdrawn: {
    id: 'withdrawn',
    label: 'Withdrawn',
    dotClass: 'bg-muted-foreground/40',
    badgeClass: 'bg-muted/40 text-muted-foreground border-border/50',
  },
}

export const ALL_STATUSES: JobStatus[] = [
  'not_applied',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

export type JobStatus =
  | 'not_applied'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

export interface JobQA {
  id: string
  question: string
  answer: string
}

export interface ExtractedMetadata {
  techStack: string[]
  salaryMentioned?: string
  experienceLevel?: string
  keyRequirements: string[]
  responsibilities: string[]
}

export type ActivityActor = 'agent' | 'dashboard'

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'qa_added'
  | 'resume_attached'
  | 'resume_removed'
  | 'deleted'
  | 'imported'

export interface JobActivity {
  id: number
  jobId: string
  actor: ActivityActor
  action: ActivityAction
  summary: string
  createdAt: string
}

/** Metadata for the attached resume PDF; the file itself is served from /api/jobs/:id/resume. */
export interface JobResume {
  name: string
  uploadedAt: string
}

export interface JobApplication {
  id: string
  createdAt: string
  updatedAt: string
  company: string
  role: string
  status: JobStatus
  appliedDate: string
  salaryMin?: number
  salaryMax?: number
  url?: string
  rawDescription?: string
  resume?: JobResume
  qaList: JobQA[]
  notes: string
  starred?: boolean
  extractedMetadata?: ExtractedMetadata
}

/** Fields a client may set when creating or editing an application. */
export type JobInput = Pick<JobApplication, 'company' | 'role'> &
  Partial<
    Pick<
      JobApplication,
      | 'status'
      | 'appliedDate'
      | 'salaryMin'
      | 'salaryMax'
      | 'url'
      | 'rawDescription'
      | 'qaList'
      | 'notes'
      | 'starred'
      | 'extractedMetadata'
    >
  > & { id?: string }

/** Partial edit; `null` clears an optional field. */
export type JobPatch = { [K in keyof Omit<JobInput, 'id'>]?: Omit<JobInput, 'id'>[K] | null }

export type ViewMode = 'table' | 'dense'

export interface JobFilters {
  search: string
  statusFilter?: JobStatus | 'all'
  companyFilter?: string
  starredOnly: boolean
  sortBy: 'appliedDate' | 'company' | 'status' | 'recentlyAdded'
  sortDirection: 'asc' | 'desc'
}

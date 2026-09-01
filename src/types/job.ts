export type WorkplaceType = 'remote' | 'hybrid' | 'onsite'

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

export interface JobActivity {
  id: string
  timestamp: string
  type: 'status_change' | 'note_added' | 'qa_added' | 'created'
  description: string
}

export interface JobResume {
  name?: string
  pdfDataUrl?: string
  uploadedAt?: string
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
  activities?: JobActivity[]
}

export type ViewMode = 'table' | 'dense'

export interface JobFilters {
  search: string
  statusFilter?: JobStatus | 'all'
  companyFilter?: string
  starredOnly: boolean
  sortBy: 'appliedDate' | 'company' | 'status' | 'recentlyAdded'
  sortDirection: 'asc' | 'desc'
}

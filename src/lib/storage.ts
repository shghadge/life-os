import type { JobApplication, JobStatus, JobResume } from '../types/job.ts'

/** YYYY-MM-DD in the machine's time zone (toISOString would give the UTC day). */
export function getTodayDateString(today = new Date()): string {
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getUniqueCompanies(jobs: JobApplication[]): string[] {
  const set = new Set<string>()
  jobs.forEach((j) => {
    if (j.company && j.company.trim()) {
      set.add(j.company.trim())
    }
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function getUniqueRoles(jobs: JobApplication[]): string[] {
  const defaults = [
    'Frontend Engineer',
    'Senior Frontend Engineer',
    'Staff Frontend Engineer',
    'Full Stack Engineer',
    'Senior Full Stack Engineer',
    'Senior Software Engineer',
    'Staff Software Engineer',
    'Principal Software Engineer',
    'Backend Engineer',
    'Senior Backend Engineer',
    'Machine Learning Engineer',
    'AI Engineer',
    'Product Designer',
    'Lead Product Designer',
    'Engineering Manager',
    'Technical Lead',
  ]
  const set = new Set<string>(defaults)
  jobs.forEach((j) => {
    if (j.role && j.role.trim()) {
      set.add(j.role.trim())
    }
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function createNewJob(data: {
  company: string
  role: string
  status?: JobStatus
  salaryMin?: number
  salaryMax?: number
  url?: string
  appliedDate: string
  notes?: string
  resume?: JobResume
  rawDescription?: string
  qaList?: { id: string; question: string; answer: string }[]
}): JobApplication {
  const timestamp = new Date().toISOString()

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    company: data.company.trim(),
    role: data.role.trim(),
    status: data.status || 'not_applied',
    salaryMin: data.salaryMin,
    salaryMax: data.salaryMax,
    url: data.url?.trim() || undefined,
    appliedDate: data.appliedDate || getTodayDateString(),
    starred: false,
    resume: data.resume,
    notes: data.notes?.trim() || '',
    rawDescription: data.rawDescription || '',
    qaList: data.qaList || [],
    extractedMetadata: data.rawDescription
      ? {
          techStack: [],
          keyRequirements: [],
          responsibilities: []
        }
      : undefined
  }
}

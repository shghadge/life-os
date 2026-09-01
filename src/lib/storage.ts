import { JobApplication, JobStatus, JobResume } from '@/types/job'
import { parseRawJobDescription } from './jd-parser'

const STORAGE_KEY = 'life_os_job_applications_v1'

export const INITIAL_SEED_JOBS: JobApplication[] = [
  {
    id: 'job-1',
    company: 'Stripe',
    role: 'Staff Frontend Engineer, Dashboard',
    status: 'interviewing',
    salaryMin: 240000,
    salaryMax: 310000,
    url: 'https://stripe.com/jobs/staff-frontend-dashboard',
    appliedDate: '2026-08-15',
    createdAt: '2026-08-15T16:00:00.000Z',
    updatedAt: '2026-08-20T18:15:00.000Z',
    starred: true,
    notes: 'Recruiter reached out via email. Focused on financial ledger UI rendering performance and design system.',
    qaList: [
      {
        id: 'qa-1',
        question: 'Why Stripe?',
        answer: 'Stripe sets the gold standard for developer tools and financial infrastructure design. I want to build high-reliability UI surfaces that power global commerce.'
      },
      {
        id: 'qa-2',
        question: 'Describe a complex state management architecture you designed.',
        answer: 'Built an optimistic mutation layer with offline rollback and differential synchronization for tabular records handling 100k+ updates.'
      }
    ],
    rawDescription: `About the Role:
At Stripe, we are looking for a Staff Frontend Engineer to lead architecture on Stripe Dashboard. You will design, build, and optimize core UI surfaces used by millions of businesses.

Tech Stack:
React, TypeScript, GraphQL, Web Workers, Canvas rendering, Tailwind CSS.

Requirements:
- 7+ years building high scale web applications.
- Deep expertise in browser performance, rendering lifecycle, and bundle optimization.
- Proven track record leading major architectural migrations.
- Base Compensation: $240,000 - $310,000 + Equity + Benefits.`,
    extractedMetadata: {
      techStack: ['React', 'TypeScript', 'GraphQL', 'Web Workers', 'Canvas', 'Tailwind CSS'],
      salaryMentioned: '$240,000 - $310,000',
      experienceLevel: '7+ years',
      keyRequirements: [
        '7+ years building high scale web apps',
        'Deep browser performance & rendering expertise',
        'Architectural leadership'
      ],
      responsibilities: [
        'Lead architecture on Stripe Dashboard',
        'Build and optimize core UI surfaces',
        'Establish team frontend engineering standards'
      ]
    }
  },
  {
    id: 'job-2',
    company: 'Linear',
    role: 'Senior Product Engineer',
    status: 'offer',
    salaryMin: 210000,
    salaryMax: 275000,
    url: 'https://linear.app/careers/product-engineer',
    appliedDate: '2026-08-14',
    createdAt: '2026-08-14T15:30:00.000Z',
    updatedAt: '2026-08-19T20:40:00.000Z',
    starred: true,
    notes: 'Craft and speed obsession. Need to prepare demo of keyboard navigation systems and offline sync architectures.',
    qaList: [
      {
        id: 'qa-10',
        question: 'What makes you obsessed with software quality and speed?',
        answer: 'Tools should disappear into muscle memory. Sub-50ms latency, zero-friction keyboard shortcuts, and calm typography make work a joy.'
      }
    ],
    rawDescription: `Linear is looking for a Senior Product Engineer to help build the future of software development tools.

Requirements:
- Strong eye for craft, typography, and micro-interactions.
- Expertise in TypeScript, React, IndexedDB, and CRDT synchronization.
- Experience with desktop-class web applications.
- Experience Level: Senior (5+ years).
- Compensation: $210,000 - $275,000 + meaningful equity.`,
    extractedMetadata: {
      techStack: ['TypeScript', 'React', 'IndexedDB', 'CRDT', 'WebSockets'],
      salaryMentioned: '$210,000 - $275,000',
      experienceLevel: '5+ years (Senior)',
      keyRequirements: [
        'Strong eye for craft and micro-interactions',
        'Expertise in TypeScript, React, and local-first data sync',
        'Desktop-class web application experience'
      ],
      responsibilities: [
        'Build lightning-fast issue tracking and project planning features',
        'Design local-first sync and keyboard workflows'
      ]
    }
  },
  {
    id: 'job-3',
    company: 'Vercel',
    role: 'Staff UI Infrastructure Engineer',
    status: 'screening',
    salaryMin: 230000,
    salaryMax: 290000,
    url: 'https://vercel.com/careers/staff-ui-infra',
    appliedDate: '2026-08-12',
    createdAt: '2026-08-12T17:10:00.000Z',
    updatedAt: '2026-08-18T16:25:00.000Z',
    starred: false,
    notes: 'Focus on Turbopack integration and edge streaming React components.',
    qaList: [],
    rawDescription: `Join Vercel to shape the developer experience for the next generation of the web.
Tech: Next.js, React Server Components, Rust, Tailwind, TypeScript.
Comp: $230,000 - $290,000.
Level: Staff Engineer (6+ years experience).`,
    extractedMetadata: {
      techStack: ['Next.js', 'React Server Components', 'Rust', 'Tailwind', 'TypeScript'],
      salaryMentioned: '$230,000 - $290,000',
      experienceLevel: 'Staff Engineer (6+ years)',
      keyRequirements: ['Next.js ecosystem depth', 'Compiler & bundler understanding'],
      responsibilities: ['Build next-gen UI infrastructure tools and frameworks']
    }
  },
  {
    id: 'job-4',
    company: 'Anthropic',
    role: 'Frontend Systems Engineer, Claude Web',
    status: 'interviewing',
    salaryMin: 250000,
    salaryMax: 340000,
    url: 'https://anthropic.com/careers/frontend-claude',
    appliedDate: '2026-08-10',
    createdAt: '2026-08-10T14:45:00.000Z',
    updatedAt: '2026-08-17T19:05:00.000Z',
    starred: true,
    notes: 'Working on conversational artifacts, code execution sandbox UI, and streaming Markdown rendering.',
    qaList: [
      {
        id: 'qa-20',
        question: 'How do you approach AI interface design?',
        answer: 'AI interfaces should feel calm, transparent, and empower the user without pretending to be human. Fast token streaming and high-fidelity rendering are critical.'
      }
    ],
    rawDescription: `Anthropic is searching for a Frontend Systems Engineer to build Claude's web interfaces.
Requirements:
- TypeScript, React, Streaming protocols, WebAssembly, Canvas.
- 5+ years experience building complex interactive web applications.
- Comp: $250,000 - $340,000 + Equity.`,
    extractedMetadata: {
      techStack: ['TypeScript', 'React', 'WebAssembly', 'Canvas', 'Streaming Protocols'],
      salaryMentioned: '$250,000 - $340,000',
      experienceLevel: '5+ years',
      keyRequirements: ['Complex interactive web apps', 'Streaming and low latency rendering'],
      responsibilities: ['Build Claude web client and artifact environments']
    }
  },
  {
    id: 'job-5',
    company: 'OpenAI',
    role: 'Full Stack Engineer, Operator & Tools',
    status: 'applied',
    salaryMin: 270000,
    salaryMax: 370000,
    url: 'https://openai.com/careers/fullstack-operator',
    appliedDate: '2026-08-08',
    createdAt: '2026-08-08T18:20:00.000Z',
    updatedAt: '2026-08-16T21:30:00.000Z',
    starred: false,
    notes: 'Operator computer-use UI research and multimodal inspection console.',
    qaList: [],
    rawDescription: `OpenAI is hiring Full Stack Engineers to build agentic computer-use tools.
Requirements: Python, React, Next.js, Tailwind, WebRTC.
Comp: $270,000 - $370,000.`,
    extractedMetadata: {
      techStack: ['Python', 'React', 'Next.js', 'Tailwind', 'WebRTC'],
      salaryMentioned: '$270,000 - $370,000',
      experienceLevel: 'Senior / Staff',
      keyRequirements: ['Fullstack experience with agent orchestration and UI'],
      responsibilities: ['Build multimodal operator tools']
    }
  }
]

type StoredJobApplication = Omit<JobApplication, 'createdAt' | 'updatedAt'> & {
  createdAt?: string
  updatedAt?: string
  salary?: string
}

export function loadStoredJobs(): JobApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      saveStoredJobs(INITIAL_SEED_JOBS)
      return INITIAL_SEED_JOBS
    }
    const parsed = JSON.parse(raw) as StoredJobApplication[]
    return parsed.map((job) => {
      const { salary, ...storedJob } = job
      const legacySalary = salary ? parseRawJobDescription(salary) : undefined
      const createdAt =
        storedJob.createdAt || new Date(`${storedJob.appliedDate}T12:00:00.000Z`).toISOString()

      return {
        ...storedJob,
        status: storedJob.status || 'not_applied',
        salaryMin: storedJob.salaryMin ?? legacySalary?.salaryMin,
        salaryMax: storedJob.salaryMax ?? legacySalary?.salaryMax,
        createdAt,
        updatedAt: storedJob.updatedAt || createdAt,
        resume: storedJob.resume?.pdfDataUrl
          ? {
              name: storedJob.resume.name,
              pdfDataUrl: storedJob.resume.pdfDataUrl,
              uploadedAt: storedJob.resume.uploadedAt,
            }
          : undefined,
      }
    })
  } catch (err) {
    console.error('Failed to load jobs from localStorage:', err)
    return INITIAL_SEED_JOBS
  }
}

export function saveStoredJobs(jobs: JobApplication[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  } catch (err) {
    console.error('Failed to save jobs to localStorage:', err)
  }
}

export function getTodayDateString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getFormattedDateTime(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  return date.toLocaleDateString('en-US', options)
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

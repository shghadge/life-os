import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { parseRawJobDescription } from '../src/lib/jd-parser.ts'
import { getTodayDateString } from '../src/lib/storage.ts'
import type {
  ActivityAction,
  ActivityActor,
  ExtractedMetadata,
  JobActivity,
  JobApplication,
  JobInput,
  JobPatch,
  JobQA,
  JobStatus,
} from '../src/types/job.ts'

export const JOB_STATUSES = [
  'not_applied',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
] as const satisfies readonly JobStatus[]

export const STATUS_LABELS: Record<JobStatus, string> = {
  not_applied: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

/** Statuses where the ball is still in play; used for stale-application detection. */
const ACTIVE_STATUSES: JobStatus[] = ['applied', 'screening', 'interviewing']

const FIELD_LABELS: Record<keyof JobPatch, string | null> = {
  company: 'company',
  role: 'role',
  status: null,
  appliedDate: 'applied date',
  salaryMin: 'salary',
  salaryMax: 'salary',
  url: 'URL',
  rawDescription: 'job description',
  qaList: 'responses',
  notes: 'notes',
  starred: null,
  extractedMetadata: null,
}

/** Consecutive edits by the same actor within this window collapse into one activity entry. */
const EDIT_COALESCE_MS = 10 * 60 * 1000

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

interface JobRow {
  id: string
  company: string
  role: string
  status: JobStatus
  applied_date: string
  salary_min: number | null
  salary_max: number | null
  url: string | null
  raw_description: string
  notes: string
  starred: number
  extracted_metadata: string | null
  resume_name: string | null
  resume_file: string | null
  resume_uploaded_at: string | null
  created_at: string
  updated_at: string
}

interface ActivityRow {
  id: number
  job_id: string
  actor: ActivityActor
  action: ActivityAction
  summary: string
  created_at: string
}

export interface JobQuery {
  status?: JobStatus
  starred?: boolean
  /** Case-insensitive match against company, role, notes, description, and Q&A. */
  query?: string
}

export interface PipelineSummary {
  total: number
  starred: number
  byStatus: Record<JobStatus, number>
  stale: { id: string; company: string; role: string; status: JobStatus; daysSinceUpdate: number }[]
  recentActivity: (JobActivity & { company: string | null })[]
}

/** Shape of applications saved by the browser-only version of the dashboard. */
export type LegacyJob = Omit<JobApplication, 'resume'> & {
  resume?: { name?: string; pdfDataUrl?: string; uploadedAt?: string }
}

/**
 * The single owner of job data. The HTTP API (dashboard) and the MCP server
 * (agents) both go through this class, so validation and activity logging
 * behave the same no matter who makes the change.
 */
export class JobStore {
  private readonly db: DatabaseSync
  private readonly resumeDir: string

  constructor(db: DatabaseSync, dataDir: string) {
    this.db = db
    this.resumeDir = path.join(dataDir, 'resumes')
  }

  /** Increments on every write; clients poll it to detect changes made by other processes. */
  revision(): number {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'revision'`).get() as { value: string }
    return Number(row.value)
  }

  list(query: JobQuery = {}): JobApplication[] {
    const rows = this.db.prepare('SELECT * FROM jobs ORDER BY applied_date DESC, created_at DESC').all() as unknown as JobRow[]
    const qaByJob = this.loadQA()
    const needle = query.query?.trim().toLowerCase()

    return rows
      .map((row) => toJob(row, qaByJob.get(row.id) ?? []))
      .filter((job) => {
        if (query.status && job.status !== query.status) return false
        if (query.starred !== undefined && Boolean(job.starred) !== query.starred) return false
        if (!needle) return true
        return [job.company, job.role, job.notes, job.rawDescription ?? '', ...job.qaList.flatMap((qa) => [qa.question, qa.answer])]
          .some((text) => text.toLowerCase().includes(needle))
      })
  }

  get(id: string): JobApplication {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
    if (!row) throw new NotFoundError(`No application with id "${id}"`)
    return toJob(row, this.loadQA(id).get(id) ?? [])
  }

  create(input: JobInput, actor: ActivityActor): JobApplication {
    const job = normalizeInput(input)
    return this.transaction(() => {
      if (this.exists(job.id)) throw new ValidationError(`An application with id "${job.id}" already exists`)
      this.insert(job)
      this.log(job.id, actor, 'created', `Added ${job.company} · ${job.role}`)
      return this.get(job.id)
    })
  }

  update(id: string, patch: JobPatch, actor: ActivityActor): JobApplication {
    return this.transaction(() => {
      const current = this.get(id)
      const next = applyPatch(current, patch)
      const changed = (Object.keys(patch) as (keyof JobPatch)[]).filter(
        (key) => patch[key] !== undefined && JSON.stringify(current[key]) !== JSON.stringify(next[key])
      )
      if (changed.length === 0) return current

      next.updatedAt = new Date().toISOString()
      this.db
        .prepare(
          `UPDATE jobs SET company = ?, role = ?, status = ?, applied_date = ?, salary_min = ?, salary_max = ?,
             url = ?, raw_description = ?, notes = ?, starred = ?, extracted_metadata = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(...jobColumns(next), next.updatedAt, id)
      if (changed.includes('qaList')) this.replaceQA(id, next.qaList)

      if (changed.includes('status')) {
        this.log(id, actor, 'status_changed', `Status: ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[next.status]}`)
      }
      if (changed.includes('starred')) {
        this.log(id, actor, 'updated', next.starred ? 'Starred' : 'Unstarred')
      }
      const edited = [...new Set(changed.map((key) => FIELD_LABELS[key]).filter((label): label is string => !!label))]
      if (edited.length > 0) this.logEdit(id, actor, edited)
      return this.get(id)
    })
  }

  delete(id: string, actor: ActivityActor): void {
    this.transaction(() => {
      const job = this.get(id)
      this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
      this.log(id, actor, 'deleted', `Deleted ${job.company} · ${job.role}`)
    })
    rmSync(this.resumeFile(id), { force: true })
  }

  addAnswer(id: string, question: string, answer: string, actor: ActivityActor): JobApplication {
    const q = question.trim()
    if (!q) throw new ValidationError('Question is required')
    return this.transaction(() => {
      const job = this.get(id)
      this.db
        .prepare('INSERT INTO job_qa (id, job_id, position, question, answer) VALUES (?, ?, ?, ?, ?)')
        .run(`qa-${randomUUID()}`, id, job.qaList.length, q, answer.trim())
      this.touch(id)
      this.log(id, actor, 'qa_added', `Added response: ${q.length > 80 ? `${q.slice(0, 79)}…` : q}`)
      return this.get(id)
    })
  }

  attachResume(id: string, fileName: string, bytes: Uint8Array, actor: ActivityActor): JobApplication {
    if (!isPdf(bytes)) throw new ValidationError('Resume must be a PDF file')
    const name = path.basename(fileName).trim() || 'Resume.pdf'
    this.get(id)
    mkdirSync(this.resumeDir, { recursive: true })
    writeFileSync(this.resumeFile(id), bytes)
    return this.transaction(() => {
      this.db
        .prepare('UPDATE jobs SET resume_name = ?, resume_file = ?, resume_uploaded_at = ? WHERE id = ?')
        .run(name, path.basename(this.resumeFile(id)), new Date().toISOString(), id)
      this.touch(id)
      this.log(id, actor, 'resume_attached', `Attached resume ${name}`)
      return this.get(id)
    })
  }

  removeResume(id: string, actor: ActivityActor): JobApplication {
    const job = this.transaction(() => {
      const current = this.get(id)
      if (!current.resume) return current
      this.db.prepare('UPDATE jobs SET resume_name = NULL, resume_file = NULL, resume_uploaded_at = NULL WHERE id = ?').run(id)
      this.touch(id)
      this.log(id, actor, 'resume_removed', `Removed resume ${current.resume.name}`)
      return this.get(id)
    })
    rmSync(this.resumeFile(id), { force: true })
    return job
  }

  /** Absolute path and display name of the attached resume PDF. */
  resume(id: string): { path: string; name: string } {
    const job = this.get(id)
    if (!job.resume) throw new NotFoundError(`${job.company} · ${job.role} has no resume attached`)
    return { path: this.resumeFile(id), name: job.resume.name }
  }

  activity(options: { jobId?: string; limit?: number } = {}): JobActivity[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500)
    const rows = (
      options.jobId
        ? this.db.prepare('SELECT * FROM activity WHERE job_id = ? ORDER BY id DESC LIMIT ?').all(options.jobId, limit)
        : this.db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?').all(limit)
    ) as unknown as ActivityRow[]
    return rows.map(toActivity)
  }

  summary(staleDays = 14): PipelineSummary {
    const jobs = this.list()
    const byStatus = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<JobStatus, number>
    jobs.forEach((job) => (byStatus[job.status] += 1))

    const now = Date.now()
    const stale = jobs
      .filter((job) => ACTIVE_STATUSES.includes(job.status))
      .map((job) => ({
        id: job.id,
        company: job.company,
        role: job.role,
        status: job.status,
        daysSinceUpdate: Math.floor((now - Date.parse(job.updatedAt)) / 86_400_000),
      }))
      .filter((job) => job.daysSinceUpdate >= staleDays)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

    const companies = new Map(jobs.map((job) => [job.id, job.company]))
    return {
      total: jobs.length,
      starred: jobs.filter((job) => job.starred).length,
      byStatus,
      stale,
      recentActivity: this.activity({ limit: 10 }).map((entry) => ({ ...entry, company: companies.get(entry.jobId) ?? null })),
    }
  }

  /**
   * Bulk-imports full application records (browser-storage migration, sample data),
   * keeping their ids and timestamps. Ids that already exist are skipped: the
   * database is the source of truth.
   */
  importJobs(
    jobs: LegacyJob[],
    actor: ActivityActor,
    summaryPrefix: string
  ): { imported: number; skipped: number } {
    let imported = 0
    for (const legacy of jobs) {
      if (this.exists(legacy.id)) continue
      const job = normalizeInput(legacy)
      job.createdAt = legacy.createdAt || job.createdAt
      job.updatedAt = legacy.updatedAt || job.createdAt
      this.transaction(() => {
        this.insert(job)
        this.log(job.id, actor, 'imported', `${summaryPrefix}: ${job.company} · ${job.role}`)
      })
      const pdf = legacy.resume?.pdfDataUrl && decodeDataUrl(legacy.resume.pdfDataUrl)
      if (pdf && isPdf(pdf)) {
        mkdirSync(this.resumeDir, { recursive: true })
        writeFileSync(this.resumeFile(job.id), pdf)
        const uploadedAt = Date.parse(legacy.resume?.uploadedAt ?? '')
        this.transaction(() => {
          this.db
            .prepare('UPDATE jobs SET resume_name = ?, resume_file = ?, resume_uploaded_at = ? WHERE id = ?')
            .run(
              legacy.resume?.name || 'Resume.pdf',
              path.basename(this.resumeFile(job.id)),
              new Date(Number.isNaN(uploadedAt) ? Date.now() : uploadedAt).toISOString(),
              job.id
            )
          this.bumpRevision()
        })
      }
      imported += 1
    }
    return { imported, skipped: jobs.length - imported }
  }

  private resumeFile(id: string): string {
    return path.join(this.resumeDir, `${encodeURIComponent(id)}.pdf`)
  }

  private exists(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id) !== undefined
  }

  private insert(job: JobApplication): void {
    this.db
      .prepare(
        `INSERT INTO jobs (company, role, status, applied_date, salary_min, salary_max, url, raw_description, notes,
           starred, extracted_metadata, id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...jobColumns(job), job.id, job.createdAt, job.updatedAt)
    this.replaceQA(job.id, job.qaList)
  }

  private loadQA(jobId?: string): Map<string, JobQA[]> {
    const rows = (
      jobId
        ? this.db.prepare('SELECT * FROM job_qa WHERE job_id = ? ORDER BY position').all(jobId)
        : this.db.prepare('SELECT * FROM job_qa ORDER BY job_id, position').all()
    ) as unknown as { id: string; job_id: string; question: string; answer: string }[]
    const byJob = new Map<string, JobQA[]>()
    for (const row of rows) {
      const list = byJob.get(row.job_id) ?? []
      list.push({ id: row.id, question: row.question, answer: row.answer })
      byJob.set(row.job_id, list)
    }
    return byJob
  }

  private replaceQA(jobId: string, qaList: JobQA[]): void {
    this.db.prepare('DELETE FROM job_qa WHERE job_id = ?').run(jobId)
    const insert = this.db.prepare('INSERT INTO job_qa (id, job_id, position, question, answer) VALUES (?, ?, ?, ?, ?)')
    qaList.forEach((qa, index) => insert.run(qa.id || `qa-${randomUUID()}`, jobId, index, qa.question, qa.answer))
  }

  private touch(id: string): void {
    this.db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  }

  private log(jobId: string, actor: ActivityActor, action: ActivityAction, summary: string): void {
    this.db
      .prepare('INSERT INTO activity (job_id, actor, action, summary, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(jobId, actor, action, summary, new Date().toISOString())
    this.bumpRevision()
  }

  /** Records field edits, folding them into the previous entry when the same actor keeps editing. */
  private logEdit(jobId: string, actor: ActivityActor, fields: string[]): void {
    const last = this.db.prepare('SELECT * FROM activity WHERE job_id = ? ORDER BY id DESC LIMIT 1').get(jobId) as
      | ActivityRow
      | undefined
    const now = new Date()
    if (
      last &&
      last.actor === actor &&
      last.action === 'updated' &&
      last.summary.startsWith('Edited ') &&
      now.getTime() - Date.parse(last.created_at) < EDIT_COALESCE_MS
    ) {
      const merged = [...new Set([...last.summary.slice('Edited '.length).split(', '), ...fields])]
      this.db
        .prepare('UPDATE activity SET summary = ?, created_at = ? WHERE id = ?')
        .run(`Edited ${merged.join(', ')}`, now.toISOString(), last.id)
      this.bumpRevision()
      return
    }
    this.log(jobId, actor, 'updated', `Edited ${fields.join(', ')}`)
  }

  private bumpRevision(): void {
    this.db.prepare(`UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'revision'`).run()
  }

  private transaction<T>(fn: () => T): T {
    if (this.db.isTransaction) return fn()
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}

function toJob(row: JobRow, qaList: JobQA[]): JobApplication {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    appliedDate: row.applied_date,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    url: row.url ?? undefined,
    rawDescription: row.raw_description,
    notes: row.notes,
    starred: row.starred === 1,
    extractedMetadata: row.extracted_metadata ? (JSON.parse(row.extracted_metadata) as ExtractedMetadata) : undefined,
    resume: row.resume_name && row.resume_uploaded_at ? { name: row.resume_name, uploadedAt: row.resume_uploaded_at } : undefined,
    qaList,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toActivity(row: ActivityRow): JobActivity {
  return {
    id: row.id,
    jobId: row.job_id,
    actor: row.actor,
    action: row.action,
    summary: row.summary,
    createdAt: row.created_at,
  }
}

/** Column values in the order shared by the INSERT and UPDATE statements. */
function jobColumns(job: JobApplication): SQLInputValue[] {
  return [
    job.company,
    job.role,
    job.status,
    job.appliedDate,
    job.salaryMin ?? null,
    job.salaryMax ?? null,
    job.url ?? null,
    job.rawDescription ?? '',
    job.notes,
    job.starred ? 1 : 0,
    job.extractedMetadata ? JSON.stringify(job.extractedMetadata) : null,
  ]
}

function normalizeInput(input: JobInput): JobApplication {
  const now = new Date().toISOString()
  const base: JobApplication = {
    id: input.id?.trim() || `job-${randomUUID()}`,
    company: '',
    role: '',
    status: 'not_applied',
    appliedDate: getTodayDateString(),
    notes: '',
    qaList: [],
    starred: false,
    rawDescription: '',
    createdAt: now,
    updatedAt: now,
  }
  const job = applyPatch(base, input)
  return { ...job, company: job.company.trim(), role: job.role.trim(), notes: job.notes.trim() }
}

/** Applies and validates a patch. When a description arrives without parsed metadata, it is parsed here. */
function applyPatch(current: JobApplication, patch: JobPatch): JobApplication {
  const next: JobApplication = { ...current }
  // Only editable fields are copied, so callers can pass whole job objects without overwriting ids or timestamps.
  for (const key of Object.keys(FIELD_LABELS) as (keyof JobPatch)[]) {
    const value = patch[key]
    if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value ?? undefined
  }

  // Text is stored as typed (the dashboard autosaves mid-keystroke); only emptiness is checked.
  next.company ??= ''
  next.role ??= ''
  next.notes ??= ''
  next.qaList = (next.qaList ?? []).map((qa) => ({ ...qa, id: qa.id || `qa-${randomUUID()}` }))
  next.url = next.url?.trim() || undefined

  if (!next.company.trim()) throw new ValidationError('Company is required')
  if (!next.role.trim()) throw new ValidationError('Role is required')
  if (!JOB_STATUSES.includes(next.status)) {
    throw new ValidationError(`Status must be one of: ${JOB_STATUSES.join(', ')}`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.appliedDate)) throw new ValidationError('Applied date must be YYYY-MM-DD')
  for (const salary of [next.salaryMin, next.salaryMax]) {
    if (salary !== undefined && (!Number.isFinite(salary) || salary < 0)) {
      throw new ValidationError('Salary must be a non-negative number')
    }
  }

  const descriptionChanged = patch.rawDescription !== undefined && patch.rawDescription !== current.rawDescription
  if (descriptionChanged && patch.extractedMetadata === undefined) {
    const parsed = parseRawJobDescription(next.rawDescription ?? '')
    next.extractedMetadata = parsed.extractedMetadata
    if (patch.salaryMin === undefined && next.salaryMin === undefined) next.salaryMin = parsed.salaryMin
    if (patch.salaryMax === undefined && next.salaryMax === undefined) next.salaryMax = parsed.salaryMax
  }
  return next
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && Buffer.from(bytes.subarray(0, 5)).toString('latin1') === '%PDF-'
}

function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:[^;,]*;base64,(.*)$/s.exec(dataUrl)
  return match ? Buffer.from(match[1], 'base64') : null
}

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { openDatabase, resolveDataDir } from './db.ts'
import { JOB_STATUSES, JobStore } from './jobs.ts'
import type { JobApplication } from '../src/types/job.ts'

const store = new JobStore(openDatabase(), resolveDataDir())

const server = new McpServer(
  { name: 'life-os', version: '0.1.0' },
  {
    instructions:
      'Life OS tracks the user\'s job applications; the same data is shown in their Life OS dashboard. ' +
      'Use list_jobs or pipeline_summary to orient, get_job for full details. Every change you make is recorded ' +
      'in the application\'s activity log as made by an agent. Status "not_applied" is shown to the user as "Saved".',
  }
)

const status = z
  .enum(JOB_STATUSES)
  .describe('not_applied = saved but not yet applied (shown as "Saved"), then applied → screening → interviewing → offer; rejected/withdrawn close it')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const salary = z.number().int().nonnegative()

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] })

/** Compact row for listings: enough to pick an application without dumping descriptions. */
const listRow = (job: JobApplication) => ({
  id: job.id,
  company: job.company,
  role: job.role,
  status: job.status,
  appliedDate: job.appliedDate,
  starred: Boolean(job.starred),
  salary: job.salaryMin || job.salaryMax ? [job.salaryMin ?? null, job.salaryMax ?? null] : null,
  hasDescription: Boolean(job.rawDescription),
  responses: job.qaList.length,
  resume: job.resume?.name ?? null,
  updatedAt: job.updatedAt,
})

server.registerTool(
  'list_jobs',
  {
    title: 'List job applications',
    description: 'List applications, newest applied first. Filters combine; query matches company, role, notes, description, and Q&A.',
    inputSchema: {
      status: status.optional(),
      starred: z.boolean().optional(),
      query: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    annotations: { readOnlyHint: true },
  },
  ({ status, starred, query, limit }) => {
    const jobs = store.list({ status, starred, query })
    return json({ total: jobs.length, jobs: jobs.slice(0, limit).map(listRow) })
  }
)

server.registerTool(
  'get_job',
  {
    title: 'Get a job application',
    description: 'Full application: description, parsed metadata, notes, interview Q&A, resume, and recent activity.',
    inputSchema: { id: z.string() },
    annotations: { readOnlyHint: true },
  },
  ({ id }) => json({ ...store.get(id), activity: store.activity({ jobId: id, limit: 20 }) })
)

server.registerTool(
  'add_job',
  {
    title: 'Add a job application',
    description:
      'Create an application. Pass the full job posting text as `description`: salary range, experience level, and tech stack are extracted from it automatically. Check list_jobs first to avoid duplicates.',
    inputSchema: {
      company: z.string().min(1),
      role: z.string().min(1),
      status: status.default('not_applied'),
      appliedDate: date.optional().describe('YYYY-MM-DD; defaults to today'),
      url: z.string().url().optional(),
      description: z.string().optional().describe('Raw job posting text'),
      notes: z.string().optional(),
      salaryMin: salary.optional(),
      salaryMax: salary.optional(),
      starred: z.boolean().optional(),
    },
  },
  ({ description, ...input }) => json(store.create({ ...input, rawDescription: description }, 'agent'))
)

server.registerTool(
  'update_job',
  {
    title: 'Update a job application',
    description:
      'Change fields of an application; omitted fields are left as they are. Pass null to clear url or salary. Replacing `notes` overwrites them: use append_note to add to them.',
    inputSchema: {
      id: z.string(),
      company: z.string().min(1).optional(),
      role: z.string().min(1).optional(),
      status: status.optional(),
      appliedDate: date.optional(),
      url: z.string().url().nullable().optional(),
      description: z.string().optional().describe('Replaces the job posting text and re-extracts metadata'),
      notes: z.string().optional(),
      salaryMin: salary.nullable().optional(),
      salaryMax: salary.nullable().optional(),
      starred: z.boolean().optional(),
    },
    annotations: { idempotentHint: true },
  },
  ({ id, description, ...patch }) => json(store.update(id, { ...patch, rawDescription: description }, 'agent'))
)

server.registerTool(
  'append_note',
  {
    title: 'Append a note',
    description: 'Add a dated line to an application\'s notes without touching existing notes (recruiter calls, follow-ups, next steps).',
    inputSchema: { id: z.string(), text: z.string().min(1) },
  },
  ({ id, text }) => {
    const job = store.get(id)
    const entry = `[${new Date().toISOString().slice(0, 10)}] ${text.trim()}`
    return json(store.update(id, { notes: job.notes.trim() ? `${job.notes.trim()}\n\n${entry}` : entry }, 'agent'))
  }
)

server.registerTool(
  'add_interview_answer',
  {
    title: 'Add an interview Q&A',
    description: 'Save a question and the user\'s prepared answer to an application (e.g. "Why this company?").',
    inputSchema: { id: z.string().describe('Application id'), question: z.string().min(1), answer: z.string() },
  },
  ({ id, question, answer }) => json(store.addAnswer(id, question, answer, 'agent'))
)

server.registerTool(
  'attach_resume',
  {
    title: 'Attach a resume PDF',
    description: 'Copy a PDF from the local filesystem onto an application, replacing any resume already attached.',
    inputSchema: {
      id: z.string().describe('Application id'),
      pdfPath: z.string().describe('Absolute path to the PDF; ~ is expanded'),
    },
    annotations: { idempotentHint: true },
  },
  ({ id, pdfPath }) => {
    const resolved = path.resolve(pdfPath.replace(/^~(?=$|\/)/, homedir()))
    return json(store.attachResume(id, path.basename(resolved), readFileSync(resolved), 'agent'))
  }
)

server.registerTool(
  'delete_job',
  {
    title: 'Delete a job application',
    description: 'Permanently delete an application, its Q&A, and its resume. Confirm with the user first; prefer status "withdrawn" or "rejected" to close one.',
    inputSchema: { id: z.string() },
    annotations: { destructiveHint: true },
  },
  ({ id }) => {
    const job = store.get(id)
    store.delete(id, 'agent')
    return json({ deleted: { id, company: job.company, role: job.role } })
  }
)

server.registerTool(
  'pipeline_summary',
  {
    title: 'Pipeline summary',
    description:
      'Counts by status, applications with no updates for `staleDays` that may need a follow-up, and the latest activity across all applications.',
    inputSchema: { staleDays: z.number().int().min(1).default(14) },
    annotations: { readOnlyHint: true },
  },
  ({ staleDays }) => json(store.summary(staleDays))
)

server.registerResource(
  'pipeline',
  'life-os://pipeline',
  {
    title: 'Job pipeline',
    description: 'Counts by status, stale applications, and recent activity.',
    mimeType: 'application/json',
  },
  (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(store.summary(), null, 2) }] })
)

await server.connect(new StdioServerTransport())

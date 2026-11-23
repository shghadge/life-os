import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db.ts'
import { JobStore } from './jobs.ts'

let dataDir: string
let store: JobStore

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'life-os-test-'))
  store = new JobStore(openDatabase(dataDir), dataDir)
})

afterEach(() => rmSync(dataDir, { recursive: true, force: true }))

describe('JobStore', () => {
  it('collapses consecutive edits by one actor but keeps status changes and other actors separate', () => {
    const job = store.create({ company: 'Acme', role: 'Engineer', status: 'applied' }, 'dashboard')
    store.update(job.id, { notes: 'a' }, 'dashboard')
    store.update(job.id, { notes: 'ab', url: 'https://acme.dev' }, 'dashboard')
    store.update(job.id, { status: 'interviewing' }, 'agent')
    store.update(job.id, { notes: 'abc' }, 'agent')

    expect(store.activity({ jobId: job.id }).map((entry) => `${entry.actor}: ${entry.summary}`)).toEqual([
      'agent: Edited notes',
      'agent: Status: Applied → Interviewing',
      'dashboard: Edited notes, URL',
      'dashboard: Added Acme · Engineer',
    ])
  })

  it('bumps the revision on every write so pollers see agent changes', () => {
    const before = store.revision()
    const job = store.create({ company: 'Acme', role: 'Engineer' }, 'agent')
    store.update(job.id, { notes: 'x' }, 'agent')
    store.update(job.id, { notes: 'xy' }, 'agent') // coalesced into the previous entry, still a write
    expect(store.revision()).toBe(before + 3)
  })

  it('parses a new description, filling salary only where none was set', () => {
    const description = 'Stack: Go and Kubernetes. Salary: $150,000 - $180,000.'
    const parsed = store.create({ company: 'Acme', role: 'Engineer', rawDescription: description }, 'agent')
    expect(parsed.extractedMetadata?.techStack).toEqual(expect.arrayContaining(['Go', 'Kubernetes']))
    expect([parsed.salaryMin, parsed.salaryMax]).toEqual([150000, 180000])

    const explicit = store.create({ company: 'Beta', role: 'Engineer', salaryMin: 200000, rawDescription: description }, 'agent')
    expect(explicit.salaryMin).toBe(200000)
  })

  it('clears optional fields with null and ignores non-editable fields', () => {
    const job = store.create({ company: 'Acme', role: 'Engineer', salaryMin: 100, url: 'https://acme.dev' }, 'dashboard')
    const updated = store.update(
      job.id,
      { salaryMin: null, url: null, ...({ id: 'hijack', createdAt: '2000-01-01T00:00:00.000Z' } as object) },
      'dashboard'
    )
    expect(updated).toMatchObject({ id: job.id, createdAt: job.createdAt, salaryMin: undefined, url: undefined })
  })

  it('imports browser-storage jobs once, keeping ids, timestamps, and resume PDFs', () => {
    const pdf = Buffer.from('%PDF-1.4\n%legacy\n')
    const legacy = {
      id: 'legacy-1',
      company: 'OldCo',
      role: 'Engineer',
      status: 'applied' as const,
      appliedDate: '2026-07-01',
      notes: '',
      qaList: [{ id: 'qa-1', question: 'Why?', answer: 'Because.' }],
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-02T10:00:00.000Z',
      resume: { name: 'old.pdf', pdfDataUrl: `data:application/pdf;base64,${pdf.toString('base64')}` },
    }

    expect(store.importJobs([legacy], 'dashboard', 'Imported')).toEqual({ imported: 1, skipped: 0 })
    expect(store.importJobs([legacy], 'dashboard', 'Imported')).toEqual({ imported: 0, skipped: 1 })

    const job = store.get('legacy-1')
    expect(job).toMatchObject({ createdAt: legacy.createdAt, updatedAt: legacy.updatedAt, qaList: legacy.qaList })
    expect(readFileSync(store.resume('legacy-1').path)).toEqual(pdf)
  })
})

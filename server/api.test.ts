import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createApiHandler } from './api.ts'
import { openDatabase } from './db.ts'
import { JobStore } from './jobs.ts'

let dataDir: string
let store: JobStore
let server: Server
let baseUrl: string

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'life-os-api-test-'))
  store = new JobStore(openDatabase(dataDir), dataDir)
  const handler = createApiHandler(store)
  server = createServer((req, res) => handler(req, res, () => res.writeHead(404).end()))
  server.listen(0, 'localhost')
  await once(server, 'listening')
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  server.close()
  await once(server, 'close')
  rmSync(dataDir, { recursive: true, force: true })
})

it('a dashboard save of one field keeps fields an agent changed meanwhile', async () => {
  const job = store.create(
    { company: 'Stripe', role: 'Engineer', status: 'applied', salaryMin: 150000, url: 'https://stripe.com/jobs/1' },
    'dashboard'
  )
  store.update(job.id, { status: 'interviewing' }, 'agent')

  const response = await fetch(`${baseUrl}/api/jobs/${job.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Recruiter call on Friday' }),
  })

  expect(response.status).toBe(200)
  expect(store.get(job.id)).toMatchObject({
    status: 'interviewing',
    notes: 'Recruiter call on Friday',
    salaryMin: 150000,
    url: 'https://stripe.com/jobs/1',
  })
})

it('a missing resume file does not crash the server', async () => {
  const job = store.create({ company: 'Stripe', role: 'Engineer' }, 'dashboard')
  store.attachResume(job.id, 'resume.pdf', Buffer.from('%PDF-1.4\n'), 'dashboard')
  rmSync(path.join(dataDir, 'resumes'), { recursive: true, force: true })

  await expect(fetch(`${baseUrl}/api/jobs/${job.id}/resume`).then((r) => r.arrayBuffer())).rejects.toThrow()
  expect((await fetch(`${baseUrl}/api/revision`)).status).toBe(200)
})

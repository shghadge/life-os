import { createReadStream } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { openDatabase, resolveDataDir } from './db.ts'
import { JobStore, NotFoundError, ValidationError, type LegacyJob } from './jobs.ts'
import type { JobInput, JobPatch } from '../src/types/job.ts'

const MAX_BODY_BYTES = 25 * 1024 * 1024

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

/** Serves the dashboard's JSON API under /api from the same Vite process (dev and preview). */
export function lifeOsApi(): Plugin {
  let handler: Handler | undefined
  const getHandler = () => (handler ??= createApiHandler(new JobStore(openDatabase(), resolveDataDir())))
  return {
    name: 'life-os-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => getHandler()(req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => getHandler()(req, res, next))
    },
  }
}

export function createApiHandler(store: JobStore): Handler {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return next()

    // Local-only API: reject DNS-rebinding hosts, and require JSON content type so
    // cross-site "simple" form posts cannot write data.
    const host = (req.headers.host ?? '').replace(/:\d+$/, '')
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
      return sendJson(res, 403, { error: 'The Life OS API only accepts requests to localhost' })
    }

    route(store, req, res, url).catch((error: unknown) => {
      const status = error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500
      if (status === 500) console.error('[life-os api]', error)
      sendJson(res, status, { error: error instanceof Error ? error.message : String(error) })
    })
  }
}

async function route(store: JobStore, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? 'GET'
  const [, , resource, rawId, sub] = url.pathname.split('/')
  const id = rawId ? decodeURIComponent(rawId) : undefined

  if (resource === 'revision' && method === 'GET') {
    return sendJson(res, 200, { revision: store.revision() })
  }

  if (resource === 'import' && rawId === 'browser' && method === 'POST') {
    const jobs = (await readJson(req)) as LegacyJob[]
    if (!Array.isArray(jobs)) throw new ValidationError('Expected an array of applications')
    const result = store.importJobs(jobs, 'dashboard', 'Imported from browser storage')
    return sendJson(res, 200, { ...result, revision: store.revision() })
  }

  if (resource !== 'jobs') throw new NotFoundError(`Unknown endpoint ${url.pathname}`)

  if (!id) {
    if (method === 'GET') return sendJson(res, 200, { jobs: store.list(), revision: store.revision() })
    if (method === 'POST') {
      const job = store.create((await readJson(req)) as JobInput, 'dashboard')
      return sendJson(res, 201, { job, revision: store.revision() })
    }
  } else if (!sub) {
    if (method === 'GET') return sendJson(res, 200, { job: store.get(id) })
    if (method === 'PUT') {
      const job = store.update(id, (await readJson(req)) as JobPatch, 'dashboard')
      return sendJson(res, 200, { job, revision: store.revision() })
    }
    if (method === 'DELETE') {
      store.delete(id, 'dashboard')
      return sendJson(res, 200, { revision: store.revision() })
    }
  } else if (sub === 'activity' && method === 'GET') {
    return sendJson(res, 200, { activity: store.activity({ jobId: id }) })
  } else if (sub === 'resume') {
    if (method === 'GET') {
      const resume = store.resume(id)
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(resume.name)}`,
        'Cache-Control': 'no-store',
      })
      // A missing file would otherwise throw an unhandled stream error and stop the server.
      createReadStream(resume.path).on('error', () => res.destroy()).pipe(res)
      return
    }
    if (method === 'PUT') {
      const fileName = decodeURIComponent(String(req.headers['x-file-name'] ?? 'Resume.pdf'))
      const job = store.attachResume(id, fileName, await readBody(req), 'dashboard')
      return sendJson(res, 200, { job, revision: store.revision() })
    }
    if (method === 'DELETE') {
      return sendJson(res, 200, { job: store.removeResume(id, 'dashboard'), revision: store.revision() })
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE')
  sendJson(res, 405, { error: `${method} not allowed on ${url.pathname}` })
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new ValidationError('Request body is too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new ValidationError('Content-Type must be application/json')
  }
  try {
    return JSON.parse((await readBody(req)).toString('utf8'))
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw new ValidationError('Request body must be valid JSON')
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

import type { JobActivity, JobApplication } from '@/types/job'

/** Key used by the browser-only version of the dashboard; migrated to the database once. */
export const LEGACY_JOBS_STORAGE_KEY = 'life_os_job_applications_v1'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, init)
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : ''
    throw new Error(message || `Request failed (${response.status})`)
  }
  // Response shapes come from our own server (server/api.ts), typed per endpoint below.
  return body as T
}

function sendJson<T>(path: string, method: string, body: unknown, keepalive = false): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  })
}

const jobPath = (id: string) => `/api/jobs/${encodeURIComponent(id)}`

type Revisioned<T> = T & { revision: number }

export const jobsApi = {
  list: () => request<Revisioned<{ jobs: JobApplication[] }>>('/api/jobs'),
  revision: () => request<{ revision: number }>('/api/revision'),
  create: (job: JobApplication) => sendJson<Revisioned<{ job: JobApplication }>>('/api/jobs', 'POST', job),
  /** Replaces the editable fields; `keepalive` lets the save finish while the page unloads. */
  update: (job: JobApplication, keepalive = false) =>
    sendJson<Revisioned<{ job: JobApplication }>>(jobPath(job.id), 'PUT', job, keepalive),
  remove: (id: string) => request<{ revision: number }>(jobPath(id), { method: 'DELETE' }),
  activity: (id: string) => request<{ activity: JobActivity[] }>(`${jobPath(id)}/activity`),
  resumeUrl: (id: string) => `${jobPath(id)}/resume`,
  uploadResume: (id: string, file: File) =>
    request<Revisioned<{ job: JobApplication }>>(`${jobPath(id)}/resume`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
    }),
  removeResume: (id: string) => request<Revisioned<{ job: JobApplication }>>(`${jobPath(id)}/resume`, { method: 'DELETE' }),
  importBrowserJobs: (jobs: unknown[]) =>
    sendJson<Revisioned<{ imported: number; skipped: number }>>('/api/import/browser', 'POST', jobs),
}

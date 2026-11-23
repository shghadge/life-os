import { useCallback, useEffect, useRef, useState } from 'react'
import { jobsApi, LEGACY_JOBS_STORAGE_KEY } from '@/lib/api'
import { JobApplication, JobPatch } from '@/types/job'

/** Typing in the detail panel autosaves after this pause. */
const SAVE_DEBOUNCE_MS = 500
/** How often to check whether an agent (or another tab) changed data. */
const POLL_INTERVAL_MS = 2000
const UNREACHABLE = "Can't reach the Life OS server. Is `npm run dev` running?"

/** Fields the dashboard may change; the Record type keeps this list in step with JobPatch. */
const EDITABLE_FIELDS = Object.keys({
  company: 1,
  role: 1,
  status: 1,
  appliedDate: 1,
  salaryMin: 1,
  salaryMax: 1,
  url: 1,
  rawDescription: 1,
  qaList: 1,
  notes: 1,
  starred: 1,
  extractedMetadata: 1,
} satisfies Record<keyof JobPatch, 1>) as (keyof JobPatch)[]

/** Local edits not yet confirmed by the server; `undefined` means the field was cleared. */
type FieldChanges = Partial<JobApplication>

/**
 * Job applications backed by the Life OS server. Edits apply locally at once and
 * save in the background; the server revision is polled so changes made by agents
 * through MCP show up live. Only the fields you changed are sent, and polled data
 * keeps those fields until they are saved, so an agent's edits to other fields of
 * the same application are neither overwritten nor hidden.
 */
export function useJobs() {
  const [jobs, setJobsState] = useState<JobApplication[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)

  /** Latest local list, readable synchronously so edits can be diffed against it. */
  const jobsRef = useRef<JobApplication[]>([])
  const pending = useRef(new Map<string, FieldChanges>())
  const inFlight = useRef(new Map<string, FieldChanges>())
  const deleting = useRef(new Set<string>())
  const timers = useRef(new Map<string, number>())
  const knownRevision = useRef<number | null>(null)
  const fetchSeq = useRef(0)

  const setJobs = useCallback((update: (current: JobApplication[]) => JobApplication[]) => {
    jobsRef.current = update(jobsRef.current)
    setJobsState(jobsRef.current)
  }, [])

  const refresh = useCallback(async () => {
    const seq = ++fetchSeq.current
    const snapshot = await jobsApi.list()
    if (seq !== fetchSeq.current) return
    knownRevision.current = snapshot.revision
    setRevision(snapshot.revision)
    setJobs(() =>
      snapshot.jobs
        .filter((job) => !deleting.current.has(job.id))
        .map((job) => ({ ...job, ...inFlight.current.get(job.id), ...pending.current.get(job.id) }))
    )
  }, [setJobs])

  const flush = useCallback((id: string, keepalive = false) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    if (inFlight.current.has(id)) return // re-flushed when the current save finishes
    const changes = pending.current.get(id)
    if (!changes) return

    pending.current.delete(id)
    inFlight.current.set(id, changes)
    const patch = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value ?? null])) as JobPatch
    jobsApi
      .update(id, patch, keepalive)
      .then(() => setError(null))
      .catch((err: Error) => {
        // Put the changes back (newer edits win) so the next save retries them.
        pending.current.set(id, { ...changes, ...pending.current.get(id) })
        const company = jobsRef.current.find((job) => job.id === id)?.company
        setError(`Couldn't save ${company || 'application'}: ${err.message}`)
      })
      .finally(() => {
        inFlight.current.delete(id)
        if (pending.current.has(id) && !timers.current.has(id)) {
          timers.current.set(id, window.setTimeout(() => flush(id), SAVE_DEBOUNCE_MS))
        }
      })
  }, [])

  // Initial load, migrating applications left in browser storage by the pre-database dashboard.
  useEffect(() => {
    const load = async () => {
      const legacy = localStorage.getItem(LEGACY_JOBS_STORAGE_KEY)
      if (legacy) {
        await jobsApi.importBrowserJobs(JSON.parse(legacy) as unknown[])
        localStorage.removeItem(LEGACY_JOBS_STORAGE_KEY)
      }
      await refresh()
    }
    load().catch((err: Error) => setError(`Couldn't load applications: ${err.message}`))
  }, [refresh])

  // Live updates: refetch when the server revision moves.
  useEffect(() => {
    const check = () => {
      if (document.hidden) return
      jobsApi
        .revision()
        .then(({ revision }) => {
          setError((current) => (current === UNREACHABLE ? null : current))
          return revision !== knownRevision.current ? refresh() : undefined
        })
        .catch(() => setError(UNREACHABLE))
    }
    const interval = window.setInterval(check, POLL_INTERVAL_MS)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
    }
  }, [refresh])

  // Save pending edits when the view unmounts or the page goes away.
  useEffect(() => {
    const flushAll = () => [...pending.current.keys()].forEach((id) => flush(id, true))
    window.addEventListener('pagehide', flushAll)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      flushAll()
    }
  }, [flush])

  const updateJob = useCallback(
    (job: JobApplication) => {
      const before = jobsRef.current.find((existing) => existing.id === job.id)
      const changes: FieldChanges = {}
      for (const key of EDITABLE_FIELDS) {
        if (!before || JSON.stringify(before[key]) !== JSON.stringify(job[key])) {
          Object.assign(changes, { [key]: job[key] })
        }
      }
      setJobs((current) => current.map((existing) => (existing.id === job.id ? job : existing)))
      if (Object.keys(changes).length === 0) return
      pending.current.set(job.id, { ...pending.current.get(job.id), ...changes })
      window.clearTimeout(timers.current.get(job.id))
      timers.current.set(job.id, window.setTimeout(() => flush(job.id), SAVE_DEBOUNCE_MS))
    },
    [flush, setJobs]
  )

  /** Creates the application (and uploads a resume picked while drafting); null if it failed. */
  const createJob = useCallback(
    async (job: JobApplication, resumeFile?: File | null) => {
      let saved: JobApplication
      try {
        saved = (await jobsApi.create(job)).job
      } catch (err) {
        setError(`Couldn't save application: ${err instanceof Error ? err.message : String(err)}`)
        return null
      }
      setJobs((current) => [saved, ...current.filter((existing) => existing.id !== saved.id)])
      setError(null)
      if (resumeFile) {
        jobsApi
          .uploadResume(saved.id, resumeFile)
          .then(({ job: withResume }) =>
            setJobs((current) =>
              current.map((existing) => (existing.id === saved.id ? { ...existing, resume: withResume.resume } : existing))
            )
          )
          .catch((err: Error) => setError(`Saved, but couldn't attach the resume: ${err.message}`))
      }
      return saved
    },
    [setJobs]
  )

  const deleteJob = useCallback(
    async (id: string) => {
      window.clearTimeout(timers.current.get(id))
      timers.current.delete(id)
      pending.current.delete(id)
      deleting.current.add(id)
      setJobs((current) => current.filter((job) => job.id !== id))
      try {
        await jobsApi.remove(id)
      } catch (err) {
        setError(`Couldn't delete application: ${err instanceof Error ? err.message : String(err)}`)
        await refresh()
      } finally {
        deleting.current.delete(id)
      }
    },
    [refresh, setJobs]
  )

  /** Resume changes touch only the resume field so unsaved edits to other fields survive. */
  const setResume = useCallback(
    (saved: JobApplication) => {
      setJobs((current) => current.map((job) => (job.id === saved.id ? { ...job, resume: saved.resume } : job)))
    },
    [setJobs]
  )

  const attachResume = useCallback(
    (id: string, file: File) =>
      jobsApi
        .uploadResume(id, file)
        .then(({ job }) => setResume(job))
        .catch((err: Error) => setError(`Couldn't attach resume: ${err.message}`)),
    [setResume]
  )

  const removeResume = useCallback(
    (id: string) =>
      jobsApi
        .removeResume(id)
        .then(({ job }) => setResume(job))
        .catch((err: Error) => setError(`Couldn't remove resume: ${err.message}`)),
    [setResume]
  )

  return {
    jobs,
    revision,
    error,
    dismissError: () => setError(null),
    updateJob,
    createJob,
    deleteJob,
    attachResume,
    removeResume,
  }
}

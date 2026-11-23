import { useCallback, useEffect, useRef, useState } from 'react'
import { jobsApi, LEGACY_JOBS_STORAGE_KEY } from '@/lib/api'
import { JobApplication } from '@/types/job'

/** Typing in the detail panel autosaves after this pause. */
const SAVE_DEBOUNCE_MS = 500
/** How often to check whether an agent (or another tab) changed data. */
const POLL_INTERVAL_MS = 2000
const UNREACHABLE = "Can't reach the Life OS server. Is `npm run dev` running?"

/**
 * Job applications backed by the Life OS server. Edits apply locally at once and
 * save in the background; the server revision is polled so changes made by agents
 * through MCP show up live. Jobs with unsaved or in-flight edits keep their local
 * version when server data is merged in, so polling never overwrites typing.
 */
export function useJobs() {
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const dirty = useRef(new Map<string, JobApplication>())
  const inFlight = useRef(new Set<string>())
  const deleting = useRef(new Set<string>())
  const timers = useRef(new Map<string, number>())
  const knownRevision = useRef<number | null>(null)
  const fetchSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++fetchSeq.current
    const snapshot = await jobsApi.list()
    if (seq !== fetchSeq.current) return
    knownRevision.current = snapshot.revision
    setRevision(snapshot.revision)
    setJobs((local) => {
      const localById = new Map(local.map((job) => [job.id, job]))
      return snapshot.jobs
        .filter((job) => !deleting.current.has(job.id))
        .map((job) =>
          dirty.current.has(job.id) || inFlight.current.has(job.id) ? localById.get(job.id) ?? job : job
        )
    })
  }, [])

  const flush = useCallback((id: string, keepalive = false) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    if (inFlight.current.has(id)) return // re-flushed when the current save finishes
    const job = dirty.current.get(id)
    if (!job) return

    dirty.current.delete(id)
    inFlight.current.add(id)
    jobsApi
      .update(job, keepalive)
      .then(() => setError(null))
      .catch((err: Error) => {
        // Keep the local version protected from polling until a later save succeeds.
        if (!dirty.current.has(id)) dirty.current.set(id, job)
        setError(`Couldn't save ${job.company || 'application'}: ${err.message}`)
      })
      .finally(() => {
        inFlight.current.delete(id)
        if (dirty.current.has(id) && !timers.current.has(id)) {
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
    const flushAll = () => [...dirty.current.keys()].forEach((id) => flush(id, true))
    window.addEventListener('pagehide', flushAll)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      flushAll()
    }
  }, [flush])

  const updateJob = useCallback(
    (job: JobApplication) => {
      setJobs((prev) => prev.map((existing) => (existing.id === job.id ? job : existing)))
      dirty.current.set(job.id, job)
      window.clearTimeout(timers.current.get(job.id))
      timers.current.set(job.id, window.setTimeout(() => flush(job.id), SAVE_DEBOUNCE_MS))
    },
    [flush]
  )

  /** Creates the application (and uploads a resume picked while drafting); null if it failed. */
  const createJob = useCallback(async (job: JobApplication, resumeFile?: File | null) => {
    let saved: JobApplication
    try {
      saved = (await jobsApi.create(job)).job
    } catch (err) {
      setError(`Couldn't save application: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
    setJobs((prev) => [saved, ...prev.filter((existing) => existing.id !== saved.id)])
    setError(null)
    if (resumeFile) {
      jobsApi
        .uploadResume(saved.id, resumeFile)
        .then(({ job: withResume }) =>
          setJobs((prev) => prev.map((existing) => (existing.id === saved.id ? { ...existing, resume: withResume.resume } : existing)))
        )
        .catch((err: Error) => setError(`Saved, but couldn't attach the resume: ${err.message}`))
    }
    return saved
  }, [])

  const deleteJob = useCallback(
    async (id: string) => {
      window.clearTimeout(timers.current.get(id))
      timers.current.delete(id)
      dirty.current.delete(id)
      deleting.current.add(id)
      setJobs((prev) => prev.filter((job) => job.id !== id))
      try {
        await jobsApi.remove(id)
      } catch (err) {
        setError(`Couldn't delete application: ${err instanceof Error ? err.message : String(err)}`)
        await refresh()
      } finally {
        deleting.current.delete(id)
      }
    },
    [refresh]
  )

  /** Resume changes touch only the resume field so unsaved edits to other fields survive. */
  const setResume = useCallback((saved: JobApplication) => {
    setJobs((prev) => prev.map((job) => (job.id === saved.id ? { ...job, resume: saved.resume } : job)))
  }, [])

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

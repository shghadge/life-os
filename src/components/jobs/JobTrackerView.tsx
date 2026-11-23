import React, { useState, useMemo, useEffect, useRef } from 'react'
import { JobApplication, JobFilters, JobStatus } from '@/types/job'
import { createNewJob, getUniqueCompanies, getUniqueRoles } from '@/lib/storage'
import { jobsApi } from '@/lib/api'
import { useJobs } from '@/lib/use-jobs'
import { X } from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { JobTable } from './JobTable'
import { JobDetailPanel } from './JobDetailPanel'
import { JobFilterBar } from './JobFilterBar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface JobTrackerViewProps {
  isStarredPreset: boolean
  selectedDateFilter: string | null
  onClearExternalFilters: () => void
  onUpdateCounts: (counts: { total: number; starred: number }) => void
  onJobsChange?: (jobs: JobApplication[]) => void
}

export const JobTrackerView: React.FC<JobTrackerViewProps> = ({
  isStarredPreset,
  selectedDateFilter,
  onClearExternalFilters,
  onUpdateCounts,
  onJobsChange,
}) => {
  const {
    jobs,
    revision,
    error,
    dismissError,
    updateJob,
    createJob,
    deleteJob,
    attachResume,
    removeResume,
  } = useJobs()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [draftJob, setDraftJob] = useState<JobApplication | null>(null)
  /** PDF picked while drafting; uploaded once the application is created. */
  const [draftResumeFile, setDraftResumeFile] = useState<File | null>(null)
  const draftResumeUrl = useMemo(() => (draftResumeFile ? URL.createObjectURL(draftResumeFile) : undefined), [draftResumeFile])
  useEffect(() => () => {
    if (draftResumeUrl) URL.revokeObjectURL(draftResumeUrl)
  }, [draftResumeUrl])
  const draftBaselineRef = useRef<string | null>(null)
  const [isDraftExitDialogOpen, setIsDraftExitDialogOpen] = useState(false)

  // Resizable detail panel width state
  const [detailWidth, setDetailWidth] = useState<number>(() => {
    const saved = localStorage.getItem('life_os_detail_width')
    return saved ? Math.max(440, Math.min(920, parseInt(saved, 10))) : 600
  })
  const [isDraggingDetail, setIsDraggingDetail] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const dragStartWidthRef = useRef<number>(600)

  // Search and filter state
  const [filters, setFilters] = useState<JobFilters>({
    search: '',
    statusFilter: 'all',
    starredOnly: isStarredPreset,
    sortBy: 'appliedDate',
    sortDirection: 'desc',
  })
  const draftHasChanges =
    draftJob !== null && JSON.stringify(draftJob) !== draftBaselineRef.current

  const requestCloseDraft = () => {
    if (!draftJob) return
    if (draftHasChanges) {
      setIsDraftExitDialogOpen(true)
    } else {
      draftBaselineRef.current = null
      setDraftJob(null)
      setDraftResumeFile(null)
    }
  }

  // Sync starred filter from preset props
  useEffect(() => {
    setFilters((prev) => ({ ...prev, starredOnly: isStarredPreset }))
  }, [isStarredPreset])

  // Sync parent counts whenever jobs change
  useEffect(() => {
    const counts = {
      total: jobs.length,
      starred: jobs.filter((j) => j.starred).length,
    }
    onUpdateCounts(counts)
    onJobsChange?.(jobs)
  }, [jobs])

  // Global hotkeys: N opens quick capture; Escape closes it without losing edits.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      const hasOpenOverlay =
        document.querySelector('[role="alertdialog"]') !== null ||
        document.querySelector('[data-radix-popper-content-wrapper]') !== null

      if (event.key === 'Escape' && hasOpenOverlay) return


      if (event.key === 'n' && !isInput && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        handleToggleQuickAdd()
      } else if (event.key === 'Escape' && draftJob) {
        event.preventDefault()
        requestCloseDraft()
      } else if (event.key === 'Escape' && !isInput) {
        setSelectedJobId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draftJob, draftHasChanges])

  // Dragging logic for Detail Panel resize
  const handleDetailDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingDetail(true)
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = detailWidth
  }

  useEffect(() => {
    if (!isDraggingDetail) return

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging left increases width, dragging right decreases width
      const deltaX = dragStartXRef.current - e.clientX
      const maxWidth = Math.max(520, window.innerWidth - 360)
      const newWidth = Math.max(440, Math.min(maxWidth, dragStartWidthRef.current + deltaX))
      setDetailWidth(newWidth)
      localStorage.setItem('life_os_detail_width', String(newWidth))
    }

    const handleMouseUp = () => {
      setIsDraggingDetail(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingDetail])

  // Get unique existing company names for suggestions
  const existingCompanies = useMemo(() => {
    return getUniqueCompanies(jobs)
  }, [jobs])

  // Get unique existing roles for suggestions
  const existingRoles = useMemo(() => {
    return getUniqueRoles(jobs)
  }, [jobs])

  const statusCounts = useMemo<Record<JobStatus, number>>(() => {
    const counts: Record<JobStatus, number> = {
      not_applied: 0,
      applied: 0,
      screening: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    }
    jobs.forEach((job) => {
      counts[job.status || 'not_applied'] += 1
    })
    return counts
  }, [jobs])

  // Toggle sorting from column headers
  const handleToggleSort = (field: 'company' | 'appliedDate' | 'status') => {
    setFilters((prev) => {
      if (prev.sortBy === field) {
        return {
          ...prev,
          sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
        }
      }
      return {
        ...prev,
        sortBy: field,
        sortDirection: field === 'company' || field === 'status' ? 'asc' : 'desc',
      }
    })
  }

  // Filtered and sorted jobs
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        // Date filter from mini calendar
        if (selectedDateFilter && job.appliedDate !== selectedDateFilter) {
          return false
        }

        if (filters.search.trim()) {
          const q = filters.search.toLowerCase()
          const matches =
            job.company.toLowerCase().includes(q) ||
            job.role.toLowerCase().includes(q) ||
            (job.status && job.status.toLowerCase().includes(q)) ||
            (job.notes && job.notes.toLowerCase().includes(q)) ||
            (job.rawDescription && job.rawDescription.toLowerCase().includes(q)) ||
            (job.qaList &&
              job.qaList.some(
                (qa) =>
                  qa.question.toLowerCase().includes(q) ||
                  qa.answer.toLowerCase().includes(q)
              ))
          if (!matches) return false
        }

        if (filters.statusFilter && filters.statusFilter !== 'all') {
          if (job.status !== filters.statusFilter) return false
        }

        if (filters.starredOnly && !job.starred) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const factor = filters.sortDirection === 'asc' ? 1 : -1

        if (filters.sortBy === 'company') {
          return a.company.localeCompare(b.company) * factor
        }

        if (filters.sortBy === 'status') {
          return (a.status || 'not_applied').localeCompare(b.status || 'not_applied') * factor
        }

        return (
          (new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime()) *
          factor
        )
      })
  }, [jobs, filters, selectedDateFilter])

  // Selected job
  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || null
  }, [jobs, selectedJobId])

  const isRightSidebarOpen = !!selectedJobId || !!draftJob

  // Update existing job
  const handleUpdateJob = (updatedJob: JobApplication) => {
    if (draftJob) {
      setDraftJob(updatedJob)
      return
    }
    updateJob({ ...updatedJob, updatedAt: new Date().toISOString() })
  }

  const handleDeleteJob = (jobId: string) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null)
    }
    void deleteJob(jobId)
  }

  const handleAttachResume = (file: File) => {
    if (draftJob) {
      setDraftResumeFile(file)
      setDraftJob({ ...draftJob, resume: { name: file.name, uploadedAt: new Date().toISOString() } })
    } else if (selectedJobId) {
      void attachResume(selectedJobId, file)
    }
  }

  const handleRemoveResume = () => {
    if (draftJob) {
      setDraftResumeFile(null)
      setDraftJob({ ...draftJob, resume: undefined })
    } else if (selectedJobId) {
      void removeResume(selectedJobId)
    }
  }

  const handleToggleQuickAdd = () => {
    if (draftJob) {
      requestCloseDraft()
      return
    }

    setSelectedJobId(null)
    const newDraft = createNewJob({
      company: '',
      role: '',
      status: 'not_applied',
      appliedDate: new Date().toISOString().split('T')[0],
      notes: '',
    })
    draftBaselineRef.current = JSON.stringify(newDraft)
    setDraftJob(newDraft)
  }

  // Save new job
  const handleSaveDraftJob = async (newJob: JobApplication) => {
    const savedJob = await createJob(newJob, draftResumeFile)
    if (!savedJob) return
    draftBaselineRef.current = null
    setIsDraftExitDialogOpen(false)
    setDraftJob(null)
    setDraftResumeFile(null)
    setSelectedJobId(savedJob.id)
  }

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.statusFilter !== 'all' ||
    filters.starredOnly ||
    selectedDateFilter !== null

  const handleClearFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
      statusFilter: 'all',
      starredOnly: false,
    }))
    onClearExternalFilters()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      {/* Header bar */}
      <AppHeader
        searchQuery={filters.search}
        onSearchChange={(q) => setFilters((prev) => ({ ...prev, search: q }))}
        onToggleQuickAdd={handleToggleQuickAdd}
        isQuickAddOpen={!!draftJob}
        totalCount={filteredJobs.length}
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={dismissError} aria-label="Dismiss error" className="rounded p-1 hover:bg-destructive/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <JobFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        statusCounts={statusCounts}
        totalMatches={filteredJobs.length}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Main Workspace (Split Master-Detail Layout) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Job Table */}
        <div
          className={`flex-1 overflow-y-auto transition-all duration-150 ${
            isRightSidebarOpen ? 'hidden md:block' : 'w-full'
          }`}
        >
          <JobTable
            jobs={filteredJobs}
            selectedJobId={selectedJobId}
            onSelectJob={(job) => {
              if (draftJob) {
                requestCloseDraft()
                return
              }
              setSelectedJobId(job.id)
            }}
            onUpdateJob={handleUpdateJob}
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            onToggleSort={handleToggleSort}
          />
        </div>

        {/* Draggable Divider between Table and Right Detail Panel */}
        {isRightSidebarOpen && (
          <div
            onMouseDown={handleDetailDragStart}
            onDoubleClick={() => {
              setDetailWidth(600)
              localStorage.setItem('life_os_detail_width', '600')
            }}
            className="hidden md:flex items-center justify-center w-2.5 -ml-1 -mr-1 z-30 cursor-col-resize group hover:bg-primary/20 active:bg-primary/40 transition-colors select-none shrink-0"
            title="Drag to resize detail panel (double-click to reset)"
          >
            <div className="w-0.5 h-12 rounded-full bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
          </div>
        )}

        {/* Right Sidebar: Unified JobDetailPanel with draggable width */}
        {draftJob && (
          <div
            style={{ width: detailWidth }}
            className="w-full md:max-w-[85vw] h-full z-10 shrink-0 shadow-lg md:shadow-none animate-in slide-in-from-right-4 duration-150"
          >
            <JobDetailPanel
              job={draftJob}
              isDraft={true}
              existingCompanies={existingCompanies}
              existingRoles={existingRoles}
              onUpdateJob={handleUpdateJob}
              onSaveNewJob={handleSaveDraftJob}
              onClose={requestCloseDraft}
              revision={revision}
              resumeUrl={draftResumeUrl}
              onAttachResume={handleAttachResume}
              onRemoveResume={handleRemoveResume}
            />
          </div>
        )}

        {!draftJob && selectedJob && (
          <div
            style={{ width: detailWidth }}
            className="w-full md:max-w-[85vw] h-full z-10 shrink-0 shadow-lg md:shadow-none animate-in slide-in-from-right-4 duration-150"
          >
            <JobDetailPanel
              job={selectedJob}
              isDraft={false}
              existingCompanies={existingCompanies}
              existingRoles={existingRoles}
              onUpdateJob={handleUpdateJob}
              onDeleteJob={handleDeleteJob}
              onClose={() => setSelectedJobId(null)}
              revision={revision}
              resumeUrl={selectedJob.resume ? `${jobsApi.resumeUrl(selectedJob.id)}?v=${encodeURIComponent(selectedJob.resume.uploadedAt)}` : undefined}
              onAttachResume={handleAttachResume}
              onRemoveResume={handleRemoveResume}
            />
          </div>
        )}
      </div>
      {draftJob && (
        <AlertDialog open={isDraftExitDialogOpen} onOpenChange={setIsDraftExitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save this application?</AlertDialogTitle>
              <AlertDialogDescription>
                {draftJob.company.trim() && draftJob.role.trim()
                  ? 'You changed this new application. Save it before closing, or discard the changes.'
                  : 'You changed this new application. Company and role are required before it can be saved.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDraftExitDialogOpen(false)}>
                Keep editing
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  draftBaselineRef.current = null
                  setIsDraftExitDialogOpen(false)
                  setDraftJob(null)
                  setDraftResumeFile(null)
                }}
              >
                Discard changes
              </AlertDialogAction>
              <AlertDialogAction
                disabled={!draftJob.company.trim() || !draftJob.role.trim()}
                onClick={() => handleSaveDraftJob(draftJob)}
              >
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

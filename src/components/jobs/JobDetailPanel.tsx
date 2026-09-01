import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ExternalLink,
  Star,
  Calendar,
  HelpCircle,
  Plus,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Building,
  Briefcase,
  Link as LinkIcon,
  DollarSign,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { JobApplication, JobQA, JobStatus } from '@/types/job'
import { STATUS_CONFIG } from '@/lib/status'
import { parseRawJobDescription } from '@/lib/jd-parser'
import { JobExpandedJDModal } from './JobExpandedJDModal'
import { ResumeAttachments } from '@/components/resume/ResumeAttachments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDate, formatDateTime, cn } from '@/lib/utils'

interface JobDetailPanelProps {
  job: JobApplication
  isDraft?: boolean
  existingCompanies: string[]
  existingRoles: string[]
  onUpdateJob: (updatedJob: JobApplication) => void
  onSaveNewJob?: (job: JobApplication) => void
  onDeleteJob?: (jobId: string) => void
  onClose: () => void
}

const COMMON_QUESTION_TEMPLATES = [
  'Why do you want to work at this company?',
  'Describe a complex technical challenge you solved recently.',
  'What are your compensation expectations?',
  'Why are you looking for a new opportunity?',
  'Tell us about a time you led an initiative end-to-end.',
]

const PIPELINE_STATUSES: JobStatus[] = ['not_applied', 'applied', 'screening', 'interviewing', 'offer']
const TERMINAL_STATUSES: JobStatus[] = ['rejected', 'withdrawn']

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
  job,
  isDraft = false,
  existingCompanies,
  existingRoles,
  onUpdateJob,
  onSaveNewJob,
  onDeleteJob,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'raw_jd' | 'qa'>('details')
  const [rawText, setRawText] = useState(job.rawDescription || '')
  const [isExpandedJDOpen, setIsExpandedJDOpen] = useState(false)
  const [copiedQAId, setCopiedQAId] = useState<string | null>(null)
  const [copiedJd, setCopiedJd] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ company?: string; role?: string }>({})

  // Company and Role autocomplete state
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false)
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState(-1)
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false)
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(-1)

  const companyInputRef = useRef<HTMLInputElement>(null)
  const roleInputRef = useRef<HTMLInputElement>(null)

  const currentStatus = STATUS_CONFIG[job.status || 'not_applied'] || STATUS_CONFIG.not_applied

  // Suggestions list
  const filteredCompanySuggestions = existingCompanies.filter(
    (c) =>
      job.company.trim().length > 0 &&
      c.toLowerCase().includes(job.company.toLowerCase()) &&
      c.toLowerCase() !== job.company.toLowerCase()
  )

  const filteredRoleSuggestions = existingRoles.filter(
    (r) =>
      job.role.trim().length > 0 &&
      r.toLowerCase().includes(job.role.toLowerCase()) &&
      r.toLowerCase() !== job.role.toLowerCase()
  )

  useEffect(() => {
    setRawText(job.rawDescription || '')
  }, [job.id, job.rawDescription])

  useEffect(() => {
    if (isDraft) {
      companyInputRef.current?.focus()
    }
  }, [isDraft])

  // Save handler with mandatory fields validation
  const handleSave = () => {
    const errors: { company?: string; role?: string } = {}
    if (!job.company.trim()) {
      errors.company = 'Company name is required'
    }
    if (!job.role.trim()) {
      errors.role = 'Role title is required'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      setActiveTab('details')
      if (errors.company) {
        companyInputRef.current?.focus()
      } else if (errors.role) {
        roleInputRef.current?.focus()
      }
      return
    }

    setValidationErrors({})
    onSaveNewJob?.(job)
  }

  // Fast keyboard tab switcher: Alt+1 / Alt+2 / Alt+3 and Save with Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        if (e.key === '1') setActiveTab('details')
        if (e.key === '2') setActiveTab('raw_jd')
        if (e.key === '3') setActiveTab('qa')
      } else if (
        isDraft &&
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter' &&
        onSaveNewJob
      ) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDraft, job, onSaveNewJob, handleSave])

  const handleFieldChange = <K extends keyof JobApplication>(key: K, value: JobApplication[K]) => {
    if (validationErrors[key as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [key]: undefined }))
    }
    onUpdateJob({
      ...job,
      [key]: value,
    })
  }

  // Parse raw text for metadata & auto extract
  const handleRawTextChange = (text: string) => {
    setRawText(text)
    if (text.trim().length > 30) {
      const parsed = parseRawJobDescription(text)
      const updates: Partial<JobApplication> = {
        rawDescription: text,
        extractedMetadata: parsed.extractedMetadata,
      }
      if (parsed.detectedCompany && !job.company) {
        updates.company = parsed.detectedCompany
        setValidationErrors((prev) => ({ ...prev, company: undefined }))
      }
      if (parsed.detectedRole && !job.role) {
        updates.role = parsed.detectedRole
        setValidationErrors((prev) => ({ ...prev, role: undefined }))
      }
      if (parsed.salaryMin && job.salaryMin === undefined) {
        updates.salaryMin = parsed.salaryMin
      }
      if (parsed.salaryMax && job.salaryMax === undefined) {
        updates.salaryMax = parsed.salaryMax
      }
      onUpdateJob({ ...job, ...updates })
    } else {
      handleFieldChange('rawDescription', text)
    }
  }

  const handleReparseRawText = () => {
    const parsed = parseRawJobDescription(rawText)
    onUpdateJob({
      ...job,
      rawDescription: rawText,
      extractedMetadata: parsed.extractedMetadata,
      salaryMin: job.salaryMin ?? parsed.salaryMin,
      salaryMax: job.salaryMax ?? parsed.salaryMax,
    })
  }

  const handleCopyJD = async () => {
    if (!rawText) return
    await navigator.clipboard.writeText(rawText)
    setCopiedJd(true)
    setTimeout(() => setCopiedJd(false), 2000)
  }


  // Company keyboard handler
  const handleCompanyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCompanySuggestions || filteredCompanySuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedCompanyIndex((prev) =>
        prev < filteredCompanySuggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedCompanyIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCompanySuggestions.length - 1
      )
    } else if (e.key === 'Enter' && selectedCompanyIndex >= 0) {
      e.preventDefault()
      handleFieldChange('company', filteredCompanySuggestions[selectedCompanyIndex])
      setShowCompanySuggestions(false)
      setSelectedCompanyIndex(-1)
      roleInputRef.current?.focus()
    }
  }

  // Role keyboard handler
  const handleRoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showRoleSuggestions || filteredRoleSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedRoleIndex((prev) =>
        prev < filteredRoleSuggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedRoleIndex((prev) =>
        prev > 0 ? prev - 1 : filteredRoleSuggestions.length - 1
      )
    } else if (e.key === 'Enter' && selectedRoleIndex >= 0) {
      e.preventDefault()
      handleFieldChange('role', filteredRoleSuggestions[selectedRoleIndex])
      setShowRoleSuggestions(false)
      setSelectedRoleIndex(-1)
    }
  }

  // Q&A Handlers
  const handleAddQA = (questionText: string = '') => {
    const newQA: JobQA = {
      id: `qa-${Date.now()}`,
      question: questionText || '',
      answer: '',
    }
    const updatedQA = [...(job.qaList || []), newQA]
    handleFieldChange('qaList', updatedQA)
  }

  const handleUpdateQA = (id: string, updates: Partial<JobQA>) => {
    const updated = (job.qaList || []).map((item) =>
      item.id === id ? { ...item, ...updates } : item
    )
    handleFieldChange('qaList', updated)
  }

  const handleDeleteQA = (id: string) => {
    const updated = (job.qaList || []).filter((item) => item.id !== id)
    handleFieldChange('qaList', updated)
  }

  const handleCopyQAAnswer = async (id: string, answerText: string) => {
    await navigator.clipboard.writeText(answerText)
    setCopiedQAId(id)
    setTimeout(() => setCopiedQAId(null), 2000)
  }


  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border bg-card text-sm font-sans">

      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {isDraft ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-heading text-lg font-semibold">
              +
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleFieldChange('starred', !job.starred)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500"
              aria-label={job.starred ? 'Remove from starred applications' : 'Add to starred applications'}
              title={job.starred ? 'Remove from starred applications' : 'Add to starred applications'}
            >
              <Star className={cn('h-4 w-4', job.starred ? 'fill-amber-400 text-amber-500' : '')} />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="truncate font-heading text-base font-semibold tracking-tight text-foreground">
                {job.company.trim() || 'New application'}
              </h2>
              {job.role.trim() && (
                <span className="truncate text-sm text-muted-foreground">{job.role}</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {isDraft ? (
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Draft</span>
              ) : (
                <span className={cn('inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium', currentStatus.badgeClass)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', currentStatus.dotClass)} />
                  {currentStatus.label}
                </span>
              )}
              <span>Applied {formatDate(job.appliedDate)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isDraft && onSaveNewJob && (
            <Button
              size="sm"
              onClick={handleSave}
              className="h-8 gap-1.5 px-3"
              title="Save (Ctrl+Enter)"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save</span>
              <kbd className="hidden rounded bg-primary-foreground/20 px-1 font-mono text-[10px] sm:inline">
                Ctrl+↵
              </kbd>
            </Button>
          )}

          {!isDraft && job.url && (
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open job description"
                title="Open job description"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          {!isDraft && onDeleteJob && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${job.company} application`}
                  title="Delete application"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {job.company}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the application, saved responses, job description, and resume files.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep application</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteJob(job.id)}>
                    Delete application
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Close application"
            title="Close application (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-b border-border bg-background/55 px-5">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
          <TabsList className="grid h-11 w-full grid-cols-3 gap-0 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="details"
              className="h-11 rounded-none border-b-2 border-transparent px-3 font-sans text-sm font-medium tracking-normal text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="raw_jd"
              className="h-11 rounded-none border-b-2 border-transparent px-3 font-sans text-sm font-medium tracking-normal text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Job Description
            </TabsTrigger>
            <TabsTrigger
              value="qa"
              className="h-11 rounded-none border-b-2 border-transparent px-3 font-sans text-sm font-medium tracking-normal text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Responses
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Tab Contents */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5 font-sans select-text">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Company with live suggestions */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Company Name <span className="text-destructive">*</span>
                </label>
                {validationErrors.company && (
                  <span className="flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.company}
                  </span>
                )}
              </div>
              <div className="relative">
                <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  ref={companyInputRef}
                  type="text"
                  value={job.company}
                  onChange={(e) => {
                    handleFieldChange('company', e.target.value)
                    setShowCompanySuggestions(true)
                  }}
                  onFocus={() => setShowCompanySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 200)}
                  onKeyDown={handleCompanyKeyDown}
                  placeholder="e.g. Stripe, Linear..."
                  className={cn(
                    "h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm font-semibold focus:outline-none focus:ring-2 font-sans",
                    validationErrors.company
                      ? "border-destructive focus:ring-destructive"
                      : "border-border focus:ring-ring"
                  )}
                  required
                />
              </div>

              {showCompanySuggestions && filteredCompanySuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border border-border bg-popover py-1 shadow-lg max-h-44 overflow-y-auto font-sans">
                  <div className="border-b border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Suggested companies
                  </div>
                  {filteredCompanySuggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      type="button"
                      onMouseDown={() => {
                        handleFieldChange('company', sug)
                        setShowCompanySuggestions(false)
                        setSelectedCompanyIndex(-1)
                        roleInputRef.current?.focus()
                      }}
                      className={cn(
                        'flex min-h-8 w-full items-center justify-between px-3 py-1.5 text-left text-sm cursor-pointer font-sans',
                        idx === selectedCompanyIndex
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'hover:bg-muted/60 text-foreground'
                      )}
                    >
                      <span>{sug}</span>
                      <span className="text-xs text-muted-foreground">Select ↵</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Role Title with live suggestions */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Role Title <span className="text-destructive">*</span>
                </label>
                {validationErrors.role && (
                  <span className="flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.role}
                  </span>
                )}
              </div>
              <div className="relative">
                <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  ref={roleInputRef}
                  type="text"
                  value={job.role}
                  onChange={(e) => {
                    handleFieldChange('role', e.target.value)
                    setShowRoleSuggestions(true)
                  }}
                  onFocus={() => setShowRoleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowRoleSuggestions(false), 200)}
                  onKeyDown={handleRoleKeyDown}
                  placeholder="e.g. Staff Frontend Engineer"
                  className={cn(
                    "h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm font-medium focus:outline-none focus:ring-2 font-sans",
                    validationErrors.role
                      ? "border-destructive focus:ring-destructive"
                      : "border-border focus:ring-ring"
                  )}
                  required
                />
              </div>

              {showRoleSuggestions && filteredRoleSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border border-border bg-popover py-1 shadow-lg max-h-44 overflow-y-auto font-sans">
                  <div className="border-b border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Suggested roles
                  </div>
                  {filteredRoleSuggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      type="button"
                      onMouseDown={() => {
                        handleFieldChange('role', sug)
                        setShowRoleSuggestions(false)
                        setSelectedRoleIndex(-1)
                      }}
                      className={cn(
                        'flex min-h-8 w-full items-center justify-between px-3 py-1.5 text-left text-sm cursor-pointer font-sans',
                        idx === selectedRoleIndex
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'hover:bg-muted/60 text-foreground'
                      )}
                    >
                      <span>{sug}</span>
                      <span className="text-xs text-muted-foreground">Select ↵</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Application stage
              </label>
              <div className="grid grid-cols-5 overflow-hidden rounded-md border border-border bg-background">
                {PIPELINE_STATUSES.map((status) => {
                  const config = STATUS_CONFIG[status]
                  const isSelected = (job.status || 'not_applied') === status
                  const label = status === 'offer' ? 'Offer' : config.label

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleFieldChange('status', status)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-8 items-center justify-center gap-1 border-r border-border px-1.5 text-[13px] font-medium transition-colors last:border-r-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', isSelected ? 'bg-primary-foreground' : config.dotClass)} />
                      <span className="truncate">{label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="mr-1 text-[13px] text-muted-foreground">Closed as</span>
                {TERMINAL_STATUSES.map((status) => {
                  const config = STATUS_CONFIG[status]
                  const isSelected = job.status === status
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleFieldChange('status', status)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-7 items-center gap-1.5 rounded-md border px-2 text-[13px] font-medium transition-colors',
                        isSelected
                          ? config.badgeClass
                          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClass)} />
                      {config.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <ResumeAttachments job={job} onUpdateJob={onUpdateJob} />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Salary range</label>
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">USD</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Minimum</span>
                  <span className="relative block">
                    <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      inputMode="numeric"
                      value={job.salaryMin ?? ''}
                      onChange={(event) =>
                        handleFieldChange(
                          'salaryMin',
                          event.target.value === '' ? undefined : event.target.valueAsNumber
                        )
                      }
                      placeholder="120000"
                      className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </span>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Maximum</span>
                  <span className="relative block">
                    <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      inputMode="numeric"
                      value={job.salaryMax ?? ''}
                      onChange={(event) =>
                        handleFieldChange(
                          'salaryMax',
                          event.target.value === '' ? undefined : event.target.valueAsNumber
                        )
                      }
                      placeholder="180000"
                      className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </span>
                </label>
              </div>
              {job.extractedMetadata?.salaryMentioned && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Detected in description: {job.extractedMetadata.salaryMentioned}
                </p>
              )}
            </div>

            {/* Job URL */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Job description URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type="url"
                  value={job.url || ''}
                  onChange={(e) => handleFieldChange('url', e.target.value)}
                  placeholder="https://..."
                  className="h-9 w-full truncate rounded-md border border-border bg-background pl-9 pr-9 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Open link"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Applied Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Applied date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                <input
                  type="date"
                  value={job.appliedDate || ''}
                  onChange={(e) => handleFieldChange('appliedDate', e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Personal Notes */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Notes
              </label>
              <textarea
                rows={5}
                value={job.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Capture recruiter updates, interview prep, and anything you need to remember…"
                className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring font-sans"
              />
            </div>

            {!isDraft && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                <span>
                  Created{' '}
                  <time dateTime={job.createdAt} className="text-foreground/75">
                    {formatDateTime(job.createdAt)}
                  </time>
                </span>
                <span>
                  Last edited{' '}
                  <time dateTime={job.updatedAt} className="text-foreground/75">
                    {formatDateTime(job.updatedAt)}
                  </time>
                </span>
              </div>
            )}
          </div>
        )}

        {/* RAW JOB DESCRIPTION TAB */}
        {activeTab === 'raw_jd' && (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  Job Description
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleCopyJD}
                  className="h-8 gap-1.5 text-sm"
                >
                  {copiedJd ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedJd ? 'Copied' : 'Copy'}</span>
                </Button>

                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setIsExpandedJDOpen(true)}
                  className="h-8 gap-1.5 text-sm font-medium text-primary"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Open reader</span>
                </Button>

                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleReparseRawText}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Extract details again"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Raw JD Textarea */}
            <textarea
              rows={12}
              value={rawText}
              onChange={(e) => handleRawTextChange(e.target.value)}
              placeholder="Paste the full job description here…"
              className="min-h-[240px] w-full resize-y rounded-md border border-border bg-background p-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {/* Detected Specifications Placed at the Bottom */}
            {job.extractedMetadata && (
              <div className="mt-1 space-y-3 rounded-lg border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-2 text-sm font-semibold text-foreground">
                  <div>
                    <span>Extracted details</span>
                  </div>
                  {job.extractedMetadata.salaryMentioned && (
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {job.extractedMetadata.salaryMentioned}
                    </span>
                  )}
                </div>

                {job.extractedMetadata.experienceLevel && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Experience:</span> {job.extractedMetadata.experienceLevel}
                  </div>
                )}

                {job.extractedMetadata.techStack.length > 0 && (
                  <div className="space-y-1">
                    <span className="block text-sm font-medium text-muted-foreground">Detected stack</span>
                    <div className="flex flex-wrap gap-1.5">
                      {job.extractedMetadata.techStack.map((tech) => (
                        <Badge key={tech} variant="subtle" className="text-xs font-sans">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* APPLICATION Q&A TAB */}
        {activeTab === 'qa' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground">Application responses</h3>
              </div>

              <Button
                size="xs"
                variant="outline"
                onClick={() => handleAddQA()}
                className="h-8 shrink-0 gap-1.5 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add response</span>
              </Button>
            </div>

            <details className="group rounded-md border border-border bg-muted/25">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Use a common question template
              </summary>
              <div className="flex flex-wrap gap-1.5 border-t border-border/50 p-3">
                {COMMON_QUESTION_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => handleAddQA(template)}
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </details>

            {/* Q&A Cards List */}
            {(!job.qaList || job.qaList.length === 0) ? (
              <div className="space-y-2 rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">
                <HelpCircle className="mx-auto h-7 w-7 text-muted-foreground/45" />
                <p className="text-sm">No responses captured yet.</p>
                <Button size="sm" variant="outline" onClick={() => handleAddQA()}>
                  Add first response
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {job.qaList.map((qa, index) => (
                  <div
                    key={qa.id}
                    className="group relative space-y-3 rounded-lg border border-border bg-background/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-primary">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        value={qa.question}
                        onChange={(e) => handleUpdateQA(qa.id, { question: e.target.value })}
                        placeholder="e.g. Why do you want to join us?"
                        className="flex-1 border-b border-transparent bg-transparent text-sm font-semibold hover:border-border focus:border-ring focus:outline-none font-sans"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyQAAnswer(qa.id, qa.answer)}
                          disabled={!qa.answer}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
                          title="Copy saved response"
                        >
                          {copiedQAId === qa.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQA(qa.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          title="Delete saved response"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={qa.answer}
                        onChange={(e) => handleUpdateQA(qa.id, { answer: e.target.value })}
                        placeholder="Write the response you submitted…"
                        className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring font-sans"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Expanded JD Reader Modal */}
      <JobExpandedJDModal
        job={job}
        isOpen={isExpandedJDOpen}
        onClose={() => setIsExpandedJDOpen(false)}
        onUpdateJob={onUpdateJob}
      />
    </div>
  )
}

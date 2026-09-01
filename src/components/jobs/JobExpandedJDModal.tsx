import React, { useState, useEffect } from 'react'
import {
  X,
  Copy,
  Check,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { JobApplication } from '@/types/job'
import { parseRawJobDescription } from '@/lib/jd-parser'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface JobExpandedJDModalProps {
  job: JobApplication
  isOpen: boolean
  onClose: () => void
  onUpdateJob: (job: JobApplication) => void
}

export const JobExpandedJDModal: React.FC<JobExpandedJDModalProps> = ({
  job,
  isOpen,
  onClose,
  onUpdateJob,
}) => {
  const [rawText, setRawText] = useState(job.rawDescription || '')
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setRawText(job.rawDescription || '')
  }, [job.rawDescription, isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopy = async () => {
    if (!rawText) return
    await navigator.clipboard.writeText(rawText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSaveText = () => {
    const parsed = parseRawJobDescription(rawText)
    onUpdateJob({
      ...job,
      rawDescription: rawText,
      extractedMetadata: parsed.extractedMetadata,
      salaryMin: job.salaryMin ?? parsed.salaryMin,
      salaryMax: job.salaryMax ?? parsed.salaryMax,
    })
    setIsEditing(false)
  }

  const handleReparse = () => {
    const parsed = parseRawJobDescription(rawText)
    onUpdateJob({
      ...job,
      rawDescription: rawText,
      extractedMetadata: parsed.extractedMetadata,
      salaryMin: job.salaryMin ?? parsed.salaryMin,
      salaryMax: job.salaryMax ?? parsed.salaryMax,
    })
  }

  const salaryRange =
    job.salaryMin !== undefined && job.salaryMax !== undefined
      ? `${formatCurrency(job.salaryMin)} – ${formatCurrency(job.salaryMax)}`
      : job.salaryMin !== undefined
        ? `From ${formatCurrency(job.salaryMin)}`
        : job.salaryMax !== undefined
          ? `Up to ${formatCurrency(job.salaryMax)}`
          : job.extractedMetadata?.salaryMentioned

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-3 font-sans backdrop-blur-sm sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${job.company} job description`}
        className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Job description
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {job.company}
                <span className="mx-1.5 text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">{job.role}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              onClick={handleCopy}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="xs"
              variant={isEditing ? 'default' : 'outline'}
              onClick={isEditing ? handleSaveText : () => setIsEditing(true)}
              className="h-8 px-3 text-xs font-medium"
            >
              {isEditing ? 'Save edits' : 'Edit'}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleReparse}
              title="Extract job details again"
              aria-label="Extract job details again"
              className="h-8 w-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onClose}
              aria-label="Close job description reader"
              title="Close (Esc)"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto bg-muted/15 px-4 py-6 select-text sm:px-8 sm:py-8">
            <article className="mx-auto min-h-full max-w-[46rem] border-x border-border/60 bg-background px-6 py-8 sm:px-10 sm:py-10">
              <header className="mb-8 border-b border-border pb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  {job.company}
                </p>
                <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {job.role}
                </h1>
              </header>

              {isEditing ? (
                <textarea
                  rows={25}
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder="Paste or edit the full job description…"
                  className="min-h-[34rem] w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                />
              ) : rawText ? (
                <div className="whitespace-pre-wrap font-serif text-[15px] leading-7 text-foreground/90">
                  {rawText}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No job description added</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose Edit to add the listing text.</p>
                </div>
              )}
            </article>
          </main>

          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-5 select-text lg:block">
            <h2 className="font-heading text-sm font-semibold text-foreground">Role brief</h2>

            <dl className="mt-4 divide-y divide-border/70 border-y border-border/70">
              {salaryRange && (
                <div className="py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Compensation
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{salaryRange}</dd>
                  <dd className="text-xs text-muted-foreground">USD</dd>
                </div>
              )}
              {job.extractedMetadata?.experienceLevel && (
                <div className="py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Experience
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">{job.extractedMetadata.experienceLevel}</dd>
                </div>
              )}
              {job.extractedMetadata && job.extractedMetadata.techStack.length > 0 && (
                <div className="py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Stack
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-foreground">
                    {job.extractedMetadata.techStack.join(' · ')}
                  </dd>
                </div>
              )}
            </dl>

            {job.extractedMetadata && job.extractedMetadata.keyRequirements.length > 0 && (
              <section className="mt-5">
                <h3 className="text-xs font-semibold text-foreground">Requirements</h3>
                <ul className="mt-2 space-y-2 border-l border-border pl-3 text-xs leading-5 text-muted-foreground">
                  {job.extractedMetadata.keyRequirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              </section>
            )}

            {job.extractedMetadata && job.extractedMetadata.responsibilities.length > 0 && (
              <section className="mt-5">
                <h3 className="text-xs font-semibold text-foreground">Responsibilities</h3>
                <ul className="mt-2 space-y-2 border-l border-border pl-3 text-xs leading-5 text-muted-foreground">
                  {job.extractedMetadata.responsibilities.map((responsibility) => (
                    <li key={responsibility}>{responsibility}</li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}

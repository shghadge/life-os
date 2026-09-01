import React, { useRef } from 'react'
import { Download, ExternalLink, FileText, Paperclip, Trash2 } from 'lucide-react'
import { JobApplication } from '@/types/job'
import { getFormattedDateTime } from '@/lib/storage'
import { Button } from '@/components/ui/button'
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

interface ResumeAttachmentsProps {
  job: JobApplication
  onUpdateJob: (updatedJob: JobApplication) => void
}

export const ResumeAttachments: React.FC<ResumeAttachmentsProps> = ({ job, onUpdateJob }) => {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const hasPdf = Boolean(job.resume?.pdfDataUrl)

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      onUpdateJob({
        ...job,
        resume: {
          name: file.name,
          pdfDataUrl: reader.result as string,
          uploadedAt: getFormattedDateTime(new Date()),
        },
      })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleRemovePdf = () => {
    onUpdateJob({
      ...job,
      resume: undefined,
    })
  }

  const handleViewPdf = async () => {
    if (!job.resume?.pdfDataUrl) return

    const pdfTab = window.open('about:blank', '_blank')
    if (!pdfTab) return
    pdfTab.opener = null

    const response = await fetch(job.resume.pdfDataUrl)
    const pdfUrl = URL.createObjectURL(await response.blob())
    pdfTab.location.replace(pdfUrl)
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 shadow-2xs">
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handlePdfUpload}
        className="hidden"
      />

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Resume</p>
          <p className="truncate text-sm text-muted-foreground">
            {hasPdf ? job.resume?.name || 'Resume.pdf' : 'No PDF attached'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {hasPdf && job.resume?.pdfDataUrl ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleViewPdf}
              aria-label={`View ${job.resume.name || 'resume PDF'} in a new tab`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5">
              <a href={job.resume.pdfDataUrl} download={job.resume.name || 'Resume.pdf'}>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => pdfInputRef.current?.click()}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Replace
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove attached PDF"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove the attached PDF?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can attach another PDF later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep PDF</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleRemovePdf}>
                    Remove PDF
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => pdfInputRef.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" />
            Attach PDF
          </Button>
        )}
      </div>
    </div>
  )
}

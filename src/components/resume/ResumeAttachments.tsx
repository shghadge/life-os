import React, { useRef } from 'react'
import { Download, ExternalLink, FileText, Paperclip, Trash2 } from 'lucide-react'
import { JobResume } from '@/types/job'
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
  resume?: JobResume
  /** Where the attached PDF can be opened or downloaded. */
  resumeUrl?: string
  onAttach: (file: File) => void
  onRemove: () => void
}

export const ResumeAttachments: React.FC<ResumeAttachmentsProps> = ({ resume, resumeUrl, onAttach, onRemove }) => {
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onAttach(file)
    event.target.value = ''
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
            {resume ? resume.name : 'No PDF attached'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {resume && resumeUrl ? (
          <>
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5">
              <a href={resumeUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${resume.name} in a new tab`}>
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5">
              <a href={resumeUrl} download={resume.name}>
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
                  <AlertDialogAction variant="destructive" onClick={onRemove}>
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

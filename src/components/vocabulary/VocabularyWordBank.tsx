import { Check, FileJson, Search, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { UserWordProgress, WordProfile } from '@/types/vocabulary'

interface VocabularyWordBankProps {
  words: WordProfile[]
  progress: UserWordProgress[]
  importMessage: { tone: 'success' | 'error'; text: string } | null
  onImport: (file: File) => void
  onActivate: (wordId: string) => void
  onDeactivate: (wordId: string) => void
}

export function VocabularyWordBank({
  words,
  progress,
  importMessage,
  onImport,
  onActivate,
  onDeactivate,
}: VocabularyWordBankProps) {
  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeIds = useMemo(
    () => new Set(progress.filter((entry) => entry.active).map((entry) => entry.wordId)),
    [progress],
  )
  const filteredWords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return words
    return words.filter((word) => (
      word.word.toLocaleLowerCase().includes(normalizedQuery)
      || word.simpleDefinition.toLocaleLowerCase().includes(normalizedQuery)
    ))
  }, [query, words])

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onImport(file)
          event.currentTarget.value = ''
        }}
      />

      <div className="flex min-h-12 flex-col justify-between gap-3 border-b border-border bg-card/45 px-5 py-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Word bank</span>
          <label className="relative block w-full sm:w-72 lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words or definitions…"
              aria-label="Search vocabulary"
              className="h-9 w-full rounded-md border border-input bg-background/80 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filteredWords.length} {filteredWords.length === 1 ? 'word' : 'words'} · {activeIds.size}/5 active
          </span>
          <Button onClick={() => fileInputRef.current?.click()} className="h-9 gap-2 px-3">
            <Upload className="h-4 w-4" />
            Import JSON
          </Button>
        </div>
      </div>

      {importMessage && (
        <div
          role={importMessage.tone === 'error' ? 'alert' : 'status'}
          className={importMessage.tone === 'error'
            ? 'mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
            : 'mx-5 mt-4 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground'}
        >
          {importMessage.text}
        </div>
      )}

      <div className="px-5 py-4">
        {words.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center border-b border-border/40 p-14 text-center text-muted-foreground">
            <FileJson className="mb-3 h-6 w-6" />
            <h2 className="font-heading text-base font-semibold text-foreground">No imported words</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              Import a JSON array of authored word profiles. If one profile is invalid, the entire batch is rejected.
            </p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-4">
              Choose JSON file
            </Button>
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center border-b border-border/40 p-14 text-center">
            <p className="font-heading text-base font-semibold text-foreground">No words in this view</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Clear the search above to see the full word bank.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <div className="hidden grid-cols-[220px_minmax(0,1fr)_180px_140px] items-center gap-4 border-b border-border/70 bg-muted/30 px-4 py-2.5 text-xs font-semibold text-foreground md:grid">
              <span>Word</span>
              <span>Definition</span>
              <span>Progress</span>
              <span className="text-right">Active set</span>
            </div>
            {filteredWords.map((word, index) => {
              const isActive = activeIds.has(word.id)
              const wordProgress = progress.find((entry) => entry.wordId === word.id)
              return (
                <article
                  key={word.id}
                  className={`grid gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[220px_minmax(0,1fr)_180px_140px] md:items-center md:gap-4 ${index > 0 ? 'border-t border-border/70' : ''}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={isActive
                      ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-primary font-heading text-sm font-semibold text-primary-foreground'
                      : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted font-heading text-sm font-semibold text-foreground'}
                    >
                      {word.word.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-foreground">{word.word}</h2>
                      <p className="truncate text-xs text-muted-foreground">{word.pos} · {word.ipa}</p>
                    </div>
                  </div>
                  <p className="min-w-0 text-sm leading-5 text-foreground/80 md:truncate">{word.simpleDefinition}</p>
                  <div className="flex gap-4 font-mono text-[11px] text-muted-foreground md:block md:space-y-1">
                    <p>Recognition {wordProgress?.recognitionScore ?? 0}/2</p>
                    <p>Retrieval {wordProgress?.retrievalScore ?? 0}/3</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isActive ? 'secondary' : 'outline'}
                    disabled={!isActive && activeIds.size >= 5}
                    onClick={() => isActive ? onDeactivate(word.id) : onActivate(word.id)}
                    className="h-8 justify-center md:justify-self-end"
                  >
                    {isActive
                      ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Active</>
                      : activeIds.size >= 5
                        ? <><X className="mr-1.5 h-3.5 w-3.5" /> Five selected</>
                        : 'Make active'}
                  </Button>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

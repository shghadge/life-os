import { ArrowRight, CalendarClock, CirclePlus, Clock3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DashboardWord, VocabularyDashboard as DashboardData } from '@/types/vocabulary'

interface VocabularyDashboardProps {
  dashboard: DashboardData
  bankCount: number
  onStartSession: () => void
  onOpenWordBank: () => void
  onDeactivate: (wordId: string) => void
}

function formatDueDate(value: string | null): string {
  if (!value) return 'No review scheduled'
  const date = new Date(value)
  const now = new Date()
  if (date.getTime() <= now.getTime()) return 'Ready now'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function ScoreRail({ label, score, max }: { label: string; score: number; max: number }) {
  return (
    <div aria-label={`${label}: ${score} of ${max}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-[11px] font-semibold">{score}/{max}</span>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={index < score ? 'h-1 rounded-full bg-primary' : 'h-1 rounded-full bg-muted'}
          />
        ))}
      </div>
    </div>
  )
}

function ActiveWordCard({ entry, slot, onDeactivate }: { entry: DashboardWord; slot: number; onDeactivate: () => void }) {
  return (
    <article className="group rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted font-heading text-sm font-semibold text-foreground">
          {slot}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-base font-semibold text-foreground">{entry.word.word}</h3>
          <p className="truncate text-xs text-muted-foreground">{entry.word.pos} · {entry.word.ipa}</p>
        </div>
        <button
          type="button"
          onClick={onDeactivate}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          aria-label={`Deactivate ${entry.word.word}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-foreground/80">
        {entry.word.simpleDefinition}
      </p>
      <div className="mt-4 space-y-3 border-t border-border/70 pt-3">
        <ScoreRail label="Recognition" score={entry.progress.recognitionScore} max={2} />
        <ScoreRail label="Retrieval" score={entry.progress.retrievalScore} max={3} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{entry.due ? 'Due now' : formatDueDate(entry.progress.fsrs.due)}</span>
      </div>
    </article>
  )
}

export function VocabularyDashboard({
  dashboard,
  bankCount,
  onStartSession,
  onOpenWordBank,
  onDeactivate,
}: VocabularyDashboardProps) {
  const emptySlots = Math.max(0, 5 - dashboard.words.length)

  return (
    <div className="w-full">
      <section className="flex min-h-12 flex-col justify-between gap-3 border-b border-border bg-card/45 px-5 py-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Daily practice</span>
          <div className="h-5 w-px bg-border" />
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {dashboard.dueCount} due
          </span>
          <span className="hidden items-center gap-1.5 text-sm text-muted-foreground md:inline-flex">
            <CalendarClock className="h-3.5 w-3.5" />
            Next: {formatDueDate(dashboard.nextDueDate)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenWordBank} className="h-8">
            Word bank · {bankCount}
          </Button>
          <Button
            size="sm"
            onClick={onStartSession}
            disabled={dashboard.activeWordCount === 0}
            className="h-8 gap-2"
          >
            {dashboard.dueCount > 0 ? `Start ${dashboard.dueCount}-word session` : 'Start bonus practice'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </section>

      <div className="px-5 py-4">
        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
            <p className="text-xs text-muted-foreground">Due now</p>
            <p className="mt-1 font-heading text-xl font-semibold text-foreground">{dashboard.dueCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
            <p className="text-xs text-muted-foreground">Retrieval level 3</p>
            <p className="mt-1 font-heading text-xl font-semibold text-foreground">{dashboard.retrievalLevelThreeCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
            <p className="text-xs text-muted-foreground">Next review</p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">{formatDueDate(dashboard.nextDueDate)}</p>
          </div>
        </section>

        <section aria-labelledby="active-words-heading">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 id="active-words-heading" className="font-heading text-sm font-semibold text-foreground">
                Active words
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recognition and retrieval are scored separately.
              </p>
            </div>
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {dashboard.activeWordCount} / 5 active
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {dashboard.words.map((entry, index) => (
              <ActiveWordCard
                key={entry.word.id}
                entry={entry}
                slot={index + 1}
                onDeactivate={() => onDeactivate(entry.word.id)}
              />
            ))}
            {Array.from({ length: emptySlots }, (_, index) => (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={onOpenWordBank}
                className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CirclePlus className="mb-2 h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  Choose word {dashboard.words.length + index + 1}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">Open word bank</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

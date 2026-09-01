import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, Lightbulb, MessageSquareText, Mic2, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getVocabularyService, LOCAL_VOCABULARY_USER_ID } from '@/lib/vocabulary-service'
import type {
  ProductionTaskType,
  RecognitionScore,
  RetrievalExerciseType,
  SessionCommitSummary,
  VocabularySession as SessionData,
  WordProfile,
} from '@/types/vocabulary'

interface VocabularySessionProps {
  initialSession: SessionData
  words: WordProfile[]
  onLeave: () => void
  onFinish: () => void
}

type SessionPhase = 'learn' | 'retrieval' | 'production' | 'summary'

interface RetrievalTask {
  wordId: string
  type: RetrievalExerciseType
  prompt: string
  eyebrow: string
}

const PHASES: Array<{ id: Exclude<SessionPhase, 'summary'>; label: string; duration: string }> = [
  { id: 'learn', label: 'Learn', duration: '~5 min' },
  { id: 'retrieval', label: 'Retrieve', duration: '~5 min' },
  { id: 'production', label: 'Produce', duration: '~5 min' },
]

function deriveStartingPhase(session: SessionData, words: WordProfile[]): SessionPhase {
  if (session.wordIds.some((wordId) => session.results[wordId]?.recognitionScore === undefined)) return 'learn'
  const hasOpenRetrieval = words.some((word) => {
    const result = session.results[word.id]
    return !result?.meaning
      || !result.situation
      || word.wordFamily.some((_, index) => !result.wordFamily[`wordFamily:${index}`])
  })
  if (hasOpenRetrieval) return 'retrieval'
  if (session.wordIds.some((wordId) => !session.results[wordId]?.committed)) return 'production'
  return 'summary'
}

function phaseIndex(phase: SessionPhase): number {
  if (phase === 'summary') return 3
  return PHASES.findIndex((entry) => entry.id === phase)
}

function formatNextReview(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function SessionHeader({ phase, bonusPractice, onLeave }: { phase: SessionPhase; bonusPractice: boolean; onLeave: () => void }) {
  const activePhaseIndex = phaseIndex(phase)
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-card/85 px-5 backdrop-blur-sm select-none">
      <div className="mx-auto flex max-w-5xl items-center gap-4">
        <button
          type="button"
          onClick={onLeave}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Leave session"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          {PHASES.map((entry, index) => {
            const complete = index < activePhaseIndex
            const active = index === activePhaseIndex
            return (
              <div key={entry.id} className="min-w-0">
                <div className={active || complete ? 'mb-1.5 h-1 rounded-full bg-[var(--vocab-accent)]' : 'mb-1.5 h-1 rounded-full bg-[var(--vocab-track)]'} />
                <div className="flex items-center justify-between gap-1">
                  <span className={active ? 'truncate text-xs font-semibold text-[var(--vocab-ink)]' : 'truncate text-xs font-medium text-[var(--vocab-muted)]'}>
                    {index + 1}. {entry.label}
                  </span>
                  <span className="hidden font-mono text-[9px] text-[var(--vocab-muted)] sm:block">{entry.duration}</span>
                </div>
              </div>
            )
          })}
        </div>
        {bonusPractice && (
          <span className="hidden shrink-0 rounded-full border border-[var(--vocab-border)] bg-[var(--vocab-track)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--vocab-muted)] md:block">
            Bonus practice
          </span>
        )}
      </div>
    </header>
  )
}

function LearnPhase({
  word,
  position,
  total,
  onRate,
}: {
  word: WordProfile
  position: number
  total: number
  onRate: (score: RecognitionScore) => void
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-7 sm:py-9">
      <div className="mb-4 flex items-center justify-between text-xs text-[var(--vocab-muted)]">
        <span>Full word card</span>
        <span className="font-mono">{position + 1} / {total}</span>
      </div>
      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="border-b border-border px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vocab-accent-strong)]">{word.pos}</p>
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{word.word}</h1>
              <p className="mt-2 text-sm text-[var(--vocab-muted)]">{word.ipa} · {word.syllables.join(' · ')}</p>
            </div>
            <p className="max-w-lg text-base leading-7 text-[var(--vocab-ink)]">{word.simpleDefinition}</p>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-9">
          <div className="space-y-5">
            <div>
              <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">Precise meaning</h2>
              <p className="text-sm leading-6 text-[var(--vocab-ink)]">{word.academicDefinition}</p>
            </div>
            <div>
              <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">Memory hook</h2>
              <p className="text-sm leading-6 text-[var(--vocab-ink)]">{word.breakdown}</p>
              <p className="mt-2 rounded-md bg-muted px-3 py-2.5 text-sm leading-5 text-foreground">{word.personalAssociation}</p>
            </div>
            <div>
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">Word neighborhood</h2>
              <div className="flex flex-wrap gap-1.5">
                {word.synonyms.map((entry) => <span key={entry} className="rounded-full bg-[var(--vocab-track)] px-2.5 py-1 text-xs text-[var(--vocab-ink)]">{entry}</span>)}
                {word.antonyms.map((entry) => <span key={entry} className="rounded-full border border-[var(--vocab-border)] px-2.5 py-1 text-xs text-[var(--vocab-muted)]">not {entry}</span>)}
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">Natural pairings</h2>
              <div className="grid gap-1.5">
                {word.collocations.map((entry) => <p key={entry} className="text-sm text-[var(--vocab-ink)]">→ {entry}</p>)}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">In use</h2>
              <div className="space-y-2 text-sm leading-5 text-[var(--vocab-ink)]">
                <p>“{word.exampleSimple}”</p>
                <p>“{word.exampleAcademic}”</p>
                <p>“{word.exampleConversational}”</p>
              </div>
            </div>
            <div>
              <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">Use it when</h2>
              <p className="text-sm leading-5 text-[var(--vocab-ink)]">{word.usefulSituations.join(' · ')}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2.5">
              <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vocab-muted)]">Watch for</h2>
              <p className="text-xs leading-5 text-[var(--vocab-ink)]">{word.commonMistakes}</p>
            </div>
          </div>
        </div>
      </article>

      <div className="mt-4 rounded-lg border border-border bg-card p-4 shadow-xs">
        <p className="mb-3 text-center text-sm font-semibold text-[var(--vocab-ink)]">How quickly did the meaning register?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            [0, 'I don’t know it'],
            [1, 'With context'],
            [2, 'Immediately'],
          ] as Array<[RecognitionScore, string]>).map(([score, label]) => (
            <Button
              key={score}
              variant="outline"
              onClick={() => onRate(score)}
              className="h-10 rounded-md border-border bg-background text-foreground hover:border-primary hover:bg-muted"
            >
              <span className="mr-2 font-mono text-xs text-[var(--vocab-accent-strong)]">{score}</span> {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function hintContent(word: WordProfile, level: number): string {
  if (level === 1) return `Put simply: ${word.simpleDefinition}`
  if (level === 2) return `${word.word[0]}${'•'.repeat(Math.max(0, [...word.word].length - 1))}`
  if (level === 3) return word.syllables[0]
  if (level === 4) {
    const letters = [...word.word]
    const visibleCount = Math.ceil(letters.length / 2)
    return `${letters.slice(0, visibleCount).join('')}${'•'.repeat(letters.length - visibleCount)}`
  }
  return word.word
}

function RetrievalPhase({
  task,
  word,
  position,
  total,
  onSubmit,
  onContinue,
}: {
  task: RetrievalTask
  word: WordProfile
  position: number
  total: number
  onSubmit: (answer: string, hintLevel: 0 | 1 | 2 | 3 | 4 | 5) => boolean
  onContinue: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3 | 4 | 5>(0)
  const [correct, setCorrect] = useState<boolean | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-8 sm:px-7">
      <div className="mb-4 flex items-center justify-between text-xs text-[var(--vocab-muted)]">
        <span>{task.eyebrow}</span>
        <span className="font-mono">Prompt {position + 1} / {total}</span>
      </div>
      <article className="rounded-lg border border-border bg-card p-6 shadow-xs sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Retrieve from the cue</p>
        <h1 className="mt-4 font-heading text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">{task.prompt}</h1>

        {task.type === 'meaning' && hintLevel > 0 && (
          <div className="mt-5 space-y-2" aria-live="polite">
            {Array.from({ length: hintLevel }, (_, index) => (
              <div key={index} className="flex gap-3 rounded-md bg-muted px-3.5 py-3 text-sm text-foreground">
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase text-primary">Hint {index + 1}</span>
                <span>{hintContent(word, index + 1)}</span>
              </div>
            ))}
          </div>
        )}

        <form
          className="mt-7"
          onSubmit={(event) => {
            event.preventDefault()
            if (!answer.trim() || correct !== null) return
            setCorrect(onSubmit(answer, hintLevel))
          }}
        >
          <label className="text-xs font-semibold text-[var(--vocab-muted)]" htmlFor="retrieval-answer">Your word</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="retrieval-answer"
              autoFocus
              autoComplete="off"
              value={answer}
              disabled={correct !== null}
              onChange={(event) => setAnswer(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-75"
              placeholder="Type the word you want to retrieve"
            />
            {correct === null ? (
              <Button type="submit" disabled={!answer.trim()} className="h-10 px-4">Check answer</Button>
            ) : (
              <Button type="button" onClick={onContinue} className="h-10 px-4">Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
            )}
          </div>
        </form>

        {correct !== null && (
          <div className={correct
            ? 'mt-4 flex items-start gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300'
            : 'mt-4 flex items-start gap-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200'}
          >
            {correct ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{correct ? 'Retrieved.' : <>The target word was <strong>{task.type.startsWith('wordFamily:') ? word.wordFamily[Number(task.type.split(':')[1])].answer : word.word}</strong>.</>}</span>
          </div>
        )}

        {task.type === 'meaning' && correct === null && hintLevel < 5 && (
          <button
            type="button"
            onClick={() => setHintLevel((hintLevel + 1) as 1 | 2 | 3 | 4 | 5)}
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lightbulb className="h-3.5 w-3.5" /> Reveal hint {hintLevel + 1} of 5
          </button>
        )}
      </article>
    </div>
  )
}

function AssessmentToggle({
  value,
  onChange,
  task,
}: {
  value: boolean | null
  onChange: (value: boolean) => void
  task: ProductionTaskType
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-[var(--vocab-muted)]">Did you use it correctly and naturally?</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(true)}
          className={value === true
            ? 'h-9 rounded-md border-primary bg-primary/15 text-foreground'
            : 'h-9 rounded-md border-border bg-background text-muted-foreground'}
          aria-pressed={value === true}
        ><Check className="mr-2 h-3.5 w-3.5" /> Yes</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(false)}
          className={value === false
            ? 'h-9 rounded-md border-amber-500/50 bg-amber-500/10 text-foreground'
            : 'h-9 rounded-md border-border bg-background text-muted-foreground'}
          aria-pressed={value === false}
        ><X className="mr-2 h-3.5 w-3.5" /> Not yet</Button>
      </div>
      <span className="sr-only">{task} self-assessment</span>
    </div>
  )
}

function ProductionPhase({
  word,
  position,
  total,
  onCommit,
}: {
  word: WordProfile
  position: number
  total: number
  onCommit: (sentence: string, sentenceSuccess: boolean, speaking: string, speakingSuccess: boolean) => void
}) {
  const [sentence, setSentence] = useState('')
  const [speaking, setSpeaking] = useState('')
  const [sentenceSuccess, setSentenceSuccess] = useState<boolean | null>(null)
  const [speakingSuccess, setSpeakingSuccess] = useState<boolean | null>(null)
  const assessmentsComplete = sentenceSuccess !== null && speakingSuccess !== null
  const canCommit = sentence.trim() && speaking.trim() && assessmentsComplete

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-7">
      <div className="mb-4 flex items-center justify-between text-xs text-[var(--vocab-muted)]">
        <span>Original use + speaking retrieval</span>
        <span className="font-mono">{position + 1} / {total}</span>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs sm:p-8">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Produce it yourself</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">{word.word}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{word.simpleDefinition}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[var(--vocab-accent-strong)]" />
              <h2 className="font-heading text-sm font-semibold text-[var(--vocab-ink)]">Write an original sentence</h2>
            </div>
            <textarea
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              rows={5}
              placeholder={`Use “${word.word}” in a sentence that matters to you.`}
              className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <AssessmentToggle task="sentence" value={sentenceSuccess} onChange={setSentenceSuccess} />
          </section>

          <section className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-[var(--vocab-accent-strong)]" />
              <h2 className="font-heading text-sm font-semibold text-[var(--vocab-ink)]">Say it, then jot what you said</h2>
            </div>
            <p className="mb-3 text-sm leading-5 text-[var(--vocab-ink)]">{word.speakingPrompt}</p>
            <textarea
              value={speaking}
              onChange={(event) => setSpeaking(event.target.value)}
              rows={4}
              placeholder="Type roughly what you said aloud. This stays self-assessed."
              className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <AssessmentToggle task="speaking" value={speakingSuccess} onChange={setSpeakingSuccess} />
          </section>
        </div>

        {assessmentsComplete && (
          <details className="group mt-5 rounded-md border border-border bg-muted/30 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--vocab-ink)]">
              Compare with authored examples
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-2 border-t border-[var(--vocab-border)] pt-3 text-sm leading-5 text-[var(--vocab-muted)]">
              <p>Academic: “{word.exampleAcademic}”</p>
              <p>Conversational: “{word.exampleConversational}”</p>
            </div>
          </details>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            disabled={!canCommit}
            onClick={() => onCommit(sentence, sentenceSuccess as boolean, speaking, speakingSuccess as boolean)}
            className="h-10 px-4"
          >
            Save review <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function WordSummary({ summary, onContinue, isLast }: { summary: SessionCommitSummary; onContinue: () => void; isLast: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-9">
      <div className="rounded-lg border border-border bg-card p-7 text-center shadow-xs sm:p-8">
        <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Check className="h-5 w-5" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vocab-muted)]">Review saved</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-[var(--vocab-ink)]">{summary.word.word}</h1>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--vocab-muted)]">Recognition</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[var(--vocab-ink)]">{summary.previousRecognitionScore} → {summary.recognitionScore}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--vocab-muted)]">Retrieval</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[var(--vocab-ink)]">{summary.previousRetrievalScore} → {summary.retrievalScore}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--vocab-muted)]">Hints</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[var(--vocab-ink)]">{summary.hintLevelUsed}</p>
          </div>
        </div>
        <p className="mt-5 text-sm text-[var(--vocab-muted)]">Next review · {formatNextReview(summary.nextDueDate)}</p>
        <Button onClick={onContinue} className="mt-6 h-10 px-4">
          {isLast ? 'View session summary' : 'Next word'} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function FinalSummary({ summaries, onFinish }: { summaries: SessionCommitSummary[]; onFinish: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-7">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary"><Eye className="h-5 w-5" /></div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vocab-muted)]">Session complete</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.035em] text-[var(--vocab-ink)]">The words are scheduled.</h1>
        <p className="mt-2 text-sm text-[var(--vocab-muted)]">Recognition and retrieval stayed separate. FSRS used the retrieval result.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        {summaries.map((summary, index) => (
          <div key={summary.word.id} className={`grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center ${index > 0 ? 'border-t border-[var(--vocab-border)]' : ''}`}>
            <div>
              <p className="font-heading text-base font-semibold text-[var(--vocab-ink)]">{summary.word.word}</p>
              <p className="mt-0.5 text-xs text-[var(--vocab-muted)]">Next · {formatNextReview(summary.nextDueDate)}</p>
            </div>
            <span className="font-mono text-xs text-[var(--vocab-muted)]">Recognition {summary.recognitionScore}/2</span>
            <span className="font-mono text-xs font-semibold text-[var(--vocab-accent-strong)]">Retrieval {summary.retrievalScore}/3</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Button onClick={onFinish} className="h-10 px-5">Return to dashboard</Button>
      </div>
    </div>
  )
}

export function VocabularySession({ initialSession, words, onLeave, onFinish }: VocabularySessionProps) {
  const service = getVocabularyService()
  const sessionWords = useMemo(
    () => initialSession.wordIds.flatMap((wordId) => {
      const word = words.find((entry) => entry.id === wordId)
      return word ? [word] : []
    }),
    [initialSession.wordIds, words],
  )
  const [session, setSession] = useState(initialSession)
  const [phase, setPhase] = useState<SessionPhase>(() => deriveStartingPhase(initialSession, sessionWords))
  const [learnIndex, setLearnIndex] = useState(() => Math.max(0, sessionWords.findIndex((word) => initialSession.results[word.id]?.recognitionScore === undefined)))
  const retrievalTasks = useMemo<RetrievalTask[]>(() => sessionWords.flatMap((word) => [
    { wordId: word.id, type: 'meaning', prompt: word.simpleDefinition, eyebrow: 'Meaning → word' },
    { wordId: word.id, type: 'situation', prompt: word.situationPrompt, eyebrow: 'Situation → word' },
    ...word.wordFamily.map((entry, index) => ({
      wordId: word.id,
      type: `wordFamily:${index}` as RetrievalExerciseType,
      prompt: entry.fillInSentence,
      eyebrow: `Word family · ${entry.form}`,
    })),
  ]), [sessionWords])
  const [retrievalIndex, setRetrievalIndex] = useState(() => {
    const firstOpen = retrievalTasks.findIndex((task) => {
      const result = initialSession.results[task.wordId]
      if (task.type === 'meaning') return !result?.meaning
      if (task.type === 'situation') return !result?.situation
      return !result?.wordFamily[task.type]
    })
    return Math.max(0, firstOpen)
  })
  const [productionIndex, setProductionIndex] = useState(() => Math.max(0, sessionWords.findIndex((word) => !initialSession.results[word.id]?.committed)))
  const [summaries, setSummaries] = useState<SessionCommitSummary[]>([])
  const [pendingSummary, setPendingSummary] = useState<SessionCommitSummary | null>(null)

  const updateSession = () => {
    const current = service.getSession(session.id)
    if (current) setSession(current)
  }

  if (phase === 'summary') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--vocab-bg)]">
        <SessionHeader phase={phase} bonusPractice={session.bonusPractice} onLeave={onLeave} />
        <div className="min-h-0 flex-1 overflow-y-auto"><FinalSummary summaries={summaries} onFinish={onFinish} /></div>
      </div>
    )
  }

  if (pendingSummary) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--vocab-bg)]">
        <SessionHeader phase="production" bonusPractice={session.bonusPractice} onLeave={onLeave} />
        <WordSummary
          summary={pendingSummary}
          isLast={productionIndex >= sessionWords.length - 1}
          onContinue={() => {
            const isLast = productionIndex >= sessionWords.length - 1
            setPendingSummary(null)
            if (isLast) setPhase('summary')
            else setProductionIndex((index) => index + 1)
          }}
        />
      </div>
    )
  }

  const learnWord = sessionWords[learnIndex]
  const retrievalTask = retrievalTasks[retrievalIndex]
  const retrievalWord = retrievalTask ? sessionWords.find((word) => word.id === retrievalTask.wordId) : undefined
  const productionWord = sessionWords[productionIndex]

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--vocab-bg)]">
      <SessionHeader phase={phase} bonusPractice={session.bonusPractice} onLeave={onLeave} />
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {phase === 'learn' && learnWord && (
          <LearnPhase
            word={learnWord}
            position={learnIndex}
            total={sessionWords.length}
            onRate={(score) => {
              setSession(service.submitRecognition(LOCAL_VOCABULARY_USER_ID, learnWord.id, score))
              if (learnIndex >= sessionWords.length - 1) setPhase('retrieval')
              else setLearnIndex((index) => index + 1)
            }}
          />
        )}
        {phase === 'retrieval' && retrievalTask && retrievalWord && (
          <RetrievalPhase
            key={`${retrievalTask.wordId}-${retrievalTask.type}`}
            task={retrievalTask}
            word={retrievalWord}
            position={retrievalIndex}
            total={retrievalTasks.length}
            onSubmit={(answer, hintLevel) => {
              const response = service.submitRetrievalAnswer(
                LOCAL_VOCABULARY_USER_ID,
                retrievalTask.wordId,
                retrievalTask.type,
                answer,
                hintLevel,
              )
              setSession(response.session)
              return response.correct
            }}
            onContinue={() => {
              if (retrievalIndex >= retrievalTasks.length - 1) setPhase('production')
              else setRetrievalIndex((index) => index + 1)
            }}
          />
        )}
        {phase === 'production' && productionWord && (
          <ProductionPhase
            key={productionWord.id}
            word={productionWord}
            position={productionIndex}
            total={sessionWords.length}
            onCommit={(sentence, sentenceSuccess, speaking, speakingSuccess) => {
              service.submitProductionSelfAssessment(LOCAL_VOCABULARY_USER_ID, productionWord.id, 'sentence', sentenceSuccess, sentence)
              service.submitProductionSelfAssessment(LOCAL_VOCABULARY_USER_ID, productionWord.id, 'speaking', speakingSuccess, speaking)
              const summary = service.commitSessionResult(LOCAL_VOCABULARY_USER_ID, productionWord.id)
              setSummaries((current) => [...current, summary])
              setPendingSummary(summary)
              updateSession()
            }}
          />
        )}
      </div>
    </div>
  )
}

import { LayoutDashboard, LibraryBig, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { VocabularyDashboard } from '@/components/vocabulary/VocabularyDashboard'
import { VocabularySession } from '@/components/vocabulary/VocabularySession'
import { VocabularyWordBank } from '@/components/vocabulary/VocabularyWordBank'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import {
  getVocabularyService,
  LOCAL_VOCABULARY_USER_ID,
} from '@/lib/vocabulary-service'
import { VocabularyImportError } from '@/lib/vocabulary-validation'
import type { UserWordProgress, VocabularyDashboard as DashboardData, VocabularySession as SessionData, WordProfile } from '@/types/vocabulary'

type VocabularyView = 'dashboard' | 'bank' | 'session'

const EMPTY_DASHBOARD: DashboardData = {
  activeWordCount: 0,
  dueCount: 0,
  retrievalLevelThreeCount: 0,
  nextDueDate: null,
  words: [],
}

export function VocabularyTrainer() {
  const service = getVocabularyService()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [view, setView] = useState<VocabularyView>('dashboard')
  const [words, setWords] = useState<WordProfile[]>([])
  const [progress, setProgress] = useState<UserWordProgress[]>([])
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [session, setSession] = useState<SessionData | null>(null)
  const [importMessage, setImportMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [serviceError, setServiceError] = useState<string | null>(null)

  const refresh = () => {
    setWords(service.getWords())
    setProgress(service.getProgress(LOCAL_VOCABULARY_USER_ID))
    setDashboard(service.getDashboard(LOCAL_VOCABULARY_USER_ID))
  }

  useEffect(() => {
    refresh()
  }, [])

  const runServiceAction = (action: () => void) => {
    try {
      setServiceError(null)
      action()
      refresh()
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : 'The vocabulary action could not be completed.')
    }
  }

  const openSession = () => {
    runServiceAction(() => {
      const nextSession = service.startSession(LOCAL_VOCABULARY_USER_ID)
      setSession(nextSession)
      setView('session')
    })
  }

  const importFile = async (file: File) => {
    try {
      setImportMessage(null)
      const parsed = JSON.parse(await file.text()) as unknown
      const imported = service.importWords(parsed)
      setImportMessage({
        tone: 'success',
        text: `Imported ${imported.length} ${imported.length === 1 ? 'word' : 'words'}. Progress was not changed.`,
      })
      refresh()
    } catch (error) {
      if (error instanceof VocabularyImportError) {
        const detail = error.issues.slice(0, 3).map((entry) => {
          const location = entry.itemId ? `“${entry.itemId}”` : `item ${entry.itemIndex + 1}`
          return `${location}: ${entry.path} ${entry.message}`
        }).join(' · ')
        const remaining = Math.max(0, error.issues.length - 3)
        setImportMessage({
          tone: 'error',
          text: `Nothing was imported. ${detail}${remaining ? ` · ${remaining} more ${remaining === 1 ? 'error' : 'errors'}` : ''}`,
        })
      } else if (error instanceof SyntaxError) {
        setImportMessage({ tone: 'error', text: 'Nothing was imported. The selected file is not valid JSON.' })
      } else {
        setImportMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Nothing was imported.' })
      }
    }
  }

  if (view === 'session' && session) {
    return (
      <div className="vocab-shell h-full min-h-0 bg-[var(--vocab-bg)] text-[var(--vocab-ink)]">
        <VocabularySession
          initialSession={session}
          words={words}
          onLeave={() => {
            refresh()
            setView('dashboard')
          }}
          onFinish={() => {
            refresh()
            setSession(null)
            setView('dashboard')
          }}
        />
      </div>
    )
  }

  return (
    <div className="vocab-shell flex h-full min-h-0 flex-col bg-[var(--vocab-bg)] text-[var(--vocab-ink)]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/85 px-5 backdrop-blur-sm select-none">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="truncate font-heading text-base font-semibold tracking-tight text-foreground">
            Vocabulary
          </h1>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
            {dashboard.activeWordCount}/5 active
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <nav className="flex items-center gap-1" aria-label="Vocabulary views">
            <button
              type="button"
              onClick={() => setView('dashboard')}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'dashboard'
                  ? 'border-primary/40 bg-primary/15 font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => setView('bank')}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'bank'
                  ? 'border-primary/40 bg-primary/15 font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <LibraryBig className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Word bank</span>
            </button>
          </nav>
          <div className="h-5 w-px bg-border" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {resolvedTheme === 'dark'
              ? <Sun className="h-4 w-4 text-amber-400" />
              : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {serviceError && (
        <div role="alert" className="mx-5 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {serviceError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'dashboard' ? (
          <VocabularyDashboard
            dashboard={dashboard}
            bankCount={words.length}
            onStartSession={openSession}
            onOpenWordBank={() => setView('bank')}
            onDeactivate={(wordId) => runServiceAction(() => { service.deactivateWord(LOCAL_VOCABULARY_USER_ID, wordId) })}
          />
        ) : (
          <VocabularyWordBank
            words={words}
            progress={progress}
            importMessage={importMessage}
            onImport={importFile}
            onActivate={(wordId) => runServiceAction(() => { service.activateWord(LOCAL_VOCABULARY_USER_ID, wordId) })}
            onDeactivate={(wordId) => runServiceAction(() => { service.deactivateWord(LOCAL_VOCABULARY_USER_ID, wordId) })}
          />
        )}
      </div>
    </div>
  )
}

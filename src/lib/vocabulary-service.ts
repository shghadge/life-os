import { createEmptyCard, fsrs, State, type CardInput, type Grade } from 'ts-fsrs'
import type {
  DashboardWord,
  FsrsRating,
  FsrsStateName,
  ProductionTaskType,
  RecognitionScore,
  RetrievalExerciseType,
  RetrievalScore,
  SessionCommitSummary,
  SessionWordResult,
  UserWordProgress,
  VocabularyDashboard,
  VocabularySession,
  WordProfile,
} from '@/types/vocabulary'
import { validateWordImport } from '@/lib/vocabulary-validation'
import { getTodayDateString } from '@/lib/storage'

const WORDS_KEY = 'life_os_vocabulary_words_v1'
const PROGRESS_KEY = 'life_os_vocabulary_progress_v1'
const SESSIONS_KEY = 'life_os_vocabulary_sessions_v1'
const MAX_ACTIVE_WORDS = 5

export const LOCAL_VOCABULARY_USER_ID = 'local-user'

export interface VocabularyStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export class VocabularyServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'VocabularyServiceError'
    this.code = code
  }
}

const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: false,
  learning_steps: [],
  relearning_steps: [],
})

function parseStoredArray<T>(storage: VocabularyStorage, key: string): T[] {
  const raw = storage.getItem(key)
  if (!raw) return []

  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) throw new Error('stored value is not an array')
    return value as T[]
  } catch {
    throw new VocabularyServiceError('storage_invalid', 'Vocabulary data is unreadable. Clear the damaged local data before continuing.')
  }
}

function saveArray<T>(storage: VocabularyStorage, key: string, value: T[]): void {
  storage.setItem(key, JSON.stringify(value))
}

function createSessionWordResult(): SessionWordResult {
  return { wordFamily: {}, committed: false }
}

function stateName(state: State): FsrsStateName {
  return ['New', 'Learning', 'Review', 'Relearning'][state] as FsrsStateName
}

function progressToCard(progress: UserWordProgress): CardInput {
  return {
    due: progress.fsrs.due,
    stability: progress.fsrs.stability,
    difficulty: progress.fsrs.difficulty,
    elapsed_days: progress.fsrs.elapsedDays,
    scheduled_days: progress.fsrs.scheduledDays,
    learning_steps: 0,
    reps: progress.fsrs.reps,
    lapses: progress.fsrs.lapses,
    state: progress.fsrs.state,
    last_review: progress.fsrs.lastReview,
  }
}

function mergeSessionResult(
  current: SessionWordResult,
  incoming?: Partial<SessionWordResult>,
): SessionWordResult {
  if (!incoming) return current
  return {
    ...current,
    ...incoming,
    wordFamily: { ...current.wordFamily, ...incoming.wordFamily },
  }
}

export function normalizeVocabularyAnswer(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKC').replace(/[\p{P}\p{S}\s]+/gu, '')
}

export function retrievalScoreToFsrsRating(score: RetrievalScore): FsrsRating {
  return (score + 1) as FsrsRating
}

export function computeRetrievalScore(result: SessionWordResult): RetrievalScore {
  const meaningCorrect = result.meaning?.correct === true
  const situationCorrect = result.situation?.correct === true
  const hintsUsed = result.meaning?.hintLevelUsed ?? 0

  let score: RetrievalScore = 0
  if (meaningCorrect && situationCorrect && hintsUsed === 0) score = 2
  else if (meaningCorrect || situationCorrect) score = 1

  const sentenceSuccess = result.sentence?.usedCorrectly === true
  const speakingSuccess = result.speaking?.usedCorrectly === true
  if (sentenceSuccess && speakingSuccess) return 3
  if (sentenceSuccess || speakingSuccess) score = Math.max(score, 2) as RetrievalScore
  return score
}

export class VocabularyService {
  constructor(
    private readonly storage: VocabularyStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getWords(): WordProfile[] {
    return parseStoredArray<WordProfile>(this.storage, WORDS_KEY).sort((a, b) => a.word.localeCompare(b.word))
  }

  getProgress(userId?: string): UserWordProgress[] {
    const progress = parseStoredArray<UserWordProgress>(this.storage, PROGRESS_KEY)
    return userId ? progress.filter((entry) => entry.userId === userId) : progress
  }

  getWordProgress(userId: string, wordId: string): UserWordProgress | null {
    return this.getProgress(userId).find((entry) => entry.wordId === wordId) ?? null
  }

  getActiveSession(userId: string): VocabularySession | null {
    return parseStoredArray<VocabularySession>(this.storage, SESSIONS_KEY)
      .filter((session) => session.userId === userId && session.status === 'active')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
  }

  getSession(sessionId: string): VocabularySession | null {
    return parseStoredArray<VocabularySession>(this.storage, SESSIONS_KEY)
      .find((session) => session.id === sessionId) ?? null
  }

  importWords(input: unknown): WordProfile[] {
    const words = this.getWords()
    const imported = validateWordImport(input, new Set(words.map((word) => word.id)))
    saveArray(this.storage, WORDS_KEY, [...words, ...imported])
    return imported
  }

  activateWord(userId: string, wordId: string): UserWordProgress {
    this.requireUserAndWord(userId, wordId)
    const allProgress = this.getProgress()
    const existing = allProgress.find((entry) => entry.userId === userId && entry.wordId === wordId)
    if (existing?.active) return existing

    const activeCount = allProgress.filter((entry) => entry.userId === userId && entry.active).length
    if (activeCount >= MAX_ACTIVE_WORDS) {
      throw new VocabularyServiceError(
        'active_limit',
        'Five words are already active. Deactivate one before adding another.',
      )
    }

    if (existing) {
      existing.active = true
      saveArray(this.storage, PROGRESS_KEY, allProgress)
      return existing
    }

    const emptyCard = createEmptyCard(this.now())
    const progress: UserWordProgress = {
      userId,
      wordId,
      active: true,
      recognitionScore: 0,
      retrievalScore: 0,
      fsrs: {
        due: emptyCard.due.toISOString(),
        stability: emptyCard.stability,
        difficulty: emptyCard.difficulty,
        elapsedDays: emptyCard.elapsed_days,
        scheduledDays: emptyCard.scheduled_days,
        reps: emptyCard.reps,
        lapses: emptyCard.lapses,
        state: stateName(emptyCard.state),
        lastReview: null,
      },
      lastReviewedDate: null,
      history: [],
    }
    saveArray(this.storage, PROGRESS_KEY, [...allProgress, progress])
    return progress
  }

  deactivateWord(userId: string, wordId: string): UserWordProgress {
    const allProgress = this.getProgress()
    const existing = allProgress.find((entry) => entry.userId === userId && entry.wordId === wordId)
    if (!existing) throw new VocabularyServiceError('progress_missing', 'This word has no progress record for the user.')
    existing.active = false
    saveArray(this.storage, PROGRESS_KEY, allProgress)
    return existing
  }

  getDueWords(userId: string): WordProfile[] {
    const now = this.now().getTime()
    const dueIds = new Set(
      this.getProgress(userId)
        .filter((entry) => entry.active && new Date(entry.fsrs.due).getTime() <= now)
        .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
        .map((entry) => entry.wordId),
    )
    return this.getWords().filter((word) => dueIds.has(word.id))
  }

  getDashboard(userId: string): VocabularyDashboard {
    const wordsById = new Map(this.getWords().map((word) => [word.id, word]))
    const now = this.now().getTime()
    const activeProgress = this.getProgress(userId)
      .filter((entry) => entry.active)
      .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
    const words: DashboardWord[] = activeProgress.flatMap((progress) => {
      const word = wordsById.get(progress.wordId)
      return word ? [{ word, progress, due: new Date(progress.fsrs.due).getTime() <= now }] : []
    })

    return {
      activeWordCount: words.length,
      dueCount: words.filter((entry) => entry.due).length,
      retrievalLevelThreeCount: words.filter((entry) => entry.progress.retrievalScore === 3).length,
      nextDueDate: words.length > 0 ? words[0].progress.fsrs.due : null,
      words,
    }
  }

  startSession(userId: string): VocabularySession {
    if (!userId.trim()) throw new VocabularyServiceError('user_required', 'A user ID is required.')
    const existing = this.getActiveSession(userId)
    if (existing) return existing

    const dueWords = this.getDueWords(userId)
    const activeWordIds = this.getProgress(userId).filter((entry) => entry.active).map((entry) => entry.wordId)
    const wordIds = dueWords.length > 0 ? dueWords.map((word) => word.id) : activeWordIds
    if (wordIds.length === 0) {
      throw new VocabularyServiceError('no_active_words', 'Activate at least one word before starting a session.')
    }

    const now = this.now().toISOString()
    const session: VocabularySession = {
      id: crypto.randomUUID(),
      userId,
      wordIds,
      bonusPractice: dueWords.length === 0,
      startedAt: now,
      completedAt: null,
      status: 'active',
      results: Object.fromEntries(wordIds.map((wordId) => [wordId, createSessionWordResult()])),
    }
    const sessions = parseStoredArray<VocabularySession>(this.storage, SESSIONS_KEY)
    saveArray(this.storage, SESSIONS_KEY, [...sessions, session])
    return session
  }

  submitRecognition(userId: string, wordId: string, score: RecognitionScore): VocabularySession {
    if (![0, 1, 2].includes(score)) throw new VocabularyServiceError('score_invalid', 'Recognition score must be 0, 1, or 2.')
    return this.updateActiveSession(userId, wordId, (result) => ({ ...result, recognitionScore: score }))
  }

  submitRetrievalAnswer(
    userId: string,
    wordId: string,
    exerciseType: RetrievalExerciseType,
    answerText: string,
    hintLevelUsed: 0 | 1 | 2 | 3 | 4 | 5,
  ): { correct: boolean; session: VocabularySession } {
    if (![0, 1, 2, 3, 4, 5].includes(hintLevelUsed)) {
      throw new VocabularyServiceError('hint_invalid', 'Hint level must be between 0 and 5.')
    }
    if (exerciseType !== 'meaning' && hintLevelUsed !== 0) {
      throw new VocabularyServiceError('hint_invalid', 'Hints are only available for meaning retrieval.')
    }

    const word = this.requireUserAndWord(userId, wordId)
    let expectedAnswer = word.word
    if (exerciseType.startsWith('wordFamily:')) {
      const index = Number(exerciseType.split(':')[1])
      const familyEntry = word.wordFamily[index]
      if (!familyEntry) throw new VocabularyServiceError('exercise_invalid', 'That word-family exercise does not exist.')
      expectedAnswer = familyEntry.answer
    }
    const correct = normalizeVocabularyAnswer(answerText) === normalizeVocabularyAnswer(expectedAnswer)
    const attempt = { answerText, correct, hintLevelUsed }

    const session = this.updateActiveSession(userId, wordId, (result) => {
      if (exerciseType === 'meaning') return { ...result, meaning: attempt }
      if (exerciseType === 'situation') return { ...result, situation: attempt }
      return { ...result, wordFamily: { ...result.wordFamily, [exerciseType]: attempt } }
    })
    return { correct, session }
  }

  submitProductionSelfAssessment(
    userId: string,
    wordId: string,
    taskType: ProductionTaskType,
    usedCorrectly: boolean,
    responseText = '',
  ): VocabularySession {
    const assessment = { responseText, usedCorrectly }
    return this.updateActiveSession(userId, wordId, (result) => ({ ...result, [taskType]: assessment }))
  }

  commitSessionResult(
    userId: string,
    wordId: string,
    results?: Partial<SessionWordResult>,
  ): SessionCommitSummary {
    const allSessions = parseStoredArray<VocabularySession>(this.storage, SESSIONS_KEY)
    const session = allSessions.find((entry) => entry.userId === userId && entry.status === 'active')
    if (!session || !session.wordIds.includes(wordId)) {
      throw new VocabularyServiceError('session_missing', 'No active session contains this word.')
    }

    const result = mergeSessionResult(session.results[wordId], results)
    const word = this.requireUserAndWord(userId, wordId)
    if (result.committed) throw new VocabularyServiceError('already_committed', 'This word result is already committed.')
    const wordFamilyComplete = word.wordFamily.every(
      (_, index) => result.wordFamily[`wordFamily:${index}`] !== undefined,
    )
    if (
      result.recognitionScore === undefined
      || !result.meaning
      || !result.situation
      || !wordFamilyComplete
      || !result.sentence
      || !result.speaking
    ) {
      throw new VocabularyServiceError(
        'session_incomplete',
        'Finish recognition, every retrieval exercise, and both production checks before committing.',
      )
    }

    const allProgress = this.getProgress()
    const progress = allProgress.find((entry) => entry.userId === userId && entry.wordId === wordId)
    if (!progress) throw new VocabularyServiceError('progress_missing', 'This word has no progress record for the user.')
    const retrievalScore = computeRetrievalScore(result)
    const fsrsRating = retrievalScoreToFsrsRating(retrievalScore)
    const reviewTime = this.now()
    const scheduled = scheduler.next(progressToCard(progress), reviewTime, fsrsRating as Grade).card
    const previousRecognitionScore = progress.recognitionScore
    const previousRetrievalScore = progress.retrievalScore
    const hintLevelUsed = result.meaning.hintLevelUsed

    progress.recognitionScore = result.recognitionScore
    progress.retrievalScore = retrievalScore
    progress.fsrs = {
      due: scheduled.due.toISOString(),
      stability: scheduled.stability,
      difficulty: scheduled.difficulty,
      elapsedDays: scheduled.elapsed_days,
      scheduledDays: scheduled.scheduled_days,
      reps: scheduled.reps,
      lapses: scheduled.lapses,
      state: stateName(scheduled.state),
      lastReview: scheduled.last_review?.toISOString() ?? reviewTime.toISOString(),
    }
    progress.lastReviewedDate = getTodayDateString(reviewTime)
    progress.history.push({
      date: progress.lastReviewedDate,
      recognitionScore: result.recognitionScore,
      retrievalScore,
      fsrsRating,
      hintLevelUsed,
      sessionType: 'production',
    })

    session.results[wordId] = { ...result, committed: true }
    if (session.wordIds.every((id) => session.results[id]?.committed)) {
      session.status = 'completed'
      session.completedAt = reviewTime.toISOString()
    }

    saveArray(this.storage, PROGRESS_KEY, allProgress)
    saveArray(this.storage, SESSIONS_KEY, allSessions)

    return {
      word,
      recognitionScore: result.recognitionScore,
      previousRecognitionScore,
      retrievalScore,
      previousRetrievalScore,
      fsrsRating,
      hintLevelUsed,
      nextDueDate: progress.fsrs.due,
    }
  }

  private requireUserAndWord(userId: string, wordId: string): WordProfile {
    if (!userId.trim()) throw new VocabularyServiceError('user_required', 'A user ID is required.')
    const word = this.getWords().find((entry) => entry.id === wordId)
    if (!word) throw new VocabularyServiceError('word_missing', 'That word is not in the imported word bank.')
    return word
  }

  private updateActiveSession(
    userId: string,
    wordId: string,
    update: (result: SessionWordResult) => SessionWordResult,
  ): VocabularySession {
    const sessions = parseStoredArray<VocabularySession>(this.storage, SESSIONS_KEY)
    const session = sessions.find((entry) => entry.userId === userId && entry.status === 'active')
    if (!session || !session.wordIds.includes(wordId)) {
      throw new VocabularyServiceError('session_missing', 'No active session contains this word.')
    }
    session.results[wordId] = update(session.results[wordId] ?? createSessionWordResult())
    saveArray(this.storage, SESSIONS_KEY, sessions)
    return session
  }
}

let browserService: VocabularyService | null = null

export function getVocabularyService(): VocabularyService {
  if (typeof window === 'undefined') {
    throw new VocabularyServiceError('browser_required', 'Browser storage is unavailable in this environment.')
  }
  browserService ??= new VocabularyService(window.localStorage)
  return browserService
}

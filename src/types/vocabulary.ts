export type VocabularyPartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb'

export interface WordFamilyEntry {
  form: string
  fillInSentence: string
  answer: string
}

export interface WordProfile {
  id: string
  word: string
  pos: VocabularyPartOfSpeech
  ipa: string
  simpleDefinition: string
  academicDefinition: string
  breakdown: string
  syllables: string[]
  synonyms: string[]
  antonyms: string[]
  wordFamily: WordFamilyEntry[]
  collocations: string[]
  exampleSimple: string
  exampleAcademic: string
  exampleConversational: string
  personalAssociation: string
  usefulSituations: string[]
  commonMistakes: string
  situationPrompt: string
  speakingPrompt: string
}

export type RecognitionScore = 0 | 1 | 2
export type RetrievalScore = 0 | 1 | 2 | 3
export type FsrsRating = 1 | 2 | 3 | 4
export type FsrsStateName = 'New' | 'Learning' | 'Review' | 'Relearning'
export type SessionType = 'learn' | 'retrieval' | 'production'

export interface VocabularyFsrsState {
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: FsrsStateName
  lastReview: string | null
}

export interface VocabularyHistoryEntry {
  date: string
  recognitionScore: RecognitionScore
  retrievalScore: RetrievalScore
  fsrsRating: FsrsRating
  hintLevelUsed: 0 | 1 | 2 | 3 | 4 | 5
  sessionType: SessionType
}

export interface UserWordProgress {
  userId: string
  wordId: string
  active: boolean
  recognitionScore: RecognitionScore
  retrievalScore: RetrievalScore
  fsrs: VocabularyFsrsState
  lastReviewedDate: string | null
  history: VocabularyHistoryEntry[]
}

export type RetrievalExerciseType = 'meaning' | 'situation' | `wordFamily:${number}`
export type ProductionTaskType = 'sentence' | 'speaking'

export interface RetrievalAttempt {
  answerText: string
  correct: boolean
  hintLevelUsed: 0 | 1 | 2 | 3 | 4 | 5
}

export interface ProductionAssessment {
  responseText: string
  usedCorrectly: boolean
}

export interface SessionWordResult {
  recognitionScore?: RecognitionScore
  meaning?: RetrievalAttempt
  situation?: RetrievalAttempt
  wordFamily: Record<string, RetrievalAttempt>
  sentence?: ProductionAssessment
  speaking?: ProductionAssessment
  committed: boolean
}

export interface VocabularySession {
  id: string
  userId: string
  wordIds: string[]
  bonusPractice: boolean
  startedAt: string
  completedAt: string | null
  status: 'active' | 'completed'
  results: Record<string, SessionWordResult>
}

export interface DashboardWord {
  word: WordProfile
  progress: UserWordProgress
  due: boolean
}

export interface VocabularyDashboard {
  activeWordCount: number
  dueCount: number
  retrievalLevelThreeCount: number
  nextDueDate: string | null
  words: DashboardWord[]
}

export interface SessionCommitSummary {
  word: WordProfile
  recognitionScore: RecognitionScore
  previousRecognitionScore: RecognitionScore
  retrievalScore: RetrievalScore
  previousRetrievalScore: RetrievalScore
  fsrsRating: FsrsRating
  hintLevelUsed: 0 | 1 | 2 | 3 | 4 | 5
  nextDueDate: string
}

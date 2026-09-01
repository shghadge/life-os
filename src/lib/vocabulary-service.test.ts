import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { VocabularyStorage } from '@/lib/vocabulary-service'
import {
  computeRetrievalScore,
  LOCAL_VOCABULARY_USER_ID,
  VocabularyService,
} from '@/lib/vocabulary-service'
import { VocabularyImportError } from '@/lib/vocabulary-validation'
import type { SessionCommitSummary, SessionWordResult, WordProfile } from '@/types/vocabulary'

class MemoryStorage implements VocabularyStorage {
  private values: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.values[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.values[key] = value
  }
}

function makeWord(id: string): WordProfile {
  return {
    id,
    word: id,
    pos: 'adjective',
    ipa: `/${id}/`,
    simpleDefinition: `A plain definition for ${id}`,
    academicDefinition: `A precise definition for ${id}`,
    breakdown: `${id} memory cue`,
    syllables: [id],
    synonyms: ['similar', 'related'],
    antonyms: [],
    wordFamily: [{ form: `${id}ly`, fillInSentence: 'They responded ___.', answer: `${id}ly` }],
    collocations: [`very ${id}`, `${id} result`, `${id} change`],
    exampleSimple: `That was ${id}.`,
    exampleAcademic: `The evidence was ${id}.`,
    exampleConversational: `It felt ${id}.`,
    personalAssociation: `Remember ${id}.`,
    usefulSituations: ['A meeting', 'A written report'],
    commonMistakes: 'Do not confuse it with a similar word.',
    situationPrompt: `Which word describes a ${id} result?`,
    speakingPrompt: `Describe something ${id}.`,
  }
}

function completeWord(
  service: VocabularyService,
  word: WordProfile,
  success: boolean,
): SessionCommitSummary {
  const userId = LOCAL_VOCABULARY_USER_ID
  service.submitRecognition(userId, word.id, success ? 2 : 0)
  service.submitRetrievalAnswer(userId, word.id, 'meaning', success ? word.word : 'wrong', 0)
  service.submitRetrievalAnswer(userId, word.id, 'situation', success ? word.word : 'wrong', 0)
  service.submitRetrievalAnswer(userId, word.id, 'wordFamily:0', success ? word.wordFamily[0].answer : 'wrong', 0)
  service.submitProductionSelfAssessment(userId, word.id, 'sentence', success, `A ${word.word} sentence.`)
  service.submitProductionSelfAssessment(userId, word.id, 'speaking', success, `A spoken ${word.word} answer.`)
  return service.commitSessionResult(userId, word.id)
}

describe('VocabularyService imports and activation', () => {
  it('rejects an entire malformed batch and reports the failing item', () => {
    const service = new VocabularyService(new MemoryStorage())
    const malformed = { ...makeWord('broken'), syllables: 'bro-ken' }

    expect(() => service.importWords([makeWord('valid'), malformed])).toThrow(VocabularyImportError)
    expect(service.getWords()).toEqual([])
  })

  it('imports the complete curated GRE word list', () => {
    const service = new VocabularyService(new MemoryStorage())
    const source = readFileSync(new URL('../../gre-words-50-import.json', import.meta.url), 'utf8')

    expect(service.importWords(JSON.parse(source))).toHaveLength(50)
  })

  it('enforces the five-active-word limit at the service boundary', () => {
    const service = new VocabularyService(new MemoryStorage())
    const words = Array.from({ length: 6 }, (_, index) => makeWord(`word-${index + 1}`))
    service.importWords(words)
    words.slice(0, 5).forEach((word) => service.activateWord(LOCAL_VOCABULARY_USER_ID, word.id))

    expect(() => service.activateWord(LOCAL_VOCABULARY_USER_ID, words[5].id)).toThrowError(
      'Five words are already active. Deactivate one before adding another.',
    )
    expect(service.getDashboard(LOCAL_VOCABULARY_USER_ID).activeWordCount).toBe(5)
  })
})

describe('retrieval scoring and FSRS scheduling', () => {
  it('reserves retrieval level three for two successful production assessments', () => {
    const base: SessionWordResult = {
      recognitionScore: 2,
      meaning: { answerText: 'word', correct: true, hintLevelUsed: 0 },
      situation: { answerText: 'word', correct: true, hintLevelUsed: 0 },
      wordFamily: {},
      committed: false,
    }

    expect(computeRetrievalScore(base)).toBe(2)
    expect(computeRetrievalScore({ ...base, sentence: { responseText: '', usedCorrectly: true } })).toBe(2)
    expect(computeRetrievalScore({
      ...base,
      sentence: { responseText: '', usedCorrectly: true },
      speaking: { responseText: '', usedCorrectly: true },
    })).toBe(3)
  })

  it('schedules both successful and failed reviews through FSRS', () => {
    const reviewedAt = new Date('2026-08-30T12:00:00.000Z')
    const service = new VocabularyService(new MemoryStorage(), () => new Date(reviewedAt))
    const easy = makeWord('substantial')
    const again = makeWord('tenuous')
    service.importWords([easy, again])
    service.activateWord(LOCAL_VOCABULARY_USER_ID, easy.id)
    service.activateWord(LOCAL_VOCABULARY_USER_ID, again.id)
    service.startSession(LOCAL_VOCABULARY_USER_ID)

    const easySummary = completeWord(service, easy, true)
    const againSummary = completeWord(service, again, false)
    const easyProgress = service.getWordProgress(LOCAL_VOCABULARY_USER_ID, easy.id)
    const againProgress = service.getWordProgress(LOCAL_VOCABULARY_USER_ID, again.id)

    expect(easySummary.fsrsRating).toBe(4)
    expect(againSummary.fsrsRating).toBe(1)
    expect(easyProgress?.fsrs.state).not.toBe('New')
    expect(againProgress?.fsrs.state).not.toBe('New')
    expect(easyProgress?.fsrs.reps).toBe(1)
    expect(againProgress?.fsrs.reps).toBe(1)
    expect(new Date(easySummary.nextDueDate).getTime()).toBeGreaterThan(new Date(againSummary.nextDueDate).getTime())
    expect(againProgress?.history[0]).toMatchObject({ retrievalScore: 0, fsrsRating: 1 })
  })
})

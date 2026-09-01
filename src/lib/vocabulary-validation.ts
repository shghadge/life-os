import type { VocabularyPartOfSpeech, WordFamilyEntry, WordProfile } from '@/types/vocabulary'

export interface VocabularyValidationIssue {
  itemIndex: number
  itemId: string | null
  path: string
  message: string
}

export class VocabularyImportError extends Error {
  readonly issues: VocabularyValidationIssue[]

  constructor(issues: VocabularyValidationIssue[]) {
    const first = issues[0]
    const location = first.itemId ? `item “${first.itemId}”` : `item ${first.itemIndex + 1}`
    super(`Import rejected: ${location}, ${first.path} ${first.message}`)
    this.name = 'VocabularyImportError'
    this.issues = issues
  }
}

const POS_VALUES: VocabularyPartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
const STRING_FIELDS: Array<keyof WordProfile> = [
  'id',
  'word',
  'ipa',
  'simpleDefinition',
  'academicDefinition',
  'breakdown',
  'exampleSimple',
  'exampleAcademic',
  'exampleConversational',
  'personalAssociation',
  'commonMistakes',
  'situationPrompt',
  'speakingPrompt',
]
const STRING_ARRAY_FIELDS: Array<keyof WordProfile> = [
  'syllables',
  'synonyms',
  'antonyms',
  'collocations',
  'usefulSituations',
]

function itemId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('id' in value)) return null
  return typeof value.id === 'string' && value.id.trim() ? value.id : null
}

function issue(
  issues: VocabularyValidationIssue[],
  itemIndex: number,
  id: string | null,
  path: string,
  message: string,
): void {
  issues.push({ itemIndex, itemId: id, path, message })
}

function validateStringArray(
  value: unknown,
  field: string,
  itemIndex: number,
  id: string | null,
  issues: VocabularyValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    issue(issues, itemIndex, id, field, 'must be an array')
    return
  }

  value.forEach((entry, entryIndex) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      issue(issues, itemIndex, id, `${field}[${entryIndex}]`, 'must be a non-empty string')
    }
  })
}

function validateWordFamily(
  value: unknown,
  itemIndex: number,
  id: string | null,
  issues: VocabularyValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    issue(issues, itemIndex, id, 'wordFamily', 'must be an array')
    return
  }

  value.forEach((entry, entryIndex) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      issue(issues, itemIndex, id, `wordFamily[${entryIndex}]`, 'must be an object')
      return
    }

    const familyEntry = entry as Partial<WordFamilyEntry>
    for (const field of ['form', 'fillInSentence', 'answer'] as const) {
      if (typeof familyEntry[field] !== 'string' || !familyEntry[field]?.trim()) {
        issue(issues, itemIndex, id, `wordFamily[${entryIndex}].${field}`, 'must be a non-empty string')
      }
    }
  })
}

export function validateWordImport(input: unknown, existingIds: Set<string> = new Set()): WordProfile[] {
  if (!Array.isArray(input)) {
    throw new VocabularyImportError([
      { itemIndex: 0, itemId: null, path: 'file', message: 'must contain a top-level JSON array' },
    ])
  }

  if (input.length === 0) {
    throw new VocabularyImportError([
      { itemIndex: 0, itemId: null, path: 'file', message: 'must contain at least one word' },
    ])
  }

  const issues: VocabularyValidationIssue[] = []
  const batchIds = new Set<string>()

  input.forEach((value, itemIndex) => {
    const id = itemId(value)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      issue(issues, itemIndex, id, 'item', 'must be an object')
      return
    }

    const candidate = value as Partial<WordProfile>
    for (const field of STRING_FIELDS) {
      if (typeof candidate[field] !== 'string' || !(candidate[field] as string).trim()) {
        issue(issues, itemIndex, id, field, 'must be a non-empty string')
      }
    }

    if (!POS_VALUES.includes(candidate.pos as VocabularyPartOfSpeech)) {
      issue(issues, itemIndex, id, 'pos', 'must be noun, verb, adjective, or adverb')
    }

    for (const field of STRING_ARRAY_FIELDS) {
      validateStringArray(candidate[field], field, itemIndex, id, issues)
    }
    validateWordFamily(candidate.wordFamily, itemIndex, id, issues)

    if (id) {
      if (batchIds.has(id)) issue(issues, itemIndex, id, 'id', 'must be unique within the import')
      if (existingIds.has(id)) issue(issues, itemIndex, id, 'id', 'already exists in the word bank')
      batchIds.add(id)
    }
  })

  if (issues.length > 0) throw new VocabularyImportError(issues)
  return input as WordProfile[]
}

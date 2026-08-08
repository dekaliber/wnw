import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Question } from '../shared/types.ts'
import { QuestionLedger, fileStore, pickQuestion } from './rotation.ts'

const BANK_PATH = fileURLToPath(new URL('../../questions/questions.json', import.meta.url))

/** Delete this file to un-retire everything and start the rotation fresh. */
const LEDGER_PATH = fileURLToPath(new URL('../../.data/recent-questions.json', import.meta.url))

const bank: Question[] = JSON.parse(readFileSync(BANK_PATH, 'utf8'))

if (bank.length === 0) throw new Error('Question bank is empty')

for (const q of bank) {
  if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) {
    throw new Error(`Question ${q.id} has a non-numeric answer`)
  }
}

const seenIds = new Set<string>()
for (const q of bank) {
  if (seenIds.has(q.id)) throw new Error(`Duplicate question id: ${q.id}`)
  seenIds.add(q.id)
}

const ledger = new QuestionLedger(fileStore(LEDGER_PATH))

export const questionCount = bank.length

/** How many of the bank state their answer in imperial units. */
export const imperialCount = bank.filter((q) => q.units === 'imperial').length

/** How many questions are currently resting, for the startup banner. */
export function retiredCount(): number {
  return ledger.retired().size
}

/**
 * Draw the next question for a room and retire it for 24 hours.
 *
 * `usedIds` is the room's own history, which the engine carries across
 * rematches; the ledger covers every other room on this server.
 */
export function drawQuestion(
  usedIds: string[],
  options: { excludeImperial: boolean } = { excludeImperial: false },
): Question {
  const question = pickQuestion(bank, {
    roomUsedIds: usedIds,
    retiredIds: ledger.retired(),
    excludeImperial: options.excludeImperial,
  })
  ledger.retire(question.id)
  return question
}

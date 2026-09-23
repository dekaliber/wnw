import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isPractice } from '../shared/customQuestions.ts'
import type { DrawOptions } from '../shared/engine.ts'
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
 * How many of the questions a room would draw from are resting — its uploaded
 * set, or the built-in bank. The ledger also holds other files' questions,
 * which this room could never be served, so they are not counted.
 */
export function restingCount(custom: readonly Question[] | null): number {
  const retired = ledger.retired()
  return (custom ?? bank).filter((q) => retired.has(q.id)).length
}

/** Make every question available again, in every room. */
export function clearResting(): void {
  ledger.clear()
}

/**
 * Draw the next question for a room and retire it for 24 hours.
 *
 * `usedIds` is the room's own history, which the engine carries across
 * rematches; the ledger covers every other room on this server — uploaded
 * questions included, keyed by content so the same file uploaded again
 * tomorrow night still knows what was played tonight.
 */
export function drawQuestion(
  usedIds: string[],
  options: DrawOptions = { excludeImperial: false, practice: false, custom: null, shuffle: false },
): Question {
  const source = options.custom ?? bank
  const practiceRows = source.filter(isPractice)
  const regularRows = source.filter((q) => !isPractice(q))

  // A practice question comes from the file's own "Practice" rows when it has
  // any; otherwise any ordinary question will do for a warm-up. Practice rows
  // are never played as real questions.
  const pool = options.practice && practiceRows.length > 0 ? practiceRows : regularRows

  const question = pickQuestion(pool.length > 0 ? pool : source, {
    roomUsedIds: usedIds,
    retiredIds: ledger.retired(),
    // Uploaded questions carry no units tag, so there is nothing to exclude.
    excludeImperial: options.custom ? false : options.excludeImperial,
    // The practice rows play in file order too, even when the rest shuffle.
    sequential: options.custom !== null && (!options.shuffle || (options.practice && practiceRows.length > 0)),
  })
  ledger.retire(question.id)
  return question
}

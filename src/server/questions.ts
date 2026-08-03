import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Question } from '../shared/types.ts'

const BANK_PATH = fileURLToPath(new URL('../../questions/questions.json', import.meta.url))

const bank: Question[] = JSON.parse(readFileSync(BANK_PATH, 'utf8'))

if (bank.length === 0) throw new Error('Question bank is empty')

for (const q of bank) {
  if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) {
    throw new Error(`Question ${q.id} has a non-numeric answer`)
  }
}

export const questionCount = bank.length

/**
 * Draw a question this room has not used. Falls back to the full bank once a
 * long session exhausts it, mirroring the rulebook's "return used cards to the
 * back of the deck".
 */
export function drawQuestion(usedIds: string[]): Question {
  const used = new Set(usedIds)
  const pool = bank.filter((q) => !used.has(q.id))
  const from = pool.length > 0 ? pool : bank
  return from[Math.floor(Math.random() * from.length)]!
}

/**
 * A host's own questions, uploaded as CSV.
 *
 * Shared so the phone and the server run exactly the same checks: the phone
 * parses first to show the host what is wrong with their file, and the server
 * parses the same text again rather than trusting whatever the phone says it
 * found.
 *
 * Expected columns, in order: id, category, format, text, answer. A header row
 * with those names is optional.
 *
 * A bad row is skipped rather than sinking the whole file: the host is told
 * which rows and why, and decides whether to fix them or play what is left.
 * Only a file with nothing playable in it is refused outright.
 */

import type { AnswerFormat, Question } from './types.ts'

export const CSV_COLUMNS = ['id', 'category', 'format', 'text', 'answer'] as const

/** Plenty for a game night; stops a stray multi-megabyte file riding the socket. */
export const MAX_CSV_BYTES = 256 * 1024
export const MAX_CUSTOM_QUESTIONS = 500
const MAX_TEXT_LENGTH = 400
const MAX_CATEGORY_LENGTH = 40

const FORMATS: readonly AnswerFormat[] = ['plain', 'money', 'year', 'percent']

/** Rows in this category are played as the practice question, never as a real one. */
export const PRACTICE_CATEGORY = 'practice'

export const isPractice = (q: Pick<Question, 'category'>): boolean =>
  q.category?.trim().toLowerCase() === PRACTICE_CATEGORY

export interface CsvProblem {
  /** 1-based, as a spreadsheet numbers it. 0 for a problem with the file as a whole. */
  row: number
  message: string
}

export type ParseResult =
  | { ok: true; questions: Question[]; skipped: CsvProblem[] }
  | { ok: false; problems: CsvProblem[] }

export function parseQuestionsCsv(csv: string): ParseResult {
  if (csv.length > MAX_CSV_BYTES) {
    return { ok: false, problems: [{ row: 0, message: 'The file is too large (256 KB max).' }] }
  }

  const rows = parseCsv(csv.replace(/^﻿/, ''))
  const problems: CsvProblem[] = []
  const questions: Question[] = []
  const seenIds = new Set<string>()

  rows.forEach((cells, i) => {
    const row = i + 1
    if (cells.every((c) => c.trim() === '')) return
    if (i === 0 && isHeader(cells)) return

    if (cells.length !== CSV_COLUMNS.length) {
      problems.push({
        row,
        message: `expected ${CSV_COLUMNS.length} columns (${CSV_COLUMNS.join(', ')}), found ${cells.length}`,
      })
      return
    }

    const [rawId, rawCategory, rawFormat, rawText, rawAnswer] = cells.map((c) => c.trim()) as [
      string,
      string,
      string,
      string,
      string,
    ]

    if (!rawId) return void problems.push({ row, message: 'id is empty' })
    if (seenIds.has(rawId)) return void problems.push({ row, message: `duplicate id “${rawId}”` })

    const format = (rawFormat.toLowerCase() || 'plain') as AnswerFormat
    if (!FORMATS.includes(format)) {
      return void problems.push({
        row,
        message: `format “${rawFormat}” must be one of ${FORMATS.join(', ')} (or blank)`,
      })
    }

    if (!rawText) return void problems.push({ row, message: 'question text is empty' })
    if (rawText.length > MAX_TEXT_LENGTH) {
      return void problems.push({ row, message: `question text is over ${MAX_TEXT_LENGTH} characters` })
    }

    const answer = parseAnswer(rawAnswer)
    if (answer === null) {
      return void problems.push({ row, message: `answer “${rawAnswer}” is not a number` })
    }
    // The keypad has no minus key, so nobody could ever guess it.
    if (answer < 0) return void problems.push({ row, message: 'answer is negative' })

    if (questions.length >= MAX_CUSTOM_QUESTIONS) {
      return void problems.push({ row, message: `over the ${MAX_CUSTOM_QUESTIONS}-question limit` })
    }

    // Only a row that is kept claims its id, so fixing a typo by adding a
    // corrected copy below the broken row still works.
    seenIds.add(rawId)
    questions.push({
      // Namespaced, and tied to the content: two hosts' files that both start
      // at id "1" must not retire each other's questions, while re-uploading
      // the same file must still find last night's plays in the ledger.
      id: `csv:${hash(`${rawId}\u0000${rawText}\u0000${answer}`)}`,
      text: rawText,
      answer,
      category: rawCategory.slice(0, MAX_CATEGORY_LENGTH) || undefined,
      format,
    })
  })

  if (!questions.some((q) => !isPractice(q))) {
    const message =
      problems.length > 0
        ? 'none of the rows could be used'
        : 'no questions found, besides practice ones'
    return { ok: false, problems: [{ row: 0, message }, ...problems] }
  }
  return { ok: true, questions, skipped: problems }
}

function isHeader(cells: string[]): boolean {
  return (
    cells.length === CSV_COLUMNS.length &&
    cells.every((c, i) => c.trim().toLowerCase() === CSV_COLUMNS[i])
  )
}

/** Forgiving about how people type numbers: "1,234", "$12", "40%". */
function parseAnswer(raw: string): number | null {
  const cleaned = raw.replace(/[\s,_]/g, '').replace(/^\$/, '').replace(/%$/, '')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * RFC 4180, near enough: quoted fields, doubled quotes inside them, and
 * newlines inside quotes. Spreadsheet exports need all three.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** FNV-1a. Only needs to tell questions apart, not resist anyone. */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

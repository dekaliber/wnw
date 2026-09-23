import { describe, expect, it } from 'vitest'
import { isPractice, parseCsv, parseQuestionsCsv } from './customQuestions.ts'

const HEADER = 'id,category,format,text,answer'

function ok(csv: string) {
  const result = parseQuestionsCsv(csv)
  if (!result.ok) throw new Error(JSON.stringify(result.problems))
  return result.questions
}

function problems(csv: string) {
  const result = parseQuestionsCsv(csv)
  if (result.ok) throw new Error('expected the file to be rejected')
  return result.problems
}

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, embedded commas and newlines, and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n"two\nlines",x,y\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['two\nlines', 'x', 'y'],
    ])
  })
})

describe('parseQuestionsCsv', () => {
  it('reads rows with or without a header', () => {
    const withHeader = ok(`${HEADER}\n1,History,year,When did it happen?,1986`)
    const without = ok('1,History,year,When did it happen?,1986')
    expect(withHeader).toEqual(without)
    expect(withHeader[0]).toMatchObject({
      text: 'When did it happen?',
      answer: 1986,
      category: 'History',
      format: 'year',
    })
  })

  it('tolerates a BOM, blank lines, a blank format, and friendly number formatting', () => {
    const qs = ok(`﻿${HEADER}\n\n1,,,"How many, roughly?","1,234"\n2,Money,money,Cost?,$12.50\n3,,Percent,Share?,40%\n`)
    expect(qs.map((q) => [q.format, q.answer])).toEqual([
      ['plain', 1234],
      ['money', 12.5],
      ['percent', 40],
    ])
    expect(qs[0]!.category).toBeUndefined()
  })

  it('skips bad rows, numbered as a spreadsheet would, and keeps the rest', () => {
    const result = parseQuestionsCsv(
      [
        HEADER,
        '1,Science,plain,Fine?,10',
        '2,Science,decimal,Bad format?,10',
        '3,Science,plain,Bad answer?,lots',
        '1,Science,plain,Duplicate id?,10',
        '5,Science,plain,,10',
        '6,Science,plain,Negative?,-4',
        '7,too,few',
        '2,Science,plain,Fixed copy of row 3?,10',
      ].join('\n'),
    )
    if (!result.ok) throw new Error('expected the good rows to load')
    // A broken row does not claim its id, so a corrected copy below it loads.
    expect(result.questions.map((q) => q.text)).toEqual(['Fine?', 'Fixed copy of row 3?'])
    const found = result.skipped
    expect(found.map((p) => p.row)).toEqual([3, 4, 5, 6, 7, 8])
    expect(found[0]!.message).toMatch(/plain, money, year, percent/)
    expect(found[1]!.message).toMatch(/not a number/)
    expect(found[2]!.message).toMatch(/duplicate/)
    expect(found[5]!.message).toMatch(/5 columns/)
  })

  it('needs at least one real question besides the practice ones', () => {
    expect(problems('p1,Practice,plain,Warm up?,3')[0]!.message).toMatch(/no questions/)
    expect(problems(HEADER)[0]!.message).toMatch(/no questions/)
  })

  it('refuses a file where every row is bad, and says why for each', () => {
    const found = problems('1,Food,plain,Q?,lots\n2,Food,decimal,Q?,5')
    expect(found.map((p) => p.row)).toEqual([0, 1, 2])
    expect(found[0]!.message).toMatch(/none of the rows/)
  })

  it('recognises practice rows whatever their case', () => {
    const qs = ok('p1,PRACTICE,plain,Warm up?,3\n1,Food,plain,Real?,5')
    expect(qs.map(isPractice)).toEqual([true, false])
  })

  it('gives ids that are stable across uploads but distinct across files', () => {
    const a = ok('1,Food,plain,How many?,5')[0]!.id
    const again = ok(`${HEADER}\n1,Other,plain,How many?,5`)[0]!.id
    const other = ok('1,Food,plain,A different question?,5')[0]!.id
    expect(a).toBe(again)
    expect(a).not.toBe(other)
    expect(a.startsWith('csv:')).toBe(true)
  })
})

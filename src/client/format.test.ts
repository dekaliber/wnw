import { describe, expect, it } from 'vitest'
import { formatAnswer } from './format.ts'

describe('formatAnswer', () => {
  it('never puts a thousands separator in a year', () => {
    expect(formatAnswer(1989, 'year')).toBe('1989')
    expect(formatAnswer(2024, 'year')).not.toContain(',')
  })

  it('groups ordinary numbers, and marks money and percentages', () => {
    expect(formatAnswer(1989)).toBe((1989).toLocaleString())
    expect(formatAnswer(499, 'money')).toBe(`$${(499).toLocaleString()}`)
    expect(formatAnswer(40, 'percent')).toBe('40%')
  })
})

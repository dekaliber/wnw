import { describe, expect, it } from 'vitest'
import { QUIPS, bucketFor, pickQuipId, quipText, seedFrom, type QuipBucket } from './quips.ts'

const BUCKETS: QuipBucket[] = ['exact', 'blazing', 'decent', 'rough', 'wild', 'allOver']

describe('the quip pool', () => {
  it('has plenty to choose from', () => {
    expect(QUIPS.length).toBeGreaterThanOrEqual(50)
  })

  it('has unique ids and no repeated lines', () => {
    const ids = QUIPS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    const texts = QUIPS.map((q) => q.text.toLowerCase())
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('leaves every bucket with general lines, not only category ones', () => {
    // A bucket of purely category-specific lines would come up empty for most
    // questions and silently drop the quip.
    for (const bucket of BUCKETS) {
      const general = QUIPS.filter((q) => q.bucket === bucket && !q.category)
      expect(general.length, bucket).toBeGreaterThanOrEqual(6)
    }
  })

  it('only tags lines with categories the question bank actually uses', () => {
    const known = new Set([
      'History', 'Geography', 'Science', 'Animals', 'Space', 'Technology',
      'Entertainment', 'Sport', 'Landmarks', 'Measures', 'Books', 'Food',
    ])
    for (const q of QUIPS) {
      if (q.category) expect(known.has(q.category), `${q.id}: ${q.category}`).toBe(true)
    }
  })
})

describe('how far off was it', () => {
  it('spots an exact hit', () => {
    expect(bucketFor(1969, 1969)).toBe('exact')
    expect(bucketFor(0, 0)).toBe('exact')
  })

  it('grades by how far off, relative to the answer', () => {
    expect(bucketFor(1000, 970)).toBe('blazing') // 3%
    expect(bucketFor(1000, 850)).toBe('decent') // 15%
    expect(bucketFor(1000, 600)).toBe('rough') // 40%
    expect(bucketFor(1000, 100)).toBe('wild') // 90%
  })

  it('scales with the answer rather than using a fixed gap', () => {
    // Being 50 out is nothing on 100,000 and catastrophic on 60.
    expect(bucketFor(100000, 99950)).toBe('blazing')
    expect(bucketFor(60, 10)).toBe('wild')
  })

  it('calls it all-over when nobody stayed under', () => {
    expect(bucketFor(500, null)).toBe('allOver')
  })

  it('survives an answer of zero without dividing by it', () => {
    // The shark-bones question: the answer really is 0.
    expect(bucketFor(0, null)).toBe('allOver')
    expect(Number.isNaN(0 / 0)).toBe(true) // the trap this guards against
  })
})

describe('years, which a ratio gets badly wrong', () => {
  it('treats centuries out as wild, not respectable', () => {
    // The whole reason years are special-cased. By ratio alone, being three
    // centuries adrift of 2000 grades as a decent guess.
    expect(bucketFor(2000, 1700)).toBe('decent')
    expect(bucketFor(2000, 1700, 'year')).toBe('wild')

    expect(bucketFor(2000, 1500)).toBe('rough') // still far too kind
    expect(bucketFor(2000, 1500, 'year')).toBe('wild')
  })

  it('grades a year on the gap alone', () => {
    expect(bucketFor(1986, 1986, 'year')).toBe('exact')
    expect(bucketFor(1986, 1984, 'year')).toBe('blazing')
    expect(bucketFor(1986, 1975, 'year')).toBe('decent')
    expect(bucketFor(1986, 1950, 'year')).toBe('rough')
    expect(bucketFor(1986, 1900, 'year')).toBe('wild')
  })

  it('applies the same gap to ancient dates as to modern ones', () => {
    // 1066 and 2005 are both "a decade out" at ten years out.
    expect(bucketFor(1066, 1056, 'year')).toBe('decent')
    expect(bucketFor(2005, 1995, 'year')).toBe('decent')
    // And both absurd at four centuries.
    expect(bucketFor(1066, 700, 'year')).toBe('wild')
  })
})

describe('small answers, which a ratio judges too harshly', () => {
  it('counts one off from a tiny answer as a decent guess', () => {
    // 2 out of 3 is 33% off, which would otherwise be graded 'rough'.
    expect(bucketFor(3, 2)).toBe('decent')
    expect(bucketFor(2, 1)).toBe('decent')
  })

  it('still lets the ratio win when it is kinder', () => {
    // 5 away from 100 is a wide gap but a tight ratio.
    expect(bucketFor(100, 95)).toBe('blazing')
  })

  it('does not rescue a guess that is genuinely far off', () => {
    expect(bucketFor(20, 4)).toBe('wild')
    expect(bucketFor(1000, 100)).toBe('wild')
  })
})

describe('picking a line', () => {
  it('always returns something for every bucket', () => {
    for (const bucket of BUCKETS) {
      for (let seed = 0; seed < 40; seed++) {
        const id = pickQuipId(bucket, undefined, seed)
        expect(id, bucket).not.toBeNull()
        expect(QUIPS.find((q) => q.id === id)!.bucket).toBe(bucket)
      }
    }
  })

  it('is stable for the same seed, so every screen agrees', () => {
    const seed = seedFrom('q42:3:4')
    expect(pickQuipId('wild', 'History', seed)).toBe(pickQuipId('wild', 'History', seed))
  })

  it('never offers a line belonging to another category', () => {
    for (let seed = 0; seed < 200; seed++) {
      const id = pickQuipId('wild', 'Food', seed)
      const quip = QUIPS.find((q) => q.id === id)!
      expect(quip.category === undefined || quip.category === 'Food').toBe(true)
    }
  })

  it('does surface the category line sometimes', () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, seed) => pickQuipId('wild', 'History', seed)),
    )
    expect(seen.has('w11')).toBe(true) // the history-class burn
  })

  it('spreads across the pool rather than favouring one line', () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, i) => pickQuipId('decent', undefined, seedFrom(`r${i}`))),
    )
    const pool = QUIPS.filter((q) => q.bucket === 'decent' && !q.category).length
    expect(seen.size).toBe(pool)
  })

  it('resolves ids back to text, and shrugs at a missing one', () => {
    expect(quipText('w1')).toMatch(/trying/)
    expect(quipText(null)).toBeNull()
    expect(quipText('nope')).toBeNull()
  })
})

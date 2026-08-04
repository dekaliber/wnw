/**
 * The table's reaction to the winning guess.
 *
 * Chosen once on the server and carried in the round result as an id, so every
 * phone and the board show the same line — picking client-side would give each
 * player a different burn and kill the shared joke.
 *
 * Selection is a hash of the round rather than `Math.random`, which keeps the
 * engine pure and makes the choice reproducible in tests.
 */

import type { AnswerFormat } from './types.ts'

export type QuipBucket = 'exact' | 'blazing' | 'decent' | 'rough' | 'wild' | 'allOver'

export interface Quip {
  id: string
  bucket: QuipBucket
  text: string
  /**
   * Restricts this line to one question category. Category lines share a pool
   * with the general ones, so they surface as an occasional bonus rather than
   * every single time the category comes up.
   */
  category?: string
}

export const QUIPS: Quip[] = [
  // -- Exact ---------------------------------------------------------------
  { id: 'x1', bucket: 'exact', text: 'Exactly right. Nobody needed to show off like that.' },
  { id: 'x2', bucket: 'exact', text: 'Dead on. Touch grass.' },
  { id: 'x3', bucket: 'exact', text: 'Nailed it to the number. Suspicious, honestly.' },
  { id: 'x4', bucket: 'exact', text: 'That’s not a guess. That’s a flex.' },
  { id: 'x5', bucket: 'exact', text: 'Somebody’s been waiting their whole life for this question.' },
  { id: 'x6', bucket: 'exact', text: 'On the nose. We’re all a little uncomfortable.' },
  { id: 'x7', bucket: 'exact', text: 'Straight-up scientist behaviour.', category: 'Science' },
  { id: 'x8', bucket: 'exact', text: 'Spot on. Someone actually did the reading.', category: 'History' },
  { id: 'x9', bucket: 'exact', text: 'Oh look, this human is a smart one!' },
  { id: 'x10', bucket: 'exact', text: 'Genuine biological intelligence. Rare sighting.' },

  // -- Within 5% -----------------------------------------------------------
  { id: 'b1', bucket: 'blazing', text: 'So close it’s almost rude.' },
  { id: 'b2', bucket: 'blazing', text: 'Practically psychic.' },
  { id: 'b3', bucket: 'blazing', text: 'That’s basically it. Round of applause.' },
  { id: 'b4', bucket: 'blazing', text: 'Barely missed. Still cooked.' },
  { id: 'b5', bucket: 'blazing', text: 'Within a whisker. Respect.' },
  { id: 'b6', bucket: 'blazing', text: 'Close enough that it stings a little.' },
  { id: 'b7', bucket: 'blazing', text: 'Locked in. Genuinely locked in.' },
  { id: 'b8', bucket: 'blazing', text: 'Some of you know things. Weird.' },
  { id: 'b9', bucket: 'blazing', text: 'Close enough for NASA.', category: 'Space' },
  { id: 'b10', bucket: 'blazing', text: 'Okay, that one’s going in the training data.' },

  // -- Within 20% ----------------------------------------------------------
  { id: 'd1', bucket: 'decent', text: 'Not bad. Not bad at all.' },
  { id: 'd2', bucket: 'decent', text: 'Solid guess. We’ll allow it.' },
  { id: 'd3', bucket: 'decent', text: 'In the neighbourhood. Good enough.' },
  { id: 'd4', bucket: 'decent', text: 'Respectable. Nothing to be ashamed of.' },
  { id: 'd5', bucket: 'decent', text: 'That’ll do. Genuinely.' },
  { id: 'd6', bucket: 'decent', text: 'Decent. You may proceed.' },
  { id: 'd7', bucket: 'decent', text: 'Somebody was paying attention. Somebody.' },
  { id: 'd8', bucket: 'decent', text: 'Fine. That was fine. Moving on.' },
  { id: 'd9', bucket: 'decent', text: 'Seasoned. Not perfect, but seasoned.', category: 'Food' },
  { id: 'd10', bucket: 'decent', text: 'Adequate. For a carbon-based life form.' },

  // -- Within 50% ----------------------------------------------------------
  { id: 'r1', bucket: 'rough', text: 'In the ballpark. Wrong seat, but in the ballpark.' },
  { id: 'r2', bucket: 'rough', text: 'Someone got vaguely close. Vaguely.' },
  { id: 'r3', bucket: 'rough', text: 'That’s a guess, technically.' },
  // Proportional wording is avoided here: "half right" is nonsense on a year,
  // where closeness is a gap rather than a ratio.
  { id: 'r4', bucket: 'rough', text: 'Not right enough to clap. Not wrong enough to laugh.' },
  { id: 'r5', bucket: 'rough', text: 'The vibes were there. The number was not.' },
  { id: 'r6', bucket: 'rough', text: 'We’ll take it. We won’t be proud of it.' },
  { id: 'r7', bucket: 'rough', text: 'Close-ish. Emphasis on the -ish.' },
  { id: 'r8', bucket: 'rough', text: 'It’s giving effort. Not accuracy, but effort.' },
  { id: 'r9', bucket: 'rough', text: 'Right area code, wrong house.' },
  { id: 'r10', bucket: 'rough', text: 'I’ve seen better. I’ve also seen worse. Mostly better.' },

  // -- More than 50% off ---------------------------------------------------
  { id: 'w1', bucket: 'wild', text: 'Lol were you even trying?' },
  { id: 'w2', bucket: 'wild', text: 'Not a single one of you knew that.' },
  { id: 'w3', bucket: 'wild', text: 'That’s not a guess, that’s a cry for help.' },
  { id: 'w4', bucket: 'wild', text: 'Absolutely cooked. All of you.' },
  { id: 'w5', bucket: 'wild', text: 'The best guess was that? Rough crowd.' },
  { id: 'w6', bucket: 'wild', text: 'Wildly off. Almost impressively so.' },
  { id: 'w7', bucket: 'wild', text: 'Nobody had any idea. Nobody.' },
  { id: 'w8', bucket: 'wild', text: 'A swing, and a full miss.' },
  { id: 'w9', bucket: 'wild', text: 'This table has never heard of this fact.' },
  { id: 'w10', bucket: 'wild', text: 'Collective silence would have been braver.' },
  { id: 'w19', bucket: 'wild', text: 'Wow. And you lot are building AI superintelligence?' },
  { id: 'w20', bucket: 'wild', text: 'Yeah, okay. Just let the AI take over at this point.' },
  { id: 'w21', bucket: 'wild', text: 'I’m a computer and even I’m embarrassed for you.' },
  { id: 'w22', bucket: 'wild', text: 'Filing this one under cautionary tale.' },
  { id: 'w11', bucket: 'wild', text: 'Somebody was NOT paying attention in history class.', category: 'History' },
  { id: 'w12', bucket: 'wild', text: 'And this is why you failed science.', category: 'Science' },
  { id: 'w13', bucket: 'wild', text: 'Please never navigate anything, ever.', category: 'Geography' },
  { id: 'w14', bucket: 'wild', text: 'Not even the right solar system.', category: 'Space' },
  { id: 'w15', bucket: 'wild', text: 'The animals are disappointed in you.', category: 'Animals' },
  { id: 'w16', bucket: 'wild', text: 'Maybe just keep watching from the couch.', category: 'Sport' },
  { id: 'w17', bucket: 'wild', text: 'Read a book. Any book. Please.', category: 'Books' },
  { id: 'w18', bucket: 'wild', text: 'None of you should be near a kitchen.', category: 'Food' },

  // -- Everyone overshot ---------------------------------------------------
  { id: 'a1', bucket: 'allOver', text: 'Every single one of you went over. Incredible.' },
  { id: 'a2', bucket: 'allOver', text: 'Nobody stayed under. Group project failure.' },
  { id: 'a3', bucket: 'allOver', text: 'All too high. Collectively delusional.' },
  { id: 'a4', bucket: 'allOver', text: 'You all overshot. Every last one.' },
  { id: 'a5', bucket: 'allOver', text: 'Not one guess survived. Brutal.' },
  { id: 'a6', bucket: 'allOver', text: 'Whole table went over. Take a moment.' },
  { id: 'a7', bucket: 'allOver', text: 'Big numbers energy. Wrong, but big.' },
  { id: 'a8', bucket: 'allOver', text: 'Everyone aimed high. Everyone missed.' },
  { id: 'a9', bucket: 'allOver', text: 'Every last one of you, over. And you wonder why we’re automating things.' },
]

/** Bands are `[upper bound, bucket]`, checked in order; anything past is wild. */
type Band = readonly [number, QuipBucket]

/**
 * Years are an interval scale — the zero point is arbitrary, so a ratio means
 * nothing. Guessing 1500 for something in 2000 is "25% off" and also five
 * centuries wrong; only the gap carries any sense of it.
 */
const YEAR_BANDS: readonly Band[] = [
  [3, 'blazing'],
  [12, 'decent'],
  [40, 'rough'],
]

/**
 * A rescue for small answers, where relative error is unfairly brutal: being
 * one off from three is a good guess, not a 33% failure. Applied alongside the
 * ratio, taking whichever is kinder.
 */
const GAP_BANDS: readonly Band[] = [
  [1, 'decent'],
  [3, 'rough'],
]

/** The default for anything measured from a true zero — counts, distances. */
const RATIO_BANDS: readonly Band[] = [
  [0.05, 'blazing'],
  [0.2, 'decent'],
  [0.5, 'rough'],
]

/** Worst to best, for comparing two gradings of the same guess. */
const SEVERITY: readonly QuipBucket[] = ['allOver', 'wild', 'rough', 'decent', 'blazing', 'exact']

function grade(value: number, bands: readonly Band[]): QuipBucket {
  for (const [limit, bucket] of bands) if (value <= limit) return bucket
  return 'wild'
}

const kinder = (a: QuipBucket, b: QuipBucket): QuipBucket =>
  SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b

/** How badly the winning guess missed. */
export function bucketFor(
  answer: number,
  winningGuess: number | null,
  format: AnswerFormat = 'plain',
): QuipBucket {
  if (winningGuess === null) return 'allOver'
  if (winningGuess === answer) return 'exact'

  const gap = Math.abs(answer - winningGuess)

  // Years get the gap alone. Letting the ratio have a say here is exactly the
  // bug: it would call half a millennium out a respectable guess.
  if (format === 'year') return grade(gap, YEAR_BANDS)

  // An answer of zero has no meaningful ratio, so `max(…, 1)` keeps it finite
  // and the gap rescue does the real work.
  const ratio = grade(gap / Math.max(Math.abs(answer), 1), RATIO_BANDS)
  return kinder(ratio, grade(gap, GAP_BANDS))
}

/** FNV-1a. Small, dependency-free, and well spread for short keys. */
export function seedFrom(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pickQuipId(
  bucket: QuipBucket,
  category: string | undefined,
  seed: number,
): string | null {
  const pool = QUIPS.filter((q) => q.bucket === bucket && (!q.category || q.category === category))
  if (pool.length === 0) return null
  return pool[seed % pool.length]!.id
}

export function quipText(id: string | null | undefined): string | null {
  if (!id) return null
  return QUIPS.find((q) => q.id === id)?.text ?? null
}

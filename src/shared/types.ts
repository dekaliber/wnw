/**
 * Shared vocabulary for Wits & Wagers. Imported by both the server (authoritative)
 * and the client (render-only). Nothing in `shared/` may import from `server/`
 * or `client/` — it is pure logic so it can be unit-tested in milliseconds.
 */

export type Phase =
  | 'lobby'
  | 'question' // players writing guesses
  | 'betting' // guesses are sorted onto the mat, players placing chips
  | 'reveal' // answer shown, payouts applied
  | 'gameover'

export interface Question {
  id: string
  text: string
  answer: number
  /** Optional context shown on the reveal screen — the "huh, neat" moment. */
  note?: string
  category?: string
  /** Rendering hint: 'plain' | 'money' | 'year' | 'percent'. */
  format?: AnswerFormat
}

export type AnswerFormat = 'plain' | 'money' | 'year' | 'percent'

export interface Player {
  id: string
  name: string
  /** Assigned at join; matches the answer-card colors on the physical mat. */
  color: string
  score: number
  connected: boolean
}

/**
 * One card on the mat. Duplicate guesses collapse into a single slot with
 * multiple authors, exactly as the rulebook directs.
 */
export interface Guess {
  value: number
  playerIds: string[]
  /** Set only when >7 unique guesses forced a merge; holds the folded-in values. */
  mergedValues?: number[]
}

export interface Slot {
  /** 0 = "All Answers Too High"; 1..7 are the guess slots, ascending. */
  index: number
  payout: number
  guess: Guess | null
}

export interface Bet {
  playerId: string
  /** Each player gets exactly two betting chips. */
  chip: 0 | 1
  slotIndex: number
  /** Extra points staked from the player's bank. The chip itself is always free. */
  wager: number
}

export interface RoundResult {
  winningSlotIndex: number
  /** Per-player point delta for this round, broken out so the TV can explain it. */
  deltas: PlayerDelta[]
}

export interface PlayerDelta {
  playerId: string
  /** 3 points for having written a guess in the winning slot. */
  bonus: number
  /** Sum of stake x odds across winning chips. */
  winnings: number
  /** Wagered points lost on incorrect slots (negative). */
  lost: number
  total: number
}

export interface Round {
  number: number
  question: Question
  /** playerId -> guess. Redacted from clients until the betting phase. */
  guesses: Record<string, number>
  slots: Slot[]
  bets: Bet[]
  /** Players who have confirmed their bets and can no longer change them. */
  locked: string[]
  result: RoundResult | null
  /** Sudden-death round to break a final tie; does not count toward the 7. */
  isTiebreak: boolean
}

export interface GameConfig {
  totalRounds: number
  guessSeconds: number
  betSeconds: number
  /** When false, phases only advance once everyone is in (no clock pressure). */
  timersEnabled: boolean
}

export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 7,
  guessSeconds: 45,
  betSeconds: 30,
  timersEnabled: true,
}

export interface GameState {
  roomCode: string
  phase: Phase
  hostId: string | null
  players: Player[]
  config: GameConfig
  round: Round | null
  /** Epoch ms when the current phase auto-advances; null when untimed. */
  phaseEndsAt: number | null
  /** Ids of players who won, set at gameover. */
  winnerIds: string[]
  /** Questions already used this game, so a rematch does not repeat them. */
  usedQuestionIds: string[]
}

// ---------------------------------------------------------------------------
// Wire protocol
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { t: 'create'; name: string; playerId?: string }
  | { t: 'join'; roomCode: string; name: string; playerId?: string }
  | { t: 'watch'; roomCode: string }
  | { t: 'rename'; name: string }
  | { t: 'config'; config: Partial<GameConfig> }
  | { t: 'start' }
  | { t: 'guess'; value: number }
  | { t: 'bet'; chip: 0 | 1; slotIndex: number; wager: number }
  | { t: 'clearBet'; chip: 0 | 1 }
  | { t: 'lock' }
  | { t: 'unlock' }
  | { t: 'advance' }
  | { t: 'kick'; playerId: string }
  | { t: 'rematch' }

export type ServerMessage =
  | { t: 'joined'; playerId: string; roomCode: string }
  | { t: 'watching'; roomCode: string }
  | { t: 'state'; state: ClientView }
  | { t: 'error'; message: string; code?: ErrorCode }

/** Machine-readable so clients never have to match on user-facing copy. */
export type ErrorCode = 'room-not-found'

/**
 * What a given client is allowed to see. During the question phase the server
 * strips other players' guesses entirely — "hidden" client-side would be
 * visible in the network tab, which would quietly ruin the game.
 */
export interface ClientView extends Omit<GameState, 'round'> {
  round: ClientRound | null
  /** Who this socket is. null for the TV board. */
  youId: string | null
  /** Server clock at send time, so clients can correct for drift. */
  now: number
}

/** The question as clients may see it: the answer is withheld until the reveal. */
export type ClientQuestion = Omit<Question, 'answer' | 'note'> & {
  answer: number | null
  note?: string
}

export interface ClientRound extends Omit<Round, 'guesses' | 'question'> {
  question: ClientQuestion
  /** Only ever populated for the recipient's own guess before the reveal. */
  yourGuess: number | null
  /** Ids of players who have submitted, for the "4 / 6 in" counter. */
  submitted: string[]
}

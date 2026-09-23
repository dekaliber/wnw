/**
 * Shared vocabulary for Wits & Wagers. Imported by both the server (authoritative)
 * and the client (render-only). Nothing in `shared/` may import from `server/`
 * or `client/` — it is pure logic so it can be unit-tested in milliseconds.
 */

import type { CsvProblem } from './customQuestions.ts'

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
  /**
   * Set when the answer is stated in imperial units, so a host with metric
   * speakers at the table can leave the whole set out. Questions whose answer
   * happens to be unit-free — a ratio, or the Celsius/Fahrenheit crossing —
   * are deliberately not tagged.
   */
  units?: 'imperial'
  /**
   * French text. Sent alongside the English rather than resolved server-side,
   * because language is per-player: two people at one table can be reading the
   * same question in different languages, so the server cannot pick one.
   * Falls back to English when a question has not been translated yet.
   */
  textFr?: string
  noteFr?: string
}

export type AnswerFormat = 'plain' | 'money' | 'year' | 'percent'

/**
 * Lives here rather than in the client so the server can track what each
 * player is reading — which is what lets the board notice a mixed-language
 * table and show both, without anyone configuring anything.
 */
export type Locale = 'en' | 'fr'

export interface Player {
  id: string
  name: string
  /** Assigned at join; matches the answer-card colors on the physical mat. */
  color: string
  score: number
  connected: boolean
  /** Lobby only: the player has said they are ready to start. */
  ready: boolean
  /** What this player is reading the game in; drives the board's bilingual mode. */
  locale: Locale
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
  /**
   * The table's reaction to how close the winning guess was. Resolved server
   * side so every screen shows the same line; null when there is nothing to
   * react to (a tiebreak, or a round nobody guessed in).
   */
  quipId: string | null
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
  /**
   * A warm-up played before question 1. It runs every step for real — guess,
   * bet, tally — and then its points are handed back before question 1.
   */
  isPractice: boolean
  /**
   * How many players the host has moved past in the board's scoring
   * playthrough. Held here rather than on the board so the host's phone can
   * drive it — the board is a display, and often nobody can reach it.
   */
  tallied: number
  /**
   * Whether the host has started the board's scoring playthrough. Off at every
   * reveal, so the room gets to take in the answer before anyone's sums start
   * competing with it, and the host decides when that moment has passed.
   */
  scoring: boolean
}

export interface GameConfig {
  totalRounds: number
  guessSeconds: number
  betSeconds: number
  /** When false, phases only advance once everyone is in (no clock pressure). */
  timersEnabled: boolean
  /**
   * Leave out questions whose answer is in feet, miles, pounds and so on.
   * For a table with metric speakers those questions are really two puzzles —
   * the guess, and a unit conversion nobody signed up for.
   */
  excludeImperial: boolean
  /** Open with a practice question that does not count. */
  practiceRound: boolean
  /**
   * Draw an uploaded set in random order. Off by default, since a host who
   * wrote their own questions usually wrote them in the order they want.
   * The built-in bank is always shuffled.
   */
  shuffleQuestions: boolean
  /**
   * The host runs the game without playing it: no guess, no chips, no score.
   * For a quizmaster who knows the answers, or just wants to keep the room
   * moving. They still drive every phase from their phone.
   */
  hostOnly: boolean
}

export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 7,
  guessSeconds: 45,
  betSeconds: 30,
  timersEnabled: false,
  excludeImperial: false,
  practiceRound: false,
  shuffleQuestions: false,
  hostOnly: false,
}

/** A host's uploaded question set, replacing the built-in bank for this room. */
export interface CustomQuestionSet {
  fileName: string
  questions: Question[]
  /** Rows left out because they failed a check, so the host can fix them. */
  skippedCount: number
  /** The first few of those, with the reason — enough to fix the file by. */
  skipped: CsvProblem[]
}

/** What clients may know about the uploaded set — never the answers. */
export interface CustomSetSummary {
  fileName: string
  /** Questions that can be played as real rounds. */
  count: number
  /** Rows in the "Practice" category. */
  practiceCount: number
  skippedCount: number
  skipped: CsvProblem[]
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
  /** null plays from the built-in bank. */
  customQuestions: CustomQuestionSet | null
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
  /** Raw CSV text, parsed on the server; null goes back to the built-in bank. */
  | { t: 'customQuestions'; csv: string | null; fileName?: string }
  /** Forget what has been played, so every question is available again. */
  | { t: 'resetPlayed' }
  | { t: 'ready'; ready: boolean }
  | { t: 'locale'; locale: Locale }
  | { t: 'start' }
  | { t: 'guess'; value: number }
  | { t: 'bet'; chip: 0 | 1; slotIndex: number; wager: number }
  | { t: 'clearBet'; chip: 0 | 1 }
  | { t: 'lock' }
  | { t: 'unlock' }
  | { t: 'advance' }
  /** Host only, during the reveal: move the board's tally on to the next player. */
  | { t: 'tally' }
  /** Host only, during the reveal: open the board's scoring playthrough. */
  | { t: 'startScoring' }
  | { t: 'kick'; playerId: string }
  /** Walk out of the lobby, freeing the seat instead of leaving it "away". */
  | { t: 'leave' }
  | { t: 'rematch' }

export type ServerMessage =
  | { t: 'joined'; playerId: string; roomCode: string }
  | { t: 'watching'; roomCode: string }
  | { t: 'state'; state: ClientView }
  | { t: 'error'; message: string; code?: ErrorCode }
  /**
   * Liveness only, carrying nothing. Browsers never surface protocol-level
   * ping/pong frames to JavaScript, so a client cannot tell a healthy quiet
   * socket from a dead one without a frame it can actually see in `onmessage`.
   */
  | { t: 'ping' }

/** Machine-readable so clients never have to match on user-facing copy. */
export type ErrorCode = 'room-not-found'

/**
 * What a given client is allowed to see. During the question phase the server
 * strips other players' guesses entirely — "hidden" client-side would be
 * visible in the network tab, which would quietly ruin the game.
 */
export interface ClientView extends Omit<GameState, 'round' | 'customQuestions'> {
  round: ClientRound | null
  customQuestions: CustomSetSummary | null
  /**
   * How many of this room's questions are resting after being played in the
   * last 24h — only counted in the lobby, where the host can bring them back.
   */
  restingCount: number
  /**
   * The host, when they are running the game without playing it. Sent
   * separately because `hostId` names whoever can drive right now, which
   * falls to a player while the host's phone is away.
   */
  nonPlayerId: string | null
  /** Who this socket is. null for the TV board. */
  youId: string | null
  /** Server clock at send time, so clients can correct for drift. */
  now: number
}

/** The question as clients may see it: the answer is withheld until the reveal. */
export type ClientQuestion = Omit<Question, 'answer' | 'note' | 'noteFr'> & {
  answer: number | null
  note?: string
  noteFr?: string
}

export interface ClientRound extends Omit<Round, 'guesses' | 'question'> {
  question: ClientQuestion
  /** Only ever populated for the recipient's own guess before the reveal. */
  yourGuess: number | null
  /** Ids of players who have submitted, for the "4 / 6 in" counter. */
  submitted: string[]
}

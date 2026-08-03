/**
 * Redaction.
 *
 * Two things must never leave the server early, and for both of them "hidden"
 * has to mean *not sent* — hiding client-side would leave them sitting in the
 * network tab for anyone who thought to look:
 *
 *   1. The correct answer, until the reveal.
 *   2. Everyone else's guesses, until the mat is built.
 */

import { effectiveHostId } from './engine.ts'
import type {
  ClientQuestion,
  ClientRound,
  ClientView,
  GameState,
  Question,
} from './types.ts'

function redactQuestion(question: Question, revealed: boolean): ClientQuestion {
  const { answer, note, ...rest } = question
  return revealed ? { ...rest, answer, note } : { ...rest, answer: null }
}

export function viewFor(state: GameState, youId: string | null, now: number): ClientView {
  const { round, ...rest } = state

  let clientRound: ClientRound | null = null
  if (round) {
    const guessesSecret = state.phase === 'question'
    const answerRevealed = state.phase === 'reveal' || state.phase === 'gameover'
    const { guesses, question, ...roundRest } = round

    clientRound = {
      ...roundRest,
      question: redactQuestion(question, answerRevealed),
      // Before the sort, a client learns only *that* someone has guessed.
      slots: guessesSecret ? [] : round.slots,
      yourGuess: youId ? (guesses[youId] ?? null) : null,
      submitted: Object.keys(guesses),
    }
  }

  // Clients compare against whoever can actually drive the game, so the host
  // controls never vanish just because the host's phone is momentarily away.
  return { ...rest, hostId: effectiveHostId(state), round: clientRound, youId, now }
}

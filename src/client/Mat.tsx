/**
 * The betting mat. Shared by the TV board and the phone fallback view, so the
 * two surfaces can never disagree about where a card sits.
 */

import { ALL_TOO_HIGH } from '../shared/mat.ts'
import { stakeOf } from '../shared/scoring.ts'
import type { Bet, ClientView, Slot } from '../shared/types.ts'
import { formatAnswer, playerById } from './format.ts'

interface MatProps {
  view: ClientView
  slots: Slot[]
  bets: Bet[]
  winningSlotIndex?: number | null
  /** Board mode keeps chips anonymous while betting is still open. */
  anonymousChips?: boolean
  onSlotClick?: (index: number) => void
  selectable?: (index: number) => boolean
  chipFor?: (index: number) => 0 | 1 | null
  /** Passed in rather than read from context: the mat is rendered by both the
      phone (player's own language) and the board (the room's). */
  allTooHighLabel?: string
  winnerLabel?: string
  /**
   * Board scoring playthrough: light up these chips of one player — and the
   * slots they sit in — and fade every other chip on the mat.
   */
  spotlight?: { playerId: string; chips: number[] } | null
}

export function Mat({
  view,
  slots,
  bets,
  winningSlotIndex = null,
  anonymousChips = false,
  onSlotClick,
  selectable,
  chipFor,
  allTooHighLabel = 'All Answers Too High',
  winnerLabel = 'Winner',
  spotlight = null,
}: MatProps) {
  const decided = winningSlotIndex !== null

  return (
    <div className="mat">
      {slots.map((slot) => {
        const slotBets = bets.filter((b) => b.slotIndex === slot.index)
        const isWinner = winningSlotIndex === slot.index
        const open = selectable?.(slot.index) ?? false
        const mine = chipFor?.(slot.index) ?? null
        const lit = (bet: Bet) =>
          spotlight !== null &&
          bet.playerId === spotlight.playerId &&
          spotlight.chips.includes(bet.chip)

        return (
          <button
            key={slot.index}
            type="button"
            className={[
              'slot',
              slot.index === ALL_TOO_HIGH ? 'slot--too-high' : '',
              isWinner ? 'slot--winner' : '',
              decided && !isWinner ? 'slot--dimmed' : '',
              open ? 'slot--open' : '',
              mine !== null ? 'slot--mine' : '',
              slotBets.some(lit) ? 'slot--spotlit' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={!open || !onSlotClick}
            onClick={() => onSlotClick?.(slot.index)}
          >
            {isWinner && <span className="slot__winner-pill">{winnerLabel}</span>}
            <span className="slot__body">
              {slot.index === ALL_TOO_HIGH ? (
                <span className="slot__too-high">{allTooHighLabel}</span>
              ) : slot.guess ? (
                <Card view={view} slot={slot} />
              ) : (
                <span className="slot__empty" />
              )}
            </span>

            <span className="slot__chips">
              {slotBets.map((bet) => {
                const owner = playerById(view, bet.playerId)
                return (
                  <span
                    key={`${bet.playerId}-${bet.chip}`}
                    className={[
                      'chip',
                      spotlight === null ? '' : lit(bet) ? 'chip--focus' : 'chip--faded',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      background: anonymousChips ? 'var(--chip-anon)' : (owner?.color ?? '#888'),
                    }}
                    title={anonymousChips ? undefined : owner?.name}
                  >
                    {/* The whole stake, not just the raise: a bare chip is still a bet of 1. */}
                    {anonymousChips ? '' : stakeOf(bet)}
                  </span>
                )
              })}
            </span>

            <span className="slot__odds slot__odds--bottom">Pays {slot.payout} to 1</span>
          </button>
        )
      })}
    </div>
  )
}

function Card({ view, slot }: { view: ClientView; slot: Slot }) {
  const guess = slot.guess!
  const authors = guess.playerIds.map((id) => playerById(view, id)).filter(Boolean)
  const format = view.round?.question.format

  return (
    <span className="card" style={{ borderColor: authors[0]?.color ?? '#ccc' }}>
      <span className="card__value">
        {guess.mergedValues
          ? guess.mergedValues.map((v) => formatAnswer(v, format)).join(' / ')
          : formatAnswer(guess.value, format)}
      </span>
      <span className="card__authors">
        {authors.map((a) => (
          <span key={a!.id} className="card__author" style={{ background: a!.color }}>
            {a!.name}
          </span>
        ))}
      </span>
    </span>
  )
}

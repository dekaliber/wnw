/**
 * The betting mat. Shared by the TV board and the phone fallback view, so the
 * two surfaces can never disagree about where a card sits.
 */

import { ALL_TOO_HIGH } from '../shared/mat.ts'
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
}: MatProps) {
  const decided = winningSlotIndex !== null

  return (
    <div className="mat">
      {slots.map((slot) => {
        const slotBets = bets.filter((b) => b.slotIndex === slot.index)
        const isWinner = winningSlotIndex === slot.index
        const open = selectable?.(slot.index) ?? false
        const mine = chipFor?.(slot.index) ?? null

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
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={!open || !onSlotClick}
            onClick={() => onSlotClick?.(slot.index)}
          >
            <span className="slot__body">
              {slot.index === ALL_TOO_HIGH ? (
                <span className="slot__too-high">All Answers Too High</span>
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
                    className="chip"
                    style={{
                      background: anonymousChips ? 'var(--chip-anon)' : (owner?.color ?? '#888'),
                    }}
                    title={anonymousChips ? undefined : owner?.name}
                  >
                    {!anonymousChips && bet.wager > 0 ? `+${bet.wager}` : ''}
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

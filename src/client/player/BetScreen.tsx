import { useState, type CSSProperties } from 'react'
import { ALL_TOO_HIGH, CHIPS_PER_PLAYER } from '../../shared/mat.ts'
import { bankAvailable } from '../../shared/scoring.ts'
import type { ClientView } from '../../shared/types.ts'
import { Confirm } from '../Confirm.tsx'
import { expectedActors, formatAnswer, playerById } from '../format.ts'
import { questionText } from '../i18n/content.ts'
import { useLocale } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'
import { useCountdown } from '../useCountdown.ts'
import { HostAdvanceButton } from './HostAdvanceButton.tsx'
import { PhaseHeader } from './PhaseHeader.tsx'

/**
 * Chips are placed by tapping a row. Both chips may sit on the same slot —
 * the rulebook allows it and it is the natural "I'm sure about this one" move,
 * so tapping a row you already own adds your second chip rather than undoing
 * the first. Removing is explicit, via the row's own chip stack.
 *
 * A raise is tracked per slot rather than per chip. With two chips on one slot
 * the payout is (2 + total raise) x odds however the points are split between
 * them, so a single control per slot is equivalent and far easier to use.
 */
export function BetScreen({ game, view }: { game: Game; view: ClientView }) {
  const { locale, t } = useLocale()
  const round = view.round!
  const seconds = useCountdown(view, game.serverNow)
  const you = view.youId ? playerById(view, view.youId) : undefined
  const locked = view.youId ? round.locked.includes(view.youId) : false

  const myBets = round.bets.filter((b) => b.playerId === view.youId)
  const myChipsOn = (slotIndex: number) => myBets.filter((b) => b.slotIndex === slotIndex)
  const freeChip = ([0, 1] as const).find((c) => !myBets.some((b) => b.chip === c))
  const bank = you ? bankAvailable(you, round.bets) : 0
  const [confirmingLock, setConfirmingLock] = useState(false)

  const lock = () => game.send({ t: 'lock' })

  // A wager chip costs nothing to place — it comes back win or lose — so
  // locking in with one unplaced is almost always an oversight. Ask once.
  const requestLock = () => {
    if (freeChip !== undefined) setConfirmingLock(true)
    else lock()
  }

  const place = (slotIndex: number) => {
    if (locked || freeChip === undefined) return
    game.send({ t: 'bet', chip: freeChip, slotIndex, wager: 0 })
  }

  const removeOne = (slotIndex: number) => {
    if (locked) return
    const here = myChipsOn(slotIndex)
    const last = here[here.length - 1]
    if (!last) return
    // Keep any raise attached to the chip that stays on the slot.
    const total = here.reduce((sum, b) => sum + b.wager, 0)
    game.send({ t: 'clearBet', chip: last.chip })
    const survivor = here[0]
    if (survivor && survivor.chip !== last.chip) {
      game.send({ t: 'bet', chip: survivor.chip, slotIndex, wager: total })
    }
  }

  /** Raise lands entirely on the slot's first chip; the maths is identical. */
  const setSlotWager = (slotIndex: number, wager: number) => {
    const here = myChipsOn(slotIndex)
    const first = here[0]
    if (!first) return
    for (const bet of here.slice(1)) {
      if (bet.wager !== 0) game.send({ t: 'bet', chip: bet.chip, slotIndex, wager: 0 })
    }
    game.send({ t: 'bet', chip: first.chip, slotIndex, wager })
  }

  return (
    <main className="screen screen--bet">
      <PhaseHeader
        view={view}
        seconds={seconds}
        title={round.isTiebreak ? t.suddenDeath : t.questionN(round.number)}
        subtitle={t.placeYourChips}
      />

      <p className="question question--recap">{questionText(round.question, locale)}</p>

      <ul className="betlist">
        {round.slots.map((slot) => {
          const bettable = slot.index === ALL_TOO_HIGH || Boolean(slot.guess)

          // Empty slots are still drawn. On the physical mat you can see the
          // whole range and every payout at once, and that shapes how the odds
          // read — a guess on the 2:1 centre looks very different when you can
          // see the two 5:1 wings sitting empty beside it.
          if (!bettable) {
            return (
              <li key={slot.index}>
                <div className="betrow betrow--vacant" aria-hidden="true">
                  <span className="betrow__odds">
                    {slot.payout}
                    <small>:1</small>
                  </span>
                  <span className="betrow__main">
                    <span className="betrow__vacant-label">{t.empty}</span>
                  </span>
                </div>
              </li>
            )
          }

          const mine = myChipsOn(slot.index)
          const slotWager = mine.reduce((sum, b) => sum + b.wager, 0)
          const authors = (slot.guess?.playerIds ?? [])
            .map((id) => playerById(view, id))
            .filter(Boolean)

          return (
            <li key={slot.index}>
              <button
                type="button"
                className={[
                  'betrow',
                  mine.length > 0 ? 'betrow--mine' : '',
                  slot.index === ALL_TOO_HIGH ? 'betrow--too-high' : '',
                  locked ? 'betrow--locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={locked || freeChip === undefined}
                onClick={() => place(slot.index)}
              >
                <span className="betrow__odds">
                  {slot.payout}
                  <small>:1</small>
                </span>

                <span className="betrow__main">
                  {slot.index === ALL_TOO_HIGH ? (
                    <span className="betrow__value betrow__value--special">
                      {t.allAnswersTooHigh}
                    </span>
                  ) : (
                    <>
                      <span className="betrow__value">
                        {slot.guess!.mergedValues
                          ? slot.guess!.mergedValues
                              .map((v) => formatAnswer(v, round.question.format))
                              .join(' / ')
                          : formatAnswer(slot.guess!.value, round.question.format)}
                      </span>
                      <span className="betrow__authors">
                        {authors.map((a) => (
                          <span key={a!.id} className="pill" style={{ background: a!.color }}>
                            {a!.name}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </span>

                {/* Only your own chips. Who else is on a slot is on the board
                    for anyone who wants it; here it was just noise. */}
                <span className="betrow__chips">
                  {mine.map((bet) => (
                    <span
                      key={bet.chip}
                      className="chip chip--own"
                      style={{ background: you?.color }}
                    />
                  ))}
                  {/* The raise as its own ghost chip, kept apart from the
                      solid ones: those always come back, this can be lost. */}
                  {slotWager > 0 && (
                    <span
                      className="chip chip--raise"
                      style={{ '--who': you?.color } as CSSProperties}
                    >
                      +{slotWager}
                    </span>
                  )}
                </span>
              </button>

              {mine.length > 0 && !locked && (
                <div className="wager">
                  <button
                    type="button"
                    className="wager__remove"
                    onClick={() => removeOne(slot.index)}
                  >
                    {t.takeBack}
                  </button>
                  <span className="wager__label">{t.raise}</span>
                  <button
                    type="button"
                    disabled={slotWager === 0}
                    onClick={() => setSlotWager(slot.index, Math.max(0, slotWager - 1))}
                  >
                    –
                  </button>
                  <span className="wager__value">{slotWager}</span>
                  <button
                    type="button"
                    disabled={bank === 0}
                    onClick={() => setSlotWager(slot.index, slotWager + 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="wager__all"
                    disabled={bank === 0}
                    onClick={() => setSlotWager(slot.index, slotWager + bank)}
                  >
                    {t.allIn}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <footer className="betfoot">
        <div className="betfoot__status">
          <span>{t.chipsLeft(CHIPS_PER_PLAYER - myBets.length)}</span>
          <span className="betfoot__bank">{t.chipsToRaise(bank)}</span>
        </div>

        {locked ? (
          <button className="btn btn--ghost" onClick={() => game.send({ t: 'unlock' })}>
            {t.lockedTapToChange(
              round.locked.length,
              expectedActors(view).length,
            )}
          </button>
        ) : (
          <button
            className="btn btn--primary"
            disabled={myBets.length === 0}
            onClick={requestLock}
          >
            {t.lockIn}
          </button>
        )}

        {/* Stacked below the player's own bet action, same reasoning as the
            guess screen: the host is a player too, so their own Lock in stays
            primary and "move on" sits beside it rather than replacing it. */}
        {view.hostId === view.youId && <HostAdvanceButton game={game} view={view} />}
      </footer>

      {confirmingLock && (
        <Confirm
          tone="nudge"
          title={t.unusedChipTitle}
          body={t.unusedChipBody}
          cancelLabel={t.unusedChipPlace}
          confirmLabel={t.unusedChipLockAnyway}
          onCancel={() => setConfirmingLock(false)}
          onConfirm={() => {
            setConfirmingLock(false)
            lock()
          }}
        />
      )}
    </main>
  )
}

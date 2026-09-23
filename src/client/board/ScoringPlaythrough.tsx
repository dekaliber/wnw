import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ALL_TOO_HIGH } from '../../shared/mat.ts'
import type { ClientView, Slot } from '../../shared/types.ts'
import { contestants, formatAnswer, playerById } from '../format.ts'
import type { Strings } from '../i18n/strings.ts'
import { prefersReducedMotion, RollingNumber, signed } from './motion.tsx'
import {
  BEAT_MS,
  SCORING_LEAD_MS,
  buildTimeline,
  frameAt,
  resumeStep,
  scoringsFor,
  type Beat,
  type PlaythroughFrame,
  type PlayerScoring,
} from './scoringTimeline.ts'

interface Run {
  key: string
  scorings: PlayerScoring[]
  timeline: Beat[]
  step: number
  /** When this reveal arrived, for holding the intro until the band is up. */
  startedAt: number
}

export interface Playthrough extends PlaythroughFrame {
  scorings: PlayerScoring[]
}

/**
 * Steps through the round's scoring one beat at a time, once per reveal.
 *
 * The scorings are frozen when the reveal arrives. The room rebroadcasts on
 * every connect and disconnect, and recomputing on each of those would shift
 * the beat list under a playthrough that is already halfway along it.
 *
 * The timed beats run here, but the pause after each player is released by
 * the host's phone (`round.tallied`), not by anything on the board — the
 * board is a display, and usually nobody can reach it.
 */
export function useScoringPlaythrough(view: ClientView): Playthrough | null {
  const round = view.round
  const result = round?.result
  const key =
    view.phase === 'reveal' && round && result && !round.isTiebreak && result.deltas.length > 0
      ? `${view.roomCode}:${round.number}`
      : null

  const tallied = round?.tallied ?? 0
  const scoring = round?.scoring ?? false
  const [run, setRun] = useState<Run | null>(null)

  // Derived during render rather than in an effect, so the very first reveal
  // frame already shows pre-round scores instead of flashing the new ones.
  let active = run
  if ((run?.key ?? null) !== key) {
    active = null
    if (key && round && result) {
      const scorings = scoringsFor(
        view.players,
        result.deltas,
        round.slots,
        round.bets,
        result.winningSlotIndex,
      )
      const timeline = buildTimeline(scorings)
      // A board opened (or reloaded) mid-tally picks up with the player the
      // host is on, rather than replaying everyone the room has already seen.
      active = {
        key,
        scorings,
        timeline,
        step: resumeStep(timeline, tallied),
        startedAt: Date.now(),
      }
    }
    setRun(active)
  }

  const beat = active?.timeline[active.step]
  useEffect(() => {
    if (!active || !beat || beat.kind === 'done') return
    const runKey = active.key
    const next = () => setRun((r) => (r && r.key === runKey ? { ...r, step: r.step + 1 } : r))

    // Held until the host has moved past this player. If they already have —
    // they tapped while it was still animating — it simply does not stop.
    if (beat.kind === 'pause') {
      if (tallied > beat.player) next()
      return
    }

    // Held until the host opens the scoring from their phone. Then the teaser
    // lingers a moment — and never leaves before the band has even appeared,
    // for a host who taps the instant the answer lands.
    if (beat.kind === 'intro') {
      if (!scoring) return
      const elapsed = Date.now() - active.startedAt
      const id = setTimeout(next, Math.max(BEAT_MS.intro - elapsed, SCORING_LEAD_MS))
      return () => clearTimeout(id)
    }

    const id = setTimeout(next, BEAT_MS[beat.kind])
    return () => clearTimeout(id)
  }, [active?.key, active?.step, tallied, scoring])

  if (!active) return null
  return { ...frameAt(active.scorings, active.timeline, active.step), scorings: active.scorings }
}

/**
 * What the tally band holds between the reveal and the host opening the
 * scoring: a heads-up of what is coming, and — until they tap — who the room
 * is waiting on, so a board that has gone still does not look stuck.
 */
export function ScoringTeaser({ waiting, t }: { waiting: boolean; t: Strings }) {
  return (
    <section className="teaser">
      <p className="teaser__title">{t.scoringTeaser}</p>
      <p className={`teaser__hint ${waiting ? '' : 'is-gone'}`}>{t.waitingForHostShort}</p>
    </section>
  )
}

/** The one player currently being settled, laid out as a worked sum. */
export function ScoringTally({
  view,
  frame,
  t,
}: {
  view: ClientView
  frame: Playthrough
  t: Strings
}) {
  const s = frame.current
  if (!s) return null
  const player = playerById(view, s.playerId)
  const round = view.round!
  const winning = round.slots[round.result!.winningSlotIndex]
  const noBets = s.bets.length === 0 && s.bonus === 0

  return (
    // Keyed per player so each one gets their own entrance.
    <section key={s.playerId} className="tally" style={{ '--who': player?.color } as CSSProperties}>
      {/* One row, read left to right as a sum: who, each bet, the bonus, the total. */}
      <header className="tally__who">
        <span className="tally__name">
          <span className="dot" style={{ background: player?.color }} />
          <span>{player?.name}</span>
        </span>
        {/* The host moves this on from their phone; say so, so the room is
            not left wondering why the board has stopped. */}
        {frame.waiting && <span className="tally__hint">{t.waitingForHostShort}</span>}
      </header>

      <ol className="tally__lines">
        {noBets && <li className="tally__line tally__line--quiet">{t.tallyNoBets}</li>}

        {s.bets.slice(0, frame.betsShown).map((line, i) => {
          const settled = i < frame.betsResolved
          return (
            <li
              key={line.slotIndex}
              className={[
                'tally__line',
                settled ? (line.won ? 'is-won' : 'is-lost') : 'is-pending',
              ].join(' ')}
            >
              {/* The odds sit up here, beside what was backed, so the second
                  line only has to hold the stake — a bonus tile alongside
                  leaves too little room for all three on one line. */}
              <span className="tally__on">
                <span className="tally__chip" style={{ background: player?.color }}>
                  {line.stake}
                </span>
                <span className="tally__slot">
                  {describeSlot(view, round.slots[line.slotIndex], t)}
                </span>
                <span className="tally__odds">{t.tallyPays(line.odds)}</span>
              </span>
              {/* "+" rather than a separator: the chips and the raise are the
                  two parts of the stake the chip badge shows in total. */}
              <span className="tally__math">
                {[t.tallyBet(line.chips.length), line.wager > 0 && t.tallyRaised(line.wager)]
                  .filter(Boolean)
                  .join(' + ')}
              </span>
              <span className="tally__result">
                {!settled ? (
                  <span className="tally__suspense">?</span>
                ) : line.won ? (
                  <>
                    <span className="tally__mark">✓</span>
                    <RollingNumber value={line.amount} from={0} format={t.tallyWon} />
                  </>
                ) : (
                  <>
                    <span className="tally__mark">✗</span>
                    {line.wager > 0 ? (
                      <RollingNumber value={line.amount} from={0} format={t.tallyLost} />
                    ) : (
                      t.tallyLostNothing
                    )}
                  </>
                )}
              </span>
            </li>
          )
        })}

        {frame.bonusShown && (
          <li className="tally__line tally__line--bonus is-won">
            <span className="tally__on">
              <span className="tally__chip tally__chip--star">★</span>
              {t.tallyBonusTitle}
            </span>
            <span className="tally__math">
              {t.tallyBonus(
                winning?.guess ? formatAnswer(winning.guess.value, round.question.format) : '',
              )}
            </span>
            <span className="tally__result">
              <RollingNumber value={s.bonus} from={0} format={(n) => `+${n}`} />
            </span>
          </li>
        )}
      </ol>

      {frame.totalShown && (
        <TallyTotal scoring={s} flying={frame.flying} chips={t.tallyChips} />
      )}
    </section>
  )
}

function TallyTotal({
  scoring,
  flying,
  chips,
}: {
  scoring: PlayerScoring
  flying: boolean
  chips: (n: number) => string
}) {
  const badge = useRef<HTMLSpanElement>(null)
  const dir = scoring.total > 0 ? 'up' : scoring.total < 0 ? 'down' : 'flat'

  // Every gain and loss on its own before they net off, so the room can see
  // why a +3 bonus and a −3 miss came out at ±0. A miss that cost nothing
  // adds nothing to the sum, so it is left out rather than shown as −0.
  const terms = [
    ...scoring.bets.map((l) => (l.won ? l.amount : -l.amount)),
    scoring.bonus,
  ].filter((n) => n !== 0)

  // Carries the result down to the player's spot on the strip. Done with a
  // throwaway element on <body> because it has to cross the whole layout —
  // nothing inside this panel can be positioned over the footer.
  useEffect(() => {
    if (!flying || prefersReducedMotion()) return
    const src = badge.current
    const dst = document.querySelector(`[data-score-for="${CSS.escape(scoring.playerId)}"]`)
    if (!src || !dst) return

    const a = src.getBoundingClientRect()
    const b = dst.getBoundingClientRect()
    const ghost = document.createElement('span')
    ghost.className = `tally-fly is-${dir}`
    ghost.textContent = signed(scoring.total)
    Object.assign(ghost.style, {
      left: `${a.left}px`,
      top: `${a.top}px`,
      width: `${a.width}px`,
      height: `${a.height}px`,
    })
    document.body.append(ghost)

    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)' },
        // A shallow arc reads as thrown rather than slid.
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(1.2)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.85 },
      ],
      { duration: BEAT_MS.fly, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
    )
    return () => ghost.remove()
  }, [flying])

  return (
    <footer className="tally__total">
      <span className="tally__net">
        {terms.length > 1 && (
          <>
            {terms.map((n, i) => (
              <span key={i} className={`tally__term ${n > 0 ? 'is-up' : 'is-down'}`}>
                {signed(n)}
              </span>
            ))}
            <span className="tally__op">=</span>
          </>
        )}
        <span
          ref={badge}
          // Faded only while its copy is in the air; once landed it is the
          // answer to the sum and has to stay readable through the pause.
          className={`tally__delta is-${dir} ${flying ? 'is-sent' : ''}`}
        >
          {signed(scoring.total)}
        </span>
      </span>
      <span className="tally__balance">
        <span className="tally__before">{scoring.before}</span>
        <span className="tally__op">→</span>
        <span className="tally__after">
          <RollingNumber value={scoring.after} from={scoring.before} duration={900} format={chips} />
        </span>
      </span>
    </footer>
  )
}

function describeSlot(view: ClientView, slot: Slot | undefined, t: Strings): string {
  if (!slot || slot.index === ALL_TOO_HIGH || !slot.guess) return t.tallyBetOn(t.allAnswersTooHigh)
  const format = view.round?.question.format
  const value = slot.guess.mergedValues
    ? slot.guess.mergedValues.map((v) => formatAnswer(v, format)).join(' / ')
    : formatAnswer(slot.guess.value, format)
  // No author: the mat right below already says whose guess it is.
  return t.tallyBetOn(value)
}

/**
 * Where everyone stands once the round is settled: before, change, after.
 *
 * Everyone is listed, including players the round did not touch — "nothing
 * happened to me" is information too, and a missing name reads like a bug.
 * Worked out from the view rather than the playthrough, so it is right even
 * on a board that never ran one.
 */
export function RoundSummary({ view, t }: { view: ClientView; t: Strings }) {
  const deltas = view.round?.result?.deltas ?? []
  const rows = contestants(view)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((player) => {
      const change = deltas.find((d) => d.playerId === player.id)?.total ?? 0
      return { player, before: player.score - change, change, after: player.score }
    })

  // A single stack up to four; past that, as many columns as it takes to stay
  // at four rows or fewer — so the band keeps its height and never shoves the
  // mat down — filled evenly, so five players read as 3 + 2 rather than 4 + 1.
  const columnCount = Math.ceil(rows.length / 4)
  const perColumn = Math.ceil(rows.length / columnCount)
  const columns: (typeof rows)[] = []
  for (let i = 0; i < rows.length; i += perColumn) columns.push(rows.slice(i, i + perColumn))

  return (
    <div className="summary" style={{ '--cols': columns.length } as CSSProperties}>
      {columns.map((column, c) => (
        <table key={c} className="summary__col">
          <thead>
            <tr>
              <th />
              <th>{t.summaryBefore}</th>
              <th>{t.summaryChange}</th>
              <th>{t.summaryAfter}</th>
            </tr>
          </thead>
          <tbody>
            {column.map(({ player, before, change, after }, i) => (
              <tr
                key={player.id}
                style={{ animationDelay: `${(c * perColumn + i) * 60}ms` }}
              >
                <td className="summary__name">
                  <span className="summary__who">
                    <span className="dot" style={{ background: player.color }} />
                    <span>{player.name}</span>
                  </span>
                </td>
                <td className="summary__before">{before}</td>
                <td
                  className={`summary__change ${change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`}
                >
                  {signed(change)}
                </td>
                <td className="summary__after">{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

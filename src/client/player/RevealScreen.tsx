import { quipText } from '../../shared/quips.ts'
import type { ClientView } from '../../shared/types.ts'
import { formatAnswer, playerById, standings } from '../format.ts'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'

export function RevealScreen({ game, view }: { game: Game; view: ClientView }) {
  const round = view.round!
  const result = round.result!
  const isHost = view.hostId === view.youId
  const mine = result.deltas.find((d) => d.playerId === view.youId)
  const winningSlot = round.slots[result.winningSlotIndex]
  const last = round.number >= view.config.totalRounds

  if (round.isTiebreak) {
    const winner = view.winnerIds[0]
    return (
      <main className="screen screen--reveal">
        <HostControls view={view} />
        <p className="reveal__label">Sudden death</p>
        <p className="reveal__answer">
          {formatAnswer(round.question.answer ?? 0, round.question.format)}
        </p>
        <p className="reveal__won">
          {view.winnerIds.length === 1
            ? `${playerById(view, winner!)?.name} takes it.`
            : 'Still tied — going again.'}
        </p>
        {isHost && (
          <button className="btn btn--primary btn--fixed" onClick={() => game.send({ t: 'advance' })}>
            Continue
          </button>
        )}
      </main>
    )
  }

  return (
    <main className="screen screen--reveal">
      <HostControls view={view} />
      <p className="reveal__label">The answer is</p>
      <p className="reveal__answer">
        {formatAnswer(round.question.answer ?? 0, round.question.format)}
      </p>
      {quipText(result.quipId) && <p className="quip">{quipText(result.quipId)}</p>}
      {round.question.note && <p className="reveal__note">{round.question.note}</p>}

      <p className="reveal__won">
        {result.winningSlotIndex === 0
          ? 'Everyone went over — All Answers Too High pays 6 to 1.'
          : `${formatAnswer(winningSlot?.guess?.value ?? 0, round.question.format)} wins at ${winningSlot?.payout} to 1.`}
      </p>

      {mine && (
        <section className={`yours ${mine.total > 0 ? 'yours--up' : mine.total < 0 ? 'yours--down' : ''}`}>
          <span className="yours__total">
            {mine.total > 0 ? '+' : ''}
            {mine.total}
          </span>
          <span className="yours__breakdown">
            {mine.winnings > 0 && <em>+{mine.winnings} from your chips</em>}
            {mine.bonus > 0 && <em>+{mine.bonus} your guess won the slot</em>}
            {mine.lost < 0 && <em>{mine.lost} on the raise</em>}
            {mine.total === 0 && <em>Chips returned. No damage.</em>}
          </span>
        </section>
      )}

      <ol className="standings">
        {standings(view).map((p, i) => (
          <li key={p.id} className={p.id === view.youId ? 'standings--you' : ''}>
            <span className="standings__rank">{i + 1}</span>
            <span className="dot" style={{ background: p.color }} />
            <span className="standings__name">{p.name}</span>
            <span className="standings__score">{p.score}</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button className="btn btn--primary btn--fixed" onClick={() => game.send({ t: 'advance' })}>
          {last ? 'Final scores' : `Question ${round.number + 1}`}
        </button>
      ) : (
        <p className="waiting">Waiting for the host…</p>
      )}
    </main>
  )
}

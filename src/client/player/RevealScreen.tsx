import type { ClientView } from '../../shared/types.ts'
import { formatAnswer, playerById, standings } from '../format.ts'
import { localisedQuip, questionNote } from '../i18n/content.ts'
import { useLocale } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'

export function RevealScreen({ game, view }: { game: Game; view: ClientView }) {
  const { locale, t } = useLocale()
  const round = view.round!
  const result = round.result!
  const isHost = view.hostId === view.youId
  const mine = result.deltas.find((d) => d.playerId === view.youId)
  const winningSlot = round.slots[result.winningSlotIndex]
  const last = round.number >= view.config.totalRounds

  const quip = localisedQuip(result.quipId, locale)
  const note = questionNote(round.question, locale)

  if (round.isTiebreak) {
    const winner = view.winnerIds[0]
    return (
      <main className="screen screen--reveal">
        <HostControls view={view} />
        <p className="reveal__label">{t.suddenDeath}</p>
        <p className="reveal__answer">
          {formatAnswer(round.question.answer ?? 0, round.question.format)}
        </p>
        <p className="reveal__won">
          {view.winnerIds.length === 1
            ? t.takesIt(playerById(view, winner!)?.name ?? '')
            : t.stillTied}
        </p>
        {isHost && (
          <button className="btn btn--primary btn--fixed" onClick={() => game.send({ t: 'advance' })}>
            {t.continueLabel}
          </button>
        )}
      </main>
    )
  }

  return (
    <main className="screen screen--reveal">
      <HostControls view={view} />
      <p className="reveal__label">{t.theAnswerIs}</p>
      <p className="reveal__answer">
        {formatAnswer(round.question.answer ?? 0, round.question.format)}
      </p>
      {quip && <p className="quip">{quip}</p>}
      {note && <p className="reveal__note">{note}</p>}

      <p className="reveal__won">
        {result.winningSlotIndex === 0
          ? t.everyoneWentOver
          : t.winsAt(
              formatAnswer(winningSlot?.guess?.value ?? 0, round.question.format),
              winningSlot?.payout ?? 0,
            )}
      </p>

      {mine && (
        <section className={`yours ${mine.total > 0 ? 'yours--up' : mine.total < 0 ? 'yours--down' : ''}`}>
          <span className="yours__total">
            {mine.total > 0 ? '+' : ''}
            {mine.total}
          </span>
          <span className="yours__breakdown">
            {mine.winnings > 0 && <em>{t.fromYourChips(mine.winnings)}</em>}
            {mine.bonus > 0 && <em>{t.guessWonSlot(mine.bonus)}</em>}
            {mine.lost < 0 && <em>{t.lostOnRaise(mine.lost)}</em>}
            {mine.total === 0 && <em>{t.chipsReturned}</em>}
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
          {last ? t.finalScores : t.nextQuestion(round.number + 1)}
        </button>
      ) : (
        <p className="waiting">{t.waitingForHostShort}</p>
      )}
    </main>
  )
}

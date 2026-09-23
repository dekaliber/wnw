import { useEffect, useRef, useState } from 'react'
import { MAX_CSV_BYTES, parseQuestionsCsv, type CsvProblem } from '../../shared/customQuestions.ts'
import type { ClientView } from '../../shared/types.ts'
import { MIN_PLAYERS, everyoneReady } from '../../shared/engine.ts'
import { LocaleToggle } from '../i18n/LocaleToggle.tsx'
import { useT } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'
import { Rules } from './Rules.tsx'

export function Lobby({ game, view }: { game: Game; view: ClientView }) {
  const t = useT()
  const [showRules, setShowRules] = useState(false)

  const isHost = view.hostId === view.youId
  const seated = view.players.filter((p) => p.connected)
  const enoughPlayers = seated.length >= MIN_PLAYERS
  const allReady = everyoneReady(view.players, view.hostId)
  const youAreReady = view.players.find((p) => p.id === view.youId)?.ready ?? false

  const waitingOn = seated.filter((p) => p.id !== view.hostId && !p.ready)

  return (
    <main className="screen">
      <HostControls view={view} restart={false} />

      <header className="room-head">
        <span className="room-head__label">{t.room}</span>
        <span className="room-head__code">{view.roomCode}</span>
      </header>

      {/* Not for the host: walking out would hand the room to someone else
          mid-setup, which deserves more than a link. */}
      {!isHost && (
        <button
          type="button"
          className="link-button room-head__exit"
          onClick={() => {
            game.send({ t: 'leave' })
            game.leave()
          }}
        >
          {t.exitRoom}
        </button>
      )}

      <section className="panel">
        <h2 className="panel__title">
          {t.atTheTable} <span className="count">{view.players.length}</span>
        </h2>
        <ul className="players">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'players__away'}>
              <span className="dot" style={{ background: p.color }} />
              <span className="players__name">{p.name}</span>
              {p.id === view.hostId && <span className="tag">{t.host}</span>}
              {p.id === view.youId && <span className="tag tag--you">{t.you}</span>}
              {!p.connected ? (
                <span className="tag tag--away">{t.away}</span>
              ) : p.id === view.hostId ? null : p.ready ? (
                <span className="tag tag--ready">{t.ready}</span>
              ) : (
                <span className="tag tag--waiting">{t.notReady}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="rules-link" onClick={() => setShowRules(true)}>
        {t.rulesLinkLead}
        <strong>{t.rulesLinkStrong}</strong>
      </button>

      {isHost ? (
        <>
          <HostSettings game={game} view={view} />
          <button
            className="btn btn--primary btn--fixed"
            disabled={!enoughPlayers || !allReady}
            onClick={() => game.send({ t: 'start' })}
          >
            {!enoughPlayers
              ? t.needPlayers(MIN_PLAYERS)
              : !allReady
                ? t.waitingOnNames(waitingOn.map((p) => p.name).join(', '))
                : view.config.practiceRound
                  ? t.startWithPractice(view.config.totalRounds)
                  : t.startQuestions(view.config.totalRounds)}
          </button>
        </>
      ) : (
        <>
          <p className="waiting">{youAreReady ? t.waitingForHost : t.readyWhenYouAre}</p>
          <button
            className={`btn btn--fixed ${youAreReady ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => game.send({ t: 'ready', ready: !youAreReady })}
          >
            {youAreReady ? t.readyTapUndo : t.imReady}
          </button>
        </>
      )}

      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </main>
  )
}

function HostSettings({ game, view }: { game: Game; view: ClientView }) {
  const t = useT()
  const { config, customQuestions: custom } = view
  const [showMore, setShowMore] = useState(false)

  return (
    <section className="panel">
      <h2 className="panel__title">{t.settings}</h2>

      <div className="setting">
        <span>{t.questionsSetting}</span>
        <Stepper
          value={config.totalRounds}
          min={1}
          max={custom ? Math.min(20, custom.count) : 20}
          onChange={(totalRounds) => game.send({ t: 'config', config: { totalRounds } })}
        />
      </div>

      <CustomQuestions game={game} view={view} />

      {custom && (
        <>
          <label className="setting setting--toggle">
            <span>{t.shuffleQuestions}</span>
            <input
              type="checkbox"
              checked={config.shuffleQuestions}
              onChange={(e) =>
                game.send({ t: 'config', config: { shuffleQuestions: e.target.checked } })
              }
            />
          </label>
          <p className="hint hint--tight">{t.shuffleHint}</p>
        </>
      )}

      <label className="setting setting--toggle">
        <span>{t.practiceSetting}</span>
        <input
          type="checkbox"
          checked={config.practiceRound}
          onChange={(e) => game.send({ t: 'config', config: { practiceRound: e.target.checked } })}
        />
      </label>
      <p className="hint hint--tight">{t.practiceHint}</p>

      <label className="setting setting--toggle">
        <span>{t.timers}</span>
        <input
          type="checkbox"
          checked={config.timersEnabled}
          onChange={(e) => game.send({ t: 'config', config: { timersEnabled: e.target.checked } })}
        />
      </label>

      {config.timersEnabled && (
        <>
          <div className="setting">
            <span>{t.secondsToGuess}</span>
            <Stepper
              value={config.guessSeconds}
              min={10}
              max={180}
              step={5}
              onChange={(guessSeconds) => game.send({ t: 'config', config: { guessSeconds } })}
            />
          </div>
          <div className="setting">
            <span>{t.secondsToBet}</span>
            <Stepper
              value={config.betSeconds}
              min={10}
              max={180}
              step={5}
              onChange={(betSeconds) => game.send({ t: 'config', config: { betSeconds } })}
            />
          </div>
        </>
      )}
      <p className="hint hint--tight">{t.timerHint}</p>

      <button type="button" className="link-button more-options" onClick={() => setShowMore(true)}>
        {t.additionalOptions}
      </button>
      {showMore && <MoreOptions game={game} view={view} onClose={() => setShowMore(false)} />}
    </section>
  )
}

/**
 * The settings most tables never touch, kept off the main setup screen so a
 * first-time host sees only what they need to get going.
 */
function MoreOptions({
  game,
  view,
  onClose,
}: {
  game: Game
  view: ClientView
  onClose: () => void
}) {
  const t = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t.additionalOptions}>
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card more-options__card">
        <h2 className="modal__title">{t.additionalOptions}</h2>

        <div className="setting">
          <span>{t.languageSetting}</span>
          <LocaleToggle inline />
        </div>
        <p className="hint hint--tight">{t.languageHint}</p>

        {/* An uploaded set has no units tags, so this would do nothing there. */}
        {!view.customQuestions && (
          <>
            <label className="setting setting--toggle">
              <span>{t.excludeImperial}</span>
              <input
                type="checkbox"
                checked={view.config.excludeImperial}
                onChange={(e) =>
                  game.send({ t: 'config', config: { excludeImperial: e.target.checked } })
                }
              />
            </label>
            <p className="hint hint--tight">{t.excludeImperialHint}</p>
          </>
        )}

        <RestingQuestions game={game} view={view} />

        <button type="button" className="btn btn--primary more-options__done" onClick={onClose}>
          {t.done}
        </button>
      </div>
    </div>
  )
}

/**
 * Upload sits under the question count because it answers the same question —
 * which questions, and how many. The file is checked here first so the host
 * sees every problem at once, then sent as text for the server to check again.
 */
function CustomQuestions({ game, view }: { game: Game; view: ClientView }) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [failed, setFailed] = useState<{ fileName: string; problems: CsvProblem[] } | null>(null)
  const custom = view.customQuestions

  async function load(file: File) {
    const fail = (problems: CsvProblem[]) => setFailed({ fileName: file.name, problems })
    if (file.size > MAX_CSV_BYTES) return fail([{ row: 0, message: 'The file is too large (256 KB max).' }])
    const csv = await file.text()
    // Bad rows alone do not stop the upload — they are skipped, and the
    // server's summary tells the host which. Only an unplayable file stops here.
    const parsed = parseQuestionsCsv(csv)
    if (!parsed.ok) return fail(parsed.problems)
    setFailed(null)
    game.send({ t: 'customQuestions', csv, fileName: file.name })
  }

  const pick = () => input.current?.click()

  return (
    <div className="custom-questions">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared so choosing the same file again, after fixing it, still fires.
          e.target.value = ''
          if (file) void load(file)
        }}
      />

      {custom ? (
        <p className="custom-questions__loaded">
          <span className="custom-questions__count">
            ✓ {t.customLoaded(custom.count)}
            {custom.practiceCount > 0 && t.customPracticeLoaded(custom.practiceCount)}
          </span>{' '}
          <span className="custom-questions__file">{t.customFrom(custom.fileName)}</span>
          <span className="custom-questions__actions">
            <button type="button" className="link-button" onClick={pick}>
              {t.replaceCsv}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setFailed(null)
                game.send({ t: 'customQuestions', csv: null })
              }}
            >
              {t.useBuiltIn}
            </button>
          </span>
        </p>
      ) : (
        <button type="button" className="link-button" onClick={pick}>
          {t.uploadCsv}
        </button>
      )}

      {custom && custom.skippedCount > 0 && !failed && (
        <details className="custom-questions__skipped">
          <summary>
            ⚠ {t.csvSkipped(custom.skippedCount)} — {t.csvSkippedHint}
          </summary>
          <ul>
            {custom.skipped.map((p) => (
              <li key={p.row}>
                <strong>{t.csvRow(p.row)}: </strong>
                {p.message}
              </li>
            ))}
          </ul>
          {custom.skippedCount > custom.skipped.length && (
            <p>{t.csvMore(custom.skippedCount - custom.skipped.length)}</p>
          )}
        </details>
      )}

      {failed ? (
        <div className="custom-questions__problems" role="alert">
          <p>{t.csvCouldNotLoad(failed.fileName)}</p>
          <ul>
            {failed.problems.slice(0, 4).map((p, i) => (
              <li key={i}>
                {p.row > 0 && <strong>{t.csvRow(p.row)}: </strong>}
                {p.message}
              </li>
            ))}
          </ul>
          {failed.problems.length > 4 && <p>{t.csvMore(failed.problems.length - 4)}</p>}
        </div>
      ) : (
        !custom && <p className="hint hint--tight">{t.csvColumnsHint}</p>
      )}
    </div>
  )
}

/**
 * The 24h rest keeps a question from coming up twice in one evening — but a
 * host who tested their own file this afternoon wants those same questions
 * tonight, and has no other way to get them back.
 */
function RestingQuestions({ game, view }: { game: Game; view: ClientView }) {
  const t = useT()
  const [cleared, setCleared] = useState(false)
  const none = view.restingCount === 0

  // Always shown, so the host can find it before they need it; with nothing
  // resting it says so, and the button goes rather than doing nothing.
  return (
    <div className="resting">
      <div className="setting">
        <span>{t.playedRecently}</span>
      </div>
      {none ? (
        <p className={`hint hint--tight ${cleared ? 'resting__done' : ''}`}>
          {cleared ? t.broughtBack : t.noneResting}
        </p>
      ) : (
        <p className="hint hint--tight">{t.restingHint(view.restingCount)}</p>
      )}
      {!none && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setCleared(true)
            game.send({ t: 'resetPlayed' })
          }}
        >
          {t.bringBackPlayed}
        </button>
      )}
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
}) {
  return (
    <span className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label="-">
        –
      </button>
      <span className="stepper__value">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} aria-label="+">
        +
      </button>
    </span>
  )
}

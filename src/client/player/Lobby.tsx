import { useState } from 'react'
import type { ClientView } from '../../shared/types.ts'
import { MIN_PLAYERS, everyoneReady } from '../../shared/engine.ts'
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
  const { config } = view

  return (
    <section className="panel">
      <h2 className="panel__title">{t.settings}</h2>

      <div className="setting">
        <span>{t.questionsSetting}</span>
        <Stepper
          value={config.totalRounds}
          min={1}
          max={20}
          onChange={(totalRounds) => game.send({ t: 'config', config: { totalRounds } })}
        />
      </div>

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
    </section>
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

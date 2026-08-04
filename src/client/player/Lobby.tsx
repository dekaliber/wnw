import { useState } from 'react'
import type { ClientView } from '../../shared/types.ts'
import { MIN_PLAYERS, everyoneReady } from '../../shared/engine.ts'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'
import { Rules } from './Rules.tsx'

export function Lobby({ game, view }: { game: Game; view: ClientView }) {
  const [showRules, setShowRules] = useState(false)

  const isHost = view.hostId === view.youId
  const seated = view.players.filter((p) => p.connected)
  const enoughPlayers = seated.length >= MIN_PLAYERS
  const allReady = everyoneReady(view.players, view.hostId)
  const youAreReady = view.players.find((p) => p.id === view.youId)?.ready ?? false

  const waitingOn = seated.filter((p) => p.id !== view.hostId && !p.ready)

  return (
    <main className="screen">
      <HostControls game={game} view={view} restart={false} />

      <header className="room-head">
        <span className="room-head__label">Room</span>
        <span className="room-head__code">{view.roomCode}</span>
      </header>

      <section className="panel">
        <h2 className="panel__title">
          At the table <span className="count">{view.players.length}</span>
        </h2>
        <ul className="players">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'players__away'}>
              <span className="dot" style={{ background: p.color }} />
              <span className="players__name">{p.name}</span>
              {p.id === view.hostId && <span className="tag">host</span>}
              {p.id === view.youId && <span className="tag tag--you">you</span>}
              {!p.connected ? (
                <span className="tag tag--away">away</span>
              ) : p.id === view.hostId ? null : p.ready ? (
                <span className="tag tag--ready">ready</span>
              ) : (
                <span className="tag tag--waiting">not ready</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="rules-link" onClick={() => setShowRules(true)}>
        While you’re waiting — <strong>how to play</strong>
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
              ? `Need ${MIN_PLAYERS} players`
              : !allReady
                ? `Waiting on ${waitingOn.map((p) => p.name).join(', ')}`
                : `Start ${view.config.totalRounds} questions`}
          </button>
        </>
      ) : (
        <>
          <p className="waiting">
            {youAreReady ? 'Waiting for the host to start…' : 'Ready when you are.'}
          </p>
          <button
            className={`btn btn--fixed ${youAreReady ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => game.send({ t: 'ready', ready: !youAreReady })}
          >
            {youAreReady ? '✓ Ready — tap to undo' : 'I’m ready'}
          </button>
        </>
      )}

      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </main>
  )
}

function HostSettings({ game, view }: { game: Game; view: ClientView }) {
  const { config } = view

  return (
    <section className="panel">
      <h2 className="panel__title">Settings</h2>

      <div className="setting">
        <span>Questions</span>
        <Stepper
          value={config.totalRounds}
          min={1}
          max={20}
          onChange={(totalRounds) => game.send({ t: 'config', config: { totalRounds } })}
        />
      </div>

      <label className="setting setting--toggle">
        <span>Timers</span>
        <input
          type="checkbox"
          checked={config.timersEnabled}
          onChange={(e) => game.send({ t: 'config', config: { timersEnabled: e.target.checked } })}
        />
      </label>

      {config.timersEnabled && (
        <>
          <div className="setting">
            <span>Seconds to guess</span>
            <Stepper
              value={config.guessSeconds}
              min={10}
              max={180}
              step={5}
              onChange={(guessSeconds) => game.send({ t: 'config', config: { guessSeconds } })}
            />
          </div>
          <div className="setting">
            <span>Seconds to bet</span>
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
      <p className="hint hint--tight">
        Guessing and betting only end when the clock runs out or you move things
        along yourself — so nobody's phone waking up late gets skipped.
      </p>
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
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label="less">
        –
      </button>
      <span className="stepper__value">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} aria-label="more">
        +
      </button>
    </span>
  )
}

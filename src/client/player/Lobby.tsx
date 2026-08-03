import type { ClientView } from '../../shared/types.ts'
import { MIN_PLAYERS } from '../../shared/engine.ts'
import type { Game } from '../net.ts'
import { HostControls } from './HostControls.tsx'

export function Lobby({ game, view }: { game: Game; view: ClientView }) {
  const isHost = view.hostId === view.youId
  const ready = view.players.filter((p) => p.connected).length >= MIN_PLAYERS

  return (
    <main className="screen">
      <HostControls view={view} restart={false} />

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
              {!p.connected && <span className="tag tag--away">away</span>}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <>
          <HostSettings game={game} view={view} />
          <button
            className="btn btn--primary btn--fixed"
            disabled={!ready}
            onClick={() => game.send({ t: 'start' })}
          >
            {ready ? `Start ${view.config.totalRounds} questions` : `Need ${MIN_PLAYERS} players`}
          </button>
        </>
      ) : (
        <p className="waiting">Waiting for the host to start…</p>
      )}
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
        Rounds end early once everyone is in, so the clock is just a backstop.
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

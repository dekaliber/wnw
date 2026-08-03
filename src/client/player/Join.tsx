import { useState } from 'react'
import type { Game } from '../net.ts'
import { rememberedName, rememberedRoom } from '../net.ts'

/**
 * A `?room=` in the URL always wins over the remembered room. Someone opening a
 * fresh link for tonight's game must not be silently dropped back into last
 * week's room code, so this is read synchronously rather than in an effect.
 */
function initialRoomCode(): string {
  const fromUrl = new URLSearchParams(location.search).get('room')
  return (fromUrl ?? rememberedRoom()).toUpperCase().slice(0, 4)
}

export function Join({ game }: { game: Game }) {
  const [name, setName] = useState(rememberedName())
  const [room, setRoom] = useState(initialRoomCode)

  const trimmed = name.trim()
  const code = room.trim().toUpperCase()

  return (
    <main className="screen screen--join">
      <header className="brand">
        <h1>Wits &amp; Wagers</h1>
        <p className="brand__sub">Everyone guesses. Everyone bets. Nobody has to know anything.</p>
      </header>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed && code) game.connect({ kind: 'join', roomCode: code, name: trimmed })
        }}
      >
        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoComplete="nickname"
            placeholder="Witless Wonder"
            enterKeyHint="next"
          />
        </label>

        <label className="field">
          <span>Room code</span>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 4))}
            className="input--code"
            placeholder="ABCD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        </label>

        <button type="submit" className="btn btn--primary" disabled={!trimmed || code.length < 4}>
          Join game
        </button>
      </form>

      <div className="divider">or</div>

      <button
        type="button"
        className="btn btn--ghost"
        disabled={!trimmed}
        onClick={() => game.connect({ kind: 'create', name: trimmed })}
      >
        Start a new game
      </button>

      <p className="hint">
        Putting the board on a TV? Open <code>/board</code> on the laptop.
      </p>
    </main>
  )
}

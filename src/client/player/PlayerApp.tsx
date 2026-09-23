import { useEffect, useRef } from 'react'
import { LocaleToggle } from '../i18n/LocaleToggle.tsx'
import { useLocale } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'
import { rememberedName, rememberedRoom } from '../net.ts'
import { Join } from './Join.tsx'
import { Lobby } from './Lobby.tsx'
import { GuessScreen } from './GuessScreen.tsx'
import { BetScreen } from './BetScreen.tsx'
import { RevealScreen } from './RevealScreen.tsx'
import { GameOverScreen } from './GameOverScreen.tsx'
import { RestartProvider } from './RestartProvider.tsx'

/**
 * A reload must not cost someone their seat.
 *
 * Reconnecting is already automatic while the tab lives, but a refresh — the
 * one move people reach for when a screen looks stuck — wipes that and drops
 * them on the join form. The identity needed to get back in is all in
 * localStorage already, so ask for it silently instead of making them retype a
 * room code mid-round.
 *
 * Taken as explicit arguments rather than read off `location` and storage, so
 * the policy below can be tested without a browser.
 */
export function rejoinTarget(
  search: string,
  remembered: string,
  savedName: string,
): { roomCode: string; name: string; quiet: boolean } | null {
  // `?room=` wins over the remembered room, matching the join form: a fresh
  // link for tonight must never resolve back into last week's game.
  const fromUrl = new URLSearchParams(search).get('room')
  const roomCode = (fromUrl ?? remembered).trim().toUpperCase()
  const name = savedName.trim()
  // Without both halves there is nothing to rejoin *as*. Creating a room is
  // never automatic — that is a deliberate act, and guessing it wrong strands
  // everyone else in the room this player was already in.
  if (roomCode.length !== 4 || !name) return null
  // A link is a request, so a dead room is worth explaining; a code from
  // memory is only a guess, and failing it should make no noise.
  return { roomCode, name, quiet: fromUrl === null }
}

export function PlayerApp({ game }: { game: Game }) {
  const { view } = game
  const { locale } = useLocale()

  // Once per mount. A failed rejoin (the room is gone) must land on the join
  // form and stay there rather than retrying into a room that will not answer.
  const rejoined = useRef(false)
  const { connect } = game
  useEffect(() => {
    if (rejoined.current) return
    rejoined.current = true
    const target = rejoinTarget(location.search, rememberedRoom(), rememberedName())
    if (target) connect({ kind: 'join', ...target })
  }, [connect])

  // Tell the server what this player is reading, so the board can notice a
  // mixed-language table on its own. Re-sent whenever the language changes or
  // the connection comes back, since a reconnect gets a fresh player record.
  //
  // Keyed on `send`, never on `game`: `useGame` hands back a new object on
  // every render, so an effect keyed on it re-runs on every state message —
  // and this one answers each state with a message that makes the server
  // broadcast another. That loop ran at ~2,000 messages a second from a
  // single idle phone, and was what made taps take seconds to land.
  const { send } = game
  const joined = Boolean(view)
  const online = game.status === 'open'
  useEffect(() => {
    if (joined && online) send({ t: 'locale', locale })
  }, [send, joined, online, locale])

  // Rendered once here rather than inside each screen: that is what makes the
  // toggle genuinely available on every page, including the join form. The
  // one exception is the host's setup screen, where it lives under
  // "Additional options" to keep that screen short.
  const hostSetup = view?.phase === 'lobby' && view.hostId === view.youId
  return (
    <>
      {!hostSetup && <LocaleToggle />}
      {view ? (
        <RestartProvider game={game} view={view}>
          <Screen game={game} view={view} />
        </RestartProvider>
      ) : (
        <Join game={game} />
      )}
    </>
  )
}

function Screen({ game, view }: { game: Game; view: NonNullable<Game['view']> }) {
  switch (view.phase) {
    case 'lobby':
      return <Lobby game={game} view={view} />
    case 'question':
      return <GuessScreen game={game} view={view} />
    case 'betting':
      return <BetScreen game={game} view={view} />
    case 'reveal':
      return <RevealScreen game={game} view={view} />
    case 'gameover':
      return <GameOverScreen game={game} view={view} />
  }
}

import type { Game } from '../net.ts'
import { Join } from './Join.tsx'
import { Lobby } from './Lobby.tsx'
import { GuessScreen } from './GuessScreen.tsx'
import { BetScreen } from './BetScreen.tsx'
import { RevealScreen } from './RevealScreen.tsx'
import { GameOverScreen } from './GameOverScreen.tsx'
import { RestartProvider } from './RestartProvider.tsx'

export function PlayerApp({ game }: { game: Game }) {
  const { view } = game

  if (!view) return <Join game={game} />

  return (
    <RestartProvider game={game} view={view}>
      <Screen game={game} view={view} />
    </RestartProvider>
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

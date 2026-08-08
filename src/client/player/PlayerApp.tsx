import { LocaleToggle } from '../i18n/LocaleToggle.tsx'
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

  // Rendered once here rather than inside each screen: that is what makes the
  // toggle genuinely available on every page, including the join form.
  return (
    <>
      <LocaleToggle />
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

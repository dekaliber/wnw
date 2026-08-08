import type { ClientView } from '../../shared/types.ts'
import { actedCount, expectedActors } from '../format.ts'
import { useT } from '../i18n/LocaleProvider.tsx'
import type { Game } from '../net.ts'

/**
 * The host's "move things along" action, promoted into the same footer as the
 * player's own primary button rather than tucked in a corner.
 *
 * It is deliberately not styled as *the* primary action, even though it sits
 * right beside one: a rushed tap here ends the phase for everyone still
 * filling in an answer, which is a bigger blast radius than the ordinary
 * "submit my own guess" button next to it. The count makes the cost visible
 * before the tap rather than after.
 */
export function HostAdvanceButton({ game, view }: { game: Game; view: ClientView }) {
  const t = useT()
  if (view.hostId !== view.youId) return null
  if (view.phase !== 'question' && view.phase !== 'betting') return null

  const acted = actedCount(view)
  const total = expectedActors(view).length
  const everyoneIn = total > 0 && acted >= total

  return (
    <button
      type="button"
      className={`btn btn--host-advance ${everyoneIn ? 'is-ready' : ''}`}
      onClick={() => game.send({ t: 'advance' })}
    >
      {view.phase === 'question' ? t.moveToBetting : t.revealAnswer}
      <span className="btn__count">
        {acted}/{total}
      </span>
    </button>
  )
}

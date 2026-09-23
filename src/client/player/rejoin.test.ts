import { describe, expect, it } from 'vitest'
import { rejoinTarget } from './PlayerApp.tsx'

describe('rejoining after a reload', () => {
  it('rejoins the remembered room under the remembered name', () => {
    expect(rejoinTarget('', 'ABCD', 'Tai')).toEqual({ roomCode: 'ABCD', name: 'Tai', quiet: true })
  })

  // After a server restart the remembered room is gone. That is expected, not
  // news, so it must not greet whoever opens the page with an error.
  it('fails quietly for a room from memory, but not for one from a link', () => {
    expect(rejoinTarget('', 'ABCD', 'Tai')?.quiet).toBe(true)
    expect(rejoinTarget('?room=ABCD', '', 'Tai')?.quiet).toBe(false)
  })

  // The regression this exists for: a refresh mid-round used to land on the
  // join form and make the player retype a code everyone else had moved past.
  it('needs no interaction when both halves are already stored', () => {
    expect(rejoinTarget('', 'wxyz', 'Sam')).not.toBeNull()
  })

  it('uppercases a remembered code, since room codes are compared uppercase', () => {
    expect(rejoinTarget('', 'wxyz', 'Sam')?.roomCode).toBe('WXYZ')
  })

  it('prefers ?room= over the remembered room', () => {
    // Opening tonight's fresh QR must not drop them into last week's game.
    expect(rejoinTarget('?room=newr', 'oldr', 'Tai')?.roomCode).toBe('NEWR')
  })

  it('stays on the join form with no room to go back to', () => {
    expect(rejoinTarget('', '', 'Tai')).toBeNull()
  })

  it('stays on the join form with no remembered name', () => {
    // Never invent a name — an unnamed player is not a seat anyone can reclaim.
    expect(rejoinTarget('?room=ABCD', '', '   ')).toBeNull()
  })

  it('refuses a partial code rather than joining the wrong room', () => {
    expect(rejoinTarget('', 'AB', 'Tai')).toBeNull()
    expect(rejoinTarget('', 'ABCDE', 'Tai')).toBeNull()
  })

  it('trims a stored name', () => {
    expect(rejoinTarget('', 'ABCD', '  Tai  ')?.name).toBe('Tai')
  })
})

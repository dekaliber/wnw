import { describe, expect, it } from 'vitest'
import { newId } from './id.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Stands in for a browser on plain http, where randomUUID does not exist. */
const insecureContext = {
  getRandomValues: <T extends ArrayBufferView>(array: T): T => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) % 256
    return array
  },
}

describe('device ids', () => {
  it('uses randomUUID when the page is in a secure context', () => {
    const id = newId({ randomUUID: () => '11111111-2222-4333-8444-555555555555' })
    expect(id).toBe('11111111-2222-4333-8444-555555555555')
  })

  // The regression: phones join over http://<lan-ip>, which is NOT a secure
  // context, so `crypto.randomUUID` is undefined. Before this fallback the
  // throw happened inside the socket's onopen and swallowed the join entirely.
  it('still produces a valid id with randomUUID unavailable', () => {
    const id = newId(insecureContext)
    expect(id).toMatch(UUID)
  })

  it('falls back again when getRandomValues is missing too', () => {
    expect(newId({})).toMatch(UUID)
    expect(newId(undefined)).toMatch(UUID)
  })

  it('does not collide across a realistic number of devices', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId({})))
    expect(ids.size).toBe(5000)
  })

  it('sets the version and variant bits', () => {
    const id = newId(insecureContext)
    expect(id[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })
})

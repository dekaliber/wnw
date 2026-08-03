/**
 * Generating a stable per-device id.
 *
 * `crypto.randomUUID()` exists only in a *secure context* — HTTPS, or
 * localhost. Game night is neither: phones reach the laptop over plain http on
 * a LAN IP like `http://192.168.50.150:8787`, where the whole `randomUUID`
 * method is simply undefined. Calling it there throws, and because the id is
 * generated inside the socket's `onopen`, the throw silently swallows the join
 * message — the socket connects and then nothing happens.
 *
 * `crypto.getRandomValues()` has no such restriction, so it carries the real
 * work. The last resort exists only for exotic embedded webviews; it is weaker
 * but still fine, since these ids identify a seat at a party game rather than
 * anything security-bearing.
 */

type MaybeCrypto = {
  randomUUID?: () => string
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T
}

function formatUuid(bytes: Uint8Array): string {
  // RFC 4122 version 4, variant 1.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newId(source: MaybeCrypto | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === 'function') return source.randomUUID()

  if (typeof source?.getRandomValues === 'function') {
    return formatUuid(source.getRandomValues(new Uint8Array(16)))
  }

  return formatUuid(Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)))
}

/**
 * Working out which address a phone on the same Wi-Fi can actually reach.
 *
 * `os.networkInterfaces()` is rarely a single obvious answer. A typical laptop
 * also reports VPN tunnels (`utun`, `tun`), container bridges (`docker0`,
 * `br-…`, `vboxnet`), and link-local 169.254 addresses from interfaces that
 * never got a DHCP lease. Handing any of those to the room produces a URL that
 * silently fails on every phone, so candidates are ranked rather than picked
 * first-come.
 *
 * Kept pure — it takes the interface map rather than reading it — so the
 * ranking can be tested without depending on whatever machine runs the tests.
 */

import { networkInterfaces } from 'node:os'

export interface InterfaceAddress {
  address: string
  family: string | number
  internal: boolean
}

export type InterfaceMap = Record<string, InterfaceAddress[] | undefined>

/** Interfaces that are real but that other devices cannot route to. */
const VIRTUAL_INTERFACE = /^(utun|tun|tap|ppp|ipsec|docker|br-|veth|vboxnet|vmnet|bridge|awdl|llw|zt)/i

/** Physical LAN and Wi-Fi adapters, named per-platform. */
const PHYSICAL_INTERFACE = /^(en|eth|wlan|wlp|enp|eno|wl)\d/i

function isIPv4(family: string | number): boolean {
  return family === 'IPv4' || family === 4
}

/**
 * Self-assigned, from an interface that never got a DHCP lease. Excluded
 * outright rather than scored down — no bonus should ever rescue it, since
 * nothing on the network can route to it.
 */
function isLinkLocal(address: string): boolean {
  return address.startsWith('169.254.')
}

/**
 * Higher is more likely to be the address the phones can hit. Ranked on the
 * interface name first, then on how conventional the private range is.
 */
export function scoreAddress(iface: string, address: string): number {
  let score = 0

  if (PHYSICAL_INTERFACE.test(iface)) score += 100
  if (VIRTUAL_INTERFACE.test(iface)) score -= 100

  // Ordered by how likely each range is to be the home Wi-Fi subnet.
  if (address.startsWith('192.168.')) score += 30
  else if (address.startsWith('10.')) score += 20
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 10

  return score
}

/**
 * Every plausible LAN address, best first. Empty when the machine is offline,
 * which the board surfaces rather than printing an unreachable URL.
 */
export function rankLanAddresses(interfaces: InterfaceMap): string[] {
  const candidates: { address: string; score: number }[] = []

  for (const [iface, addresses] of Object.entries(interfaces)) {
    for (const entry of addresses ?? []) {
      if (entry.internal || !isIPv4(entry.family) || isLinkLocal(entry.address)) continue
      candidates.push({ address: entry.address, score: scoreAddress(iface, entry.address) })
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.address.localeCompare(b.address))
    .map((c) => c.address)
}

export function lanAddresses(): string[] {
  return rankLanAddresses(networkInterfaces() as InterfaceMap)
}

import { describe, expect, it } from 'vitest'
import { rankLanAddresses, type InterfaceMap } from './network.ts'

const ipv4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal })

describe('picking a LAN address phones can reach', () => {
  it('prefers Wi-Fi over a VPN tunnel', () => {
    // The failure this guards against: a connected VPN shadowing the real
    // Wi-Fi address, producing a URL that fails on every phone in the room.
    const interfaces: InterfaceMap = {
      utun4: [ipv4('10.212.134.9')],
      en0: [ipv4('192.168.50.150')],
    }
    expect(rankLanAddresses(interfaces)[0]).toBe('192.168.50.150')
  })

  it('prefers Wi-Fi over a Docker bridge', () => {
    const interfaces: InterfaceMap = {
      docker0: [ipv4('172.17.0.1')],
      en0: [ipv4('192.168.1.42')],
    }
    expect(rankLanAddresses(interfaces)[0]).toBe('192.168.1.42')
  })

  it('drops loopback and IPv6', () => {
    const interfaces: InterfaceMap = {
      lo0: [ipv4('127.0.0.1', true), { address: '::1', family: 'IPv6', internal: true }],
      en0: [ipv4('192.168.0.5'), { address: 'fe80::1', family: 'IPv6', internal: false }],
    }
    expect(rankLanAddresses(interfaces)).toEqual(['192.168.0.5'])
  })

  it('never offers a self-assigned 169.254 address', () => {
    // An interface that never got a DHCP lease — reachable by nothing.
    const interfaces: InterfaceMap = { en1: [ipv4('169.254.12.9')] }
    expect(rankLanAddresses(interfaces)).toEqual([])
  })

  it('returns nothing when the laptop is offline', () => {
    expect(rankLanAddresses({ lo0: [ipv4('127.0.0.1', true)] })).toEqual([])
  })

  it('still offers an unusual address when it is all there is', () => {
    // Better to show something reachable-ish than to claim there is no network.
    const interfaces: InterfaceMap = { en0: [ipv4('100.64.3.7')] }
    expect(rankLanAddresses(interfaces)).toEqual(['100.64.3.7'])
  })

  it('accepts the numeric family some Node versions report', () => {
    const interfaces: InterfaceMap = { en0: [{ address: '192.168.7.7', family: 4, internal: false }] }
    expect(rankLanAddresses(interfaces)).toEqual(['192.168.7.7'])
  })

  it('orders every candidate, best first', () => {
    const interfaces: InterfaceMap = {
      utun0: [ipv4('10.9.9.9')],
      en0: [ipv4('192.168.50.150')],
      en1: [ipv4('10.0.0.8')],
    }
    expect(rankLanAddresses(interfaces)).toEqual(['192.168.50.150', '10.0.0.8', '10.9.9.9'])
  })
})

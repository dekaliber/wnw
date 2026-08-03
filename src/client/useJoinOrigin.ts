import { useEffect, useState } from 'react'

/**
 * The host:port the board should tell the room to type.
 *
 * The board is nearly always opened on the laptop as `localhost`, which no
 * phone can reach — so when that is the case we ask the server which of its
 * network addresses is actually routable. If the board was itself opened over
 * the network, whatever is in the address bar already demonstrably works.
 *
 * The port comes from `location`, not the server: in development Vite serves
 * the client on 5173 and only proxies the API to 8787, so the server's own
 * port would be the wrong thing to read out.
 */

export type JoinOrigin =
  | { state: 'loading' }
  | { state: 'ready'; host: string }
  | { state: 'unreachable' } // laptop has no usable network address

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

export function useJoinOrigin(): JoinOrigin {
  const [origin, setOrigin] = useState<JoinOrigin>(() =>
    LOOPBACK.has(location.hostname) ? { state: 'loading' } : { state: 'ready', host: location.host },
  )

  useEffect(() => {
    if (!LOOPBACK.has(location.hostname)) return
    let cancelled = false

    fetch('/api/net')
      .then((r) => r.json())
      .then((data: { addresses?: string[] }) => {
        if (cancelled) return
        const address = data.addresses?.[0]
        if (!address) return setOrigin({ state: 'unreachable' })
        setOrigin({
          state: 'ready',
          host: location.port ? `${address}:${location.port}` : address,
        })
      })
      .catch(() => {
        if (!cancelled) setOrigin({ state: 'unreachable' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return origin
}

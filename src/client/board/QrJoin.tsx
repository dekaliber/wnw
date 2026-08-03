import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * The scan-to-join code.
 *
 * Encodes the full join URL including `?room=`, so scanning drops someone
 * straight into the lobby with nothing to type — the room code below it is
 * the fallback for anyone whose camera will not cooperate.
 *
 * Rendered as a PNG data URL rather than injected SVG markup: the room code
 * is server-supplied, and this keeps it impossible for anything to reach the
 * DOM as HTML. `errorCorrectionLevel: 'M'` tolerates a phone camera at an
 * angle across a room without inflating the module count.
 */
export function QrJoin({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0d0e13ff', light: '#ffffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!src) return <div className="qr qr--placeholder" aria-hidden="true" />

  return (
    <div className="qr">
      <img src={src} alt={`QR code to join at ${url}`} />
    </div>
  )
}

import { fromB64url, toB64url } from './crypto'
import { MY_SIDE, SIDE_APP, type Side } from './side'

const PREFIX = 'PARISATAB1.'
const te = new TextEncoder()
const td = new TextDecoder()

export interface Pairing {
  gistId: string
  token: string
  key: string
  /** the side of the phone that generated this code */
  side: Side
}

export function encodePairing(p: Pairing): string {
  const payload = { g: p.gistId, t: p.token, k: p.key, s: p.side }
  return PREFIX + toB64url(te.encode(JSON.stringify(payload)))
}

/**
 * Decode a pairing code and refuse the one mistake that would silently corrupt
 * every balance: both phones claiming to be the same person.
 */
export function decodePairing(raw: string): Pairing {
  const code = raw.trim().replace(/\s+/g, '')
  if (!code) throw new Error('Paste the pairing code first.')
  if (!code.startsWith(PREFIX)) throw new Error('That doesn’t look like a pairing code.')

  let p: Pairing
  try {
    const json = JSON.parse(td.decode(fromB64url(code.slice(PREFIX.length)))) as Record<
      string,
      unknown
    >
    const side = json.s === 'her' || json.s === 'him' ? json.s : null
    if (!side || typeof json.g !== 'string' || typeof json.t !== 'string' || typeof json.k !== 'string') {
      throw new Error('incomplete')
    }
    p = { gistId: json.g, token: json.t, key: json.k, side }
  } catch {
    throw new Error('That pairing code is damaged — copy it again.')
  }

  if (p.side === MY_SIDE) {
    throw new Error(
      `This code was made by ${SIDE_APP[p.side]}, and this is also ${SIDE_APP[MY_SIDE]}. ` +
        'Set sync up on one phone and join from the other.',
    )
  }
  return p
}

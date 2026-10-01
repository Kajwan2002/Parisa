import type { Side } from '@/db/types'

export type { Side }

/**
 * Which person this build *is*. Baked in at build time from the variant, so a
 * phone can never be wrong about who it is:
 *   Blossom ("Parisa", hers)        → 'her'
 *   Midnight ("The Treasury", his)  → 'him'
 *
 * Every row on the wire is written in these absolute terms. The relative
 * `paidBy: 'you' | 'partner'` stored locally is derived from them on the way in
 * and collapsed back on the way out — that is the whole reason debts can't flip.
 */
export const MY_SIDE: Side = import.meta.env.VITE_SIDE === 'him' ? 'him' : 'her'

export function other(s: Side): Side {
  return s === 'her' ? 'him' : 'her'
}

export const OTHER_SIDE: Side = other(MY_SIDE)

/** Which app each side runs — used in pairing messages so mix-ups read clearly. */
export const SIDE_APP: Record<Side, string> = {
  her: 'Parisa',
  him: 'The Treasury',
}

/** Each side owns exactly one file in the gist and never writes the other's. */
export function sliceFile(s: Side): string {
  return `tab-${s}.json`
}

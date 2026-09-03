export interface Accent {
  id: string
  name: string
  base: string
  deep: string
  soft: string
}

export const ACCENTS: Accent[] = [
  { id: 'rose', name: 'Rosé', base: '#ec7fa9', deep: '#d96591', soft: '#f7a8c4' },
  { id: 'coral', name: 'Coral', base: '#f28e8e', deep: '#e06f6f', soft: '#f9b6b6' },
  { id: 'lavender', name: 'Lavender', base: '#b28ad9', deep: '#9a6fc9', soft: '#cdb2e8' },
  { id: 'peach', name: 'Peach', base: '#f2a97a', deep: '#e58f59', soft: '#f8c6a6' },
  { id: 'sky', name: 'Sky', base: '#6fb4df', deep: '#529fd0', soft: '#a9d3ef' },
]

export function accentFor(base: string | undefined): Accent {
  return ACCENTS.find((a) => a.base === base) ?? ACCENTS[0]
}

export function applyAccent(base: string | undefined): void {
  const a = accentFor(base)
  const root = document.documentElement
  root.style.setProperty('--color-rose', a.base)
  root.style.setProperty('--color-rose-deep', a.deep)
  root.style.setProperty('--color-rose-soft', a.soft)
}

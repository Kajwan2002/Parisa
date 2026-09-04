import { THEME, type Accent } from './themes'

/** the single theme this build ships */
export const activeTheme = THEME

export function accentFor(base: string | undefined): Accent {
  return THEME.accents.find((a) => a.base === base) ?? THEME.accents[0]
}

/** Paint the build's theme palette onto <html>. */
export function applyTheme(): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(THEME.vars)) {
    root.style.setProperty(`--${key}`, value)
  }
  root.dataset.theme = THEME.id
}

/** Override just the accent trio, within the theme. */
export function applyAccent(base: string | undefined): void {
  const a = accentFor(base)
  const root = document.documentElement
  root.style.setProperty('--color-rose', a.base)
  root.style.setProperty('--color-rose-deep', a.deep)
  root.style.setProperty('--color-rose-soft', a.soft)
}

/**
 * Copy written for the cute (Blossom) voice. `cheer` returns it unchanged there;
 * in a `plainCopy` theme it strips the emoji so it reads plainly.
 */
export function cheer(s: string): string {
  if (!THEME.plainCopy) return s
  return s
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const APP_NAME: string = import.meta.env.VITE_APP_NAME || 'Parisa'

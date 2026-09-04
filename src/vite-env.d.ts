/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** in-app display name (short) — set per build variant */
  readonly VITE_APP_NAME?: string
  /** theme id this build ships: 'blossom' | 'midnight' */
  readonly VITE_THEME?: string
  /** IndexedDB name for this build */
  readonly VITE_DB_NAME?: string
  /** base path, e.g. "/Parisa/" — set by the deploy workflow */
  readonly VITE_BASE?: string
}

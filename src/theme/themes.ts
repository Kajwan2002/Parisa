// A theme is a full CSS-variable palette + a few copy/decoration choices.
// Each build ships exactly one (VITE_THEME); there is no in-app switcher.

export interface Accent {
  id: string
  name: string
  base: string
  deep: string
  soft: string
}

export interface Theme {
  id: string
  name: string
  /** CSS custom properties merged onto <html> — keys without the `--` prefix */
  vars: Record<string, string>
  accents: Accent[]
  /** true → strip hearts/flowers from toasts & flourishes */
  plainCopy: boolean
  splashEmoji: string
  greeting: (hour: number) => string
  footer: (appName: string) => string
  emptyIcon: {
    expenses: string
    categories: string
    income: string
    history: string
    year: string
    recurring: string
    tab: string
    insights: string
  }
}

const BLOSSOM_ACCENTS: Accent[] = [
  { id: 'rose', name: 'Rosé', base: '#ec7fa9', deep: '#d96591', soft: '#f7a8c4' },
  { id: 'coral', name: 'Coral', base: '#f28e8e', deep: '#e06f6f', soft: '#f9b6b6' },
  { id: 'lavender', name: 'Lavender', base: '#b28ad9', deep: '#9a6fc9', soft: '#cdb2e8' },
  { id: 'peach', name: 'Peach', base: '#f2a97a', deep: '#e58f59', soft: '#f8c6a6' },
  { id: 'sky', name: 'Sky', base: '#6fb4df', deep: '#529fd0', soft: '#a9d3ef' },
]

const MIDNIGHT_ACCENTS: Accent[] = [
  { id: 'blue', name: 'Blue', base: '#4c8dff', deep: '#8bb4ff', soft: '#5a86c8' },
  { id: 'green', name: 'Green', base: '#35c491', deep: '#6be0b6', soft: '#3f9c7c' },
  { id: 'violet', name: 'Violet', base: '#9d7bff', deep: '#bda6ff', soft: '#7d63c8' },
  { id: 'amber', name: 'Amber', base: '#f0a94c', deep: '#ffc884', soft: '#c68a45' },
]

export const BLOSSOM: Theme = {
  id: 'blossom',
  name: 'Blossom',
  accents: BLOSSOM_ACCENTS,
  plainCopy: false,
  splashEmoji: '🌸',
  greeting: (h) =>
    h < 5 ? 'Late night 🌙' : h < 12 ? 'Good morning ☀️' : h < 18 ? 'Hi there 🌷' : 'Good evening 🌸',
  footer: (n) => `${n} · made with 💕`,
  emptyIcon: {
    expenses: '🧁',
    categories: '🌷',
    income: '💌',
    history: '🍃',
    year: '🌱',
    recurring: '🔁',
    tab: '🤝',
    insights: '🔍',
  },
  vars: {
    'font-sans':
      "'Quicksand Variable', ui-rounded, 'Hiragino Maru Gothic ProN', 'Segoe UI', system-ui, sans-serif",
    'color-bg': '#fff5f7',
    'color-bg-deep': '#ffeaf1',
    'color-surface': '#ffffff',
    'color-surface-2': '#fff0f5',
    'color-rose': '#ec7fa9',
    'color-rose-deep': '#d96591',
    'color-rose-soft': '#f7a8c4',
    'color-blush': '#ffe3ec',
    'color-lavender': '#c7b4e6',
    'color-peach': '#ffcaa6',
    'color-mint': '#a7e0cf',
    'color-butter': '#ffe6a8',
    'color-sky': '#a9d3ef',
    'color-ink': '#6b4753',
    'color-ink-soft': '#b0929c',
    'color-ink-faint': '#d9c3cc',
    'color-good': '#6cc9a8',
    'color-warn': '#f6b26b',
    'color-over': '#f28e8e',
    'radius-xl': '1.25rem',
    'radius-2xl': '1.75rem',
    'radius-3xl': '2rem',
    'shadow-soft': '0 8px 24px -8px rgba(236, 127, 169, 0.28)',
    'shadow-card': '0 2px 10px -2px rgba(217, 101, 145, 0.15)',
  },
}

export const MIDNIGHT: Theme = {
  id: 'midnight',
  name: 'Midnight',
  accents: MIDNIGHT_ACCENTS,
  plainCopy: true,
  splashEmoji: '',
  greeting: (h) =>
    h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Afternoon' : 'Good evening',
  footer: (n) => n,
  emptyIcon: {
    expenses: '💳',
    categories: '🏷️',
    income: '💵',
    history: '📊',
    year: '📊',
    recurring: '🔁',
    tab: '🤝',
    insights: '📈',
  },
  vars: {
    'font-sans':
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, system-ui, sans-serif",
    'color-bg': '#14171c',
    'color-bg-deep': '#0f1216',
    'color-surface': '#1e232b',
    'color-surface-2': '#2b323d',
    'color-rose': '#4c8dff',
    'color-rose-deep': '#8bb4ff',
    'color-rose-soft': '#5a86c8',
    'color-blush': '#2b3340',
    'color-lavender': '#a98fd6',
    'color-peach': '#e6a578',
    'color-mint': '#6fc3aa',
    'color-butter': '#d9bd6f',
    'color-sky': '#7fb0dd',
    'color-ink': '#e7ebf0',
    'color-ink-soft': '#a3adba',
    'color-ink-faint': '#5c6673',
    'color-good': '#3ddc9a',
    'color-warn': '#e6ab54',
    'color-over': '#ff7d7d',
    'radius-xl': '1rem',
    'radius-2xl': '1.4rem',
    'radius-3xl': '1.5rem',
    'shadow-soft': '0 10px 30px -10px rgba(0, 0, 0, 0.65)',
    'shadow-card': '0 1px 3px 0 rgba(0, 0, 0, 0.45)',
  },
}

// Each build is locked to one theme (VITE_THEME, set by the build variant).
// There is no in-app switcher — "Parisa" is always Blossom, "The Treasury" is
// always Midnight.
export const THEME: Theme = import.meta.env.VITE_THEME === 'midnight' ? MIDNIGHT : BLOSSOM

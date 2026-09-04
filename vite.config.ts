import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// ------------------------------------------------------------------ //
// Build variants — one codebase, two installable apps.
//   (default)            → hers · "Parisa"       · Blossom · db "parisa"
//   VITE_VARIANT=treasury → his  · "The Treasury" · Midnight · db "parisa-treasury"
// Locally: `npm run dev:treasury` / `npm run build:treasury` (via .env.treasury).
// In CI: the deploy workflow sets VITE_VARIANT / VITE_BASE / VITE_OUT_DIR.
// ------------------------------------------------------------------ //
const VARIANTS = {
  blossom: {
    appName: 'Parisa — Expenses',
    shortName: 'Parisa',
    description: 'A cute little app to track spending and stay on budget.',
    themeColor: '#fff5f7',
    bgColor: '#fff5f7',
    theme: 'blossom',
    dbName: 'parisa',
    statusBar: 'default',
  },
  treasury: {
    appName: 'The Treasury',
    shortName: 'The Treasury',
    description: 'Track your spending, budgets, and a shared tab.',
    themeColor: '#14171c',
    bgColor: '#14171c',
    theme: 'midnight',
    dbName: 'parisa-treasury',
    statusBar: 'black-translucent',
  },
} as const

const MIDNIGHT_CRITICAL_CSS =
  ':root{--color-bg:#14171c;--color-bg-deep:#0f1216;--color-surface:#1e232b;' +
  '--color-surface-2:#2b323d;--color-ink:#e7ebf0;--color-ink-soft:#a3adba;' +
  '--color-ink-faint:#5c6673}'

/** rewrite <title>/meta + inject first-paint CSS for the active variant */
function variantHtml(v: (typeof VARIANTS)[keyof typeof VARIANTS]): Plugin {
  return {
    name: 'parisa-variant-html',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        let out = html
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${v.appName}</title>`)
          .replace(/(<meta name="theme-color" content=")[^"]*(")/, `$1${v.themeColor}$2`)
          .replace(
            /(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/,
            `$1${v.shortName}$2`,
          )
          .replace(
            /(<meta name="apple-mobile-web-app-status-bar-style" content=")[^"]*(")/,
            `$1${v.statusBar}$2`,
          )
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${v.description}$2`)
        if (v.theme === 'midnight') {
          out = out.replace('</head>', `<style>${MIDNIGHT_CRITICAL_CSS}</style></head>`)
        }
        return out
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env.* is loaded here (process.env wins over it, for CI)
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const v = VARIANTS[(env.VITE_VARIANT as keyof typeof VARIANTS) || 'blossom'] ?? VARIANTS.blossom
  const base = env.VITE_BASE || '/'
  const outDir = env.VITE_OUT_DIR || 'dist'

  return {
    base,
    build: { outDir, emptyOutDir: true },
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(v.shortName),
      'import.meta.env.VITE_THEME': JSON.stringify(v.theme),
      'import.meta.env.VITE_DB_NAME': JSON.stringify(v.dbName),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      tailwindcss(),
      variantHtml(v),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: {
          name: v.appName,
          short_name: v.shortName,
          description: v.description,
          theme_color: v.themeColor,
          background_color: v.bgColor,
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})

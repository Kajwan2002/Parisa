// GitHub Pages serves static files only, so a deep link like /history would
// 404 before the service worker is installed. Copying index.html to 404.html
// lets Pages fall back to the SPA, which then renders the right route.
import { copyFileSync, existsSync } from 'node:fs'

if (existsSync('dist/index.html')) {
  copyFileSync('dist/index.html', 'dist/404.html')
  console.log('  ✓ dist/404.html (SPA fallback)')
}

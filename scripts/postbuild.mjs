// GitHub Pages serves static files only. Two things to handle:
//  1. a deep link (e.g. /history) 404s before the service worker is installed —
//     copying index.html → 404.html lets Pages fall back to the SPA.
//  2. the site has two apps (hers at <base>/, his at <base>mine/). Pages only
//     uses the ROOT /404.html, so that one routes an unknown path to the right
//     app's start URL.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.env.VITE_OUT_DIR || 'dist'
const base = process.env.VITE_BASE || '/' //  e.g. "/Parisa/mine/"
const index = join(outDir, 'index.html')

if (!existsSync(index)) {
  console.log(`  · ${index} not found, skipping 404`)
  process.exit(0)
}

// per-build SPA fallback
copyFileSync(index, join(outDir, '404.html'))
console.log(`  ✓ ${outDir}/404.html`)

// root deploy build: replace 404 with a router that sends unknown paths to the
// right app (only when a real base path is set, i.e. on GitHub Pages)
if (outDir === 'dist' && base !== '/') {
  const hers = base // "/Parisa/"
  const his = base.replace(/\/$/, '') + '/mine/' // "/Parisa/mine/"
  const html = `<!doctype html><meta charset="utf-8"><title>Redirecting…</title>
<script>
  var p = location.pathname, s = location.search + location.hash;
  var his = ${JSON.stringify(his)}, hers = ${JSON.stringify(hers)};
  location.replace((p.indexOf(his) === 0 ? his : hers) + s);
</script>`
  writeFileSync(join(outDir, '404.html'), html)
  console.log('  ✓ dist/404.html (two-app router)')
}

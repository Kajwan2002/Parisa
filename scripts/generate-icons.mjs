// Rasterises the app icon into the PNG sizes the manifest + iOS need.
// Blossom (default) = heart + coin. Treasury (VITE_VARIANT=treasury) = dark
// tile + blue coin. Run with: npm run icons
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
const TREASURY = process.env.VITE_VARIANT === 'treasury'

const heartPath =
  'M256 400c-8 0-15-4-20-10-58-63-96-104-96-152 0-38 30-68 68-68 22 0 42 10 55 27 13-17 33-27 55-27 38 0 68 30 68 68 0 48-38 89-96 152-5 6-12 10-20 10z'

/** @param {number} k art scale (smaller = more padding, for maskable) */
function blossomSvg(k) {
  const s = 512
  const c = s / 2
  const tx = (x) => c + (x - c) * k
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffdbe8"/><stop offset="1" stop-color="#ee88b0"/>
  </linearGradient></defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <g transform="translate(${tx(0)} ${tx(0)}) scale(${k})">
    <path fill="#ffffff" d="${heartPath}"/>
    <circle cx="352" cy="356" r="52" fill="#ffe6a8" stroke="#ffffff" stroke-width="10"/>
    <text x="352" y="377" font-family="Georgia, serif" font-size="58" font-weight="700" fill="#d96591" text-anchor="middle">€</text>
    <g fill="#ffffff">
      <path d="M150 120l8 22 22 8-22 8-8 22-8-22-22-8 22-8z"/>
      <path d="M388 150l6 16 16 6-16 6-6 16-6-16-16-6 16-6z"/>
    </g>
  </g>
</svg>`
}

/** @param {number} k art scale */
function treasurySvg(k) {
  const s = 512
  const c = s / 2
  const tx = (x) => c + (x - c) * k
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#232a35"/><stop offset="1" stop-color="#12151a"/>
  </linearGradient></defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <g transform="translate(${tx(0)} ${tx(0)}) scale(${k})">
    <!-- stacked coins -->
    <ellipse cx="256" cy="356" rx="120" ry="40" fill="#2f6ad6"/>
    <ellipse cx="256" cy="312" rx="120" ry="40" fill="#3f7ee6"/>
    <ellipse cx="256" cy="268" rx="120" ry="40" fill="#4c8dff"/>
    <text x="256" y="286" font-family="Georgia, serif" font-size="60" font-weight="700" fill="#0f1216" text-anchor="middle">€</text>
    <!-- up-tick -->
    <path d="M150 190l55-55 40 40 75-80" fill="none" stroke="#7fb0ff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M300 95h55v55" fill="none" stroke="#7fb0ff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}

const svg = TREASURY ? treasurySvg : blossomSvg

async function png(markup, size, file) {
  const buf = await sharp(Buffer.from(markup)).resize(size, size).png().toBuffer()
  await writeFile(file, buf)
  console.log('  ✓', file.replace(root + '\\', '').replace(root + '/', ''))
}

await mkdir(outDir, { recursive: true })
await png(svg(1), 192, resolve(outDir, 'icon-192.png'))
await png(svg(1), 512, resolve(outDir, 'icon-512.png'))
await png(svg(0.66), 512, resolve(outDir, 'icon-maskable-512.png'))
await png(svg(1), 180, resolve(root, 'public/apple-touch-icon.png'))
await writeFile(resolve(root, 'public/favicon.svg'), svg(1))
console.log('  ✓ public/favicon.svg')
console.log(`icons generated (${TREASURY ? 'treasury' : 'blossom'}).`)

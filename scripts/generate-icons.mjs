// Rasterises the app icon into the PNG sizes the manifest + iOS need.
// Run with: npm run icons
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

/** @param {number} artScale 0..1 — smaller = more padding (for maskable safe zone) */
function iconSvg(artScale) {
  const s = 512
  const c = s / 2
  const k = artScale // scale factor around the centre

  const tx = (x) => c + (x - c) * k
  const heartPath =
    'M256 400c-8 0-15-4-20-10-58-63-96-104-96-152 0-38 30-68 68-68 22 0 42 10 55 27 13-17 33-27 55-27 38 0 68 30 68 68 0 48-38 89-96 152-5 6-12 10-20 10z'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffdbe8"/>
      <stop offset="1" stop-color="#ee88b0"/>
    </linearGradient>
  </defs>
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

async function png(svg, size, file) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(file, buf)
  console.log('  ✓', file.replace(root + '\\', '').replace(root + '/', ''))
}

await mkdir(outDir, { recursive: true })
const normal = iconSvg(1)
const maskable = iconSvg(0.68)

await png(normal, 192, resolve(outDir, 'icon-192.png'))
await png(normal, 512, resolve(outDir, 'icon-512.png'))
await png(maskable, 512, resolve(outDir, 'icon-maskable-512.png'))
await png(normal, 180, resolve(root, 'public/apple-touch-icon.png'))
console.log('icons generated.')

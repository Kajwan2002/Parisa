// Local convenience: build the Treasury variant into dist/mine/ exactly as CI
// does. (CI sets these env vars itself and just runs `npm run build`.)
import { execSync } from 'node:child_process'

process.env.VITE_VARIANT = 'treasury'
process.env.VITE_BASE = process.env.VITE_BASE || '/Parisa/mine/'
process.env.VITE_OUT_DIR = 'dist/mine'

execSync('npm run build', { stdio: 'inherit', env: process.env })

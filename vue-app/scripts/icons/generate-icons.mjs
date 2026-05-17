import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('./icon-source.svg')

const sizes = [
  { file: 'public/icone.png',            size: 512 },
  { file: 'public/pwa-512.png',          size: 512 },
  { file: 'public/pwa-192.png',          size: 192 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-32.png',       size: 32  },
]

for (const { file, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(file)
  console.log(`✓ ${file} (${size}×${size})`)
}

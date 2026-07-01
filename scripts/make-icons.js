import { deflateSync } from "node:zlib"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, "..", "public")
const outDir = path.resolve(publicDir, "assets")

const SIZES = [16, 32, 64, 80, 96, 128]
const FAVICON_SIZES = new Set([16, 32, 64])
const SCALE = 4
const BLUE = [15, 108, 189, 255]
const WHITE = [255, 255, 255, 255]
const TRANSPARENT = [0, 0, 0, 0]

const SVG_SIZE = 80
const TILE = { x: 3, y: 3, width: 74, height: 74, radius: 16 }
const M_POINTS = [
  [17, 59],
  [17, 25],
  [40, 48],
  [63, 25],
  [63, 59],
]
const M_STROKE = 15
const EYE_CUTOUT = { x: 40, y: 46, radius: 6.1 }
const EYE_HIGHLIGHT_POINTS = [
  [38.4, 43.3],
  [38.4, 48.2],
  [41.6, 48.2],
]
const EYE_HIGHLIGHT_STROKE = 2.5

function makeIcon(size) {
  const big = size * SCALE
  const pixels = new Uint8ClampedArray(big * big * 4)

  for (let y = 0; y < big; y += 1) {
    for (let x = 0; x < big; x += 1) {
      const point = toSvgPoint(x, y, big)
      let color = TRANSPARENT

      if (insideRoundedRect(point, TILE)) {
        color = BLUE
      }
      if (distanceToPolyline(point, M_POINTS) <= M_STROKE / 2) {
        color = WHITE
      }
      if (insideCircle(point, EYE_CUTOUT.x, EYE_CUTOUT.y, EYE_CUTOUT.radius)) {
        color = BLUE
      }
      if (distanceToPolyline(point, EYE_HIGHLIGHT_POINTS) <= EYE_HIGHLIGHT_STROKE / 2) {
        color = WHITE
      }

      setPixel(pixels, big, x, y, color)
    }
  }

  return downsample(pixels, big, size, SCALE)
}

function toSvgPoint(x, y, pixelSize) {
  const scale = SVG_SIZE / pixelSize
  return {
    x: (x + 0.5) * scale,
    y: (y + 0.5) * scale,
  }
}

function insideRoundedRect(point, rect) {
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height

  if (point.x < rect.x || point.x > right || point.y < rect.y || point.y > bottom) {
    return false
  }

  const cx = clamp(point.x, rect.x + rect.radius, right - rect.radius)
  const cy = clamp(point.y, rect.y + rect.radius, bottom - rect.radius)
  return distance(point.x, point.y, cx, cy) <= rect.radius
}

function insideCircle(point, cx, cy, radius) {
  return distance(point.x, point.y, cx, cy) <= radius
}

function distanceToPolyline(point, points) {
  let nearest = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length - 1; index += 1) {
    nearest = Math.min(nearest, distanceToSegment(point, points[index], points[index + 1]))
  }
  return nearest
}

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSquared = dx * dx + dy * dy
  const rawT =
    lengthSquared === 0
      ? 0
      : ((point.x - start[0]) * dx + (point.y - start[1]) * dy) / lengthSquared
  const t = clamp(rawT, 0, 1)
  return distance(point.x, point.y, start[0] + t * dx, start[1] + t * dy)
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function setPixel(pixels, width, x, y, color) {
  const offset = (y * width + x) * 4
  pixels[offset] = color[0]
  pixels[offset + 1] = color[1]
  pixels[offset + 2] = color[2]
  pixels[offset + 3] = color[3]
}

function downsample(source, sourceSize, targetSize, scale) {
  const output = new Uint8Array(targetSize * targetSize * 4)
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sum = [0, 0, 0, 0]
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sourceOffset = ((y * scale + sy) * sourceSize + x * scale + sx) * 4
          sum[0] += source[sourceOffset]
          sum[1] += source[sourceOffset + 1]
          sum[2] += source[sourceOffset + 2]
          sum[3] += source[sourceOffset + 3]
        }
      }
      const targetOffset = (y * targetSize + x) * 4
      const samples = scale * scale
      output[targetOffset] = Math.round(sum[0] / samples)
      output[targetOffset + 1] = Math.round(sum[1] / samples)
      output[targetOffset + 2] = Math.round(sum[2] / samples)
      output[targetOffset + 3] = Math.round(sum[3] / samples)
    }
  }
  return output
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, rowStart + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function encodeIco(images) {
  const headerSize = 6
  const directorySize = images.length * 16
  let imageOffset = headerSize + directorySize
  const header = Buffer.alloc(headerSize)
  const entries = []
  const data = []

  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  for (const image of images) {
    const entry = Buffer.alloc(16)
    entry[0] = image.size >= 256 ? 0 : image.size
    entry[1] = image.size >= 256 ? 0 : image.size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.png.length, 8)
    entry.writeUInt32LE(imageOffset, 12)

    entries.push(entry)
    data.push(image.png)
    imageOffset += image.png.length
  }

  return Buffer.concat([header, ...entries, ...data])
}

function ihdr(width, height) {
  const data = Buffer.alloc(13)
  data.writeUInt32BE(width, 0)
  data.writeUInt32BE(height, 4)
  data[8] = 8
  data[9] = 6
  data[10] = 0
  data[11] = 0
  data[12] = 0
  return data
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeCrcTable() {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
}

const CRC_TABLE = makeCrcTable()

fs.mkdirSync(outDir, { recursive: true })
const faviconImages = []
for (const size of SIZES) {
  const rgba = makeIcon(size)
  const png = encodePng(size, size, rgba)
  const outputPath = path.join(outDir, `icon-${size}.png`)
  fs.writeFileSync(outputPath, png)
  if (FAVICON_SIZES.has(size)) {
    faviconImages.push({ size, png })
  }
  console.log(`wrote ${outputPath}`)
}

const faviconPath = path.join(publicDir, "favicon.ico")
fs.writeFileSync(faviconPath, encodeIco(faviconImages))
console.log(`wrote ${faviconPath}`)

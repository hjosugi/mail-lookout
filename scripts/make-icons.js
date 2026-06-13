import { deflateSync } from "node:zlib"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, "..", "public", "assets")

const SIZES = [16, 32, 64, 80, 128]
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
const M_STROKE = 10
const EYE_CUTOUT_POINTS = [
  [30.7, 45.8],
  [33.5, 41.7],
  [36.7, 39.9],
  [40, 39.9],
  [43.3, 39.9],
  [46.5, 41.7],
  [49.3, 45.8],
  [46.5, 49.9],
  [43.3, 51.7],
  [40, 51.7],
  [36.7, 51.7],
  [33.5, 49.9],
]
const EYE_OUTLINE_POINTS = [...EYE_CUTOUT_POINTS, EYE_CUTOUT_POINTS[0]]
const EYE_OUTLINE_STROKE = 1.4
const EYE_HIGHLIGHT_POINTS = [
  [42.2, 42.8],
  [42.2, 45.8],
  [45.1, 45.8],
]
const EYE_HIGHLIGHT_STROKE = 2

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
      if (insidePolygon(point, EYE_CUTOUT_POINTS)) {
        color = BLUE
      }
      if (distanceToPolyline(point, EYE_OUTLINE_POINTS) <= EYE_OUTLINE_STROKE / 2) {
        color = WHITE
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

function insidePolygon(point, points) {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index]
    const previousPoint = points[previous]
    const crossesY = currentPoint[1] > point.y !== previousPoint[1] > point.y
    const intersectionX =
      ((previousPoint[0] - currentPoint[0]) * (point.y - currentPoint[1])) /
        (previousPoint[1] - currentPoint[1]) +
      currentPoint[0]

    if (crossesY && point.x < intersectionX) {
      inside = !inside
    }
  }

  return inside
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
for (const size of SIZES) {
  const rgba = makeIcon(size)
  const png = encodePng(size, size, rgba)
  const outputPath = path.join(outDir, `icon-${size}.png`)
  fs.writeFileSync(outputPath, png)
  console.log(`wrote ${outputPath}`)
}

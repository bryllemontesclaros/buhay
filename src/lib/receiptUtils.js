import { CURRENCIES } from './utils'

const RECEIPT_CURRENCY_PATTERNS = [
  { code: 'HKD', patterns: [/HK\s*\$/i, /\bHKD\b/i, /港幣|港币/] },
  { code: 'JPY', patterns: [/￥/, /\bJPY\b/i, /円/] },
  { code: 'SGD', patterns: [/S\$/i, /\bSGD\b/i] },
  { code: 'USD', patterns: [/US\$/i, /\bUSD\b/i] },
  { code: 'EUR', patterns: [/€/, /\bEUR\b/i] },
  { code: 'GBP', patterns: [/£/, /\bGBP\b/i] },
  { code: 'PHP', patterns: [/₱/, /\bPHP\b/i, /peso/i] },
]

function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Could not prepare image.'))
    }, type, quality)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function replaceFileExtension(fileName = '', nextExtension = 'jpg') {
  const cleanedName = String(fileName || '').trim()
  if (!cleanedName) return `upload.${nextExtension}`
  if (cleanedName.includes('.')) {
    return cleanedName.replace(/\.[a-z0-9]+$/i, `.${nextExtension}`)
  }
  return `${cleanedName}.${nextExtension}`
}

function getPixelLuminance(data, index) {
  return (0.299 * data[index]) + (0.587 * data[index + 1]) + (0.114 * data[index + 2])
}

function findReceiptBounds(imageData, width, height) {
  const data = imageData.data
  const stride = Math.max(1, Math.round(Math.min(width, height) / 320))
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = ((y * width) + x) * 4
      const luminance = getPixelLuminance(data, index)
      const maxChannel = Math.max(data[index], data[index + 1], data[index + 2])
      const minChannel = Math.min(data[index], data[index + 1], data[index + 2])
      const saturation = maxChannel - minChannel

      if (luminance < 242 || saturation > 16) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null
  }

  const boxWidth = maxX - minX
  const boxHeight = maxY - minY
  const coverage = (boxWidth * boxHeight) / Math.max(width * height, 1)

  if (coverage < 0.12 || coverage > 0.98) {
    return null
  }

  const padding = Math.max(18, Math.round(Math.min(width, height) * 0.02))
  const x = Math.max(0, minX - padding)
  const y = Math.max(0, minY - padding)
  return {
    x,
    y,
    width: Math.min(width - x, boxWidth + (padding * 2)),
    height: Math.min(height - y, boxHeight + (padding * 2)),
  }
}

function enhanceReceiptCanvas(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  const luminances = new Uint8Array(data.length / 4)
  let min = 255
  let max = 0

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const luminance = getPixelLuminance(data, index)
    luminances[pixel] = luminance
    min = Math.min(min, luminance)
    max = Math.max(max, luminance)
  }

  const range = Math.max(1, max - min)
  const boost = range < 60 ? 1.32 : range < 110 ? 1.2 : 1.12

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const normalized = (luminances[pixel] - min) / range
    let value = (normalized * 255)
    value = ((value - 128) * boost) + 136
    if (value < 176) value -= 20
    const next = clamp(Math.round(value))
    data[index] = next
    data[index + 1] = next
    data[index + 2] = next
    data[index + 3] = 255
  }

  context.putImageData(imageData, 0, 0)
}

function getCurrencyCodes() {
  return new Set(CURRENCIES.map(currency => currency.code))
}

export function normalizeReceiptCurrency(code, fallback = 'PHP') {
  const normalized = String(code || '').trim().toUpperCase()
  if (getCurrencyCodes().has(normalized)) return normalized
  return fallback
}

export function detectReceiptCurrency(text = '', fallback = 'PHP') {
  const source = String(text || '')
  const match = RECEIPT_CURRENCY_PATTERNS.find(entry => entry.patterns.some(pattern => pattern.test(source)))
  return normalizeReceiptCurrency(match?.code || fallback, fallback)
}

export async function prepareImageUpload(file, options = {}) {
  if (typeof document === 'undefined' || !file) {
    throw new Error('Image preparation is unavailable.')
  }

  const {
    maxEdge = 1800,
    maxBytes = 4 * 1024 * 1024,
    quality = 0.88,
    minimumQuality = 0.64,
    minimumEdge = 960,
  } = options

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    let scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1))
    let width = Math.max(1, Math.round((image.width || 1) * scale))
    let height = Math.max(1, Math.round((image.height || 1) * scale))
    let currentQuality = quality

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Image preparation is unavailable.')

    async function render(nextWidth, nextHeight, nextQuality) {
      canvas.width = nextWidth
      canvas.height = nextHeight
      context.clearRect(0, 0, nextWidth, nextHeight)
      context.drawImage(image, 0, 0, nextWidth, nextHeight)
      return canvasToBlob(canvas, 'image/jpeg', nextQuality)
    }

    let blob = await render(width, height, currentQuality)

    for (let attempt = 0; blob.size > maxBytes && attempt < 6; attempt += 1) {
      if (currentQuality > minimumQuality) {
        currentQuality = Math.max(minimumQuality, currentQuality - 0.08)
      } else {
        const longestEdge = Math.max(width, height)
        if (longestEdge <= minimumEdge) break
        const nextScale = Math.max(minimumEdge / longestEdge, 0.82)
        width = Math.max(1, Math.round(width * nextScale))
        height = Math.max(1, Math.round(height * nextScale))
      }

      blob = await render(width, height, currentQuality)
    }

    return {
      blob,
      fileName: replaceFileExtension(file.name, 'jpg'),
      width,
      height,
      cleanupSummary: blob.size < file.size ? 'Resized for upload' : 'Prepared for upload',
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function preprocessReceiptImage(file) {
  if (typeof document === 'undefined' || !file) {
    throw new Error('Receipt preprocessing is unavailable.')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const maxEdge = 2200
    const scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1))
    const width = Math.max(1, Math.round((image.width || 1) * scale))
    const height = Math.max(1, Math.round((image.height || 1) * scale))

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = width
    sourceCanvas.height = height

    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
    sourceContext.fillStyle = '#ffffff'
    sourceContext.fillRect(0, 0, width, height)
    sourceContext.drawImage(image, 0, 0, width, height)

    const sourceData = sourceContext.getImageData(0, 0, width, height)
    const crop = findReceiptBounds(sourceData, width, height)
    const cropWidth = crop?.width || width
    const cropHeight = crop?.height || height

    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = cropWidth
    croppedCanvas.height = cropHeight

    const croppedContext = croppedCanvas.getContext('2d', { willReadFrequently: true })
    croppedContext.fillStyle = '#ffffff'
    croppedContext.fillRect(0, 0, cropWidth, cropHeight)
    croppedContext.drawImage(
      sourceCanvas,
      crop?.x || 0,
      crop?.y || 0,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    )

    const cleanedCanvas = document.createElement('canvas')
    cleanedCanvas.width = cropWidth
    cleanedCanvas.height = cropHeight

    const cleanedContext = cleanedCanvas.getContext('2d', { willReadFrequently: true })
    cleanedContext.fillStyle = '#ffffff'
    cleanedContext.fillRect(0, 0, cropWidth, cropHeight)
    cleanedContext.drawImage(croppedCanvas, 0, 0)
    enhanceReceiptCanvas(cleanedCanvas)

    const originalBlob = await canvasToBlob(sourceCanvas, 'image/jpeg', 0.9)
    const cleanedBlob = await canvasToBlob(cleanedCanvas, 'image/jpeg', 0.92)
    const originalDataUrl = await blobToDataUrl(originalBlob)
    const cleanedDataUrl = await blobToDataUrl(cleanedBlob)

    return {
      originalBlob,
      cleanedBlob,
      originalDataUrl,
      cleanedDataUrl,
      width,
      height,
      cleanedWidth: cropWidth,
      cleanedHeight: cropHeight,
      cleanupSummary: crop ? 'Auto-trim + contrast boost' : 'Contrast boost',
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

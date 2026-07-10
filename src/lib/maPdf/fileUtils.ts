import {
  MAX_JPG_CANVAS_DIMENSION,
  MAX_JPG_CANVAS_PIXELS
} from './constants'

export function createFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)

  return copy.buffer
}

export function sanitizeFileName(name: string) {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function isPdfFile(file: File) {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1500)
}

export function parsePageRanges(value: string, pageCount: number) {
  const cleaned = value.replace(/\s+/g, '')

  if (!cleaned) {
    throw new Error('Indique pelo menos uma página ou intervalo.')
  }

  const pageIndexes = new Set<number>()
  const parts = cleaned.split(',').filter(Boolean)

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const page = Number(part)

      if (page < 1 || page > pageCount) {
        throw new Error(
          `A página ${page} não existe. O documento tem ${pageCount} páginas.`
        )
      }

      pageIndexes.add(page - 1)
      continue
    }

    const match = part.match(/^(\d+)-(\d+)$/)

    if (!match) {
      throw new Error(
        'Use páginas e intervalos no formato 1-3, 5, 8-10.'
      )
    }

    const start = Number(match[1])
    const end = Number(match[2])

    if (start > end) {
      throw new Error(`O intervalo ${part} está invertido.`)
    }

    if (start < 1 || end > pageCount) {
      throw new Error(
        `O intervalo ${part} ultrapassa as ${pageCount} páginas do documento.`
      )
    }

    for (let page = start; page <= end; page += 1) {
      pageIndexes.add(page - 1)
    }
  }

  return Array.from(pageIndexes).sort((a, b) => a - b)
}

export function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível criar a imagem JPG.'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality
    )
  })
}

export async function blobToUint8Array(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

export function getSafeJpgScale(
  width: number,
  height: number,
  desiredScale: number
) {
  const dimensionScale = Math.min(
    MAX_JPG_CANVAS_DIMENSION / width,
    MAX_JPG_CANVAS_DIMENSION / height
  )

  const pixelScale = Math.sqrt(
    MAX_JPG_CANVAS_PIXELS / Math.max(width * height, 1)
  )

  return Math.max(0.5, Math.min(desiredScale, dimensionScale, pixelScale))
}

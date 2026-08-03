import type {
  Canvas
} from 'fabric'
import {
  PDFDocument
} from 'pdf-lib'

import type {
  MAQuadroDesign,
  MAQuadroExportScale
} from '../../types/maQuadro'

export function safeMAQuadroFileName(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'design-ma-quadro'
}

export function downloadMAQuadroBlob(
  blob: Blob,
  fileName: string
) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

export function exportMAQuadroDesignJson(
  design: MAQuadroDesign
) {
  downloadMAQuadroBlob(
    new Blob(
      [JSON.stringify(design, null, 2)],
      {
        type: 'application/json;charset=utf-8'
      }
    ),
    `${safeMAQuadroFileName(design.name)}.ma-quadro.json`
  )
}

export function exportMAQuadroPng(
  canvas: Canvas,
  designName: string,
  scale: MAQuadroExportScale
) {
  const activeObject = canvas.getActiveObject()

  canvas.discardActiveObject()
  canvas.requestRenderAll()

  const dataUrl = canvas.toDataURL({
    format: 'png',
    multiplier: scale,
    enableRetinaScaling: false
  })
  const anchor = document.createElement('a')

  anchor.href = dataUrl
  anchor.download = `${safeMAQuadroFileName(
    designName
  )}-${scale}x.png`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  if (activeObject) {
    canvas.setActiveObject(activeObject)
    canvas.requestRenderAll()
  }
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || ''
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export async function exportMAQuadroPdf(
  canvas: Canvas,
  designName: string
) {
  const activeObject = canvas.getActiveObject()

  canvas.discardActiveObject()
  canvas.requestRenderAll()

  const dataUrl = canvas.toDataURL({
    format: 'png',
    multiplier: 1,
    enableRetinaScaling: false
  })
  const pdf = await PDFDocument.create()
  const image = await pdf.embedPng(
    dataUrlToBytes(dataUrl)
  )
  const width = canvas.getWidth()
  const height = canvas.getHeight()
  const scale = Math.min(
    1,
    842 / Math.max(width, height)
  )
  const pageWidth = width * scale
  const pageHeight = height * scale
  const page = pdf.addPage([
    pageWidth,
    pageHeight
  ])

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight
  })

  const bytes = await pdf.save()

  downloadMAQuadroBlob(
    new Blob([bytes as BlobPart], {
      type: 'application/pdf'
    }),
    `${safeMAQuadroFileName(designName)}.pdf`
  )

  if (activeObject) {
    canvas.setActiveObject(activeObject)
    canvas.requestRenderAll()
  }
}

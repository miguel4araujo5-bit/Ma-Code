import { zipSync } from 'fflate'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type {
  JpgQuality,
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'
import {
  blobToUint8Array,
  bytesToArrayBuffer,
  canvasToJpegBlob,
  getSafeJpgScale,
  sanitizeFileName
} from './fileUtils'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export async function convertPdfToJpg(
  selected: SelectedPdf | undefined,
  jpgQuality: JpgQuality,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error('Escolha um ficheiro PDF para converter para JPG.')
  }

  onProgress('A preparar o conversor de PDF para JPG...')

  const data = new Uint8Array(await selected.file.arrayBuffer())
  const loadingTask = getDocument({ data })

  try {
    const pdfDocument = await loadingTask.promise
    const pageCount = pdfDocument.numPages

    if (pageCount === 0) {
      throw new Error('O documento não contém páginas.')
    }

    const desiredScale = jpgQuality === 'high' ? 2.5 : 1.75
    const jpegQuality = jpgQuality === 'high' ? 0.94 : 0.86
    const baseName = sanitizeFileName(selected.file.name)
    const zipFiles: Record<string, Uint8Array> = {}
    let singlePageBlob: Blob | null = null

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onProgress(
        `A converter página ${pageNumber} de ${pageCount} para JPG...`
      )

      const page = await pdfDocument.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const safeScale = getSafeJpgScale(
        baseViewport.width,
        baseViewport.height,
        desiredScale
      )
      const viewport = page.getViewport({ scale: safeScale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', {
        alpha: false
      })

      if (!context) {
        throw new Error(
          'O navegador não conseguiu preparar a imagem desta página.'
        )
      }

      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        background: 'rgb(255, 255, 255)'
      }).promise

      const jpgBlob = await canvasToJpegBlob(canvas, jpegQuality)
      const pageNumberText = String(pageNumber).padStart(
        String(pageCount).length,
        '0'
      )
      const jpgFileName = `${baseName}-pagina-${pageNumberText}.jpg`

      if (pageCount === 1) {
        singlePageBlob = jpgBlob
      } else {
        zipFiles[jpgFileName] = await blobToUint8Array(jpgBlob)
      }

      page.cleanup()
      canvas.width = 1
      canvas.height = 1
    }

    if (pageCount === 1 && singlePageBlob) {
      return {
        fileName: `${baseName}-pagina-1.jpg`,
        blob: singlePageBlob,
        originalSize: selected.file.size,
        finalSize: singlePageBlob.size,
        message: 'A página do PDF foi convertida para uma imagem JPG.'
      }
    }

    onProgress('A criar o ficheiro ZIP com as imagens JPG...')

    const zipBytes = zipSync(zipFiles, {
      level: 0
    })

    const blob = new Blob([bytesToArrayBuffer(zipBytes)], {
      type: 'application/zip'
    })

    return {
      fileName: `${baseName}-paginas-jpg.zip`,
      blob,
      originalSize: selected.file.size,
      finalSize: blob.size,
      message: `${pageCount} páginas foram convertidas para JPG e organizadas num ficheiro ZIP.`
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker não deve impedir a entrega do resultado criado.
    }
  }
}

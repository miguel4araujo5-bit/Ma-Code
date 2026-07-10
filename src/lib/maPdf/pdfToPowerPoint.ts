import PptxGenJS from 'pptxgenjs'

import {
  GlobalWorkerOptions,
  getDocument
} from 'pdfjs-dist'

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import {
  getSafeJpgScale,
  sanitizeFileName
} from './fileUtils'

GlobalWorkerOptions.workerSrc =
  pdfWorkerUrl

const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const SLIDE_WIDTH = 13.333
const SLIDE_HEIGHT = 7.5

function getBaseName(
  fileName: string
) {
  return (
    sanitizeFileName(
      fileName.replace(
        /\.pdf$/i,
        ''
      )
    ) || 'documento-pdf'
  )
}

function getContainedPlacement(
  imageWidth: number,
  imageHeight: number
) {
  const imageRatio =
    imageWidth / imageHeight

  const slideRatio =
    SLIDE_WIDTH /
    SLIDE_HEIGHT

  if (imageRatio >= slideRatio) {
    const width =
      SLIDE_WIDTH

    const height =
      width / imageRatio

    return {
      x: 0,
      y:
        (SLIDE_HEIGHT -
          height) /
        2,
      width,
      height
    }
  }

  const height =
    SLIDE_HEIGHT

  const width =
    height * imageRatio

  return {
    x:
      (SLIDE_WIDTH -
        width) /
      2,
    y: 0,
    width,
    height
  }
}

function toBlob(
  value: unknown
) {
  if (value instanceof Blob) {
    return value
  }

  if (
    value instanceof ArrayBuffer
  ) {
    return new Blob(
      [value],
      {
        type: PPTX_MIME_TYPE
      }
    )
  }

  if (
    ArrayBuffer.isView(value)
  ) {
    const view =
      value as ArrayBufferView

    const copy =
      new Uint8Array(
        view.byteLength
      )

    copy.set(
      new Uint8Array(
        view.buffer,
        view.byteOffset,
        view.byteLength
      )
    )

    return new Blob(
      [copy.buffer],
      {
        type: PPTX_MIME_TYPE
      }
    )
  }

  throw new Error(
    'O navegador não conseguiu criar o ficheiro PowerPoint.'
  )
}

export async function convertPdfToPowerPoint(
  selected:
    | SelectedPdf
    | undefined,
  onProgress:
    ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para converter para PowerPoint.'
    )
  }

  onProgress(
    'A preparar a conversão para PowerPoint...'
  )

  const data =
    new Uint8Array(
      await selected.file.arrayBuffer()
    )

  const loadingTask =
    getDocument({
      data
    })

  try {
    const pdfDocument =
      await loadingTask.promise

    if (
      pdfDocument.numPages === 0
    ) {
      throw new Error(
        'O documento não contém páginas.'
      )
    }

    const presentation =
      new PptxGenJS()

    presentation.layout =
      'LAYOUT_WIDE'

    presentation.author =
      'MA-Code'

    presentation.company =
      'MA-Code'

    presentation.subject =
      'PDF convertido para PowerPoint'

    presentation.title =
      getBaseName(
        selected.file.name
      )

    for (
      let pageNumber = 1;
      pageNumber <=
      pdfDocument.numPages;
      pageNumber += 1
    ) {
      onProgress(
        `A converter a página ${pageNumber} de ${pdfDocument.numPages} para slide...`
      )

      const page =
        await pdfDocument.getPage(
          pageNumber
        )

      const baseViewport =
        page.getViewport({
          scale: 1
        })

      const scale =
        getSafeJpgScale(
          baseViewport.width,
          baseViewport.height,
          2
        )

      const viewport =
        page.getViewport({
          scale
        })

      const canvas =
        document.createElement(
          'canvas'
        )

      const context =
        canvas.getContext(
          '2d',
          {
            alpha: false
          }
        )

      if (!context) {
        throw new Error(
          'O navegador não conseguiu preparar a imagem desta página.'
        )
      }

      canvas.width =
        Math.max(
          1,
          Math.ceil(
            viewport.width
          )
        )

      canvas.height =
        Math.max(
          1,
          Math.ceil(
            viewport.height
          )
        )

      await page.render({
        canvas,
        canvasContext:
          context,
        viewport,
        background:
          'rgb(255, 255, 255)'
      }).promise

      const imageData =
        canvas.toDataURL(
          'image/jpeg',
          0.92
        )

      const placement =
        getContainedPlacement(
          canvas.width,
          canvas.height
        )

      const slide =
        presentation.addSlide()

      slide.background = {
        color: 'FFFFFF'
      }

      slide.addImage({
        data: imageData,
        x: placement.x,
        y: placement.y,
        w: placement.width,
        h: placement.height
      })

      page.cleanup()

      canvas.width = 1
      canvas.height = 1
    }

    onProgress(
      'A criar o ficheiro PowerPoint...'
    )

    const output =
      await presentation.write({
        outputType: 'blob'
      })

    const blob =
      toBlob(output)

    return {
      fileName: `${getBaseName(
        selected.file.name
      )}-convertido.pptx`,
      blob,
      originalSize:
        selected.file.size,
      finalSize:
        blob.size,
      message: `${pdfDocument.numPages} página${
        pdfDocument.numPages === 1
          ? ''
          : 's'
      } ${
        pdfDocument.numPages === 1
          ? 'foi convertida'
          : 'foram convertidas'
      } para PowerPoint. Cada página foi colocada como imagem num slide para preservar o aspeto visual do PDF.`
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker
      // não deve impedir o resultado.
    }
  }
}

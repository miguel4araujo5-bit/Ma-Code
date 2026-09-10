import {
  GlobalWorkerOptions,
  getDocument
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  reconstructScheduleGridDocument,
  type ScheduleGeometryPageInput,
  type ScheduleGeometryTextItem,
  type ScheduleGridDocument
} from './scheduleGridGeometry'

GlobalWorkerOptions.workerSrc =
  pdfWorkerUrl

type PdfTextItemLike = {
  str?: unknown
  transform?: unknown
  width?: unknown
  height?: unknown
}

type PdfTextContentChunkLike = {
  items?: unknown
}

export type ScheduleGridPdfAnalysis = {
  grid: ScheduleGridDocument
  sourcePages: ScheduleGeometryPageInput[]
}

function finiteNumber(
  value: unknown,
  fallback = 0
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback
}

function rawPdfText(value: unknown) {
  return typeof value === 'string'
    ? value.replace(
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,
        ''
      )
    : ''
}

function toGeometryTextItem(
  value: unknown
): ScheduleGeometryTextItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const item = value as PdfTextItemLike
  const text = rawPdfText(item.str)

  if (
    !text.trim() ||
    !Array.isArray(item.transform) ||
    item.transform.length < 6
  ) {
    return null
  }

  const transform = item.transform
  const x = finiteNumber(transform[4])
  const y = finiteNumber(transform[5])
  const measuredHeight = Math.hypot(
    finiteNumber(transform[2]),
    finiteNumber(transform[3])
  )
  const height = Math.max(
    1,
    finiteNumber(item.height, measuredHeight || 10),
    measuredHeight
  )
  const estimatedWidth = Math.max(
    text.length * height * 0.45,
    height * 0.5
  )
  const width = Math.max(
    0,
    finiteNumber(item.width, estimatedWidth)
  )

  return {
    text,
    x,
    y,
    width,
    height
  }
}

async function readPdfTextItems(
  page: {
    streamTextContent: () => ReadableStream<unknown>
  }
) {
  const reader =
    page.streamTextContent().getReader()
  const items: unknown[] = []

  try {
    while (true) {
      const result =
        await reader.read()

      if (result.done) {
        break
      }

      const chunk =
        result.value

      if (!chunk || typeof chunk !== 'object') {
        continue
      }

      const chunkItems =
        (chunk as PdfTextContentChunkLike).items

      if (Array.isArray(chunkItems)) {
        items.push(...chunkItems)
      }
    }
  } finally {
    reader.releaseLock()
  }

  return items
}

export async function extractScheduleGridAnalysisFromPdf(
  file: File,
  onProgress: (message: string) => void = () => {}
): Promise<ScheduleGridPdfAnalysis> {
  if (
    file.type !== 'application/pdf' &&
    !file.name.toLocaleLowerCase('pt-PT').endsWith('.pdf')
  ) {
    throw new Error('Selecione um ficheiro PDF.')
  }

  onProgress(
    'A reconstruir a grelha original do horário...'
  )

  const data =
    new Uint8Array(
      await file.arrayBuffer()
    )
  const loadingTask =
    getDocument({ data })

  try {
    const pdfDocument =
      await loadingTask.promise
    const pages:
      ScheduleGeometryPageInput[] = []
    let sourceItemCount = 0

    if (pdfDocument.numPages === 0) {
      throw new Error(
        'O documento não contém páginas.'
      )
    }

    for (
      let pageNumber = 1;
      pageNumber <= pdfDocument.numPages;
      pageNumber += 1
    ) {
      onProgress(
        `A reconstruir a grelha da página ${pageNumber} de ${pdfDocument.numPages}...`
      )

      const page =
        await pdfDocument.getPage(
          pageNumber
        )
      const textItems =
        await readPdfTextItems(page)
      const items =
        textItems
          .map(toGeometryTextItem)
          .filter(
            (
              item
            ): item is ScheduleGeometryTextItem =>
              item !== null
          )

      sourceItemCount +=
        items.length
      pages.push({
        pageNumber,
        items
      })

      page.cleanup()
    }

    if (sourceItemCount === 0) {
      throw new Error(
        'Este PDF não contém texto selecionável. A captura geométrica ainda não usa OCR.'
      )
    }

    return {
      grid: reconstructScheduleGridDocument(
        pages
      ),
      sourcePages: pages.map(page => ({
        pageNumber: page.pageNumber,
        items: page.items.map(item => ({ ...item }))
      }))
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker não deve esconder
      // o resultado ou o erro principal.
    }
  }
}

export async function extractScheduleGridFromPdf(
  file: File,
  onProgress: (message: string) => void = () => {}
): Promise<ScheduleGridDocument> {
  const analysis =
    await extractScheduleGridAnalysisFromPdf(
      file,
      onProgress
    )

  return analysis.grid
}

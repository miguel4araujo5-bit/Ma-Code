import { zipSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import type {
  ProgressCallback,
  ResultData,
  SelectedPdf,
  SplitMode
} from '../../types/maPdf'
import {
  bytesToArrayBuffer,
  parsePageRanges,
  sanitizeFileName
} from './fileUtils'

async function splitPdfByRanges(
  sourceDocument: PDFDocument,
  selected: SelectedPdf,
  splitRanges: string,
  onProgress: ProgressCallback
): Promise<ResultData> {
  const pageCount = sourceDocument.getPageCount()
  const selectedPageIndexes = parsePageRanges(splitRanges, pageCount)

  onProgress('A copiar as páginas selecionadas...')

  const outputDocument = await PDFDocument.create()
  const copiedPages = await outputDocument.copyPages(
    sourceDocument,
    selectedPageIndexes
  )

  copiedPages.forEach((page) => {
    outputDocument.addPage(page)
  })

  const outputBytes = await outputDocument.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 30
  })

  const blob = new Blob([bytesToArrayBuffer(outputBytes)], {
    type: 'application/pdf'
  })

  return {
    fileName: `${sanitizeFileName(selected.file.name)}-paginas-selecionadas.pdf`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message: `${selectedPageIndexes.length} página${
      selectedPageIndexes.length === 1 ? '' : 's'
    } foram extraídas para um novo PDF.`
  }
}

async function splitPdfIntoIndividualPages(
  sourceDocument: PDFDocument,
  selected: SelectedPdf,
  onProgress: ProgressCallback
): Promise<ResultData> {
  const pageCount = sourceDocument.getPageCount()
  const zipFiles: Record<string, Uint8Array> = {}

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    onProgress(`A separar página ${pageIndex + 1} de ${pageCount}...`)

    const pageDocument = await PDFDocument.create()
    const [copiedPage] = await pageDocument.copyPages(sourceDocument, [
      pageIndex
    ])

    pageDocument.addPage(copiedPage)

    const pageBytes = await pageDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 30
    })

    const pageNumber = String(pageIndex + 1).padStart(
      String(pageCount).length,
      '0'
    )

    zipFiles[
      `${sanitizeFileName(selected.file.name)}-pagina-${pageNumber}.pdf`
    ] = pageBytes
  }

  onProgress('A criar o ficheiro ZIP...')

  const zipBytes = zipSync(zipFiles, {
    level: 6
  })

  const blob = new Blob([bytesToArrayBuffer(zipBytes)], {
    type: 'application/zip'
  })

  return {
    fileName: `${sanitizeFileName(selected.file.name)}-paginas.zip`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message: `${pageCount} páginas foram separadas em ficheiros PDF individuais.`
  }
}

export async function splitPdfFile(
  selected: SelectedPdf | undefined,
  splitMode: SplitMode,
  splitRanges: string,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error('Escolha um ficheiro PDF para dividir.')
  }

  onProgress('A analisar o documento PDF...')

  const bytes = await selected.file.arrayBuffer()
  const sourceDocument = await PDFDocument.load(bytes, {
    updateMetadata: false
  })

  if (sourceDocument.getPageCount() === 0) {
    throw new Error('O documento não contém páginas.')
  }

  if (splitMode === 'individual') {
    return splitPdfIntoIndividualPages(
      sourceDocument,
      selected,
      onProgress
    )
  }

  return splitPdfByRanges(
    sourceDocument,
    selected,
    splitRanges,
    onProgress
  )
}

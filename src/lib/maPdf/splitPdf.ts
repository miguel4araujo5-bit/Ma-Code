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

async function splitPdfIntoPageGroups(
  sourceDocument: PDFDocument,
  selected: SelectedPdf,
  splitGroupSize: number,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!Number.isInteger(splitGroupSize) || splitGroupSize < 1) {
    throw new Error('Indique um número válido de páginas por grupo.')
  }

  const pageCount = sourceDocument.getPageCount()
  const groupCount = Math.ceil(pageCount / splitGroupSize)
  const numberPadding = String(pageCount).length
  const zipFiles: Record<string, Uint8Array> = {}
  const sanitizedFileName = sanitizeFileName(selected.file.name)

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const startPageIndex = groupIndex * splitGroupSize
    const endPageIndex = Math.min(
      startPageIndex + splitGroupSize,
      pageCount
    )
    const startPageNumber = startPageIndex + 1
    const endPageNumber = endPageIndex

    onProgress(
      `A criar grupo ${groupIndex + 1} de ${groupCount} ` +
        `(páginas ${startPageNumber}-${endPageNumber})...`
    )

    const groupDocument = await PDFDocument.create()
    const pageIndexes = Array.from(
      { length: endPageIndex - startPageIndex },
      (_, index) => startPageIndex + index
    )
    const copiedPages = await groupDocument.copyPages(
      sourceDocument,
      pageIndexes
    )

    copiedPages.forEach((page) => {
      groupDocument.addPage(page)
    })

    const groupBytes = await groupDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 30
    })
    const paddedStartPage = String(startPageNumber).padStart(
      numberPadding,
      '0'
    )
    const paddedEndPage = String(endPageNumber).padStart(
      numberPadding,
      '0'
    )

    zipFiles[
      `${sanitizedFileName}-paginas-${paddedStartPage}-a-${paddedEndPage}.pdf`
    ] = groupBytes
  }

  onProgress('A criar o ficheiro ZIP...')

  const zipBytes = zipSync(zipFiles, {
    level: 6
  })
  const blob = new Blob([bytesToArrayBuffer(zipBytes)], {
    type: 'application/zip'
  })

  return {
    fileName: `${sanitizedFileName}-grupos-de-${splitGroupSize}-paginas.zip`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message: `${pageCount} páginas foram divididas em ${groupCount} ficheiro${
      groupCount === 1 ? '' : 's'
    } PDF, com até ${splitGroupSize} página${
      splitGroupSize === 1 ? '' : 's'
    } por grupo.`
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
  splitGroupSize: number,
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

  if (splitMode === 'groups') {
    return splitPdfIntoPageGroups(
      sourceDocument,
      selected,
      splitGroupSize,
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

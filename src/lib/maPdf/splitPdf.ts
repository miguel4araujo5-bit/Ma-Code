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
  sanitizeFileName
} from './fileUtils'

type PageGroup = {
  startPage: number
  endPage: number
  pageIndexes: number[]
}

function parsePageGroups(
  value: string,
  pageCount: number
): PageGroup[] {
  const cleaned = value.replace(/\s+/g, '')

  if (!cleaned) {
    throw new Error('Indique pelo menos uma página ou intervalo.')
  }

  const parts = cleaned.split(',').filter(Boolean)

  if (parts.length === 0) {
    throw new Error('Indique pelo menos uma página ou intervalo.')
  }

  return parts.map((part) => {
    if (/^\d+$/.test(part)) {
      const page = Number(part)

      if (page < 1 || page > pageCount) {
        throw new Error(
          `A página ${page} não existe. O documento tem ${pageCount} páginas.`
        )
      }

      return {
        startPage: page,
        endPage: page,
        pageIndexes: [page - 1]
      }
    }

    const match = part.match(/^(\d+)-(\d+)$/)

    if (!match) {
      throw new Error(
        'Use páginas e intervalos no formato 1-3, 5, 8-10.'
      )
    }

    const startPage = Number(match[1])
    const endPage = Number(match[2])

    if (startPage > endPage) {
      throw new Error(`O intervalo ${part} está invertido.`)
    }

    if (startPage < 1 || endPage > pageCount) {
      throw new Error(
        `O intervalo ${part} ultrapassa as ${pageCount} páginas do documento.`
      )
    }

    return {
      startPage,
      endPage,
      pageIndexes: Array.from(
        { length: endPage - startPage + 1 },
        (_, index) => startPage - 1 + index
      )
    }
  })
}

async function createPdfBytes(
  sourceDocument: PDFDocument,
  pageIndexes: number[]
) {
  const outputDocument = await PDFDocument.create()
  const copiedPages = await outputDocument.copyPages(
    sourceDocument,
    pageIndexes
  )

  copiedPages.forEach((page) => {
    outputDocument.addPage(page)
  })

  return outputDocument.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 30
  })
}

function getRangeFileName(
  sanitizedFileName: string,
  group: PageGroup,
  groupIndex: number,
  groupCount: number,
  pageCount: number
) {
  const groupPadding = String(groupCount).length
  const pagePadding = String(pageCount).length
  const groupNumber = String(groupIndex + 1).padStart(groupPadding, '0')
  const startPage = String(group.startPage).padStart(pagePadding, '0')
  const endPage = String(group.endPage).padStart(pagePadding, '0')
  const pageLabel =
    group.startPage === group.endPage
      ? `pagina-${startPage}`
      : `paginas-${startPage}-a-${endPage}`

  return `${sanitizedFileName}-grupo-${groupNumber}-${pageLabel}.pdf`
}

async function splitPdfByRanges(
  sourceDocument: PDFDocument,
  selected: SelectedPdf,
  splitRanges: string,
  onProgress: ProgressCallback
): Promise<ResultData> {
  const pageCount = sourceDocument.getPageCount()
  const pageGroups = parsePageGroups(splitRanges, pageCount)
  const sanitizedFileName = sanitizeFileName(selected.file.name)

  if (pageGroups.length === 1) {
    const [pageGroup] = pageGroups

    onProgress('A criar o PDF com o intervalo selecionado...')

    const outputBytes = await createPdfBytes(
      sourceDocument,
      pageGroup.pageIndexes
    )
    const blob = new Blob([bytesToArrayBuffer(outputBytes)], {
      type: 'application/pdf'
    })

    return {
      fileName: getRangeFileName(
        sanitizedFileName,
        pageGroup,
        0,
        1,
        pageCount
      ),
      blob,
      originalSize: selected.file.size,
      finalSize: blob.size,
      message: `${pageGroup.pageIndexes.length} página${
        pageGroup.pageIndexes.length === 1 ? '' : 's'
      } foram separadas para um novo PDF.`
    }
  }

  const zipFiles: Record<string, Uint8Array> = {}

  for (let groupIndex = 0; groupIndex < pageGroups.length; groupIndex += 1) {
    const pageGroup = pageGroups[groupIndex]

    onProgress(
      `A criar intervalo ${groupIndex + 1} de ${pageGroups.length} ` +
        `(páginas ${pageGroup.startPage}-${pageGroup.endPage})...`
    )

    const groupBytes = await createPdfBytes(
      sourceDocument,
      pageGroup.pageIndexes
    )

    zipFiles[
      getRangeFileName(
        sanitizedFileName,
        pageGroup,
        groupIndex,
        pageGroups.length,
        pageCount
      )
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
    fileName: `${sanitizedFileName}-intervalos.zip`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message: `${pageGroups.length} intervalos foram separados em ${pageGroups.length} ficheiros PDF independentes.`
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
  const groupPadding = String(groupCount).length
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

    const pageIndexes = Array.from(
      { length: endPageIndex - startPageIndex },
      (_, index) => startPageIndex + index
    )
    const groupBytes = await createPdfBytes(
      sourceDocument,
      pageIndexes
    )
    const groupNumber = String(groupIndex + 1).padStart(groupPadding, '0')
    const paddedStartPage = String(startPageNumber).padStart(
      numberPadding,
      '0'
    )
    const paddedEndPage = String(endPageNumber).padStart(
      numberPadding,
      '0'
    )

    zipFiles[
      `${sanitizedFileName}-grupo-${groupNumber}-paginas-${paddedStartPage}-a-${paddedEndPage}.pdf`
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
  const sanitizedFileName = sanitizeFileName(selected.file.name)

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    onProgress(`A separar página ${pageIndex + 1} de ${pageCount}...`)

    const pageBytes = await createPdfBytes(sourceDocument, [pageIndex])
    const pageNumber = String(pageIndex + 1).padStart(
      String(pageCount).length,
      '0'
    )

    zipFiles[
      `${sanitizedFileName}-pagina-${pageNumber}.pdf`
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
    fileName: `${sanitizedFileName}-paginas.zip`,
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

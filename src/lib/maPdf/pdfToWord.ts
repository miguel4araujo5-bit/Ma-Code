import {
  strToU8,
  zipSync
} from 'fflate'

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
  bytesToArrayBuffer,
  sanitizeFileName
} from './fileUtils'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type ExtractedPage = {
  pageNumber: number
  paragraphs: string[]
}

type PdfTextItem = {
  str?: unknown
  transform?: ArrayLike<number>
  hasEOL?: unknown
}

const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const LINE_Y_TOLERANCE = 3.5

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldJoinWithoutSpace(
  previousText: string,
  nextText: string
) {
  if (!previousText || !nextText) {
    return true
  }

  if (
    previousText.endsWith('-') ||
    previousText.endsWith('/') ||
    previousText.endsWith('(') ||
    previousText.endsWith('[')
  ) {
    return true
  }

  return /^[,.;:!?%)\]}]/.test(nextText)
}

function appendTextSegment(
  currentLine: string,
  segment: string
) {
  if (!currentLine) {
    return segment
  }

  if (
    shouldJoinWithoutSpace(
      currentLine,
      segment
    )
  ) {
    return `${currentLine}${segment}`
  }

  return `${currentLine} ${segment}`
}

function getItemY(item: PdfTextItem) {
  const transform = item.transform

  if (
    !transform ||
    typeof transform[5] !== 'number'
  ) {
    return null
  }

  return transform[5]
}

function extractParagraphsFromTextContent(
  items: unknown[]
) {
  const paragraphs: string[] = []

  let currentLine = ''
  let currentY: number | null = null

  const pushCurrentLine = () => {
    const normalizedLine =
      normalizeText(currentLine)

    if (normalizedLine) {
      paragraphs.push(normalizedLine)
    }

    currentLine = ''
    currentY = null
  }

  for (const rawItem of items) {
    if (
      typeof rawItem !== 'object' ||
      rawItem === null
    ) {
      continue
    }

    const item = rawItem as PdfTextItem

    if (typeof item.str !== 'string') {
      continue
    }

    const text = normalizeText(item.str)

    if (!text) {
      if (item.hasEOL === true) {
        pushCurrentLine()
      }

      continue
    }

    const itemY = getItemY(item)

    if (
      currentY !== null &&
      itemY !== null &&
      Math.abs(itemY - currentY) >
        LINE_Y_TOLERANCE
    ) {
      pushCurrentLine()
    }

    currentLine = appendTextSegment(
      currentLine,
      text
    )

    if (itemY !== null) {
      currentY = itemY
    }

    if (item.hasEOL === true) {
      pushCurrentLine()
    }
  }

  pushCurrentLine()

  return paragraphs
}

function createWordParagraph(text: string) {
  return [
    '<w:p>',
    '<w:pPr>',
    '<w:spacing w:after="120" w:line="276" w:lineRule="auto"/>',
    '</w:pPr>',
    '<w:r>',
    '<w:rPr>',
    '<w:sz w:val="22"/>',
    '<w:szCs w:val="22"/>',
    '</w:rPr>',
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`,
    '</w:r>',
    '</w:p>'
  ].join('')
}

function createPageBreak() {
  return [
    '<w:p>',
    '<w:r>',
    '<w:br w:type="page"/>',
    '</w:r>',
    '</w:p>'
  ].join('')
}

function createEmptyParagraph() {
  return '<w:p><w:r><w:t></w:t></w:r></w:p>'
}

function createDocumentXml(
  pages: ExtractedPage[]
) {
  const documentContent: string[] = []

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      documentContent.push(
        createPageBreak()
      )
    }

    if (page.paragraphs.length === 0) {
      documentContent.push(
        createEmptyParagraph()
      )

      return
    }

    for (const paragraph of page.paragraphs) {
      documentContent.push(
        createWordParagraph(paragraph)
      )
    }
  })

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document',
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    '>',
    '<w:body>',
    documentContent.join(''),
    '<w:sectPr>',
    '<w:pgSz w:w="11906" w:h="16838"/>',
    '<w:pgMar',
    ' w:top="1134"',
    ' w:right="1134"',
    ' w:bottom="1134"',
    ' w:left="1134"',
    ' w:header="708"',
    ' w:footer="708"',
    ' w:gutter="0"',
    '/>',
    '</w:sectPr>',
    '</w:body>',
    '</w:document>'
  ].join('')
}

function createStylesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:styles',
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    '>',
    '<w:docDefaults>',
    '<w:rPrDefault>',
    '<w:rPr>',
    '<w:rFonts',
    ' w:ascii="Arial"',
    ' w:hAnsi="Arial"',
    ' w:eastAsia="Arial"',
    ' w:cs="Arial"',
    '/>',
    '<w:sz w:val="22"/>',
    '<w:szCs w:val="22"/>',
    '<w:lang',
    ' w:val="pt-PT"',
    ' w:eastAsia="pt-PT"',
    ' w:bidi="pt-PT"',
    '/>',
    '</w:rPr>',
    '</w:rPrDefault>',
    '<w:pPrDefault>',
    '<w:pPr>',
    '<w:spacing w:after="120" w:line="276" w:lineRule="auto"/>',
    '</w:pPr>',
    '</w:pPrDefault>',
    '</w:docDefaults>',
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">',
    '<w:name w:val="Normal"/>',
    '<w:qFormat/>',
    '</w:style>',
    '</w:styles>'
  ].join('')
}

function createContentTypesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default',
    ' Extension="rels"',
    ' ContentType="application/vnd.openxmlformats-package.relationships+xml"',
    '/>',
    '<Default',
    ' Extension="xml"',
    ' ContentType="application/xml"',
    '/>',
    '<Override',
    ' PartName="/word/document.xml"',
    ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"',
    '/>',
    '<Override',
    ' PartName="/word/styles.xml"',
    ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"',
    '/>',
    '<Override',
    ' PartName="/docProps/core.xml"',
    ' ContentType="application/vnd.openxmlformats-package.core-properties+xml"',
    '/>',
    '<Override',
    ' PartName="/docProps/app.xml"',
    ' ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"',
    '/>',
    '</Types>'
  ].join('')
}

function createRootRelationshipsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship',
    ' Id="rId1"',
    ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"',
    ' Target="word/document.xml"',
    '/>',
    '<Relationship',
    ' Id="rId2"',
    ' Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"',
    ' Target="docProps/core.xml"',
    '/>',
    '<Relationship',
    ' Id="rId3"',
    ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"',
    ' Target="docProps/app.xml"',
    '/>',
    '</Relationships>'
  ].join('')
}

function createDocumentRelationshipsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship',
    ' Id="rId1"',
    ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"',
    ' Target="styles.xml"',
    '/>',
    '</Relationships>'
  ].join('')
}

function createCorePropertiesXml(
  title: string
) {
  const timestamp =
    new Date().toISOString()

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<cp:coreProperties',
    ' xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"',
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"',
    ' xmlns:dcterms="http://purl.org/dc/terms/"',
    ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"',
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '>',
    `<dc:title>${escapeXml(title)}</dc:title>`,
    '<dc:creator>MA PDF - MA-Code.pt</dc:creator>',
    '<cp:lastModifiedBy>MA PDF - MA-Code.pt</cp:lastModifiedBy>',
    `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>`,
    '</cp:coreProperties>'
  ].join('')
}

function createAppPropertiesXml(
  pageCount: number
) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties',
    ' xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"',
    ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"',
    '>',
    '<Application>MA PDF - MA-Code.pt</Application>',
    '<AppVersion>1.0</AppVersion>',
    `<Pages>${pageCount}</Pages>`,
    '<Company>MA-Code</Company>',
    '</Properties>'
  ].join('')
}

function createDocxArchive(
  pages: ExtractedPage[],
  documentTitle: string
) {
  const archiveFiles: Record<
    string,
    Uint8Array
  > = {
    '[Content_Types].xml': strToU8(
      createContentTypesXml()
    ),

    '_rels/.rels': strToU8(
      createRootRelationshipsXml()
    ),

    'word/document.xml': strToU8(
      createDocumentXml(pages)
    ),

    'word/styles.xml': strToU8(
      createStylesXml()
    ),

    'word/_rels/document.xml.rels':
      strToU8(
        createDocumentRelationshipsXml()
      ),

    'docProps/core.xml': strToU8(
      createCorePropertiesXml(
        documentTitle
      )
    ),

    'docProps/app.xml': strToU8(
      createAppPropertiesXml(
        pages.length
      )
    )
  }

  return zipSync(
    archiveFiles,
    {
      level: 6
    }
  )
}

export async function convertPdfToWord(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para converter para Word.'
    )
  }

  onProgress(
    'A preparar o conversor de PDF para Word...'
  )

  const pdfData = new Uint8Array(
    await selected.file.arrayBuffer()
  )

  const loadingTask = getDocument({
    data: pdfData
  })

  try {
    const pdfDocument =
      await loadingTask.promise

    const pageCount =
      pdfDocument.numPages

    if (pageCount === 0) {
      throw new Error(
        'O documento não contém páginas.'
      )
    }

    const extractedPages: ExtractedPage[] =
      []

    let totalParagraphs = 0

    for (
      let pageNumber = 1;
      pageNumber <= pageCount;
      pageNumber += 1
    ) {
      onProgress(
        `A extrair texto da página ${pageNumber} de ${pageCount}...`
      )

      const page =
        await pdfDocument.getPage(
          pageNumber
        )

      const textContent =
        await page.getTextContent()

      const paragraphs =
        extractParagraphsFromTextContent(
          textContent.items
        )

      totalParagraphs +=
        paragraphs.length

      extractedPages.push({
        pageNumber,
        paragraphs
      })

      page.cleanup()
    }

    if (totalParagraphs === 0) {
      throw new Error(
        'Não foi encontrado texto selecionável neste PDF. O documento pode ter sido digitalizado como imagem e necessitar de OCR.'
      )
    }

    onProgress(
      'A criar o documento Word editável...'
    )

    const baseName =
      sanitizeFileName(
        selected.file.name
      )

    const docxBytes =
      createDocxArchive(
        extractedPages,
        baseName
      )

    const blob = new Blob(
      [
        bytesToArrayBuffer(
          docxBytes
        )
      ],
      {
        type: DOCX_MIME_TYPE
      }
    )

    return {
      fileName:
        `${baseName}.docx`,

      blob,

      originalSize:
        selected.file.size,

      finalSize:
        blob.size,

      message:
        `${pageCount} página${
          pageCount === 1 ? '' : 's'
        } ${
          pageCount === 1
            ? 'foi convertida'
            : 'foram convertidas'
        } para um documento Word editável. A disposição do texto pode diferir do PDF original.`
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker não deve impedir
      // a entrega do documento já criado.
    }
  }
}

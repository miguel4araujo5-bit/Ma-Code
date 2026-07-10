import { strFromU8, unzipSync } from 'fflate'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'

import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import {
  bytesToArrayBuffer,
  sanitizeFileName
} from './fileUtils'

type ParagraphAlignment =
  | 'left'
  | 'center'
  | 'right'

type WordRun = {
  text: string
  bold: boolean
  italic: boolean
  fontSize: number
}

type WordParagraph = {
  runs: WordRun[]
  alignment: ParagraphAlignment
  pageBreakBefore: boolean
  spacingAfter: number
}

type EmbeddedFonts = {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
  boldItalic: PDFFont
}

type LineSegment = {
  text: string
  font: PDFFont
  fontSize: number
  width: number
}

type TextLine = {
  segments: LineSegment[]
  width: number
  height: number
}

const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const WORD_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = 50

const DEFAULT_FONT_SIZE = 11
const DEFAULT_LINE_HEIGHT = 15
const DEFAULT_PARAGRAPH_SPACING = 6

const MAX_FILE_SIZE_BYTES =
  100 * 1024 * 1024

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  )
}

function isDocxFile(file: File) {
  return (
    file.type === DOCX_MIME_TYPE ||
    file.name
      .toLowerCase()
      .endsWith('.docx')
  )
}

function getElementsByLocalName(
  root: Document | Element,
  localName: string
) {
  const namespacedElements =
    Array.from(
      root.getElementsByTagNameNS(
        '*',
        localName
      )
    )

  if (
    namespacedElements.length > 0
  ) {
    return namespacedElements
  }

  return Array.from(
    root.getElementsByTagName('*')
  ).filter(
    (element) =>
      element.localName ===
        localName ||
      element.tagName ===
        `w:${localName}` ||
      element.tagName ===
        localName
  )
}

function getDirectChild(
  parent: Element | null,
  localName: string
) {
  if (!parent) {
    return null
  }

  return (
    Array.from(
      parent.children
    ).find(
      (child) =>
        child.localName ===
          localName ||
        child.tagName ===
          `w:${localName}` ||
        child.tagName ===
          localName
    ) ?? null
  )
}

function getFirstDescendant(
  parent: Element | null,
  localName: string
) {
  if (!parent) {
    return null
  }

  return (
    getElementsByLocalName(
      parent,
      localName
    )[0] ?? null
  )
}

function getWordAttribute(
  element: Element | null,
  name: string
) {
  if (!element) {
    return null
  }

  return (
    element.getAttributeNS(
      WORD_NAMESPACE,
      name
    ) ||
    element.getAttribute(
      `w:${name}`
    ) ||
    element.getAttribute(name)
  )
}

function readToggle(
  runProperties: Element | null,
  propertyName: string
) {
  const property =
    getFirstDescendant(
      runProperties,
      propertyName
    )

  if (!property) {
    return false
  }

  const value =
    getWordAttribute(
      property,
      'val'
    )?.toLowerCase()

  return (
    !value ||
    ![
      '0',
      'false',
      'off',
      'none'
    ].includes(value)
  )
}

function getRunFontSize(
  runProperties: Element | null
) {
  const sizeElement =
    getFirstDescendant(
      runProperties,
      'sz'
    )

  const rawValue = Number(
    getWordAttribute(
      sizeElement,
      'val'
    )
  )

  if (
    !Number.isFinite(rawValue) ||
    rawValue <= 0
  ) {
    return DEFAULT_FONT_SIZE
  }

  return clamp(
    rawValue / 2,
    7,
    48
  )
}

function collectRunText(
  node: Node
): string {
  let text = ''

  for (
    const child of Array.from(
      node.childNodes
    )
  ) {
    if (
      child.nodeType !==
      Node.ELEMENT_NODE
    ) {
      continue
    }

    const element =
      child as Element

    if (
      element.localName === 't'
    ) {
      text +=
        element.textContent ?? ''
    } else if (
      element.localName === 'tab'
    ) {
      text += '\t'
    } else if (
      element.localName === 'br' ||
      element.localName === 'cr'
    ) {
      text += '\n'
    } else {
      text +=
        collectRunText(element)
    }
  }

  return text
}

function parseParagraphAlignment(
  paragraphProperties: Element | null
): ParagraphAlignment {
  const alignmentElement =
    getFirstDescendant(
      paragraphProperties,
      'jc'
    )

  const value =
    getWordAttribute(
      alignmentElement,
      'val'
    )?.toLowerCase()

  if (value === 'center') {
    return 'center'
  }

  if (
    value === 'right' ||
    value === 'end'
  ) {
    return 'right'
  }

  return 'left'
}

function parseParagraphSpacing(
  paragraphProperties: Element | null
) {
  const spacingElement =
    getFirstDescendant(
      paragraphProperties,
      'spacing'
    )

  const afterTwips = Number(
    getWordAttribute(
      spacingElement,
      'after'
    )
  )

  if (
    !Number.isFinite(afterTwips) ||
    afterTwips < 0
  ) {
    return DEFAULT_PARAGRAPH_SPACING
  }

  return clamp(
    afterTwips / 20,
    0,
    36
  )
}

function parseParagraph(
  paragraph: Element
): WordParagraph {
  const paragraphProperties =
    getDirectChild(
      paragraph,
      'pPr'
    )

  const runs: WordRun[] =
    getElementsByLocalName(
      paragraph,
      'r'
    )
      .map((runElement) => {
        const runProperties =
          getDirectChild(
            runElement,
            'rPr'
          )

        return {
          text:
            collectRunText(
              runElement
            ),

          bold:
            readToggle(
              runProperties,
              'b'
            ),

          italic:
            readToggle(
              runProperties,
              'i'
            ),

          fontSize:
            getRunFontSize(
              runProperties
            )
        }
      })
      .filter(
        (run) =>
          run.text.length > 0
      )

  if (runs.length === 0) {
    const fallbackText =
      paragraph.textContent?.trim() ??
      ''

    if (fallbackText) {
      runs.push({
        text: fallbackText,
        bold: false,
        italic: false,
        fontSize:
          DEFAULT_FONT_SIZE
      })
    }
  }

  return {
    runs,

    alignment:
      parseParagraphAlignment(
        paragraphProperties
      ),

    pageBreakBefore:
      getFirstDescendant(
        paragraphProperties,
        'pageBreakBefore'
      ) !== null,

    spacingAfter:
      parseParagraphSpacing(
        paragraphProperties
      )
  }
}

function parseWordDocument(
  documentXml: string
) {
  const parser =
    new DOMParser()

  const xmlDocument =
    parser.parseFromString(
      documentXml,
      'application/xml'
    )

  if (
    xmlDocument
      .getElementsByTagName(
        'parsererror'
      )
      .length > 0
  ) {
    throw new Error(
      'O documento Word contém dados inválidos ou está danificado.'
    )
  }

  return getElementsByLocalName(
    xmlDocument,
    'p'
  ).map(parseParagraph)
}

function resolveFont(
  run: WordRun,
  fonts: EmbeddedFonts
) {
  if (
    run.bold &&
    run.italic
  ) {
    return fonts.boldItalic
  }

  if (run.bold) {
    return fonts.bold
  }

  if (run.italic) {
    return fonts.italic
  }

  return fonts.regular
}

function normalizeTextForPdf(
  value: string
) {
  return value
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function makeTextSafeForFont(
  value: string,
  font: PDFFont
) {
  let safeText = ''

  for (
    const character of Array.from(
      normalizeTextForPdf(value)
    )
  ) {
    if (
      character === '\n' ||
      character === '\t'
    ) {
      safeText +=
        character === '\t'
          ? '    '
          : '\n'

      continue
    }

    try {
      font.widthOfTextAtSize(
        character,
        DEFAULT_FONT_SIZE
      )

      safeText += character
    } catch {
      safeText += '?'
    }
  }

  return safeText
}

function createEmptyLine(): TextLine {
  return {
    segments: [],
    width: 0,
    height: DEFAULT_LINE_HEIGHT
  }
}

function appendSegment(
  line: TextLine,
  text: string,
  font: PDFFont,
  fontSize: number
) {
  if (!text) {
    return
  }

  const width =
    font.widthOfTextAtSize(
      text,
      fontSize
    )

  const previousSegment =
    line.segments[
      line.segments.length - 1
    ]

  if (
    previousSegment &&
    previousSegment.font === font &&
    previousSegment.fontSize ===
      fontSize
  ) {
    previousSegment.text += text
    previousSegment.width += width
  } else {
    line.segments.push({
      text,
      font,
      fontSize,
      width
    })
  }

  line.width += width

  line.height = Math.max(
    line.height,
    fontSize * 1.35
  )
}

function layoutParagraph(
  paragraph: WordParagraph,
  fonts: EmbeddedFonts,
  maxWidth: number
) {
  const lines: TextLine[] = []

  let currentLine =
    createEmptyLine()

  let pendingSpace = false

  const pushLine = (
    force = false
  ) => {
    if (
      currentLine.segments.length >
        0 ||
      force
    ) {
      lines.push(currentLine)
    }

    currentLine =
      createEmptyLine()

    pendingSpace = false
  }

  for (
    const run of paragraph.runs
  ) {
    const font =
      resolveFont(
        run,
        fonts
      )

    const fontSize =
      clamp(
        run.fontSize,
        7,
        48
      )

    const safeText =
      makeTextSafeForFont(
        run.text,
        font
      )

    const tokens =
      safeText
        .split(/(\s+)/)
        .filter(Boolean)

    for (const token of tokens) {
      if (
        token.includes('\n')
      ) {
        const lineBreakCount =
          (
            token.match(/\n/g) ??
            []
          ).length

        pushLine(true)

        for (
          let index = 1;
          index < lineBreakCount;
          index += 1
        ) {
          lines.push(
            createEmptyLine()
          )
        }

        continue
      }

      if (/^\s+$/.test(token)) {
        pendingSpace = true
        continue
      }

      const space =
        pendingSpace &&
        currentLine.segments.length >
          0
          ? ' '
          : ''

      const candidate =
        `${space}${token}`

      const candidateWidth =
        font.widthOfTextAtSize(
          candidate,
          fontSize
        )

      if (
        currentLine.segments.length >
          0 &&
        currentLine.width +
          candidateWidth >
          maxWidth
      ) {
        pushLine()
      }

      const textToAppend =
        pendingSpace &&
        currentLine.segments.length >
          0
          ? ` ${token}`
          : token

      if (
        font.widthOfTextAtSize(
          textToAppend,
          fontSize
        ) <= maxWidth
      ) {
        appendSegment(
          currentLine,
          textToAppend,
          font,
          fontSize
        )
      } else {
        let fragment = ''

        for (
          const character of Array.from(
            textToAppend
          )
        ) {
          const nextFragment =
            `${fragment}${character}`

          if (
            fragment &&
            font.widthOfTextAtSize(
              nextFragment,
              fontSize
            ) > maxWidth
          ) {
            appendSegment(
              currentLine,
              fragment,
              font,
              fontSize
            )

            pushLine()

            fragment =
              character
          } else {
            fragment =
              nextFragment
          }
        }

        appendSegment(
          currentLine,
          fragment,
          font,
          fontSize
        )
      }

      pendingSpace = false
    }
  }

  if (
    currentLine.segments.length >
    0
  ) {
    lines.push(currentLine)
  }

  return lines
}

function getLineStartX(
  line: TextLine,
  alignment: ParagraphAlignment,
  availableWidth: number
) {
  if (alignment === 'center') {
    return (
      PAGE_MARGIN +
      (
        availableWidth -
        line.width
      ) /
        2
    )
  }

  if (alignment === 'right') {
    return (
      PAGE_WIDTH -
      PAGE_MARGIN -
      line.width
    )
  }

  return PAGE_MARGIN
}

function drawLine(
  page: PDFPage,
  line: TextLine,
  alignment: ParagraphAlignment,
  cursorY: number,
  availableWidth: number
) {
  let x =
    getLineStartX(
      line,
      alignment,
      availableWidth
    )

  for (
    const segment of
    line.segments
  ) {
    page.drawText(
      segment.text,
      {
        x,

        y:
          cursorY -
          segment.fontSize,

        size:
          segment.fontSize,

        font:
          segment.font,

        color:
          rgb(
            0.07,
            0.09,
            0.13
          )
      }
    )

    x += segment.width
  }
}

function getBaseName(
  fileName: string
) {
  const withoutExtension =
    fileName.replace(
      /\.docx$/i,
      ''
    )

  return (
    sanitizeFileName(
      withoutExtension
    ) ||
    'documento-word'
  )
}

export async function convertWordToPdf(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um documento Word para converter para PDF.'
    )
  }

  if (
    !isDocxFile(
      selected.file
    )
  ) {
    throw new Error(
      'Escolha um documento Word no formato DOCX.'
    )
  }

  if (
    selected.file.size === 0
  ) {
    throw new Error(
      'O documento Word está vazio.'
    )
  }

  if (
    selected.file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    throw new Error(
      'O documento Word ultrapassa o limite de 100 MB.'
    )
  }

  onProgress(
    'A abrir o documento Word...'
  )

  let archive: ReturnType<
    typeof unzipSync
  >

  try {
    archive =
      unzipSync(
        new Uint8Array(
          await selected.file.arrayBuffer()
        )
      )
  } catch {
    throw new Error(
      'Não foi possível abrir o documento Word. Confirme que o ficheiro DOCX é válido.'
    )
  }

  const documentXmlBytes =
    archive[
      'word/document.xml'
    ]

  if (!documentXmlBytes) {
    throw new Error(
      'O ficheiro não contém um documento Word válido.'
    )
  }

  onProgress(
    'A extrair o texto e a formatação básica...'
  )

  const paragraphs =
    parseWordDocument(
      strFromU8(
        documentXmlBytes
      )
    )

  const characterCount =
    paragraphs.reduce(
      (
        total,
        paragraph
      ) =>
        total +
        paragraph.runs.reduce(
          (
            runTotal,
            run
          ) =>
            runTotal +
            run.text.trim().length,
          0
        ),
      0
    )

  if (
    characterCount === 0
  ) {
    throw new Error(
      'Não foi encontrado texto no documento Word. O ficheiro pode conter apenas imagens ou elementos não suportados.'
    )
  }

  onProgress(
    'A criar o documento PDF...'
  )

  const pdfDocument =
    await PDFDocument.create()

  const fonts: EmbeddedFonts = {
    regular:
      await pdfDocument.embedFont(
        StandardFonts.Helvetica
      ),

    bold:
      await pdfDocument.embedFont(
        StandardFonts.HelveticaBold
      ),

    italic:
      await pdfDocument.embedFont(
        StandardFonts.HelveticaOblique
      ),

    boldItalic:
      await pdfDocument.embedFont(
        StandardFonts
          .HelveticaBoldOblique
      )
  }

  const baseName =
    getBaseName(
      selected.file.name
    )

  pdfDocument.setTitle(
    baseName
  )

  pdfDocument.setAuthor(
    'MA-Code'
  )

  pdfDocument.setCreator(
    'MA PDF - MA-Code.pt'
  )

  pdfDocument.setProducer(
    'MA PDF - MA-Code.pt'
  )

  const availableWidth =
    PAGE_WIDTH -
    PAGE_MARGIN * 2

  let page =
    pdfDocument.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT
    ])

  let cursorY =
    PAGE_HEIGHT -
    PAGE_MARGIN

  const addPage = () => {
    page =
      pdfDocument.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT
      ])

    cursorY =
      PAGE_HEIGHT -
      PAGE_MARGIN
  }

  for (
    let index = 0;
    index < paragraphs.length;
    index += 1
  ) {
    const paragraph =
      paragraphs[index]

    onProgress(
      `A converter o bloco ${index + 1} de ${paragraphs.length}...`
    )

    if (
      paragraph.pageBreakBefore &&
      cursorY <
        PAGE_HEIGHT -
          PAGE_MARGIN
    ) {
      addPage()
    }

    const lines =
      layoutParagraph(
        paragraph,
        fonts,
        availableWidth
      )

    if (
      lines.length === 0
    ) {
      cursorY -=
        DEFAULT_LINE_HEIGHT

      if (
        cursorY <
        PAGE_MARGIN
      ) {
        addPage()
      }

      continue
    }

    for (
      const line of lines
    ) {
      if (
        cursorY -
          line.height <
        PAGE_MARGIN
      ) {
        addPage()
      }

      drawLine(
        page,
        line,
        paragraph.alignment,
        cursorY,
        availableWidth
      )

      cursorY -=
        line.height
    }

    cursorY -=
      paragraph.spacingAfter
  }

  onProgress(
    'A finalizar o documento PDF...'
  )

  const pdfBytes =
    await pdfDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 20
    })

  const blob =
    new Blob(
      [
        bytesToArrayBuffer(
          pdfBytes
        )
      ],
      {
        type:
          'application/pdf'
      }
    )

  return {
    fileName:
      `${baseName}.pdf`,

    blob,

    originalSize:
      selected.file.size,

    finalSize:
      blob.size,

    message:
      'O documento Word foi convertido para PDF. O texto e a formatação básica foram preservados; imagens, tabelas complexas, colunas, cabeçalhos e paginação podem apresentar diferenças.'
  }
}

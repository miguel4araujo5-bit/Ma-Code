import {
  unzipSync,
  strFromU8
} from 'fflate'

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
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

const PRESENTATION_PATH =
  'ppt/presentation.xml'

const PRESENTATION_RELS_PATH =
  'ppt/_rels/presentation.xml.rels'

const DEFAULT_SLIDE_WIDTH =
  12_192_000

const DEFAULT_SLIDE_HEIGHT =
  6_858_000

const PDF_WIDTH = 960

function getBaseName(
  fileName: string
) {
  return (
    sanitizeFileName(
      fileName.replace(
        /\.pptx$/i,
        ''
      )
    ) || 'apresentacao'
  )
}

function parseXml(value: string) {
  const xmlDocument =
    new DOMParser().parseFromString(
      value,
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
      'A apresentação contém XML inválido ou danificado.'
    )
  }

  return xmlDocument
}

function elements(
  root: Document | Element,
  localName: string
) {
  return Array.from(
    root.getElementsByTagName('*')
  ).filter(
    (element) =>
      element.localName ===
      localName
  )
}

function first(
  root: Document | Element,
  localName: string
) {
  return (
    elements(
      root,
      localName
    )[0] || null
  )
}

function attribute(
  element: Element | null,
  name: string
) {
  if (!element) {
    return ''
  }

  return (
    element.getAttribute(name) ||
    Array.from(
      element.attributes
    ).find(
      (item) =>
        item.localName === name ||
        item.name === name
    )?.value ||
    ''
  )
}

function relationshipId(
  element: Element
) {
  return (
    element.getAttribute('r:id') ||
    Array.from(
      element.attributes
    ).find(
      (item) =>
        item.prefix === 'r' &&
        item.localName === 'id'
    )?.value ||
    ''
  )
}

function numberValue(
  value: string,
  fallback = 0
) {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function normalizePath(
  path: string
) {
  const output: string[] = []

  path
    .replace(/^\//, '')
    .split('/')
    .forEach((part) => {
      if (
        !part ||
        part === '.'
      ) {
        return
      }

      if (part === '..') {
        output.pop()
        return
      }

      output.push(part)
    })

  return output.join('/')
}

function resolveTarget(
  sourcePath: string,
  target: string
) {
  if (target.startsWith('/')) {
    return normalizePath(target)
  }

  const folder = sourcePath
    .split('/')
    .slice(0, -1)
    .join('/')

  return normalizePath(
    `${folder}/${target}`
  )
}

function relationshipMap(
  files: Record<
    string,
    Uint8Array
  >,
  relationshipPath: string,
  sourcePath: string
) {
  const map =
    new Map<string, string>()

  const bytes =
    files[relationshipPath]

  if (!bytes) {
    return map
  }

  const xmlDocument = parseXml(
    strFromU8(bytes)
  )

  elements(
    xmlDocument,
    'Relationship'
  ).forEach(
    (relationship) => {
      const id = attribute(
        relationship,
        'Id'
      )

      const target = attribute(
        relationship,
        'Target'
      )

      const mode = attribute(
        relationship,
        'TargetMode'
      )

      if (
        id &&
        target &&
        mode.toLowerCase() !==
          'external'
      ) {
        map.set(
          id,
          resolveTarget(
            sourcePath,
            target
          )
        )
      }
    }
  )

  return map
}

function slideRelationshipPath(
  slidePath: string
) {
  const parts =
    slidePath.split('/')

  const fileName =
    parts.pop() || ''

  return [
    ...parts,
    '_rels',
    `${fileName}.rels`
  ].join('/')
}

function getPresentation(
  files: Record<
    string,
    Uint8Array
  >
) {
  const presentationBytes =
    files[PRESENTATION_PATH]

  if (!presentationBytes) {
    throw new Error(
      'O ficheiro não contém uma apresentação PPTX válida.'
    )
  }

  const xmlDocument = parseXml(
    strFromU8(
      presentationBytes
    )
  )

  const relationships =
    relationshipMap(
      files,
      PRESENTATION_RELS_PATH,
      PRESENTATION_PATH
    )

  let slidePaths = elements(
    xmlDocument,
    'sldId'
  )
    .map((slideId) =>
      relationships.get(
        relationshipId(slideId)
      )
    )
    .filter(
      (
        path
      ): path is string =>
        Boolean(
          path &&
          files[path]
        )
    )

  if (
    slidePaths.length === 0
  ) {
    slidePaths =
      Object.keys(files)
        .filter((path) =>
          /^ppt\/slides\/slide\d+\.xml$/i.test(
            path
          )
        )
        .sort((a, b) => {
          const aNumber = Number(
            a.match(
              /slide(\d+)\.xml/i
            )?.[1] || 0
          )

          const bNumber = Number(
            b.match(
              /slide(\d+)\.xml/i
            )?.[1] || 0
          )

          return (
            aNumber - bNumber
          )
        })
  }

  if (
    slidePaths.length === 0
  ) {
    throw new Error(
      'A apresentação não contém slides legíveis.'
    )
  }

  const slideSize = first(
    xmlDocument,
    'sldSz'
  )

  const widthEmu = Math.max(
    1,
    numberValue(
      attribute(
        slideSize,
        'cx'
      ),
      DEFAULT_SLIDE_WIDTH
    )
  )

  const heightEmu = Math.max(
    1,
    numberValue(
      attribute(
        slideSize,
        'cy'
      ),
      DEFAULT_SLIDE_HEIGHT
    )
  )

  const pageHeight =
    PDF_WIDTH /
    (widthEmu / heightEmu)

  return {
    slidePaths,
    widthEmu,
    heightEmu,
    pageWidth: PDF_WIDTH,
    pageHeight
  }
}

function getBox(
  root: Element,
  widthEmu: number,
  heightEmu: number,
  pageWidth: number,
  pageHeight: number
) {
  const transform =
    first(root, 'xfrm')

  const offset = transform
    ? first(
        transform,
        'off'
      )
    : null

  const extent = transform
    ? first(
        transform,
        'ext'
      )
    : null

  const x = numberValue(
    attribute(offset, 'x')
  )

  const y = numberValue(
    attribute(offset, 'y')
  )

  const width = numberValue(
    attribute(extent, 'cx'),
    widthEmu
  )

  const height = numberValue(
    attribute(extent, 'cy'),
    heightEmu
  )

  return {
    x:
      (x / widthEmu) *
      pageWidth,

    y:
      pageHeight -
      ((y + height) /
        heightEmu) *
        pageHeight,

    width:
      (width / widthEmu) *
      pageWidth,

    height:
      (height / heightEmu) *
      pageHeight
  }
}

function safeText(value: string) {
  return value
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/€/g, ' EUR ')
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^\x20-\x7e\xa0-\xff\n]/g,
      '?'
    )
    .trim()
}

function shapeText(
  shape: Element
) {
  const paragraphs =
    elements(shape, 'p')
      .map((paragraph) =>
        elements(
          paragraph,
          't'
        )
          .map(
            (item) =>
              item.textContent ||
              ''
          )
          .join('')
          .trim()
      )
      .filter(Boolean)

  return paragraphs.length > 0
    ? paragraphs.join('\n')
    : elements(shape, 't')
        .map(
          (item) =>
            item.textContent || ''
        )
        .join(' ')
        .trim()
}

function measure(
  font: PDFFont,
  text: string,
  size: number
) {
  try {
    return font.widthOfTextAtSize(
      text,
      size
    )
  } catch {
    return text.length *
      size *
      0.52
  }
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number
) {
  const lines: string[] = []

  for (
    const paragraph of safeText(
      value
    ).split('\n')
  ) {
    let current = ''

    for (
      const word of paragraph.split(
        /\s+/
      )
    ) {
      if (!word) {
        continue
      }

      const candidate = current
        ? `${current} ${word}`
        : word

      if (
        measure(
          font,
          candidate,
          size
        ) <= maxWidth
      ) {
        current = candidate
      } else {
        if (current) {
          lines.push(current)
        }

        current = word
      }

      if (
        lines.length >=
        maxLines
      ) {
        return lines.slice(
          0,
          maxLines
        )
      }
    }

    if (current) {
      lines.push(current)
    }

    if (
      lines.length >= maxLines
    ) {
      return lines.slice(
        0,
        maxLines
      )
    }
  }

  return lines.slice(
    0,
    maxLines
  )
}

function textStyle(
  shape: Element
) {
  const properties =
    first(shape, 'rPr') ||
    first(shape, 'defRPr')

  const rawSize =
    numberValue(
      attribute(
        properties,
        'sz'
      ),
      1_800
    )

  const color = first(
    properties || shape,
    'srgbClr'
  )

  const hex = attribute(
    color,
    'val'
  )
    .replace(
      /[^0-9a-f]/gi,
      ''
    )
    .slice(0, 6)

  return {
    size: Math.max(
      7,
      Math.min(
        48,
        rawSize / 100
      )
    ),

    bold: [
      '1',
      'true'
    ].includes(
      attribute(
        properties,
        'b'
      ).toLowerCase()
    ),

    color:
      hex.length === 6
        ? rgb(
            Number.parseInt(
              hex.slice(0, 2),
              16
            ) / 255,
            Number.parseInt(
              hex.slice(2, 4),
              16
            ) / 255,
            Number.parseInt(
              hex.slice(4, 6),
              16
            ) / 255
          )
        : rgb(
            0.12,
            0.16,
            0.22
          )
  }
}

async function embedImage(
  pdfDocument: PDFDocument,
  path: string,
  bytes: Uint8Array
): Promise<PDFImage | null> {
  try {
    if (/\.png$/i.test(path)) {
      return await pdfDocument.embedPng(
        bytes
      )
    }

    if (
      /\.jpe?g$/i.test(path)
    ) {
      return await pdfDocument.embedJpg(
        bytes
      )
    }
  } catch {
    return null
  }

  return null
}

async function drawImages(
  page: PDFPage,
  pdfDocument: PDFDocument,
  slide: Document,
  relationships: Map<
    string,
    string
  >,
  files: Record<
    string,
    Uint8Array
  >,
  dimensions: ReturnType<
    typeof getPresentation
  >
) {
  for (
    const picture of elements(
      slide,
      'pic'
    )
  ) {
    const blip = first(
      picture,
      'blip'
    )

    const id = attribute(
      blip,
      'embed'
    )

    const path =
      relationships.get(id)

    if (
      !path ||
      !files[path]
    ) {
      continue
    }

    const image =
      await embedImage(
        pdfDocument,
        path,
        files[path]
      )

    if (!image) {
      continue
    }

    const box = getBox(
      picture,
      dimensions.widthEmu,
      dimensions.heightEmu,
      dimensions.pageWidth,
      dimensions.pageHeight
    )

    if (
      box.width > 0 &&
      box.height > 0
    ) {
      page.drawImage(
        image,
        box
      )
    }
  }
}

function drawTextShapes(
  page: PDFPage,
  slide: Document,
  regularFont: PDFFont,
  boldFont: PDFFont,
  dimensions: ReturnType<
    typeof getPresentation
  >
) {
  const shapes = [
    ...elements(slide, 'sp'),
    ...elements(
      slide,
      'graphicFrame'
    )
  ]

  shapes.forEach((shape) => {
    const text =
      shapeText(shape)

    if (!text) {
      return
    }

    const box = getBox(
      shape,
      dimensions.widthEmu,
      dimensions.heightEmu,
      dimensions.pageWidth,
      dimensions.pageHeight
    )

    if (
      box.width < 5 ||
      box.height < 5
    ) {
      return
    }

    const style =
      textStyle(shape)

    const font = style.bold
      ? boldFont
      : regularFont

    const lineHeight =
      style.size * 1.2

    const maxLines = Math.max(
      1,
      Math.floor(
        (box.height - 4) /
          lineHeight
      )
    )

    const lines = wrapText(
      text,
      font,
      style.size,
      Math.max(
        10,
        box.width - 8
      ),
      maxLines
    )

    lines.forEach(
      (line, index) => {
        const y =
          box.y +
          box.height -
          style.size -
          3 -
          index * lineHeight

        if (y >= box.y) {
          page.drawText(line, {
            x: box.x + 4,
            y,
            size: style.size,
            font,
            color: style.color,
            maxWidth: Math.max(
              10,
              box.width - 8
            )
          })
        }
      }
    )
  })
}

export async function convertPowerPointToPdf(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PowerPoint PPTX para converter para PDF.'
    )
  }

  onProgress(
    'A abrir a apresentação PowerPoint...'
  )

  let files: Record<
    string,
    Uint8Array
  >

  try {
    files = unzipSync(
      new Uint8Array(
        await selected.file.arrayBuffer()
      )
    )
  } catch {
    throw new Error(
      'Não foi possível abrir o ficheiro PPTX. Confirme que a apresentação não está danificada.'
    )
  }

  const dimensions =
    getPresentation(files)

  const pdfDocument =
    await PDFDocument.create()

  const regularFont =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica
    )

  const boldFont =
    await pdfDocument.embedFont(
      StandardFonts.HelveticaBold
    )

  for (
    let index = 0;
    index <
    dimensions.slidePaths.length;
    index += 1
  ) {
    const slidePath =
      dimensions.slidePaths[index]

    onProgress(
      `A converter o slide ${index + 1} de ${dimensions.slidePaths.length}...`
    )

    const slide = parseXml(
      strFromU8(
        files[slidePath]
      )
    )

    const relationships =
      relationshipMap(
        files,
        slideRelationshipPath(
          slidePath
        ),
        slidePath
      )

    const page =
      pdfDocument.addPage([
        dimensions.pageWidth,
        dimensions.pageHeight
      ])

    page.drawRectangle({
      x: 0,
      y: 0,
      width:
        dimensions.pageWidth,
      height:
        dimensions.pageHeight,
      color: rgb(1, 1, 1)
    })

    await drawImages(
      page,
      pdfDocument,
      slide,
      relationships,
      files,
      dimensions
    )

    drawTextShapes(
      page,
      slide,
      regularFont,
      boldFont,
      dimensions
    )
  }

  onProgress(
    'A finalizar o documento PDF...'
  )

  const pdfBytes =
    await pdfDocument.save({
      useObjectStreams: true
    })

  const blob = new Blob(
    [
      bytesToArrayBuffer(
        pdfBytes
      )
    ],
    {
      type: 'application/pdf'
    }
  )

  return {
    fileName: `${getBaseName(
      selected.file.name
    )}-convertido.pdf`,
    blob,
    originalSize:
      selected.file.size,
    finalSize: blob.size,
    message: `${dimensions.slidePaths.length} slide${
      dimensions.slidePaths.length ===
      1
        ? ''
        : 's'
    } ${
      dimensions.slidePaths.length ===
      1
        ? 'foi convertido'
        : 'foram convertidos'
    } para PDF. Texto e imagens comuns são processados; animações, vídeo, SmartArt, gráficos e alguns efeitos avançados podem apresentar diferenças.`
  }
}

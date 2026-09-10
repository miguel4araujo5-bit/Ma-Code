import { strFromU8, unzipSync } from 'fflate'

import {
  extractPlanificationPdf
} from '../planifications/planificationPdfExtractor'
import type {
  PlanificationPdfDocument,
  PlanificationPdfLine
} from '../planifications/planificationPdfParser'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_XML_BYTES = 10 * 1024 * 1024

function clean(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function line(cells: string[]): PlanificationPdfLine {
  const cleaned = cells.map(clean)

  return {
    text: cleaned.filter(Boolean).join(' '),
    cells: cleaned,
    positionedCells: cleaned.map((text, index) => ({
      text,
      x: index * 100,
      width: 80
    }))
  }
}

function paragraphText(element: Element) {
  return clean(
    Array.from(
      element.getElementsByTagNameNS(WORD_NS, 't')
    )
      .map(node => node.textContent ?? '')
      .join('')
  )
}

function cellText(element: Element) {
  return clean(
    Array.from(
      element.getElementsByTagNameNS(WORD_NS, 'p')
    )
      .map(paragraphText)
      .filter(Boolean)
      .join(' ')
  )
}

function parseWordDom(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error('O documento Word contém uma estrutura não suportada.')
  }

  const dom = new DOMParser().parseFromString(
    xml,
    'application/xml'
  )

  if (dom.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Não foi possível ler o documento Word.')
  }

  return dom
}

export function parseAssessmentCriteriaDocxXml(
  xml: string
): PlanificationPdfDocument {
  const dom = parseWordDom(xml)
  const body = dom.getElementsByTagNameNS(WORD_NS, 'body')[0]

  if (!body) {
    throw new Error('O documento Word não contém conteúdo legível.')
  }

  const lines: PlanificationPdfLine[] = []

  for (const child of Array.from(body.children)) {
    if (child.localName === 'p') {
      const value = paragraphText(child)
      if (value) lines.push(line([value]))
      continue
    }

    if (child.localName !== 'tbl') continue

    for (const row of Array.from(child.children).filter(
      element => element.localName === 'tr'
    )) {
      const cells = Array.from(row.children)
        .filter(element => element.localName === 'tc')
        .map(cellText)

      if (cells.some(Boolean)) {
        lines.push(line(cells))
      }
    }
  }

  const characterCount = lines.reduce(
    (total, current) => total + current.text.length,
    0
  )

  if (characterCount === 0) {
    throw new Error('O documento Word não contém texto legível.')
  }

  return {
    pages: [{
      pageNumber: 1,
      lines
    }],
    pageCount: 1,
    characterCount
  }
}

export async function readAssessmentCriteriaDocument(
  file: File
): Promise<PlanificationPdfDocument> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('O ficheiro excede o limite de 20 MB.')
  }

  const name = file.name.toLocaleLowerCase('pt-PT')
  const isPdf =
    file.type === 'application/pdf' ||
    name.endsWith('.pdf')
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')

  if (isPdf) {
    return extractPlanificationPdf(file)
  }

  if (!isDocx) {
    throw new Error('Selecione um ficheiro PDF ou Word (.docx) válido.')
  }

  const archive = unzipSync(
    new Uint8Array(await file.arrayBuffer())
  )
  const xmlBytes = archive['word/document.xml']

  if (!xmlBytes) {
    throw new Error('O ficheiro Word não contém o documento principal esperado.')
  }

  if (xmlBytes.byteLength > MAX_XML_BYTES) {
    throw new Error('O conteúdo interno do Word é demasiado grande para ser analisado com segurança.')
  }

  return parseAssessmentCriteriaDocxXml(
    strFromU8(xmlBytes)
  )
}

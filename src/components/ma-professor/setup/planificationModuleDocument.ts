import { strFromU8, unzipSync } from 'fflate'
import {
  parsePlanificationPdfDocument,
  type ParsedPlanificationPdfSection,
  type PlanificationPdfLine
} from '../planifications/planificationPdfParser'

export interface ModuleDocument {
  name: string
  sha256: string
  subjectLabel: string
  courseLabel: string
  gradeLabel: string
  groupLabel: string
  periodMinutes: number | null
  sections: ParsedPlanificationPdfSection[]
  warnings: string[]
}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_XML_BYTES = 10 * 1024 * 1024
const headers = ['Período Letivo', 'UFCD', 'Temas/Conteúdos',
  'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas']

function line(values: string[]): PlanificationPdfLine {
  return {
    text: values.join(' '), cells: values,
    positionedCells: values.map((text, index) => ({ text, x: index * 100, width: 80 }))
  }
}

function paragraphText(element: Element) {
  return Array.from(element.getElementsByTagNameNS(WORD_NS, 't'))
    .map(t => t.textContent ?? '')
    .join('')
    .trim()
}

function paragraphs(element: Element) {
  return Array.from(element.getElementsByTagNameNS(WORD_NS, 'p'))
    .map(paragraphText)
    .join('\n')
    .trim()
}

function cleanMetadataValue(value: string) {
  return value
    .trim()
    .replace(/^[:–—-]+\s*/, '')
    .replace(/\s+/g, ' ')
}

function canonicalGroup(grade: string, letter: string) {
  return `${grade}.º ${letter.toLocaleUpperCase('pt-PT')}`
}

function canonicalGrade(grade: string) {
  return `${grade}.º ano`
}

function metadata(text: string, fileName = '') {
  const normalizedText = text.normalize('NFC').replace(/\r\n/g, '\n')
  const explicitDiscipline = cleanMetadataValue(
    normalizedText.match(
      /\bdisciplina\s*:\s*(.+?)(?=\s+(?:n[.ºo]*\s*(?:aulas|horas)|tema|professor(?:a)?)\s*:|\n|$)/i
    )?.[1] ?? ''
  )
  const subjectFromTitle = cleanMetadataValue(
    normalizedText.match(
      /planifica[çc][ãa]o\s+de\s+(.+?)(?=\s+curso profissional\b|\s*[-–—]\s*(?:1[0-2]|[1-9])\s*[.ºo°]*\s*ano\b|\n|$)/i
    )?.[1] ?? ''
  )
  const subjectLabel =
    explicitDiscipline ||
    subjectFromTitle
  const courseLabel = cleanMetadataValue(
    normalizedText.match(
      /curso profissional\s*[:–—-]?\s*(.+?)(?=\s+(?:1[0-2]|[1-9])\s*(?:\.?\s*[ºo°])?\s*ano\b|\s+disciplina\s*:|\n|$)/i
    )?.[1] ?? ''
  )
  const explicitGroup = normalizedText.match(
    /\bturma\s*[:–—-]?\s*(1[0-2]|[1-9])\s*(?:\.?\s*[ºo°])?\s*[-–—.]?\s*([A-Za-z])\b/i
  )
  const normalizedFileName = fileName.normalize('NFC')
  const fileGroup = normalizedFileName.match(
    /(?:^|[^0-9A-Za-z])(1[0-2]|[1-9])\s*(?:\.?\s*[º°])?\s*[-–—._ ]?\s*([A-Za-z])(?=$|[^0-9A-Za-z])/i
  )
  const groupMatch = explicitGroup || fileGroup
  const gradeMatch = normalizedText.match(
    /\b(1[0-2]|[1-9])\s*(?:\.?\s*[ºo°])?\s*ano\b/i
  )
  const fileGrade = normalizedFileName.match(
    /(?:^|[^0-9A-Za-z])(1[0-2]|[1-9])\s*(?:\.?\s*[ºo°])?\s*ano\b/i
  )
  const grade = groupMatch?.[1] || gradeMatch?.[1] || fileGrade?.[1] || ''
  const groupLabel = groupMatch
    ? canonicalGroup(groupMatch[1], groupMatch[2])
    : ''
  const gradeLabel = grade
    ? canonicalGrade(grade)
    : ''
  const minutes = [...normalizedText.matchAll(/\(\s*(\d+)\s*min(?:utos)?\s*\)/gi)]
    .map(match => Number(match[1]))
  const unique = [...new Set(minutes)]
  return {
    subjectLabel,
    courseLabel,
    gradeLabel,
    groupLabel,
    periodMinutes: unique.length === 1 ? unique[0] : null
  }
}

function parseWordDom(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('O documento Word contém uma estrutura não suportada.')
  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  if (dom.getElementsByTagName('parsererror').length) throw new Error('Não foi possível ler o documento Word.')
  return dom
}

function genericWordLines(dom: Document) {
  const result: PlanificationPdfLine[] = []

  for (const paragraph of Array.from(
    dom.getElementsByTagNameNS(WORD_NS, 'p')
  )) {
    const value = paragraphText(paragraph)
    if (value) {
      result.push(line([value]))
    }
  }

  for (const table of Array.from(
    dom.getElementsByTagNameNS(WORD_NS, 'tbl')
  )) {
    for (const row of Array.from(table.children)
      .filter(element => element.localName === 'tr')) {
      const cells = Array.from(row.children)
        .filter(element => element.localName === 'tc')
        .map(paragraphs)

      if (cells.some(Boolean)) {
        result.push(line(cells))
      }
    }
  }

  return result
}

export function parseModuleDocxXml(xml: string, name: string): Omit<ModuleDocument, 'sha256'> {
  const dom = parseWordDom(xml)
  const text = paragraphs(dom.documentElement)
  const lines = [line(headers)]
  let found = 0
  for (const table of Array.from(dom.getElementsByTagNameNS(WORD_NS, 'tbl'))) {
    for (const row of Array.from(table.children).filter(el => el.localName === 'tr')) {
      const cells = Array.from(row.children).filter(el => el.localName === 'tc').map(paragraphs)
      if (cells.some(c => /temas\s*\/\s*conte[úu]dos/i.test(c))) continue
      if (/^avalia[çc][ãa]o$/i.test(cells[0]?.trim() ?? '')) {
        lines.push(line(cells))
      } else if (cells.some(c => /\bUFCD\s*\d{3,6}\b/i.test(c))) {
        if (cells.length !== 6 || !/\bUFCD\s*\d{3,6}\b/i.test(cells[1])) {
          throw new Error('A tabela de UFCD não tem as seis colunas esperadas. Reveja o documento antes de importar.')
        }
        lines.push(line(cells))
        found++
      }
    }
  }
  if (!found) throw new Error('Não foram encontradas UFCD estruturadas nas tabelas deste Word.')
  const parsed = parsePlanificationPdfDocument({
    pages: [{ pageNumber: 1, lines }], pageCount: 1, characterCount: text.length
  }, name)
  if (parsed.sections.length !== found) throw new Error('Existem códigos repetidos ou secções ambíguas. Reveja o documento.')
  return {
    name, ...metadata(text, name),
    // DOCX table order is not a reliable printed page number.
    sections: parsed.sections.map(section => ({ ...section, sourcePages: [] })),
    warnings: [...parsed.warnings, 'Word: a origem é identificada pelo ficheiro e pela UFCD; a paginação não é inferida.']
  }
}

async function parseModuleStyleWord(
  xml: string,
  name: string,
  sha256: string
): Promise<ModuleDocument | null> {
  const dom = parseWordDom(xml)
  const text = paragraphs(dom.documentElement)
  const lines = genericWordLines(dom)
  const {
    parseModuleStylePlanificationPdfDocument
  } = await import(
    '../planifications/moduleStylePlanificationPdfParser'
  )
  const parsed =
    parseModuleStylePlanificationPdfDocument(
      {
        pages: [{
          pageNumber: 1,
          lines
        }],
        pageCount: 1,
        characterCount: text.length
      },
      name
    )

  if (parsed.sections.length === 0) {
    return null
  }

  return {
    name,
    sha256,
    ...metadata(text, name),
    sections: parsed.sections.map(section => ({
      ...section,
      sourcePages: []
    })),
    warnings: [
      ...parsed.warnings,
      'Word: a origem é identificada pelo ficheiro e pelo módulo; a paginação não é inferida.'
    ]
  }
}

export async function readModuleDocument(file: File): Promise<ModuleDocument> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Selecione um PDF ou Word até 20 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  if (/\.docx$/i.test(file.name)) {
    const archive = unzipSync(bytes, {
      filter: entry => {
        if (entry.name !== 'word/document.xml') return false
        if (entry.originalSize > MAX_XML_BYTES) throw new Error('O conteúdo do Word é demasiado grande.')
        return true
      }
    })
    if (!archive['word/document.xml']) throw new Error('O ficheiro não é um documento Word válido.')
    const xml = strFromU8(archive['word/document.xml'])

    try {
      return {
        ...parseModuleDocxXml(xml, file.name),
        sha256
      }
    } catch (failure) {
      if (
        !(failure instanceof Error) ||
        !failure.message.includes('Não foram encontradas UFCD estruturadas')
      ) {
        throw failure
      }

      const moduleDocument =
        await parseModuleStyleWord(
          xml,
          file.name,
          sha256
        )

      if (moduleDocument) {
        return moduleDocument
      }

      throw new Error(
        'Não foram encontradas UFCD ou módulos estruturados nas tabelas deste Word.'
      )
    }
  }
  if (!/\.pdf$/i.test(file.name)) throw new Error('Selecione um PDF ou um Word (.docx).')
  const { extractPlanificationPdf } = await import('../planifications/planificationPdfExtractor')
  const document = await extractPlanificationPdf(file)
  const standardParsed = parsePlanificationPdfDocument(document, file.name)
  let parsed = standardParsed

  if (standardParsed.sections.length === 0) {
    const {
      parseModuleStylePlanificationPdfDocument
    } = await import(
      '../planifications/moduleStylePlanificationPdfParser'
    )

    parsed = parseModuleStylePlanificationPdfDocument(
      document,
      file.name
    )
  }

  if (!parsed.sections.length) throw new Error('Não foram encontradas UFCD ou módulos com texto legível neste PDF.')
  const text = document.pages.flatMap(page => page.lines.map(row => row.text)).join('\n')
  return {
    name: file.name, sha256, ...metadata(text, file.name), sections: parsed.sections,
    warnings: [
      ...standardParsed.warnings.filter(warning =>
        standardParsed.sections.length > 0 ||
        !warning.includes('nenhuma UFCD')
      ),
      ...(standardParsed.sections.length > 0
        ? []
        : parsed.warnings),
      'O PDF pode dividir palavras entre linhas. Reveja as designações e os textos extraídos; pode corrigi-los antes de importar.'
    ]
  }
}

export function durationWarning(section: ParsedPlanificationPdfSection, periodMinutes: number | null) {
  if (!periodMinutes || !section.durationHours || !section.plannedLessons) {
    return 'Confirme a duração dos tempos e o número de tempos letivos a criar.'
  }
  if (Math.abs(section.durationHours * 60 - section.plannedLessons * periodMinutes) > 0.01) {
    return `${section.durationHours} horas não correspondem a ${section.plannedLessons} aulas de ${periodMinutes} minutos. Confirme o número de tempos a usar.`
  }
  return ''
}

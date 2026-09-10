import type {
  ParsedPlanificationPdfDocument,
  ParsedPlanificationPdfSection,
  PlanificationPdfCell,
  PlanificationPdfDocument,
  PlanificationPdfLine
} from './planificationPdfParser'

type BodyColumnKind =
  | 'contents'
  | 'objectives'
  | 'strategies'
  | 'descriptors'
  | 'resources'
  | 'lessons'

type ColumnAnchor = {
  kind: BodyColumnKind
  x: number
}

type MutableModule = {
  code: string
  rawLabel: string
  name: string
  sourcePages: Set<number>
  plannedLessons: number
  plannedLessonsKnown: boolean
  contents: string[]
  objectives: string[]
  strategies: string[]
  resources: string[]
  warnings: string[]
}

function clean(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = clean(value)
    const key = normalize(cleaned)

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function normalizeModuleCode(value: string) {
  const compact = clean(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toLocaleUpperCase('pt-PT')

  if (!compact) {
    return ''
  }

  return /^\d+$/.test(compact)
    ? `M${compact}`
    : compact
}

function moduleMatch(value: string) {
  const text = clean(value)
  const match = text.match(
    /\bm[oó]dulo\s+([A-Za-z]{0,3}\s*\d{1,3})(?:\s*[-–—:]\s*|\s+)?(.*)$/i
  )

  if (!match) {
    return null
  }

  const code = normalizeModuleCode(match[1])
  const trailing = clean(match[2] ?? '')
    .replace(/^[-–—:]+\s*/, '')

  if (!code) {
    return null
  }

  return {
    code,
    rawLabel: text,
    name: trailing
  }
}

function topicFromHeader(value: string) {
  const text = clean(value)
  const match = text.match(
    /\btema\s*:\s*(.+?)(?=\s+(?:professor(?:a)?|n[.ºo]*\s*(?:aulas|horas))\s*:|$)/i
  )

  return clean(match?.[1] ?? '')
}

function hoursFromHeader(value: string) {
  const text = clean(value)
  const matches = [
    text.match(
      /\bn[.ºo]*\s*horas?\s*:\s*(\d+(?:[.,]\d+)?)/i
    ),
    text.match(
      /\b(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\b/i
    )
  ]

  for (const match of matches) {
    if (!match) continue
    const parsed = Number(
      match[1].replace(',', '.')
    )
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function plannedLessonsFromHeader(value: string) {
  const match = clean(value).match(
    /\bn[.ºo]*\s*(?:de\s*)?aulas(?:\s+previstas?)?\s*:\s*(\d{1,3})\b/i
  )

  const parsed = Number(match?.[1] ?? '')

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null
}

function bodyHeaderKind(value: string): BodyColumnKind | null {
  const normalized = normalize(value)

  if (
    /^(?:tema|dominio\s*\/\s*tema|temas?(?:,|\s)|topicos?)/.test(normalized) ||
    normalized.includes('topicos e subtopicos')
  ) {
    return 'contents'
  }

  if (
    normalized.includes('aprendizagens essenciais') ||
    normalized.includes('conhecimentos, capacidades e atitudes') ||
    normalized.includes('conhecimentos capacidades e atitudes') ||
    normalized.includes('objetivos/competencias')
  ) {
    return 'objectives'
  }

  if (
    normalized.includes('acoes estrategicas de ensino') ||
    normalized.includes('estrategias/metodologias')
  ) {
    return 'strategies'
  }

  if (
    normalized.includes('descritores') &&
    normalized.includes('perfil')
  ) {
    return 'descriptors'
  }

  if (normalized === 'recursos') {
    return 'resources'
  }

  if (
    normalized.includes('tempos letivos') ||
    normalized.includes('aulas previstas')
  ) {
    return 'lessons'
  }

  return null
}

function positionedCells(line: PlanificationPdfLine) {
  return (
    line.positionedCells &&
    line.positionedCells.length > 0
      ? line.positionedCells
      : line.cells.map(
          (text, index): PlanificationPdfCell => ({
            text,
            x: index * 150,
            width: 120
          })
        )
  )
}

function collectBodyAnchors(
  lines: PlanificationPdfLine[]
) {
  const byKind = new Map<
    BodyColumnKind,
    number[]
  >()

  for (const line of lines) {
    for (const cell of positionedCells(line)) {
      const kind = bodyHeaderKind(cell.text)
      if (!kind) continue
      const positions = byKind.get(kind) ?? []
      positions.push(cell.x)
      byKind.set(kind, positions)
    }
  }

  return Array.from(byKind.entries())
    .map(([kind, positions]) => ({
      kind,
      x:
        positions.reduce(
          (total, position) => total + position,
          0
        ) / positions.length
    }))
    .sort((left, right) => left.x - right.x)
}

function nearestAnchor(
  cell: PlanificationPdfCell,
  anchors: ColumnAnchor[]
) {
  if (anchors.length === 0) {
    return null
  }

  const probe =
    cell.x + Math.max(0, cell.width) * 0.1

  return anchors.reduce(
    (best, current) =>
      Math.abs(current.x - probe) <
      Math.abs(best.x - probe)
        ? current
        : best,
    anchors[0]
  )
}

function looksLikeDecoration(value: string) {
  const normalized = normalize(value)

  return (
    !normalized ||
    normalized.includes('agrupamento de escolas') ||
    normalized.startsWith('rua da liberdade') ||
    normalized.startsWith('email:') ||
    normalized.includes('facebook.com/') ||
    normalized.includes('instagram:') ||
    normalized.startsWith('planificacao de ')
  )
}

function rowLessonValue(
  line: PlanificationPdfLine,
  anchors: ColumnAnchor[]
) {
  const lessonAnchor = anchors.find(
    anchor => anchor.kind === 'lessons'
  )

  if (!lessonAnchor) {
    return null
  }

  const values = positionedCells(line)
    .filter(cell =>
      nearestAnchor(cell, anchors)?.kind === 'lessons'
    )
    .map(cell => clean(cell.text))

  for (const value of values) {
    const match = value.match(
      /(?:^|\s)(\d{1,3})(?:\s*T\b|\s*$)/i
    )
    const parsed = Number(match?.[1] ?? '')

    if (
      Number.isInteger(parsed) &&
      parsed > 0 &&
      parsed <= 150
    ) {
      return parsed
    }
  }

  return null
}

function summaryLessonValue(
  line: PlanificationPdfLine,
  moduleCell: PlanificationPdfCell
) {
  const cells = positionedCells(line)
    .filter(cell => cell.x > moduleCell.x)
    .sort((left, right) => left.x - right.x)

  for (const cell of cells) {
    const value = clean(cell.text)
    if (!/^\d{1,3}$/.test(value)) continue
    const parsed = Number(value)
    if (
      Number.isInteger(parsed) &&
      parsed > 0 &&
      parsed <= 150
    ) {
      return parsed
    }
  }

  return null
}

function createModule(
  match: NonNullable<ReturnType<typeof moduleMatch>>,
  pageNumber: number
): MutableModule {
  return {
    code: match.code,
    rawLabel: match.rawLabel,
    name: match.name,
    sourcePages: new Set([pageNumber]),
    plannedLessons: 0,
    plannedLessonsKnown: false,
    contents: [],
    objectives: [],
    strategies: [],
    resources: [],
    warnings: []
  }
}

function moduleMapFromDocument(
  document: PlanificationPdfDocument
) {
  const modules = new Map<string, MutableModule>()
  const moduleOrder: string[] = []

  for (const page of document.pages) {
    for (const line of page.lines) {
      for (const cell of positionedCells(line)) {
        const match = moduleMatch(cell.text)
        if (!match) continue

        let module = modules.get(match.code)
        if (!module) {
          module = createModule(
            match,
            page.pageNumber
          )
          modules.set(match.code, module)
          moduleOrder.push(match.code)
        }

        module.sourcePages.add(page.pageNumber)

        if (
          !module.name &&
          match.name
        ) {
          module.name = match.name
        }

        const lessons =
          summaryLessonValue(line, cell)

        if (lessons !== null) {
          module.plannedLessons += lessons
          module.plannedLessonsKnown = true
        }
      }

      const wholeLineMatch = moduleMatch(line.text)
      if (!wholeLineMatch) continue

      let module = modules.get(wholeLineMatch.code)
      if (!module) {
        module = createModule(
          wholeLineMatch,
          page.pageNumber
        )
        modules.set(wholeLineMatch.code, module)
        moduleOrder.push(wholeLineMatch.code)
      }

      module.sourcePages.add(page.pageNumber)
      if (!module.name && wholeLineMatch.name) {
        module.name = wholeLineMatch.name
      }
    }
  }

  return {
    modules,
    moduleOrder
  }
}

function finalize(
  module: MutableModule,
  sourceDocumentName: string,
  durationHours: number | null
): ParsedPlanificationPdfSection {
  const contents = unique(module.contents)
  const objectives = unique(module.objectives)
  const strategies = unique(module.strategies)
  const resources = unique(module.resources)
  const warnings = [...module.warnings]

  if (!module.name) {
    warnings.push(
      'A designação do módulo não foi identificada; confirme-a antes de importar.'
    )
  }

  if (!module.plannedLessonsKnown) {
    warnings.push(
      'O número de tempos letivos do módulo não foi identificado com segurança.'
    )
  }

  return {
    sourceDocumentName,
    sourcePages: Array.from(module.sourcePages)
      .sort((left, right) => left - right),
    code: module.code,
    name: module.name || module.rawLabel,
    durationHours,
    plannedLessons:
      module.plannedLessonsKnown
        ? module.plannedLessons
        : null,
    periodLabel: '',
    contentsText: contents.join('\n'),
    objectivesText: objectives.join('\n'),
    methodologyText: strategies.join('\n'),
    resourcesText: resources.join('\n'),
    evaluationText: '',
    warnings
  }
}

export function parseModuleStylePlanificationPdfDocument(
  document: PlanificationPdfDocument,
  sourceDocumentName: string
): ParsedPlanificationPdfDocument {
  const text = document.pages
    .flatMap(page => page.lines.map(line => line.text))
    .join('\n')

  if (
    !/\bplanifica[çc][ãa]o\b/i.test(text) ||
    !/\bm[oó]dulo\s+[A-Za-z]{0,3}\s*\d{1,3}\b/i.test(text)
  ) {
    return {
      sourceDocumentName,
      sections: [],
      warnings: []
    }
  }

  const {
    modules,
    moduleOrder
  } = moduleMapFromDocument(document)

  if (moduleOrder.length === 0) {
    return {
      sourceDocumentName,
      sections: [],
      warnings: [
        'O documento refere módulos, mas não foi possível separar as respetivas secções com segurança.'
      ]
    }
  }

  const allLines = document.pages.flatMap(
    page => page.lines
  )
  const anchors = collectBodyAnchors(allLines)
  let activeCode =
    moduleOrder.length === 1
      ? moduleOrder[0]
      : ''

  for (const page of document.pages) {
    let pageAnchors = collectBodyAnchors(
      page.lines
    )

    if (pageAnchors.length < 2) {
      pageAnchors = anchors
    }

    for (const line of page.lines) {
      const lineModule = moduleMatch(line.text)

      if (lineModule && modules.has(lineModule.code)) {
        activeCode = lineModule.code
        const module = modules.get(activeCode)!
        module.sourcePages.add(page.pageNumber)

        const topic = topicFromHeader(line.text)
        if (
          topic &&
          !module.name
        ) {
          module.name = topic
        }
        continue
      }

      if (
        !activeCode ||
        looksLikeDecoration(line.text)
      ) {
        continue
      }

      const module = modules.get(activeCode)
      if (!module) continue

      const topic = topicFromHeader(line.text)
      if (topic && !module.name) {
        module.name = topic
      }

      if (
        positionedCells(line).some(cell =>
          bodyHeaderKind(cell.text) !== null
        )
      ) {
        continue
      }

      if (pageAnchors.length >= 2) {
        for (const cell of positionedCells(line)) {
          const value = clean(cell.text)
          if (!value) continue
          const anchor = nearestAnchor(
            cell,
            pageAnchors
          )
          if (!anchor) continue

          if (anchor.kind === 'contents') {
            module.contents.push(value)
          } else if (anchor.kind === 'objectives') {
            module.objectives.push(value)
          } else if (anchor.kind === 'strategies') {
            module.strategies.push(value)
          } else if (anchor.kind === 'resources') {
            module.resources.push(value)
          }
        }

        if (!module.plannedLessonsKnown) {
          const lessons = rowLessonValue(
            line,
            pageAnchors
          )
          if (lessons !== null) {
            module.plannedLessons = lessons
            module.plannedLessonsKnown = true
          }
        }
      }

      module.sourcePages.add(page.pageNumber)
    }
  }

  const singleModuleDuration =
    moduleOrder.length === 1
      ? hoursFromHeader(text)
      : null
  const headerLessons =
    moduleOrder.length === 1
      ? plannedLessonsFromHeader(text)
      : null

  if (
    moduleOrder.length === 1 &&
    headerLessons !== null
  ) {
    const module = modules.get(moduleOrder[0])!
    module.plannedLessons = headerLessons
    module.plannedLessonsKnown = true
  }

  const sections = moduleOrder.map(code =>
    finalize(
      modules.get(code)!,
      sourceDocumentName,
      singleModuleDuration
    )
  )

  return {
    sourceDocumentName,
    sections,
    warnings: [
      'Foi reconhecida uma planificação organizada por módulos, sem código UFCD obrigatório. Confirme designações e tempos antes de guardar.'
    ]
  }
}

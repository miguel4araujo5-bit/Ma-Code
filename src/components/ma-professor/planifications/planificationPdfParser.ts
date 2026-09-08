export interface PlanificationPdfCell {
  text: string
  x: number
  width: number
}

export interface PlanificationPdfLine {
  text: string
  cells: string[]
  positionedCells?: PlanificationPdfCell[]
}

export interface PlanificationPdfPage {
  pageNumber: number
  lines: PlanificationPdfLine[]
}

export interface PlanificationPdfDocument {
  pages: PlanificationPdfPage[]
  pageCount: number
  characterCount: number
}

export interface ParsedPlanificationPdfSection {
  sourceDocumentName: string
  sourcePages: number[]
  code: string
  name: string
  durationHours: number | null
  plannedLessons: number | null
  periodLabel: string
  contentsText: string
  objectivesText: string
  methodologyText: string
  resourcesText: string
  evaluationText: string
  warnings: string[]
}

export interface ParsedPlanificationPdfDocument {
  sourceDocumentName: string
  sections: ParsedPlanificationPdfSection[]
  warnings: string[]
}

export interface PlanificationPdfDestination {
  moduleId: string
  teachingAssignmentId: string
  code: string
  name: string
  label: string
  hasActivePlanification: boolean
}

export interface PlanificationPdfDestinationMatch {
  section: ParsedPlanificationPdfSection
  candidates: PlanificationPdfDestination[]
  automaticDestinationId: string | null
  warnings: string[]
}

type ColumnKind =
  | 'period'
  | 'module'
  | 'contents'
  | 'objectives'
  | 'strategies'
  | 'lessons'

type ColumnAnchor = {
  kind: ColumnKind
  x: number
}

type MutableSection = {
  sourceDocumentName: string
  sourcePages: Set<number>
  code: string
  moduleFragments: string[]
  periodFragments: string[]
  contentFragments: string[]
  objectiveFragments: string[]
  strategyFragments: string[]
  lessonFragments: string[]
  evaluationFragments: string[]
  warnings: string[]
}

const HEADER_KIND_PATTERNS: Array<{
  kind: ColumnKind
  pattern: RegExp
}> = [
  {
    kind: 'period',
    pattern: /^(?:periodo|letivo|periodo letivo)$/i
  },
  {
    kind: 'module',
    pattern: /^ufcd(?:\s*\(\s*horas?\s*\))?$/i
  },
  {
    kind: 'contents',
    pattern: /^(?:temas?|conteudos?|temas?\s*\/\s*conteudos?)$/i
  },
  {
    kind: 'objectives',
    pattern: /^(?:objetivos?|competencias?|objetivos?\s*\/\s*competencias?)$/i
  },
  {
    kind: 'strategies',
    pattern: /^(?:estrategias?|metodologias?|estrategias?\s*\/\s*metodologias?)$/i
  },
  {
    kind: 'lessons',
    pattern: /^(?:n(?:o|º|°)?\s*de\s*)?(?:aulas?(?:\s+previstas?)?|previstas?)(?:\s*\(.*\))?$/i
  }
]

function normalizeSpaces(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeComparable(value: string) {
  return normalizeSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeSpaces(value)

    if (!normalized) {
      continue
    }

    const key = normalizeComparable(normalized)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(normalized)
  }

  return result
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)

  if (sorted.length === 0) {
    return 0
  }

  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function getHeaderKind(value: string): ColumnKind | null {
  const normalized = normalizeComparable(value)

  for (const candidate of HEADER_KIND_PATTERNS) {
    if (candidate.pattern.test(normalized)) {
      return candidate.kind
    }
  }

  return null
}

function isEvaluationLabel(value: string) {
  const normalized = normalizeComparable(value)

  return normalized === 'avaliacao' ||
    normalized === 'avaliação'
}

function hasUfcdCode(value: string) {
  return /\bufcd\s*[.:#-]?\s*\d{3,6}\b/i.test(
    normalizeSpaces(value)
  )
}

function getCellProbeX(cell: PlanificationPdfCell) {
  return cell.x + Math.min(
    5,
    Math.max(1, cell.width * 0.12)
  )
}

function collectAnchors(
  document: PlanificationPdfDocument
): ColumnAnchor[] {
  const values = new Map<ColumnKind, number[]>()

  for (const page of document.pages) {
    let sectionStarted = false

    for (const line of page.lines) {
      const cells = line.positionedCells ?? []

      if (
        hasUfcdCode(line.text) ||
        cells.some(cell => hasUfcdCode(cell.text))
      ) {
        sectionStarted = true
      }

      if (sectionStarted) {
        break
      }

      for (const cell of cells) {
        const kind = getHeaderKind(cell.text)

        if (!kind) {
          continue
        }

        const current = values.get(kind) ?? []
        current.push(getCellProbeX(cell))
        values.set(kind, current)
      }
    }
  }

  return (
    [
      'period',
      'module',
      'contents',
      'objectives',
      'strategies',
      'lessons'
    ] as ColumnKind[]
  )
    .flatMap(kind => {
      const positions = values.get(kind) ?? []

      return positions.length > 0
        ? [{ kind, x: median(positions) }]
        : []
    })
    .sort((left, right) => left.x - right.x)
}

function getColumnKind(
  cell: PlanificationPdfCell,
  anchors: ColumnAnchor[]
): ColumnKind | null {
  if (anchors.length === 0) {
    return null
  }

  const probe = getCellProbeX(cell)

  let best = anchors[0]
  let bestDistance = Math.abs(probe - best.x)

  for (let index = 1; index < anchors.length; index += 1) {
    const current = anchors[index]
    const distance = Math.abs(probe - current.x)

    if (distance < bestDistance) {
      best = current
      bestDistance = distance
    }
  }

  return best.kind
}

function isTableHeaderLine(line: PlanificationPdfLine) {
  const cells = line.positionedCells ?? []
  const kinds = new Set(
    cells
      .map(cell => getHeaderKind(cell.text))
      .filter((kind): kind is ColumnKind => Boolean(kind))
  )

  return kinds.size >= 2
}

function lineLooksLikeDecoration(line: PlanificationPdfLine) {
  const normalized = normalizeComparable(line.text)

  if (!normalized) {
    return true
  }

  return (
    normalized.includes('agrupamento de escolas') ||
    normalized.startsWith('pagina ') ||
    normalized.startsWith('rua da liberdade') ||
    normalized.startsWith('email:') ||
    normalized.includes('facebook.com/') ||
    normalized.includes('instagram:') ||
    normalized.startsWith('planificacao de ') ||
    normalized.startsWith('curso profissional')
  )
}

function addPage(section: MutableSection, pageNumber: number) {
  section.sourcePages.add(pageNumber)
}

function appendFragment(
  section: MutableSection,
  kind: ColumnKind,
  value: string,
  pageNumber: number
) {
  const normalized = normalizeSpaces(value)

  if (!normalized) {
    return
  }

  addPage(section, pageNumber)

  if (kind === 'period') {
    section.periodFragments.push(normalized)
    return
  }

  if (kind === 'module') {
    section.moduleFragments.push(normalized)
    return
  }

  if (kind === 'contents') {
    section.contentFragments.push(normalized)
    return
  }

  if (kind === 'objectives') {
    section.objectiveFragments.push(normalized)
    return
  }

  if (kind === 'strategies') {
    section.strategyFragments.push(normalized)
    return
  }

  section.lessonFragments.push(normalized)
}

function createSection(
  sourceDocumentName: string,
  code: string,
  pageNumber: number,
  initialModuleFragment: string
): MutableSection {
  return {
    sourceDocumentName,
    sourcePages: new Set([pageNumber]),
    code,
    moduleFragments: initialModuleFragment
      ? [normalizeSpaces(initialModuleFragment)]
      : [],
    periodFragments: [],
    contentFragments: [],
    objectiveFragments: [],
    strategyFragments: [],
    lessonFragments: [],
    evaluationFragments: [],
    warnings: []
  }
}

function extractCode(value: string) {
  const direct = normalizeSpaces(value).match(
    /\bufcd\s*[.:#-]?\s*(\d{3,6})\b/i
  )

  return direct?.[1] ?? null
}

function extractLeadingCode(value: string) {
  const match = normalizeSpaces(value).match(
    /^(\d{3,6})(?:\b|(?=\s*\())/
  )

  return match?.[1] ?? null
}

function parseDurationHours(value: string) {
  const match = normalizeSpaces(value).match(
    /\(\s*(\d+(?:[.,]\d+)?)\s*horas?\s*\)/i
  )

  if (!match) {
    return null
  }

  const parsed = Number(match[1].replace(',', '.'))

  return Number.isFinite(parsed)
    ? parsed
    : null
}

function parsePlannedLessons(values: string[]) {
  for (const value of values) {
    const match = normalizeSpaces(value).match(
      /\b(\d{1,3})\b/
    )

    if (!match) {
      continue
    }

    const parsed = Number(match[1])

    if (
      Number.isInteger(parsed) &&
      parsed > 0
    ) {
      return parsed
    }
  }

  return null
}

function cleanModuleName(
  moduleText: string,
  code: string
) {
  return normalizeSpaces(moduleText)
    .replace(
      new RegExp(
        `\\bufcd\\s*[.:#-]?\\s*${code}\\b`,
        'i'
      ),
      ' '
    )
    .replace(
      /\(\s*\d+(?:[.,]\d+)?\s*horas?\s*\)/gi,
      ' '
    )
    .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitStrategies(
  fragments: string[]
) {
  const text = uniqueStrings(fragments).join('\n')
  const comparable = normalizeComparable(text)
  const marker = comparable.indexOf('uso de:')

  if (marker === -1) {
    return {
      methodologyText:
        text.replace(
          /^\s*m[eé]todos?\s*:\s*/i,
          ''
        ).trim(),
      resourcesText: ''
    }
  }

  const originalMarker = text
    .toLocaleLowerCase('pt-PT')
    .indexOf('uso de:')

  if (originalMarker === -1) {
    return {
      methodologyText: text,
      resourcesText: ''
    }
  }

  return {
    methodologyText:
      text
        .slice(0, originalMarker)
        .replace(
          /^\s*m[eé]todos?\s*:\s*/i,
          ''
        )
        .trim(),
    resourcesText:
      text
        .slice(
          originalMarker +
            'uso de:'.length
        )
        .trim()
  }
}

function finalizeSection(
  section: MutableSection
): ParsedPlanificationPdfSection {
  const moduleText =
    uniqueStrings(section.moduleFragments)
      .join(' ')

  const durationHours =
    parseDurationHours(moduleText)

  const name =
    cleanModuleName(
      moduleText,
      section.code
    )

  const strategies =
    splitStrategies(
      section.strategyFragments
    )

  const warnings = [
    ...section.warnings
  ]

  if (!name) {
    warnings.push(
      'A designação da UFCD não foi identificada com segurança.'
    )
  }

  if (durationHours === null) {
    warnings.push(
      'A duração da UFCD não foi identificada.'
    )
  }

  return {
    sourceDocumentName:
      section.sourceDocumentName,
    sourcePages:
      [...section.sourcePages]
        .sort((left, right) => left - right),
    code:
      section.code,
    name,
    durationHours,
    plannedLessons:
      parsePlannedLessons(
        section.lessonFragments
      ),
    periodLabel:
      uniqueStrings(
        section.periodFragments
      ).join(' '),
    contentsText:
      uniqueStrings(
        section.contentFragments
      ).join('\n'),
    objectivesText:
      uniqueStrings(
        section.objectiveFragments
      ).join('\n'),
    methodologyText:
      strategies.methodologyText,
    resourcesText:
      strategies.resourcesText,
    evaluationText:
      uniqueStrings(
        section.evaluationFragments
      ).join('\n'),
    warnings
  }
}

export function parsePlanificationPdfDocument(
  document: PlanificationPdfDocument,
  sourceDocumentName: string
): ParsedPlanificationPdfDocument {
  const warnings: string[] = []

  if (
    document.characterCount <= 0 ||
    document.pages.every(
      page =>
        page.lines.every(
          line =>
            !normalizeSpaces(line.text)
        )
    )
  ) {
    return {
      sourceDocumentName,
      sections: [],
      warnings: [
        'O documento não contém texto extraível. A importação automática não pode prosseguir.'
      ]
    }
  }

  const anchors =
    collectAnchors(document)

  const requiredKinds:
    ColumnKind[] = [
      'module',
      'contents',
      'objectives',
      'strategies'
    ]

  const anchorKinds =
    new Set(
      anchors.map(anchor => anchor.kind)
    )

  for (const kind of requiredKinds) {
    if (!anchorKinds.has(kind)) {
      warnings.push(
        `Não foi possível localizar com segurança a coluna “${kind}”.`
      )
    }
  }

  let current: MutableSection | null = null
  const sections: MutableSection[] = []
  let pendingUfcdLabel = false

  for (const page of document.pages) {
    let sawTableHeader = false
    let bodyStarted = false
    let evaluationReached = false

    for (const line of page.lines) {
      const positioned =
        line.positionedCells ?? []

      if (isTableHeaderLine(line)) {
        sawTableHeader = true
        continue
      }

      if (!sawTableHeader) {
        continue
      }

      if (
        evaluationReached ||
        lineLooksLikeDecoration(line)
      ) {
        continue
      }

      const evaluationCells =
        positioned.filter(
          cell =>
            isEvaluationLabel(
              cell.text
            )
        )

      if (
        evaluationCells.length > 0 ||
        /^\s*avalia[cç][aã]o\b/i.test(
          line.text
        )
      ) {
        if (current) {
          const values =
            positioned.length > 0
              ? positioned
                  .filter(
                    cell =>
                      !isEvaluationLabel(
                        cell.text
                      )
                  )
                  .map(cell => cell.text)
              : [
                  line.text.replace(
                    /^\s*avalia[cç][aã]o\s*/i,
                    ''
                  )
                ]

          current.evaluationFragments.push(
            ...values
          )
          addPage(
            current,
            page.pageNumber
          )
        }

        evaluationReached = true
        continue
      }

      if (!bodyStarted) {
        bodyStarted = true
      }

      if (!bodyStarted) {
        continue
      }

      if (positioned.length === 0) {
        if (
          current &&
          hasUfcdCode(line.text)
        ) {
          const code =
            extractCode(line.text)

          if (code) {
            if (
              !current ||
              current.code !== code
            ) {
              current =
                createSection(
                  sourceDocumentName,
                  code,
                  page.pageNumber,
                  line.text
                )

              sections.push(current)
            } else {
              current.moduleFragments.push(
                line.text
              )
              addPage(
                current,
                page.pageNumber
              )
            }
          }
        }

        continue
      }

      for (const cell of positioned) {
        const value =
          normalizeSpaces(cell.text)

        if (!value) {
          continue
        }

        const kind =
          getColumnKind(
            cell,
            anchors
          )

        if (!kind) {
          continue
        }

        if (kind === 'module') {
          const directCode =
            extractCode(value)

          if (directCode) {
            if (
              !current ||
              current.code !==
                directCode
            ) {
              current =
                createSection(
                  sourceDocumentName,
                  directCode,
                  page.pageNumber,
                  value
                )
              sections.push(
                current
              )
            } else {
              current.moduleFragments.push(
                value
              )
              addPage(
                current,
                page.pageNumber
              )
            }

            pendingUfcdLabel = false
            continue
          }

          if (
            normalizeComparable(value) ===
            'ufcd'
          ) {
            pendingUfcdLabel = true
            continue
          }

          if (pendingUfcdLabel) {
            const code =
              extractLeadingCode(value)

            if (code) {
              if (
                !current ||
                current.code !== code
              ) {
                current =
                  createSection(
                    sourceDocumentName,
                    code,
                    page.pageNumber,
                    `UFCD ${value}`
                  )
                sections.push(
                  current
                )
              } else {
                current.moduleFragments.push(
                  value
                )
                addPage(
                  current,
                  page.pageNumber
                )
              }

              pendingUfcdLabel = false
              continue
            }
          }
        }

        if (current) {
          appendFragment(
            current,
            kind,
            value,
            page.pageNumber
          )
        }
      }
    }
  }

  const finalized =
    sections.map(
      finalizeSection
    )

  if (finalized.length === 0) {
    warnings.push(
      'Não foi identificada nenhuma UFCD no documento.'
    )
  }

  return {
    sourceDocumentName,
    sections: finalized,
    warnings
  }
}

export function matchPlanificationPdfDestinations(
  sections: ParsedPlanificationPdfSection[],
  destinations: PlanificationPdfDestination[]
): PlanificationPdfDestinationMatch[] {
  return sections.map(section => {
    const codeMatches =
      section.code
        ? destinations.filter(
            destination =>
              destination.code.trim() ===
              section.code
          )
        : []

    const nameMatches =
      codeMatches.length === 0 &&
      !section.code &&
      section.name
        ? destinations.filter(
            destination =>
              normalizeComparable(
                destination.name
              ) ===
              normalizeComparable(
                section.name
              )
          )
        : []

    const candidates =
      codeMatches.length > 0
        ? codeMatches
        : nameMatches

    const warnings: string[] = []

    if (
      section.code &&
      candidates.length === 0
    ) {
      warnings.push(
        `Não existe uma UFCD com o código exato ${section.code}.`
      )
    }

    if (
      candidates.length > 1
    ) {
      warnings.push(
        'Existem vários destinos possíveis para esta UFCD. Confirme a turma e a disciplina.'
      )
    }

    if (
      candidates.some(
        candidate =>
          candidate.hasActivePlanification
      )
    ) {
      warnings.push(
        'Pelo menos um destino já possui uma planificação ativa. A importação não a deve substituir automaticamente.'
      )
    }

    return {
      section,
      candidates,
      automaticDestinationId:
        candidates.length === 1 &&
        !candidates[0]
          .hasActivePlanification
          ? candidates[0].moduleId
          : null,
      warnings
    }
  })
}

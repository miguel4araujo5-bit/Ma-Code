import type {
  ScheduleGeometryPageInput,
  ScheduleGeometryTextItem,
  ScheduleGridDocument,
  ScheduleGridWeekday,
  ScheduleImportBlock
} from './scheduleGridGeometry'

export type ScheduleLegendEntry = {
  code: string
  label: string
  sourcePage: number
}

export type ScheduleSemanticLesson = {
  sourceBlockId: string
  included: boolean
  weekday: ScheduleGridWeekday
  startTime: string
  endTime: string
  periodCount: number
  groupName: string
  courseCode: string
  courseName: string
  subjectCode: string
  subjectName: string
  subjectConfirmed: boolean
  warnings: string[]
}

export type ScheduleSemanticDuty = {
  sourceBlockId: string
  included: boolean
  weekday: ScheduleGridWeekday
  startTime: string
  endTime: string
  name: string
  warnings: string[]
}

export type ScheduleSemanticUnknown = {
  sourceBlockId: string
  weekday: ScheduleGridWeekday
  startTime: string
  endTime: string
  rawActivityText: string
  rawRoomText: string
  warnings: string[]
}

export type ScheduleSemanticProposal = {
  lessons: ScheduleSemanticLesson[]
  duties: ScheduleSemanticDuty[]
  unknownBlocks: ScheduleSemanticUnknown[]
  legend: ScheduleLegendEntry[]
}

type VisualLine = {
  y: number
  text: string
}

type GroupContext = {
  groupName: string
  courseCode: string
  activityText: string
}

const fallbackSubjects: Array<{
  name: string
  aliases: string[]
}> = [
  {
    name: 'Área de Expressões',
    aliases: ['AEXP', 'AE']
  },
  {
    name: 'Animação Sociocultural',
    aliases: ['AS', 'ASC']
  },
  {
    name: 'Prova de Aptidão Profissional',
    aliases: ['PAP']
  },
  {
    name: 'Português',
    aliases: ['PORT', 'POR']
  },
  {
    name: 'Inglês',
    aliases: ['ING']
  },
  {
    name: 'Área de Integração',
    aliases: ['AI']
  },
  {
    name: 'Tecnologias da Informação e Comunicação',
    aliases: ['TIC']
  },
  {
    name: 'Educação Física',
    aliases: ['EF']
  },
  {
    name: 'Psicologia',
    aliases: ['PSI']
  },
  {
    name: 'Sociologia',
    aliases: ['SOC']
  }
]

const fallbackCourses: Array<{
  name: string
  aliases: string[]
}> = [
  {
    name: 'Técnico de Apoio Psicossocial',
    aliases: ['AP', 'TAP']
  }
]

function clean(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function median(values: number[]) {
  if (values.length === 0) return 10

  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)

  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

function visualLines(
  items: ScheduleGeometryTextItem[]
): VisualLine[] {
  if (items.length === 0) return []

  const tolerance = Math.max(
    2,
    median(
      items
        .map(item => item.height)
        .filter(value => value > 0)
    ) * 0.45
  )
  const ordered = [...items].sort((left, right) => {
    const vertical = right.y - left.y
    return Math.abs(vertical) > tolerance
      ? vertical
      : left.x - right.x
  })
  const rows: Array<{
    y: number
    items: ScheduleGeometryTextItem[]
  }> = []

  for (const item of ordered) {
    const current = rows[rows.length - 1]

    if (!current || Math.abs(current.y - item.y) > tolerance) {
      rows.push({
        y: item.y,
        items: [item]
      })
      continue
    }

    current.items.push(item)
    current.y =
      current.items.reduce(
        (total, rowItem) => total + rowItem.y,
        0
      ) / current.items.length
  }

  return rows
    .map(row => ({
      y: row.y,
      text: clean(
        [...row.items]
          .sort((left, right) => left.x - right.x)
          .map(item => item.text)
          .join(' ')
      )
    }))
    .filter(line => line.text.length > 0)
}

function parseLegendLine(
  value: string,
  sourcePage: number
): ScheduleLegendEntry | null {
  const match = clean(value).match(
    /^(.{1,48}?)\s*[-–—]\s*(.{2,})$/u
  )

  if (!match) {
    return null
  }

  const code = clean(match[1])
  const label = clean(match[2])

  if (
    !code ||
    !label ||
    /^(?:CL|CNL|TOTAL)$/i.test(code)
  ) {
    return null
  }

  return {
    code,
    label,
    sourcePage
  }
}

export function extractScheduleLegend(
  sourcePages: ScheduleGeometryPageInput[]
): ScheduleLegendEntry[] {
  const entries: ScheduleLegendEntry[] = []
  const seen = new Set<string>()

  for (const page of sourcePages) {
    const lines = visualLines(page.items)
    const startIndex = lines.findIndex(line =>
      normalize(line.text).includes('atividades do professor')
    )

    if (startIndex < 0) {
      continue
    }

    for (
      let index = startIndex + 1;
      index < lines.length;
      index += 1
    ) {
      const line = lines[index]
      const normalizedLine = normalize(line.text)

      if (
        /^(?:o diretor|a diretora)(?:\b|:)/.test(normalizedLine)
      ) {
        break
      }

      const entry = parseLegendLine(
        line.text,
        page.pageNumber
      )

      if (entry) {
        const key = normalize(entry.code)

        if (!seen.has(key)) {
          entries.push(entry)
          seen.add(key)
        }

        continue
      }

      if (
        line.text.length <= 48 &&
        /[A-Za-zÀ-ÿ]/u.test(line.text) &&
        !/\b(?:CL|CNL|TOTAL|Créditos?)\b/i.test(line.text)
      ) {
        const key = normalize(line.text)

        if (!seen.has(key)) {
          entries.push({
            code: line.text,
            label: line.text,
            sourcePage: page.pageNumber
          })
          seen.add(key)
        }
      }
    }
  }

  return entries
}

function parseGroupContext(
  value: string
): GroupContext | null {
  const source = clean(value)
  const match = source.match(
    /\b([1-9]|1[0-2])\s*(?:\.?\s*[ºo°])?\s*([A-Za-z])(?:\s*[_-]\s*([A-Za-z][A-Za-z0-9]*))?/iu
  )

  if (!match || match.index === undefined) {
    return null
  }

  const grade = match[1]
  const letter = match[2].toLocaleUpperCase('pt-PT')
  const courseCode = clean(match[3] ?? '')
  const afterGroup = source.slice(
    match.index + match[0].length
  )
  const activityText = clean(
    afterGroup.replace(/^[\s._|:;\-/]+/u, '')
  )

  return {
    groupName: `${grade}.º ${letter}`,
    courseCode,
    activityText
  }
}

function resolveCourseName(code: string) {
  const normalizedCode = normalize(code)

  if (!normalizedCode) return ''

  const match = fallbackCourses.find(course =>
    course.aliases.some(alias => normalize(alias) === normalizedCode)
  )

  return match?.name ?? ''
}

function resolveLegendEntry(
  value: string,
  legend: ScheduleLegendEntry[]
) {
  const normalizedValue = normalize(value)

  if (!normalizedValue) {
    return null
  }

  const exact = legend.find(entry =>
    normalize(entry.code) === normalizedValue ||
    normalize(entry.label) === normalizedValue
  )

  if (exact) {
    return exact
  }

  return legend.find(entry => {
    const normalizedCode = normalize(entry.code)

    return (
      normalizedCode.length > 0 &&
      normalizedValue.startsWith(`${normalizedCode} `)
    )
  }) ?? null
}

function resolveSubject(
  activityText: string,
  legend: ScheduleLegendEntry[]
) {
  const source = clean(activityText)
  const legendEntry = resolveLegendEntry(
    source,
    legend
  )

  if (legendEntry) {
    return {
      subjectCode: legendEntry.code,
      subjectName: legendEntry.label,
      subjectConfirmed: true,
      warnings: [] as string[]
    }
  }

  const normalizedSource = normalize(source)
  const fallback = fallbackSubjects.find(subject =>
    normalize(subject.name) === normalizedSource ||
    subject.aliases.some(alias => normalize(alias) === normalizedSource)
  )

  if (fallback) {
    return {
      subjectCode: source,
      subjectName: fallback.name,
      subjectConfirmed: true,
      warnings: [
        'A disciplina foi resolvida por um alias interno porque a legenda do PDF não forneceu uma correspondência utilizável.'
      ]
    }
  }

  const compact = source.replace(/[\s._/\-]/g, '')
  const ambiguousShortLabel =
    compact.length > 0 &&
    compact.length <= 8 &&
    /^[A-Z0-9]+$/.test(compact)

  return {
    subjectCode: source,
    subjectName: source,
    subjectConfirmed:
      Boolean(source) && !ambiguousShortLabel,
    warnings: source
      ? [
          ambiguousShortLabel
            ? `A sigla “${source}” não aparece na legenda do PDF e precisa de confirmação.`
            : 'O nome da disciplina não foi confirmado pela legenda do PDF.'
        ]
      : [
          'A célula tem turma identificável, mas não foi possível identificar a disciplina.'
        ]
  }
}

function looksLikeExplicitDuty(
  value: string,
  legend: ScheduleLegendEntry[]
) {
  const candidate = clean(value)

  if (!candidate) return false

  if (resolveLegendEntry(candidate, legend)) {
    return true
  }

  return (
    /^(?:Eq(?:uipa)?\s+|Co\s+|Clube\s+)/i.test(candidate) ||
    /^(?:Trabalho de Escola|Artigo 79|Trabalho Individual|Reunião|TI)$/i.test(candidate)
  )
}

function suggestedPeriods(
  startTime: string,
  endTime: string,
  defaultMinutes: number
) {
  const [startHour, startMinute] =
    startTime.split(':').map(Number)
  const [endHour, endMinute] =
    endTime.split(':').map(Number)
  const duration =
    endHour * 60 + endMinute -
    (startHour * 60 + startMinute)

  return duration > 0 && defaultMinutes > 0
    ? Math.max(
        1,
        Math.round(duration / defaultMinutes)
      )
    : 1
}

function interpretTeachingBlock(
  block: ScheduleImportBlock,
  context: GroupContext,
  legend: ScheduleLegendEntry[],
  defaultPeriodMinutes: number
): ScheduleSemanticLesson {
  const subject = resolveSubject(
    context.activityText,
    legend
  )
  const courseName = resolveCourseName(
    context.courseCode
  )
  const warnings = [...subject.warnings]

  if (context.courseCode && !courseName) {
    warnings.push(
      `O código “${context.courseCode}” foi preservado, mas não foi convertido automaticamente num nome de curso.`
    )
  }

  return {
    sourceBlockId: block.id,
    included: block.included,
    weekday: block.weekday,
    startTime: block.startTime,
    endTime: block.endTime,
    periodCount: suggestedPeriods(
      block.startTime,
      block.endTime,
      defaultPeriodMinutes
    ),
    groupName: context.groupName,
    courseCode: context.courseCode,
    courseName,
    subjectCode: subject.subjectCode,
    subjectName: subject.subjectName,
    subjectConfirmed: subject.subjectConfirmed,
    warnings
  }
}

export function interpretScheduleGridDocument(
  grid: ScheduleGridDocument,
  sourcePages: ScheduleGeometryPageInput[],
  defaultPeriodMinutes: number
): ScheduleSemanticProposal {
  const legend = extractScheduleLegend(sourcePages)
  const lessons: ScheduleSemanticLesson[] = []
  const duties: ScheduleSemanticDuty[] = []
  const unknownBlocks: ScheduleSemanticUnknown[] = []

  for (const block of grid.blocks) {
    const groupContext = parseGroupContext(
      block.rawActivityText
    )

    if (groupContext) {
      lessons.push(
        interpretTeachingBlock(
          block,
          groupContext,
          legend,
          defaultPeriodMinutes
        )
      )
      continue
    }

    if (
      looksLikeExplicitDuty(
        block.rawActivityText,
        legend
      )
    ) {
      duties.push({
        sourceBlockId: block.id,
        included: block.included,
        weekday: block.weekday,
        startTime: block.startTime,
        endTime: block.endTime,
        name: clean(block.rawActivityText),
        warnings: []
      })
      continue
    }

    unknownBlocks.push({
      sourceBlockId: block.id,
      weekday: block.weekday,
      startTime: block.startTime,
      endTime: block.endTime,
      rawActivityText: block.rawActivityText,
      rawRoomText: block.rawRoomText,
      warnings: [
        'O bloco foi capturado pela grelha, mas não há evidência suficiente para o classificar automaticamente como aula ou cargo.'
      ]
    })
  }

  return {
    lessons,
    duties,
    unknownBlocks,
    legend
  }
}

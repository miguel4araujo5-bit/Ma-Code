import type {
  ExtractedPdfCell,
  ExtractedPdfPage
} from '../../../lib/maPdf/extractPdfText'

import type {
  Weekday
} from '../types'

export type ScheduleLessonDraft = {
  id: string
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  periodCount: number
  groupName: string
  courseName: string
  subjectName: string
  subjectConfirmed: boolean
}

export type ScheduleDutyDraft = {
  id: string
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  name: string
}

export type ScheduleUnresolvedDraft = {
  id: string
  weekday: Weekday
  startTime: string
  endTime: string
  rawText: string
  requiresReview: boolean
  reason: string
}

export type ParsedScheduleProposal = {
  lessons: ScheduleLessonDraft[]
  duties: ScheduleDutyDraft[]
  unresolved: ScheduleUnresolvedDraft[]
}

type DayColumn = {
  weekday: Weekday
  centerX: number
}

type ImportedSubjectResolution = {
  subjectName: string
  subjectConfirmed: boolean
}

type ImportedLessonResolution =
  ImportedSubjectResolution & {
    courseName: string
  }

const knownSubjectAliases: Array<{
  name: string
  aliases: string[]
}> = [
  {
    name: 'Área de Expressões',
    aliases: ['AE']
  },
  {
    name: 'Animação Sociocultural',
    aliases: ['ASC']
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

const knownCourseAliases: Array<{
  name: string
  aliases: string[]
}> = [
  {
    name: 'Técnico de Apoio Psicossocial',
    aliases: ['AP', 'TAP']
  }
]

const weekdayPatterns: Array<{
  value: Weekday
  patterns: RegExp[]
}> = [
  {
    value: 1,
    patterns: [
      /\bsegunda(?:-feira)?\b/i,
      /(?:^|[^0-9a-z])2(?:a|ª)(?=$|[^0-9a-z])/i
    ]
  },
  {
    value: 2,
    patterns: [
      /\bterca(?:-feira)?\b/i,
      /(?:^|[^0-9a-z])3(?:a|ª)(?=$|[^0-9a-z])/i
    ]
  },
  {
    value: 3,
    patterns: [
      /\bquarta(?:-feira)?\b/i,
      /(?:^|[^0-9a-z])4(?:a|ª)(?=$|[^0-9a-z])/i
    ]
  },
  {
    value: 4,
    patterns: [
      /\bquinta(?:-feira)?\b/i,
      /(?:^|[^0-9a-z])5(?:a|ª)(?=$|[^0-9a-z])/i
    ]
  },
  {
    value: 5,
    patterns: [
      /\bsexta(?:-feira)?\b/i,
      /(?:^|[^0-9a-z])6(?:a|ª)(?=$|[^0-9a-z])/i
    ]
  },
  {
    value: 6,
    patterns: [
      /\bsabado\b/i
    ]
  },
  {
    value: 7,
    patterns: [
      /\bdomingo\b/i
    ]
  }
]

export function normalizeScheduleText(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanScheduleText(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function detectWeekday(
  value: string
): Weekday | null {
  const candidate =
    normalizeScheduleText(value)

  for (const weekday of weekdayPatterns) {
    if (
      weekday.patterns.some(
        pattern => pattern.test(candidate)
      )
    ) {
      return weekday.value
    }
  }

  return null
}

function extractTimeRange(
  value: string
) {
  const normalized =
    value.replace(/[hH.]/g, ':')
  const match = normalized.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|–|—|a|as|às?)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i
  )

  if (!match) {
    return null
  }

  return {
    startTime:
      `${match[1].padStart(2, '0')}:${match[2]}`,
    endTime:
      `${match[3].padStart(2, '0')}:${match[4]}`,
    matchedText:
      match[0]
  }
}

export function extractScheduleGroupName(
  value: string
) {
  const match = value.match(
    /\b(10|11|12|[1-9])\s*(?:\.?\s*[ºo°])?\s*[-–—.]?\s*([A-Za-z][A-Za-z0-9]{0,3})(?=$|[\s_.:;|/-])/i
  )

  return match
    ? `${match[1]}.º ${match[2].toLocaleUpperCase('pt-PT')}`
    : ''
}

function stripLessonNoise(
  value: string,
  groupName: string,
  preserveActivity = false
) {
  let result = value

  if (groupName) {
    const [grade, groupCode] =
      groupName
        .replace('.º', '')
        .split(/\s+/)

    result = result.replace(
      new RegExp(
        `\\b${grade}\\s*(?:\\.?\\s*[ºo°])?\\s*[-–—.]?\\s*${groupCode}(?=$|[\\s_.:;|/-])`,
        'i'
      ),
      ' '
    )
  }

  if (preserveActivity) {
    return cleanScheduleText(result)
  }

  return result
    .replace(
      /\b(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?\b/gi,
      ' '
    )
    .replace(
      /\b[2-6][ªa]\b/gi,
      ' '
    )
    .replace(
      /\b(?:sala|lab(?:orat[oó]rio)?|oficina|pavilh[aã]o)\s*[\w./-]+\b/gi,
      ' '
    )
    .replace(
      /\b(?:turno|grupo)\s*\d+\b/gi,
      ' '
    )
    .replace(/[|•·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeRoomOrMarker(
  value: string
) {
  const candidate =
    cleanScheduleText(value)
  const compact =
    candidate.replace(/\s+/g, '')

  return (
    /^(?:SP|TE|Cre|REO)$/i.test(candidate) ||
    /^(?:Sala(?:\s+n[.º°o]*)?|Sl\.?|Espaço|Local)\s*[:#-]?\s*[A-Za-z0-9][A-Za-z0-9./-]*(?:\s+[A-Za-z0-9][A-Za-z0-9./-]*)?$/i.test(candidate) ||
    /^[A-Za-z]{1,5}\d+(?:[./-]\d+)?$/i.test(compact)
  )
}

function resolveImportedSubject(
  value: string,
  legend?: Map<string, string>
): ImportedSubjectResolution {
  const subjectName =
    cleanScheduleText(value)
  const normalizedSubject =
    normalizeScheduleText(subjectName)
  const legendName =
    legend?.get(normalizedSubject)

  if (legend?.has(normalizedSubject)) {
    return {
      subjectName:
        legendName || subjectName,
      subjectConfirmed:
        Boolean(legendName)
    }
  }

  for (const knownSubject of knownSubjectAliases) {
    if (
      normalizeScheduleText(knownSubject.name) ===
        normalizedSubject ||
      knownSubject.aliases.some(
        alias =>
          normalizeScheduleText(alias) ===
            normalizedSubject
      )
    ) {
      return {
        subjectName:
          knownSubject.name,
        subjectConfirmed:
          true
      }
    }
  }

  const compact =
    subjectName.replace(/[\s._/-]/g, '')

  const ambiguousShortLabel =
    compact.length > 0 &&
    /^[A-Z0-9]+$/.test(compact)

  return {
    subjectName,
    subjectConfirmed:
      Boolean(subjectName) &&
      !ambiguousShortLabel
  }
}

function resolveImportedLessonContext(
  value: string,
  legend?: Map<string, string>
): ImportedLessonResolution {
  const explicitCourse =
    cleanScheduleText(value).match(
      /^[_-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_-]*)(?:\s*[.·|:;]\s*|\s+|$)(.*)$/u
    )

  if (explicitCourse) {
    const code =
      explicitCourse[1]
    const course =
      knownCourseAliases.find(
        candidate =>
          candidate.aliases.some(
            alias =>
              normalizeScheduleText(alias) ===
                normalizeScheduleText(code)
          )
      )

    return {
      ...resolveImportedSubject(
        explicitCourse[2],
        legend
      ),
      courseName:
        course?.name ?? code
    }
  }

  const subjectTokens: string[] = []
  let courseName = ''

  for (
    const token of cleanScheduleText(value).split(/\s+/)
  ) {
    const compactToken =
      token.replace(/[._/-]/g, '')

    const course =
      knownCourseAliases.find(
        candidate =>
          candidate.aliases.some(
            alias =>
              normalizeScheduleText(alias) ===
                normalizeScheduleText(compactToken)
          )
      )

    if (course) {
      courseName =
        courseName || course.name
      continue
    }

    subjectTokens.push(token)
  }

  return {
    ...resolveImportedSubject(
      subjectTokens.join(' '),
      legend
    ),
    courseName
  }
}

function extractDutyName(
  value: string,
  legend: Map<string, string>
) {
  const rawCandidate =
    cleanScheduleText(value)
  const hasDutyMarker =
    /\s+(?:SP|TE|Cre)$/i.test(rawCandidate)

  const candidate = rawCandidate
    .replace(/\s+(?:SP|TE|Cre)$/i, '')
    .trim()

  if (
    !candidate ||
    extractScheduleGroupName(candidate) ||
    detectWeekday(candidate) ||
    extractTimeRange(candidate) ||
    looksLikeRoomOrMarker(candidate)
  ) {
    return ''
  }

  const legendName =
    legend.get(
      normalizeScheduleText(candidate)
    )

  if (legendName) {
    return legendName
  }

  if (hasDutyMarker) {
    return candidate
  }

  if (
    /^(?:Eq(?:uipa)?\s+|Clube\s+)/i.test(candidate) ||
    /^(?:Trabalho de Escola|Artigo 79|Trabalho Individual|Reunião)$/i.test(candidate)
  ) {
    return candidate
  }

  return ''
}

function suggestedPeriods(
  startTime: string,
  endTime: string,
  defaultMinutes: number
) {
  const [sh, sm] =
    startTime
      .split(':')
      .map(Number)
  const [eh, em] =
    endTime
      .split(':')
      .map(Number)

  const duration =
    eh * 60 +
    em -
    (sh * 60 + sm)

  return duration > 0 &&
    defaultMinutes > 0
    ? Math.max(
        1,
        Math.round(
          duration /
          defaultMinutes
        )
      )
    : 1
}

function getCellCenter(
  cell: ExtractedPdfCell
) {
  return (
    cell.x +
    cell.width / 2
  )
}

function detectDayColumns(
  cells: ExtractedPdfCell[]
) {
  const detected =
    new Map<Weekday, DayColumn>()

  for (const cell of cells) {
    const weekday =
      detectWeekday(cell.text)

    if (
      !weekday ||
      detected.has(weekday)
    ) {
      continue
    }

    detected.set(
      weekday,
      {
        weekday,
        centerX:
          getCellCenter(cell)
      }
    )
  }

  return Array.from(
    detected.values()
  ).sort(
    (left, right) =>
      left.centerX -
      right.centerX
  )
}

function resolveColumnWeekday(
  cell: ExtractedPdfCell,
  columns: DayColumn[]
): Weekday | null {
  if (columns.length < 2) {
    return null
  }

  const centerX =
    getCellCenter(cell)

  for (
    let index = 0;
    index < columns.length;
    index += 1
  ) {
    const current =
      columns[index]
    const previous =
      columns[index - 1]
    const next =
      columns[index + 1]

    const lowerBound =
      previous
        ? (
            previous.centerX +
            current.centerX
          ) / 2
        : current.centerX -
          (
            next.centerX -
            current.centerX
          ) / 2

    const upperBound =
      next
        ? (
            current.centerX +
            next.centerX
          ) / 2
        : current.centerX +
          (
            current.centerX -
            previous.centerX
          ) / 2

    if (
      centerX >= lowerBound &&
      centerX < upperBound
    ) {
      return current.weekday
    }
  }

  return null
}

export function parseSchedulePdfPages(
  pages: ExtractedPdfPage[],
  defaultMinutes: number
): ParsedScheduleProposal {
  const legend =
    new Map<string, string>()
  const conflictingCodes =
    new Set<string>()

  for (const page of pages) {
    let inLegend = false

    for (const line of page.lines) {
      if (
        normalizeScheduleText(line.text)
          .includes('atividades do professor')
      ) {
        inLegend = true
        continue
      }

      if (
        /^(?:o diretor|a diretora)\b/.test(
          normalizeScheduleText(line.text)
        )
      ) {
        inLegend = false
      }

      if (!inLegend) {
        continue
      }

      const entry =
        cleanScheduleText(line.text).match(
          /^(.{1,48}?)\s*[-–—]\s*(.{2,})$/u
        )

      if (!entry) {
        continue
      }

      const code =
        normalizeScheduleText(entry[1])
      const label =
        cleanScheduleText(entry[2])

      if (
        legend.has(code) &&
        normalizeScheduleText(
          legend.get(code)!
        ) !==
          normalizeScheduleText(label)
      ) {
        conflictingCodes.add(code)
      }

      legend.set(code, label)
    }
  }

  for (const code of conflictingCodes) {
    legend.set(code, '')
  }

  const lessons: ScheduleLessonDraft[] = []
  const duties: ScheduleDutyDraft[] = []
  const unresolved: ScheduleUnresolvedDraft[] = []

  const seenLessons = new Set<string>()
  const seenDuties = new Set<string>()
  const seenUnresolved = new Set<string>()

  let lessonSequence = 0
  let dutySequence = 0
  let unresolvedSequence = 0

  function addLesson(
    weekday: Weekday,
    startTime: string,
    endTime: string,
    raw: string,
    requiresReview = false,
    preserveActivity = false
  ) {
    const cleanedRaw =
      cleanScheduleText(raw)

    if (
      !cleanedRaw ||
      looksLikeRoomOrMarker(cleanedRaw)
    ) {
      return false
    }

    const groupName =
      extractScheduleGroupName(cleanedRaw)

    if (!groupName) {
      return false
    }

    const extractedSubjectName =
      stripLessonNoise(
        cleanedRaw,
        groupName,
        preserveActivity
      )

    if (
      !extractedSubjectName ||
      looksLikeRoomOrMarker(extractedSubjectName)
    ) {
      return false
    }

    const lesson =
      resolveImportedLessonContext(
        extractedSubjectName,
        legend
      )

    if (
      !lesson.subjectName &&
      !lesson.courseName
    ) {
      return false
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalizeScheduleText(groupName),
      normalizeScheduleText(lesson.courseName),
      normalizeScheduleText(lesson.subjectName)
    ].join('|')

    if (seenLessons.has(key)) {
      return true
    }

    seenLessons.add(key)

    lessons.push({
      id:
        `pdf-slot-${lessonSequence += 1}`,
      included:
        true,
      weekday,
      startTime,
      endTime,
      periodCount:
        suggestedPeriods(
          startTime,
          endTime,
          defaultMinutes
        ),
      groupName,
      courseName:
        lesson.courseName,
      subjectName:
        lesson.subjectName,
      subjectConfirmed:
        lesson.subjectConfirmed &&
        !requiresReview
    })

    return true
  }

  function addDuty(
    weekday: Weekday,
    startTime: string,
    endTime: string,
    raw: string
  ) {
    const name =
      extractDutyName(
        raw,
        legend
      )

    if (!name) {
      return false
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalizeScheduleText(name)
    ].join('|')

    if (seenDuties.has(key)) {
      return true
    }

    seenDuties.add(key)

    duties.push({
      id:
        `pdf-duty-${dutySequence += 1}`,
      included:
        true,
      weekday,
      startTime,
      endTime,
      name
    })

    return true
  }

  function addUnresolved(
    weekday: Weekday,
    startTime: string,
    endTime: string,
    raw: string,
    requiresReview = false
  ) {
    const rawText =
      cleanScheduleText(raw)

    if (
      !rawText ||
      detectWeekday(rawText) ||
      extractTimeRange(rawText) ||
      looksLikeRoomOrMarker(rawText)
    ) {
      return false
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalizeScheduleText(rawText)
    ].join('|')

    if (seenUnresolved.has(key)) {
      return true
    }

    seenUnresolved.add(key)

    unresolved.push({
      id:
        `pdf-unresolved-${unresolvedSequence += 1}`,
      weekday,
      startTime,
      endTime,
      rawText,
      requiresReview,
      reason:
        'O MA-Professor não conseguiu confirmar se este bloco é uma aula ou um cargo.'
    })

    return true
  }

  function classifyCandidate(
    weekday: Weekday,
    startTime: string,
    endTime: string,
    raw: string,
    requiresReview = false,
    preserveActivity = false
  ) {
    const content =
      cleanScheduleText(raw)

    if (
      !content ||
      detectWeekday(content) ||
      looksLikeRoomOrMarker(content)
    ) {
      return false
    }

    // Aulas são tentadas primeiro. Um bloco com turma nunca deve ser
    // transformado em cargo apenas por ter várias palavras.
    if (
      addLesson(
        weekday,
        startTime,
        endTime,
        content,
        requiresReview,
        preserveActivity
      )
    ) {
      return true
    }

    // Cargo automático exige evidência positiva: marcador, legenda ou
    // padrão conhecido. Não existe fallback de «duas palavras = cargo».
    if (
      addDuty(
        weekday,
        startTime,
        endTime,
        content
      )
    ) {
      return true
    }

    return addUnresolved(
      weekday,
      startTime,
      endTime,
      content,
      requiresReview
    )
  }

  for (const page of pages) {
    let dayColumns: DayColumn[] = []

    for (const line of page.lines) {
      const positionedCells =
        line.positionedCells ?? []

      const detectedColumns =
        detectDayColumns(positionedCells)

      if (detectedColumns.length >= 2) {
        dayColumns = detectedColumns
        continue
      }

      const time =
        extractTimeRange(line.text)

      if (!time) {
        continue
      }

      const usesColumnLayout =
        dayColumns.length >= 2 &&
        positionedCells.length > 0

      if (usesColumnLayout) {
        for (const cell of positionedCells) {
          if (
            extractTimeRange(cell.text)
          ) {
            continue
          }

          const weekday =
            resolveColumnWeekday(
              cell,
              dayColumns
            )

          if (!weekday) {
            continue
          }

          const content =
            cleanScheduleText(
              cell.text.replace(
                time.matchedText,
                ' '
              )
            )

          classifyCandidate(
            weekday,
            time.startTime,
            time.endTime,
            content,
            cell.requiresReview === true,
            true
          )
        }

        // Quando a grelha geométrica existe, cada célula foi tratada
        // individualmente. Não voltar a interpretar a linha inteira, pois isso
        // voltaria a misturar disciplinas, salas e outros dias.
        continue
      }

      const explicitDay =
        detectWeekday(line.text)

      if (!explicitDay) {
        continue
      }

      classifyCandidate(
        explicitDay,
        time.startTime,
        time.endTime,
        line.text.replace(
          time.matchedText,
          ' '
        )
      )
    }
  }

  return {
    lessons,
    duties,
    unresolved
  }
}

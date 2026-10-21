import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { readMAProfessorStoredAccess } from '../access/accessStorage'
import { readOtherSchoolScheduleDraft, saveOtherSchoolScheduleDraft, deleteOtherSchoolScheduleDraft } from './otherSchoolScheduleDraftStorage'

import {
  extractTextFromPdf,
  type ExtractedPdfCell,
  type ExtractedPdfPage
} from '../../../lib/maPdf/extractPdfText'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import type {
  Weekday
} from '../types'
import {
  commitScheduleImportAtomically,
  readScheduleImportFingerprint
} from './scheduleImportAtomicRepository'
import ScheduleImportVisualGrid, {
  type ScheduleImportTimeRow,
  type ScheduleImportUnresolvedDraft
} from './OtherSchoolScheduleImportVisualGrid'

type Props = {
  snapshot: SetupSnapshot
  onImported: (snapshot: SetupSnapshot) => void | Promise<void>
  onContinueWithoutPdf: () => void
}

type Draft = {
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
  dutyNameBackup?: string
}

type DutyDraft = {
  id: string
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  name: string
  lessonBackup?: {
    periodCount: number
    groupName: string
    courseName: string
    subjectName: string
    subjectConfirmed: boolean
  }
}

type UnresolvedDraft =
  ScheduleImportUnresolvedDraft

type ReviewDraftState = {
  fileName: string; drafts: Draft[]; duties: DutyDraft[]; unresolved: UnresolvedDraft[]
  sourceTimeRows: ScheduleImportTimeRow[]; defaultPeriodMinutes: number
  expectedFingerprint: string; reviewView: 'grid' | 'pdf'
}

type DayColumn = {
  weekday: Weekday
  centerX: number
}

type ParsedProposal = {
  lessons: Draft[]
  duties: DutyDraft[]
  unresolved: UnresolvedDraft[]
  timeRows: ScheduleImportTimeRow[]
}

type ImportedSubjectResolution = {
  subjectName: string
  subjectConfirmed: boolean
}

type ImportedLessonResolution =
  ImportedSubjectResolution & {
    courseName: string
  }

const weekdays: Array<{
  value: Weekday
  label: string
}> = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' }
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

const UNSAVED_SCHEDULE_IMPORT_MESSAGE =
  'Existe uma proposta de horário importada por confirmar. Se continuar, essa proposta e as correções feitas serão perdidas. Pretende continuar?'

const MAX_SCHEDULE_PDF_BYTES =
  20 * 1024 * 1024

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

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function clean(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function resolveImportedSubject(
  value: string,
  legend?: Map<string, string>
): ImportedSubjectResolution {
  const subjectName = clean(value)
  const normalizedSubject = normalize(subjectName)
  const legendName = legend?.get(normalizedSubject)

  if (legend?.has(normalizedSubject)) {
    return {
      subjectName: legendName || subjectName,
      subjectConfirmed: Boolean(legendName)
    }
  }

  for (const knownSubject of knownSubjectAliases) {
    if (
      normalize(knownSubject.name) === normalizedSubject ||
      knownSubject.aliases.some(
        alias => normalize(alias) === normalizedSubject
      )
    ) {
      return {
        subjectName: knownSubject.name,
        subjectConfirmed: true
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
  // No horário, «12.ºD_AP . AEXP» identifica o curso depois de «_»
  // e a disciplina depois do separador. Preservar também cursos desconhecidos.
  const explicitCourse = clean(value).match(
    /^[_-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_-]*)(?:\s*[.·|:;]\s*|\s+|$)(.*)$/u
  )

  if (explicitCourse) {
    const code = explicitCourse[1]
    const course = knownCourseAliases.find(candidate =>
      candidate.aliases.some(alias => normalize(alias) === normalize(code))
    )

    return {
      ...resolveImportedSubject(explicitCourse[2], legend),
      courseName: course?.name ?? code
    }
  }

  const subjectTokens: string[] = []
  let courseName = ''

  for (const token of clean(value).split(/\s+/)) {
    const compactToken =
      token.replace(/[._/-]/g, '')

    const course =
      knownCourseAliases.find(
        candidate =>
          candidate.aliases.some(
            alias =>
              normalize(alias) ===
              normalize(compactToken)
          )
      )

    if (course) {
      courseName = courseName || course.name
      continue
    }

    subjectTokens.push(token)
  }

  const subject =
    resolveImportedSubject(
      subjectTokens.join(' '),
      legend
    )

  return {
    ...subject,
    courseName
  }
}

function detectWeekday(
  value: string
): Weekday | null {
  const candidate = normalize(value)

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

function extractTimeRange(value: string) {
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

function extractGroupName(value: string) {
  const match = value.match(
    /^\s*(?:(?:(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?|[2-6][ªa])\s+)?(10|11|12|[1-9])\s*(?:\.?\s*[ºo°])?\s*[-–—.]?\s*([A-Za-z][A-Za-z0-9]{0,2})(?=$|[\s_.:;|/-])/i
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
    const [grade, letter] =
      groupName
        .replace('.º', '')
        .split(/\s+/)

    result = result.replace(
      new RegExp(
        `\\b${grade}\\s*(?:\\.?\\s*[ºo°])?\\s*[-–—.]?\\s*${letter}(?=$|[\\s_.:;|/-])`,
        'i'
      ),
      ' '
    )
  }

  if (preserveActivity) return clean(result)

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
  const compact =
    value.replace(/\s+/g, '')

  return (
    /^(?:SP|TE|Cre|REO)$/i.test(value) ||
    /^[A-Za-z]{1,5}\d+(?:[./-]\d+)?$/i.test(compact)
  )
}

function extractDutyName(value: string) {
  const rawCandidate = clean(value)
  const hasDutyMarker =
    /\s+(?:SP|TE|Cre)$/i.test(rawCandidate)

  const candidate = rawCandidate
    .replace(/\s+(?:SP|TE|Cre)$/i, '')
    .trim()

  if (
    !candidate ||
    extractGroupName(candidate) ||
    detectWeekday(candidate) ||
    extractTimeRange(candidate) ||
    looksLikeRoomOrMarker(candidate)
  ) {
    return ''
  }

  if (hasDutyMarker) {
    return candidate
  }

  if (
    /^(?:Eq(?:uipa)?\s+|Clube\s+)/i.test(candidate) ||
    /^(?:Co\s+PCE|Trabalho de Escola|Artigo 79|Trabalho Individual|Reunião)$/i.test(candidate)
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
    (
      sh * 60 +
      sm
    )

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

function parsePages(
  pages: ExtractedPdfPage[],
  defaultMinutes: number
): ParsedProposal {
  const legend = new Map<string, string>()
  const conflictingCodes = new Set<string>()

  for (const page of pages) {
    let inLegend = false
    for (const line of page.lines) {
      if (normalize(line.text).includes('atividades do professor')) {
        inLegend = true
        continue
      }
      if (/^(?:o diretor|a diretora)\b/.test(normalize(line.text))) {
        inLegend = false
      }
      if (!inLegend) continue
      const entry = clean(line.text).match(/^(.{1,48}?)\s*[-–—]\s*(.{2,})$/u)
      if (!entry) continue
      const code = normalize(entry[1])
      const label = clean(entry[2])
      if (legend.has(code) && normalize(legend.get(code)!) !== normalize(label)) {
        conflictingCodes.add(code)
      }
      legend.set(code, label)
    }
  }
  for (const code of conflictingCodes) legend.set(code, '')

  const lessons: Draft[] = []
  const duties: DutyDraft[] = []
  const unresolved: UnresolvedDraft[] = []
  const sourceTimeRows =
    new Map<string, ScheduleImportTimeRow>()
  const seenLessons = new Set<string>()
  const seenDuties = new Set<string>()
  const seenUnresolved = new Set<string>()

  for (const page of pages) {
    for (const line of page.lines) {
      const time = extractTimeRange(line.text)
      if (!time) continue

      const key = `${time.startTime}|${time.endTime}`
      sourceTimeRows.set(key, {
        startTime: time.startTime,
        endTime: time.endTime
      })
    }
  }

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
      clean(raw)

    const groupName =
      extractGroupName(cleanedRaw)

    if (!groupName) {
      return false
    }

    const extractedSubjectName =
      stripLessonNoise(
        cleanedRaw,
        groupName,
        preserveActivity
      )

    if (!extractedSubjectName) {
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
      normalize(groupName),
      normalize(lesson.courseName),
      normalize(lesson.subjectName)
    ].join('|')

    if (seenLessons.has(key)) {
      return false
    }

    seenLessons.add(key)

    lessons.push({
      id:
        `pdf-slot-${lessonSequence += 1}`,
      included: true,
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
        lesson.subjectConfirmed && !requiresReview
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
      extractDutyName(raw)

    if (!name) {
      return false
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalize(name)
    ].join('|')

    if (seenDuties.has(key)) {
      return false
    }

    seenDuties.add(key)

    duties.push({
      id:
        `pdf-duty-${dutySequence += 1}`,
      included: true,
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
    raw: string
  ) {
    const rawText = clean(raw)

    if (!rawText) {
      return false
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalize(rawText)
    ].join('|')

    if (seenUnresolved.has(key)) {
      return false
    }

    seenUnresolved.add(key)
    unresolved.push({
      id:
        `pdf-unresolved-${unresolvedSequence += 1}`,
      weekday,
      startTime,
      endTime,
      periodCount:
        suggestedPeriods(
          startTime,
          endTime,
          defaultMinutes
        ),
      rawText,
      reason:
        'A célula estava ocupada no PDF, mas não existem dados suficientes para a classificar automaticamente como componente letiva ou cargo.'
    })

    return true
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

      let addedFromColumns = false

      if (
        dayColumns.length >= 2 &&
        positionedCells.length > 0
      ) {
        for (
          let index = 0;
          index < positionedCells.length;
          index += 1
        ) {
          const cell =
            positionedCells[index]

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

          // Só a célula já separada da sala pode definir a atividade.
          // Os índices de line.cells pertencem à extração bruta original.
          if (
            addDuty(
              weekday,
              time.startTime,
              time.endTime,
              cell.text
            )
          ) {
            addedFromColumns = true
            continue
          }

          const content =
            clean(
              cell.text.replace(
                time.matchedText,
                ' '
              )
            )

          if (
            !content ||
            detectWeekday(content)
          ) {
            continue
          }

          if (
            addLesson(
              weekday,
              time.startTime,
              time.endTime,
              content,
              cell.requiresReview,
              true
            )
          ) {
            addedFromColumns = true
            continue
          }

          if (
            addUnresolved(
              weekday,
              time.startTime,
              time.endTime,
              content
            )
          ) {
            addedFromColumns = true
          }
        }
      }

      if (!addedFromColumns) {
        const explicitDay =
          detectWeekday(line.text)

        if (!explicitDay) {
          continue
        }

        const raw =
          clean(
            line.text.replace(
              time.matchedText,
              ' '
            )
          )

        if (
          !addDuty(
            explicitDay,
            time.startTime,
            time.endTime,
            raw
          ) &&
          !addLesson(
            explicitDay,
            time.startTime,
            time.endTime,
            raw
          )
        ) {
          addUnresolved(
            explicitDay,
            time.startTime,
            time.endTime,
            stripLessonNoise(
              raw,
              ''
            )
          )
        }
      }
    }
  }

  return {
    lessons,
    duties,
    unresolved,
    timeRows: [...sourceTimeRows.values()].sort(
      (left, right) =>
        left.startTime.localeCompare(right.startTime) ||
        left.endTime.localeCompare(right.endTime)
    )
  }
}

function shortName(name: string) {
  const words =
    clean(name)
      .split(/\s+/)

  if (words.length <= 2) {
    return name.slice(0, 24)
  }

  const initials =
    words
      .filter(
        word => word.length > 2
      )
      .map(
        word =>
          word[0]?.toLocaleUpperCase(
            'pt-PT'
          ) ?? ''
      )
      .join('')

  return (initials || name).slice(0, 24)
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function manualId(prefix: string) {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
}

export default function OtherSchoolSchedulePdfImportStep({
  snapshot,
  onImported,
  onContinueWithoutPdf
}: Props) {
  const [fileName, setFileName] = useState('')
  const [originalPdf, setOriginalPdf] = useState<File | null>(null)
  const [originalPdfUrl, setOriginalPdfUrl] = useState('')
  const [reviewView, setReviewView] = useState<'grid' | 'pdf'>('grid')

  useEffect(() => {
    if (!originalPdf) { setOriginalPdfUrl(''); return }
    const url = URL.createObjectURL(originalPdf)
    setOriginalPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [originalPdf])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [duties, setDuties] = useState<DutyDraft[]>([])
  const [unresolved, setUnresolved] = useState<UnresolvedDraft[]>([])
  const [sourceTimeRows, setSourceTimeRows] =
    useState<ScheduleImportTimeRow[]>([])
  const [defaultPeriodMinutes, setDefaultPeriodMinutes] =
    useState(50)
  const [expectedFingerprint, setExpectedFingerprint] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [subjectCorrection, setSubjectCorrection] = useState<{ id: string; previous: string; next: string } | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  const saveGeneration = useRef(0)
  const [replacementPdf, setReplacementPdf] = useState<File | null>(null)
  const accountEmail = useMemo(() => readMAProfessorStoredAccess()?.email.trim().toLowerCase() ?? '', [])
  const draftRevision = useRef(0)
  const savedPdf = useRef<File | null>(null)
  const draftQueue = useRef<Promise<unknown>>(Promise.resolve())
  const clearingDraft = useRef(false)
  const mounted = useRef(true)
  const accountIsCurrent = () => Boolean(accountEmail) &&
    readMAProfessorStoredAccess()?.email.trim().toLowerCase() === accountEmail

  useEffect(() => {
    mounted.current = true
    let disposed = false
    if (!accountEmail) { setDraftLoaded(true); setDraftStatus('O rascunho automático requer uma conta identificada.'); return }
    void readOtherSchoolScheduleDraft<ReviewDraftState>({ accountEmail, academicYearId: snapshot.academicYear.id }).then(saved => {
      if (disposed || !accountIsCurrent()) return
      if (saved) {
        draftRevision.current = saved.revision
        savedPdf.current = saved.originalPdf
        const state = saved.state
        if (!state || !Array.isArray(state.drafts) || !Array.isArray(state.duties) || !Array.isArray(state.unresolved) || !Array.isArray(state.sourceTimeRows) || typeof state.expectedFingerprint !== 'string' || !(saved.originalPdf instanceof Blob)) throw new Error('O rascunho guardado não pode ser aberto. O horário definitivo foi mantido.')
        setFileName(state.fileName); setDrafts(state.drafts); setDuties(state.duties)
        setUnresolved(state.unresolved); setSourceTimeRows(state.sourceTimeRows)
        setDefaultPeriodMinutes(state.defaultPeriodMinutes); setExpectedFingerprint(state.expectedFingerprint)
        setReviewView(state.reviewView === 'pdf' ? 'pdf' : 'grid'); setOriginalPdf(saved.originalPdf)
        setDraftStatus('Revisão retomada neste dispositivo.')
      }
      setDraftLoaded(true)
    }).catch(reason => {
      if (!disposed) { setDraftStatus(errorMessage(reason)); setDraftLoaded(true) }
    })
    return () => { disposed = true; mounted.current = false }
  }, [accountEmail, snapshot.academicYear.id])

  useEffect(() => {
    if (!draftLoaded || busy || !originalPdf || clearingDraft.current || !accountIsCurrent()) return
    const state: ReviewDraftState = { fileName, drafts, duties, unresolved, sourceTimeRows, defaultPeriodMinutes, expectedFingerprint, reviewView }
    const generation = ++saveGeneration.current
    setDraftStatus('A guardar rascunho…')
    draftQueue.current = draftQueue.current.then(async () => {
      if (clearingDraft.current || !accountIsCurrent()) return
      draftRevision.current = await saveOtherSchoolScheduleDraft({ accountEmail, academicYearId: snapshot.academicYear.id }, state, savedPdf.current === originalPdf ? null : originalPdf, draftRevision.current)
      savedPdf.current = originalPdf
      if (mounted.current && generation === saveGeneration.current) setDraftStatus('Rascunho guardado neste dispositivo.')
    }).catch(reason => { if (mounted.current && generation === saveGeneration.current) setDraftStatus(`Não foi possível guardar o rascunho: ${errorMessage(reason)}`) })
  }, [draftLoaded, busy, originalPdf, fileName, drafts, duties, unresolved, sourceTimeRows, defaultPeriodMinutes, expectedFingerprint, reviewView])

  async function discardSavedDraft() {
    clearingDraft.current = true
    await draftQueue.current
    if (accountIsCurrent()) {
      await deleteOtherSchoolScheduleDraft({ accountEmail, academicYearId: snapshot.academicYear.id }, draftRevision.current)
      draftRevision.current = 0
    }
  }

  const rootRef =
    useRef<HTMLDivElement>(null)

  const canUseSavedSchedule =
    snapshot.weeklyScheduleSlots.some(
      slot => slot.active
    )

  const included = useMemo(
    () => drafts.filter(
      draft => draft.included
    ),
    [drafts]
  )

  const includedDuties = useMemo(
    () => duties.filter(
      duty => duty.included
    ),
    [duties]
  )

  const unconfirmedSubjects = useMemo(
    () => included.filter(
      draft => !draft.subjectConfirmed
    ),
    [included]
  )

  const hasProposal =
    drafts.length > 0 ||
    duties.length > 0 ||
    unresolved.length > 0 ||
    originalPdf !== null

  const includedCount =
    included.length +
    includedDuties.length

  useMAProfessorUnsavedWorkspaceProtection(
    hasProposal && draftStatus !== 'Rascunho guardado neste dispositivo.',
    rootRef,
    UNSAVED_SCHEDULE_IMPORT_MESSAGE
  )

  function clearProposal() {
    setDrafts([])
    setDuties([])
    setUnresolved([])
    setSourceTimeRows([])
    setExpectedFingerprint('')
    setFileName('')
    setOriginalPdf(null)
    setReviewView('grid')
    setProgress('')
    setError('')
  }

  async function useSavedSchedule() {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const current =
        await maProfessorRepository
          .getSetupSnapshot(
            snapshot.academicYear.id
          )

      if (
        !current
          .weeklyScheduleSlots
          .some(
            slot => slot.active
          )
      ) {
        throw new Error(
          'O horário guardado já não está disponível. Pode ignorar a proposta e continuar com a configuração manual.'
        )
      }

      await discardSavedDraft()
      await onImported(current)
      clearProposal()
    } catch (readError) {
      clearingDraft.current = false
      setError(
        errorMessage(readError)
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    event.target.value = ''

    if (!file || !draftLoaded) {
      return
    }

    if (
      file.type !== 'application/pdf' &&
      !file.name
        .toLocaleLowerCase('pt-PT')
        .endsWith('.pdf')
    ) {
      setError(
        'Selecione um ficheiro PDF.'
      )
      return
    }

    if (
      file.size >
        MAX_SCHEDULE_PDF_BYTES
    ) {
      setError(
        'O PDF do horário ultrapassa o limite de 20 MB. Reduza o ficheiro antes de voltar a importar.'
      )
      return
    }

    if (hasProposal) { setReplacementPdf(file); return }
    await readFile(file)
  }

  async function readFile(file: File) {
    clearingDraft.current = false
    setBusy(true)
    setError('')

    try {
      let pages: ExtractedPdfPage[]
      try {
        const extracted = await extractTextFromPdf({
          id: `ma-professor-schedule-${Date.now()}`, file
        }, setProgress)
        pages = extracted.pages
      } catch (reason) {
        // A scanned document still has an original to compare with and a grid
        // to complete. Keep genuine file/password/storage failures visible.
        if (!(reason instanceof Error) || !reason.message.startsWith('Este PDF não contém texto selecionável.')) throw reason
        pages = []
      }

      const settings =
        await maProfessorRepository
          .getSettings()

      setDefaultPeriodMinutes(
        settings.defaultPeriodMinutes
      )

      const proposal =
        parsePages(
          pages,
          settings.defaultPeriodMinutes
        )

      const fingerprint =
        await readScheduleImportFingerprint(
          snapshot.academicYear.id
        )

      setOriginalPdf(file)
      setReviewView('grid')
      setFileName(file.name)
      setDrafts(proposal.lessons)
      setDuties(proposal.duties)
      setUnresolved(proposal.unresolved)
      setSourceTimeRows(proposal.timeRows)
      setExpectedFingerprint(
        fingerprint
      )

      const unresolvedCount =
        proposal.unresolved.length

      setProgress(
        proposal.lessons.length + proposal.duties.length + unresolvedCount === 0
          ? 'Verifique o horário no PDF e acrescente os blocos à grelha para continuar.'
          : `${proposal.lessons.length} componentes letivas, ${proposal.duties.length} cargos e ${unresolvedCount} blocos por classificar. Verifique se o horário corresponde ao documento que enviou e complete o que faltar.`
      )
    } catch (readError) {
      clearingDraft.current = false
      setError(
        errorMessage(readError)
      )
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  function updateDraft(
    id: string,
    changes: Partial<Draft>
  ) {
    setDrafts(
      current => current.map(
        draft =>
          draft.id === id
            ? {
                ...draft,
                ...changes
              }
            : draft
      )
    )

    setError('')
  }

  function updateDuty(
    id: string,
    changes: Partial<DutyDraft>
  ) {
    setDuties(
      current => current.map(
        duty =>
          duty.id === id
            ? {
                ...duty,
                ...changes
              }
            : duty
      )
    )

    setError('')
  }

  function lessonAsDuty(id: string) {
    if (busy) return

    const lesson =
      drafts.find(
        candidate => candidate.id === id
      )

    if (!lesson) return

    setDrafts(
      current => current.filter(
        candidate => candidate.id !== id
      )
    )
    setDuties(
      current => [
        ...current.filter(
          candidate => candidate.id !== id
        ),
        {
          id: lesson.id,
          included: lesson.included,
          weekday: lesson.weekday,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          name:
            lesson.dutyNameBackup?.trim() ||
            lesson.subjectName.trim() ||
            lesson.groupName.trim() ||
            'Cargo / atividade',
          lessonBackup: {
            periodCount: lesson.periodCount,
            groupName: lesson.groupName,
            courseName: lesson.courseName,
            subjectName: lesson.subjectName,
            subjectConfirmed: lesson.subjectConfirmed
          }
        }
      ]
    )
    setError('')
  }

  function dutyAsLesson(id: string) {
    if (busy) return

    const duty =
      duties.find(
        candidate => candidate.id === id
      )

    if (!duty) return

    const backup = duty.lessonBackup

    setDuties(
      current => current.filter(
        candidate => candidate.id !== id
      )
    )
    setDrafts(
      current => [
        ...current.filter(
          candidate => candidate.id !== id
        ),
        {
          id: duty.id,
          included: duty.included,
          weekday: duty.weekday,
          startTime: duty.startTime,
          endTime: duty.endTime,
          periodCount:
            backup?.periodCount ??
            suggestedPeriods(
              duty.startTime,
              duty.endTime,
              defaultPeriodMinutes
            ),
          groupName: backup?.groupName ?? '',
          courseName: backup?.courseName ?? '',
          subjectName:
            backup?.subjectName || duty.name,
          subjectConfirmed:
            backup?.subjectConfirmed ?? false,
          dutyNameBackup: duty.name
        }
      ]
    )
    setError('')
  }

  function resolveUnresolvedAsLesson(id: string) {
    const block =
      unresolved.find(
        candidate => candidate.id === id
      )

    if (!block || busy) {
      return
    }

    const groupName =
      extractGroupName(block.rawText)
    const subjectSource =
      groupName
        ? stripLessonNoise(
            block.rawText,
            groupName,
            true
          )
        : block.rawText
    const lesson =
      resolveImportedLessonContext(
        subjectSource
      )

    setDrafts(
      current => [
        ...current,
        {
          id: block.id,
          included: true,
          weekday: block.weekday,
          startTime: block.startTime,
          endTime: block.endTime,
          periodCount: block.periodCount,
          groupName,
          courseName: lesson.courseName,
          subjectName:
            lesson.subjectName || block.rawText,
          subjectConfirmed: false
        }
      ]
    )
    setUnresolved(
      current => current.filter(
        candidate => candidate.id !== id
      )
    )
    setError('')
  }

  function resolveUnresolvedAsDuty(id: string) {
    const block =
      unresolved.find(
        candidate => candidate.id === id
      )

    if (!block || busy) {
      return
    }

    setDuties(
      current => [
        ...current,
        {
          id: block.id,
          included: true,
          weekday: block.weekday,
          startTime: block.startTime,
          endTime: block.endTime,
          name: block.rawText
        }
      ]
    )
    setUnresolved(
      current => current.filter(
        candidate => candidate.id !== id
      )
    )
    setError('')
  }

  function ignoreUnresolved(id: string) {
    if (busy) {
      return
    }

    setUnresolved(
      current => current.filter(
        candidate => candidate.id !== id
      )
    )
    setError('')
  }

  function addManualLesson() {
    if (busy) {
      return
    }

    setDrafts(
      current => [
        ...current,
        {
          id:
            manualId('manual-slot'),
          included: true,
          weekday: 1,
          startTime: '08:30',
          endTime: '09:20',
          periodCount: 1,
          groupName: '',
          courseName: '',
          subjectName: '',
          subjectConfirmed: false
        }
      ]
    )

    setError('')
  }

  function addManualDuty() {
    if (busy) {
      return
    }

    setDuties(
      current => [
        ...current,
        {
          id:
            manualId('manual-duty'),
          included: true,
          weekday: 1,
          startTime: '08:30',
          endTime: '09:20',
          name: ''
        }
      ]
    )

    setError('')
  }

  async function applyImport() {
    if (busy) {
      return
    }

    if (unresolved.length > 0) {
      setError(
        'Existem blocos ocupados do horário por classificar. Escolha Componente letiva ou Cargo em cada célula, ou ignore explicitamente um falso positivo, antes de confirmar a importação.'
      )
      return
    }

    if (
      included.length === 0 &&
      includedDuties.length === 0
    ) {
      setError(
        'Mantenha pelo menos um bloco para importar.'
      )
      return
    }

    if (
      unconfirmedSubjects.length > 0
    ) {
      setError(
        'Existem siglas ou nomes de disciplina por confirmar. Corrija a disciplina diretamente na célula assinalada ou escolha “Confirmar como disciplina”. O MA-Professor não vai criar disciplinas a partir de siglas ambíguas sem confirmação.'
      )
      return
    }

    if (!expectedFingerprint) {
      setError(
        'O estado de segurança desta proposta já não está disponível. Volte a selecionar o PDF antes de confirmar.'
      )
      return
    }

    setBusy(true)
    setError('')
    setProgress(
      'A validar e guardar a proposta numa única operação...'
    )

    try {
      const academicYearId =
        snapshot.academicYear.id

      const result =
        await commitScheduleImportAtomically({
          academicYearId,
          expectedFingerprint,
          lessons:
            included,
          duties:
            includedDuties
        })

      const courseNotice =
        result.preservedCourseConflicts > 0
          ? ` ${result.preservedCourseConflicts} turma${result.preservedCourseConflicts === 1 ? '' : 's'} manteve${result.preservedCourseConflicts === 1 ? '' : 'ram'} o curso já confirmado, em vez de aceitar automaticamente um valor diferente do PDF.`
          : ''

      setProgress(
        `${included.length} componente${included.length === 1 ? '' : 's'} letiva${included.length === 1 ? '' : 's'} preparada${included.length === 1 ? '' : 's'}; ${result.createdSlots} novo${result.createdSlots === 1 ? '' : 's'} bloco${result.createdSlots === 1 ? '' : 's'} criado${result.createdSlots === 1 ? '' : 's'} e ${result.createdDutyOccurrences} ocorrência${result.createdDutyOccurrences === 1 ? '' : 's'} de cargos programada${result.createdDutyOccurrences === 1 ? '' : 's'}.${courseNotice}`
      )

      // The definitive commit succeeded. Cleanup failure must not invite a second application.
      try { await discardSavedDraft() } catch { /* A stale draft remains protected by its original fingerprint. */ }
      await onImported(
        await maProfessorRepository
          .getSetupSnapshot(
            academicYearId
          )
      )

      setDrafts([])
      setDuties([])
      setUnresolved([])
      setSourceTimeRows([])
      setExpectedFingerprint('')
      setFileName('')
      setOriginalPdf(null)
    } catch (submitError) {
      clearingDraft.current = false
      setError(
        errorMessage(submitError)
      )
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  async function requestContinueWithoutPdf() {
    if (busy) return

    if (!hasProposal) {
      clearProposal()
      onContinueWithoutPdf()
      return
    }

    if (
      !window.confirm(
        UNSAVED_SCHEDULE_IMPORT_MESSAGE
      )
    ) {
      return
    }

    try {
      await discardSavedDraft()
      clearProposal()
      onContinueWithoutPdf()
    } catch (reason) {
      clearingDraft.current = false
      setError(errorMessage(reason))
    }
  }

  return (
    <div
      ref={rootRef}
      className="mx-auto max-w-[100rem]"
    >
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              Preparação automática
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Importe o seu horário.
            </h1>

            <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
              O MA-Professor lê o PDF no seu dispositivo e prepara a grelha semanal para rever, corrigir e completar. Envie um PDF com um único horário. As salas são ignoradas e nada é aplicado antes da sua confirmação.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">
            Leitura local · sem envio do PDF
          </div>
        </div>

        {canUseSavedSchedule ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              Já existe um horário guardado. Pode utilizá-lo para continuar a configuração.
              {hasProposal
                ? ' A proposta deste PDF será descartada e os dados guardados serão mantidos.'
                : ''}
            </p>

            {!hasProposal ? (
              <button
                type="button"
                disabled={busy || !draftLoaded}
                onClick={useSavedSchedule}
                className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2.5 text-sm font-bold text-cyan-50 disabled:opacity-50"
              >
                Usar horário guardado
              </button>
            ) : null}
          </div>
        ) : null}

        {!hasProposal ? (
          <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.035] p-6 text-center transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.06]">
              <span className="text-lg font-black text-white">
                {busy
                  ? 'A ler o horário...'
                  : 'Selecionar horário em PDF'}
              </span>

              <span className="mt-2 text-sm leading-6 text-slate-500">
                {fileName ||
                  'PDF com texto selecionável, até 20 MB. Se for uma digitalização, o fluxo manual continua disponível.'}
              </span>

              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={busy || !draftLoaded}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              disabled={busy || !draftLoaded}
              onClick={requestContinueWithoutPdf}
              className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3.5 text-sm font-bold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
            >
              Continuar sem PDF
            </button>
          </div>
        ) : (
          <>
            <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="font-black text-white">
                Reveja o horário de {fileName}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Verifique se o horário corresponde ao documento que enviou. Clique numa célula para editar os dados e altere diretamente entre Componente letiva e Cargo quando a classificação automática não estiver correta. As linhas horárias do documento são mantidas mesmo quando estão vazias.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !draftLoaded}
                  onClick={addManualLesson}
                  className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/[0.14] disabled:opacity-50"
                >
                  + Adicionar componente letiva
                </button>

                <button
                  type="button"
                  disabled={busy || !draftLoaded}
                  onClick={addManualDuty}
                  className="rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2.5 text-sm font-black text-violet-100 transition hover:bg-violet-300/[0.14] disabled:opacity-50"
                >
                  + Adicionar cargo
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setReviewView(view => view === 'grid' ? 'pdf' : 'grid')} className="rounded-xl border border-cyan-300/25 px-4 py-3 text-sm font-bold text-cyan-100 xl:hidden">
                {reviewView === 'grid' ? 'Ver PDF original' : 'Voltar à grelha'}
              </button>
              <label className="cursor-pointer rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-200">
                Escolher outro PDF
                <input type="file" accept="application/pdf,.pdf" disabled={busy || !draftLoaded} onChange={handleFileChange} className="sr-only" />
              </label>
            </div>
            <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {originalPdfUrl ? (
                <div className={`${reviewView === 'pdf' ? 'block' : 'hidden'} min-w-0 xl:block`}>
                  <p className="mb-2 text-sm font-bold text-slate-300">PDF original</p>
                  <object aria-label="PDF original do horário" data={originalPdfUrl} type="application/pdf" className="h-[65vh] min-h-[24rem] w-full rounded-2xl border border-white/10">
                    <p className="p-4 text-sm text-slate-300">O navegador não apresenta o PDF nesta vista. <a href={originalPdfUrl} target="_blank" rel="noreferrer" className="underline">Abrir PDF original</a></p>
                  </object>
                </div>
              ) : null}
              <div className={`${reviewView === 'grid' ? 'block' : 'hidden'} min-w-0 xl:block`}>
              <ScheduleImportVisualGrid
                lessons={drafts}
                duties={duties}
                unresolved={unresolved}
                sourceTimeRows={sourceTimeRows}
                disabled={busy || !draftLoaded}
                onUpdateLesson={updateDraft}
                onSubjectEdited={(id, previous, next) => {
                  if (previous.trim() && next.trim() && previous !== next && drafts.some(draft => draft.id !== id && draft.subjectName === previous)) setSubjectCorrection({ id, previous, next })
                }}
                onUpdateDuty={updateDuty}
                onLessonAsDuty={lessonAsDuty}
                onDutyAsLesson={dutyAsLesson}
                onUnresolvedAsLesson={resolveUnresolvedAsLesson}
                onUnresolvedAsDuty={resolveUnresolvedAsDuty}
                onIgnoreUnresolved={ignoreUnresolved}
              />
              </div>
            </div>

            {unconfirmedSubjects.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <p className="text-sm font-black text-amber-100">
                  Existem {unconfirmedSubjects.length} disciplina{unconfirmedSubjects.length === 1 ? '' : 's'} por confirmar.
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-100/75">
                  Abra a própria célula para corrigir o nome ou escolha “Confirmar como disciplina”. O MA-Professor não cria automaticamente uma disciplina a partir de uma sigla ambígua.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {canUseSavedSchedule ? (
                <button
                  type="button"
                  onClick={useSavedSchedule}
                  disabled={busy || !draftLoaded}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2.5 text-sm font-bold text-cyan-50 disabled:opacity-50"
                >
                  Usar horário guardado
                </button>
              ) : null}

              <button
                type="button"
                onClick={requestContinueWithoutPdf}
                disabled={busy || !draftLoaded}
                className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:text-white disabled:opacity-50"
              >
                Ignorar importação
              </button>

              <button
                type="button"
                onClick={applyImport}
                disabled={
                  busy || !draftLoaded ||
                  unresolved.length > 0 ||
                  includedCount === 0 ||
                  unconfirmedSubjects.length > 0
                }
                className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-5 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'A aplicar...'
                  : unresolved.length > 0
                    ? `Classificar ${unresolved.length} bloco${unresolved.length === 1 ? '' : 's'} primeiro`
                    : unconfirmedSubjects.length > 0
                      ? `Confirmar ${unconfirmedSubjects.length} disciplina${unconfirmedSubjects.length === 1 ? '' : 's'} primeiro`
                      : `Confirmar ${includedCount} bloco${includedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}

        {replacementPdf ? (
          <div role="dialog" aria-modal="true" aria-label="Substituir a revisão atual" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-5">
            <div className="max-w-lg rounded-3xl border border-cyan-300/25 bg-slate-900 p-6 text-white">
              <h2 className="text-xl font-black">Pretende substituir a revisão atual pelo novo PDF?</h2>
              <p className="mt-3 text-sm leading-6">Se cancelar, mantém o PDF e todas as correções atuais.</p>
              <div className="mt-5 flex gap-3">
                <button type="button" autoFocus onClick={() => setReplacementPdf(null)} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold">Cancelar</button>
                <button type="button" onClick={() => { const file = replacementPdf; setReplacementPdf(null); void readFile(file) }} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">Sim</button>
              </div>
            </div>
          </div>
        ) : null}

        {subjectCorrection ? (
          <div role="dialog" aria-modal="true" aria-label="Aplicar correção da sigla" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-5">
            <div className="max-w-lg rounded-3xl border border-cyan-300/25 bg-slate-900 p-6 text-white">
              <h2 className="text-xl font-black">Onde pretende aplicar esta correção?</h2>
              <p className="mt-3 text-sm leading-6">Alterar «{subjectCorrection.previous}» para «{subjectCorrection.next}» só nesta célula ou em todas as células com esta sigla neste horário?</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" autoFocus onClick={() => setSubjectCorrection(null)} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold">Só esta célula</button>
                <button type="button" onClick={() => {
                  setDrafts(current => current.map(draft => draft.id !== subjectCorrection.id && draft.subjectName === subjectCorrection.previous ? { ...draft, subjectName: subjectCorrection.next, subjectConfirmed: false } : draft))
                  setSubjectCorrection(null)
                }} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">Todas com esta sigla neste horário</button>
              </div>
            </div>
          </div>
        ) : null}

        {draftStatus ? <p role="status" className="mt-4 text-sm text-slate-300">{draftStatus}</p> : null}

        {progress ? (
          <p className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4 text-sm leading-6 text-cyan-100">
            {progress}
          </p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  )
}

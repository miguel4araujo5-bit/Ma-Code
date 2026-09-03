import {
  type ChangeEvent,
  useMemo,
  useState
} from 'react'

import {
  extractTextFromPdf,
  type ExtractedPdfCell,
  type ExtractedPdfLine,
  type ExtractedPdfPage
} from '../../../lib/maPdf/extractPdfText'
import {
  calendarRepository
} from '../calendar/calendarRepository'
import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import type {
  AcademicYear,
  ISODate,
  Weekday
} from '../types'

type Props = {
  snapshot: SetupSnapshot
  onImported: (snapshot: SetupSnapshot) => void
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
  subjectName: string
}

type DutyDraft = {
  id: string
  included: boolean
  weekday: Weekday
  startTime: string
  endTime: string
  name: string
}

type DayColumn = {
  weekday: Weekday
  centerX: number
}

type ParsedProposal = {
  lessons: Draft[]
  duties: DutyDraft[]
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

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50'

const S_BENTO_2026_2027_DUTY_RANGES: Array<{
  startDate: ISODate
  endDate: ISODate
}> = [
  {
    startDate: '2026-09-21',
    endDate: '2026-12-15'
  },
  {
    startDate: '2027-01-04',
    endDate: '2027-03-19'
  },
  {
    startDate: '2027-04-05',
    endDate: '2027-06-11'
  }
]

const S_BENTO_2026_2027_CLOSED_DATES =
  new Set<ISODate>([
    '2026-10-05',
    '2026-12-01',
    '2026-12-08',
    '2027-02-08',
    '2027-02-09',
    '2027-02-10',
    '2027-03-19',
    '2027-04-25',
    '2027-05-01',
    '2027-05-27',
    '2027-06-10'
  ])

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
    /\b(10|11|12)\s*(?:\.?\s*[ºo°])?\s*[-–—.]?\s*([A-Za-z])\b/i
  )

  return match
    ? `${match[1]}.º ${match[2].toLocaleUpperCase('pt-PT')}`
    : ''
}

function stripLessonNoise(
  value: string,
  groupName: string
) {
  let result = value

  if (groupName) {
    const [grade, letter] =
      groupName
        .replace('.º', '')
        .split(/\s+/)

    result = result.replace(
      new RegExp(
        `\\b${grade}\\s*(?:\\.?\\s*[ºo°])?\\s*[-–—.]?\\s*${letter}\\b`,
        'i'
      ),
      ' '
    )
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

function extractDutyName(value: string) {
  const candidate = clean(value)
    .replace(/\s+(?:SP|TE|Cre)$/i, '')
    .trim()

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

function rawCellText(
  line: ExtractedPdfLine,
  index: number,
  fallback: string
) {
  if (
    line.cells.length ===
      (line.positionedCells?.length ?? 0)
  ) {
    return line.cells[index] ?? fallback
  }

  return fallback
}

function parsePages(
  pages: ExtractedPdfPage[],
  defaultMinutes: number
): ParsedProposal {
  const lessons: Draft[] = []
  const duties: DutyDraft[] = []
  const seenLessons = new Set<string>()
  const seenDuties = new Set<string>()
  let lessonSequence = 0
  let dutySequence = 0

  function addLesson(
    weekday: Weekday,
    startTime: string,
    endTime: string,
    raw: string
  ) {
    const cleanedRaw =
      clean(raw)
    const groupName =
      extractGroupName(cleanedRaw)

    if (!groupName) {
      return false
    }

    const subjectName =
      stripLessonNoise(
        cleanedRaw,
        groupName
      )

    if (!subjectName) {
      return false
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalize(groupName),
      normalize(subjectName)
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
      subjectName
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

          const originalText =
            rawCellText(
              line,
              index,
              cell.text
            )

          if (
            addDuty(
              weekday,
              time.startTime,
              time.endTime,
              originalText
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
          line.text.replace(
            time.matchedText,
            ' '
          )

        if (
          !addDuty(
            explicitDay,
            time.startTime,
            time.endTime,
            raw
          )
        ) {
          addLesson(
            explicitDay,
            time.startTime,
            time.endTime,
            raw
          )
        }
      }
    }
  }

  return {
    lessons,
    duties
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

function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) {
  return (
    firstStart < secondEnd &&
    secondStart < firstEnd
  )
}

function weekdayLabel(weekday: Weekday) {
  return (
    weekdays.find(
      day => day.value === weekday
    )?.label ?? 'Dia'
  )
}

function draftLabel(draft: Draft) {
  return `${draft.subjectName.trim()} · ${draft.groupName.trim()}`
}

function validateDraftConflicts(
  lessons: Draft[],
  duties: DutyDraft[]
) {
  const rows = [
    ...lessons.map(
      lesson => ({
        weekday: lesson.weekday,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        label: draftLabel(lesson)
      })
    ),
    ...duties.map(
      duty => ({
        weekday: duty.weekday,
        startTime: duty.startTime,
        endTime: duty.endTime,
        label: duty.name
      })
    )
  ]

  for (
    let firstIndex = 0;
    firstIndex < rows.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < rows.length;
      secondIndex += 1
    ) {
      const first = rows[firstIndex]
      const second = rows[secondIndex]

      if (
        first.weekday === second.weekday &&
        timeRangesOverlap(
          first.startTime,
          first.endTime,
          second.startTime,
          second.endTime
        )
      ) {
        throw new Error(
          `Há dois blocos sobrepostos na proposta: ${first.label} e ${second.label}, à ${weekdayLabel(first.weekday)}, entre ${first.startTime} e ${first.endTime}. Corrija ou desmarque um deles antes de importar.`
        )
      }
    }
  }
}

function isSameExistingLesson(
  draft: Draft,
  slot: SetupSnapshot['weeklyScheduleSlots'][number],
  snapshot: SetupSnapshot
) {
  if (
    slot.weekday !== draft.weekday ||
    slot.startTime !== draft.startTime ||
    slot.endTime !== draft.endTime
  ) {
    return false
  }

  const assignment =
    snapshot.teachingAssignments.find(
      item => item.id === slot.teachingAssignmentId
    )
  const group =
    assignment
      ? snapshot.groups.find(
          item => item.id === assignment.groupId
        )
      : null
  const subject =
    assignment
      ? snapshot.subjects.find(
          item => item.id === assignment.subjectId
        )
      : null

  return Boolean(
    group &&
    subject &&
    normalize(group.name) === normalize(draft.groupName) &&
    normalize(subject.name) === normalize(draft.subjectName)
  )
}

function validateExistingScheduleConflicts(
  lessons: Draft[],
  duties: DutyDraft[],
  snapshot: SetupSnapshot
) {
  const activeSlots =
    snapshot.weeklyScheduleSlots.filter(
      slot => slot.active
    )

  for (const draft of lessons) {
    for (const slot of activeSlots) {
      if (
        slot.weekday !== draft.weekday ||
        !timeRangesOverlap(
          slot.startTime,
          slot.endTime,
          draft.startTime,
          draft.endTime
        )
      ) {
        continue
      }

      if (
        isSameExistingLesson(
          draft,
          slot,
          snapshot
        )
      ) {
        continue
      }

      const assignment =
        snapshot.teachingAssignments.find(
          item => item.id === slot.teachingAssignmentId
        )

      throw new Error(
        `O bloco ${draftLabel(draft)} sobrepõe-se a ${assignment?.displayName ?? 'uma aula já existente'}, à ${weekdayLabel(draft.weekday)}, das ${slot.startTime} às ${slot.endTime}. Corrija o horário antes de importar.`
      )
    }
  }

  for (const duty of duties) {
    const conflict =
      activeSlots.find(
        slot =>
          slot.weekday === duty.weekday &&
          timeRangesOverlap(
            slot.startTime,
            slot.endTime,
            duty.startTime,
            duty.endTime
          )
      )

    if (conflict) {
      throw new Error(
        `O cargo ${duty.name} sobrepõe-se a uma aula já existente, à ${weekdayLabel(duty.weekday)}, das ${duty.startTime} às ${duty.endTime}. Corrija o horário antes de importar.`
      )
    }
  }
}

function parseISODate(value: ISODate) {
  const [year, month, day] =
    value.split('-').map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function toISODate(value: Date): ISODate {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function getWeekday(value: Date): Weekday {
  const day = value.getUTCDay()
  return (
    day === 0
      ? 7
      : day
  ) as Weekday
}

function getDutyRanges(
  academicYear: AcademicYear
) {
  if (
    normalize(academicYear.name) ===
      '2026/2027'
  ) {
    return S_BENTO_2026_2027_DUTY_RANGES
  }

  return [
    {
      startDate: academicYear.startDate,
      endDate: academicYear.endDate
    }
  ]
}

function getDutyDates(
  academicYear: AcademicYear,
  weekday: Weekday
) {
  const result: ISODate[] = []

  for (
    const range of getDutyRanges(
      academicYear
    )
  ) {
    const current =
      parseISODate(range.startDate)
    const end =
      parseISODate(range.endDate)

    while (current <= end) {
      const isoDate =
        toISODate(current)

      if (
        getWeekday(current) === weekday &&
        !(
          normalize(academicYear.name) ===
            '2026/2027' &&
          S_BENTO_2026_2027_CLOSED_DATES.has(
            isoDate
          )
        )
      ) {
        result.push(isoDate)
      }

      current.setUTCDate(
        current.getUTCDate() + 1
      )
    }
  }

  return result
}

function dutyEventTitle(
  duty: DutyDraft
) {
  return `Cargo · ${clean(duty.name)} · ${duty.startTime}–${duty.endTime}`
}

function dutyEventKey(
  title: string,
  date: ISODate
) {
  return `${normalize(title)}|${date}`
}

async function importDutyEvents(
  academicYear: AcademicYear,
  duties: DutyDraft[]
) {
  if (duties.length === 0) {
    return 0
  }

  const existingEvents =
    await calendarRepository.listEvents({
      academicYearId: academicYear.id
    })
  const existingKeys =
    new Set(
      existingEvents
        .filter(
          event =>
            event.type === 'school_activity' &&
            event.scope === 'all'
        )
        .map(
          event =>
            dutyEventKey(
              event.title,
              event.startDate
            )
        )
    )

  let created = 0

  for (const duty of duties) {
    const title =
      dutyEventTitle(duty)

    for (
      const date of getDutyDates(
        academicYear,
        duty.weekday
      )
    ) {
      const key =
        dutyEventKey(
          title,
          date
        )

      if (existingKeys.has(key)) {
        continue
      }

      await calendarRepository.createEvent({
        academicYearId: academicYear.id,
        type: 'school_activity',
        scope: 'all',
        title,
        description: '',
        startDate: date,
        endDate: date,
        blocksLessons: false
      })

      existingKeys.add(key)
      created += 1
    }
  }

  return created
}

export default function SchedulePdfImportStep({
  snapshot,
  onImported,
  onContinueWithoutPdf
}: Props) {
  const [fileName, setFileName] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [duties, setDuties] = useState<DutyDraft[]>([])
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLocaleLowerCase('pt-PT').endsWith('.pdf')
    ) {
      setError('Selecione um ficheiro PDF.')
      return
    }

    setBusy(true)
    setError('')
    setDrafts([])
    setDuties([])
    setFileName(file.name)

    try {
      const extracted =
        await extractTextFromPdf(
          {
            id: `ma-professor-schedule-${Date.now()}`,
            file
          },
          setProgress
        )
      const settings =
        await maProfessorRepository.getSettings()
      const proposal =
        parsePages(
          extracted.pages,
          settings.defaultPeriodMinutes
        )

      if (
        proposal.lessons.length === 0 &&
        proposal.duties.length === 0
      ) {
        throw new Error(
          'Foi possível ler o PDF, mas não reconhecer automaticamente blocos do horário com segurança. Pode continuar com a configuração manual sem perder nada.'
        )
      }

      setDrafts(proposal.lessons)
      setDuties(proposal.duties)
      setProgress(
        `${proposal.lessons.length} aula${proposal.lessons.length === 1 ? '' : 's'} e ${proposal.duties.length} cargo${proposal.duties.length === 1 ? '' : 's'} encontrado${proposal.lessons.length + proposal.duties.length === 1 ? '' : 's'}. Reveja antes de confirmar.`
      )
    } catch (readError) {
      setError(errorMessage(readError))
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

  async function applyImport() {
    if (busy) {
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
      included.some(
        draft =>
          !draft.groupName.trim() ||
          !draft.subjectName.trim() ||
          !draft.startTime ||
          !draft.endTime ||
          draft.startTime >= draft.endTime ||
          !Number.isInteger(draft.periodCount) ||
          draft.periodCount <= 0
      ) ||
      includedDuties.some(
        duty =>
          !duty.name.trim() ||
          !duty.startTime ||
          !duty.endTime ||
          duty.startTime >= duty.endTime
      )
    ) {
      setError(
        'Reveja os blocos: existem dados em falta ou horas inválidas.'
      )
      return
    }

    setBusy(true)
    setError('')
    setProgress('A validar a proposta...')

    try {
      const academicYearId =
        snapshot.academicYear.id
      let current =
        await maProfessorRepository.getSetupSnapshot(
          academicYearId
        )

      validateDraftConflicts(
        included,
        includedDuties
      )
      validateExistingScheduleConflicts(
        included,
        includedDuties,
        current
      )

      setProgress(
        'A guardar a configuração confirmada...'
      )

      const groups =
        new Map(
          current.groups.map(
            group => [
              normalize(group.name),
              group
            ]
          )
        )
      const subjects =
        new Map(
          current.subjects.map(
            subject => [
              normalize(subject.name),
              subject
            ]
          )
        )

      for (const draft of included) {
        const groupName =
          clean(draft.groupName)
        const subjectName =
          clean(draft.subjectName)

        if (!groups.has(normalize(groupName))) {
          const grade =
            groupName.match(/^\s*(10|11|12)/)?.[1]
          const group =
            await maProfessorRepository.createGroup({
              academicYearId,
              name: groupName,
              courseName: '',
              gradeLevel:
                grade
                  ? `${grade}.º ano`
                  : '',
              active: true
            })

          groups.set(
            normalize(groupName),
            group
          )
        }

        if (!subjects.has(normalize(subjectName))) {
          const subject =
            await maProfessorRepository.createSubject({
              academicYearId,
              name: subjectName,
              shortName:
                shortName(subjectName),
              code: '',
              active: true
            })

          subjects.set(
            normalize(subjectName),
            subject
          )
        }
      }

      current =
        await maProfessorRepository.getSetupSnapshot(
          academicYearId
        )

      const assignments =
        new Map(
          current.teachingAssignments.map(
            assignment => [
              `${assignment.groupId}|${assignment.subjectId}`,
              assignment
            ]
          )
        )
      const resolved: Array<{
        draft: Draft
        assignmentId: string
      }> = []

      for (const draft of included) {
        const group =
          groups.get(
            normalize(
              clean(draft.groupName)
            )
          )
        const subject =
          subjects.get(
            normalize(
              clean(draft.subjectName)
            )
          )

        if (!group || !subject) {
          throw new Error(
            'Não foi possível associar uma turma ou disciplina importada.'
          )
        }

        const pair =
          `${group.id}|${subject.id}`
        let assignment =
          assignments.get(pair)

        if (!assignment) {
          assignment =
            await maProfessorRepository.createTeachingAssignment({
              academicYearId,
              groupId: group.id,
              subjectId: subject.id,
              displayName:
                `${subject.shortName || subject.name} · ${group.name}`,
              active: true
            })

          assignments.set(
            pair,
            assignment
          )
        }

        resolved.push({
          draft,
          assignmentId: assignment.id
        })
      }

      current =
        await maProfessorRepository.getSetupSnapshot(
          academicYearId
        )

      const existingSlots =
        new Set(
          current.weeklyScheduleSlots.map(
            slot => [
              slot.teachingAssignmentId,
              slot.weekday,
              slot.startTime,
              slot.endTime
            ].join('|')
          )
        )

      for (const {
        draft,
        assignmentId
      } of resolved) {
        const key = [
          assignmentId,
          draft.weekday,
          draft.startTime,
          draft.endTime
        ].join('|')

        if (existingSlots.has(key)) {
          continue
        }

        await maProfessorRepository.createWeeklyScheduleSlot({
          academicYearId,
          teachingAssignmentId: assignmentId,
          weekday: draft.weekday,
          startTime: draft.startTime,
          endTime: draft.endTime,
          periodCount: draft.periodCount,
          validFrom:
            snapshot.academicYear.startDate,
          validUntil:
            snapshot.academicYear.endDate,
          active: true
        })

        existingSlots.add(key)
      }

      const createdDuties =
        await importDutyEvents(
          snapshot.academicYear,
          includedDuties
        )

      setProgress(
        `${included.length} aula${included.length === 1 ? '' : 's'} preparada${included.length === 1 ? '' : 's'} e ${createdDuties} ocorrência${createdDuties === 1 ? '' : 's'} de cargos programada${createdDuties === 1 ? '' : 's'}.`
      )

      onImported(
        await maProfessorRepository.getSetupSnapshot(
          academicYearId
        )
      )
    } catch (submitError) {
      setError(errorMessage(submitError))
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  const hasProposal =
    drafts.length > 0 ||
    duties.length > 0
  const includedCount =
    included.length +
    includedDuties.length

  return (
    <div className="mx-auto max-w-[100rem]">
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
              O MA-Professor lê o PDF no seu dispositivo e prepara aulas e cargos. As salas são ignoradas. Nada é aplicado antes da sua confirmação.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">
            Leitura local · sem envio do PDF
          </div>
        </div>

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
                  'PDF com texto selecionável. Se for uma digitalização, o fluxo manual continua disponível.'}
              </span>

              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={busy}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={onContinueWithoutPdf}
              className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3.5 text-sm font-bold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
            >
              Continuar sem PDF
            </button>
          </div>
        ) : (
          <>
            <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="font-black text-white">
                Proposta extraída de {fileName}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Corrija o que estiver errado e desmarque o que não pretende importar. Nenhuma sala é guardada.
              </p>
            </div>

            {drafts.length > 0 ? (
              <div className="mt-5">
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-cyan-100">
                  Aulas
                </h2>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[940px] border-collapse text-left">
                    <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Usar</th>
                        <th className="px-3 py-3">Dia</th>
                        <th className="px-3 py-3">Início</th>
                        <th className="px-3 py-3">Fim</th>
                        <th className="px-3 py-3">Tempos</th>
                        <th className="px-3 py-3">Turma</th>
                        <th className="px-3 py-3">Disciplina</th>
                      </tr>
                    </thead>

                    <tbody>
                      {drafts.map(draft => (
                        <tr
                          key={draft.id}
                          className="border-t border-white/[0.07]"
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    included:
                                      event.target.checked
                                  }
                                )
                              }
                              className="h-4 w-4 accent-cyan-300"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <select
                              value={draft.weekday}
                              disabled={!draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    weekday:
                                      Number(event.target.value) as Weekday
                                  }
                                )
                              }
                              className={inputClassName}
                            >
                              {weekdays.map(day => (
                                <option
                                  key={day.value}
                                  value={day.value}
                                >
                                  {day.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={draft.startTime}
                              disabled={!draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    startTime:
                                      event.target.value
                                  }
                                )
                              }
                              className={inputClassName}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={draft.endTime}
                              disabled={!draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    endTime:
                                      event.target.value
                                  }
                                )
                              }
                              className={inputClassName}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={draft.periodCount}
                              disabled={!draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    periodCount:
                                      Math.max(
                                        1,
                                        Number(event.target.value) || 1
                                      )
                                  }
                                )
                              }
                              className={inputClassName}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              value={draft.groupName}
                              disabled={!draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    groupName:
                                      event.target.value
                                  }
                                )
                              }
                              placeholder="Ex.: 10.º D"
                              className={inputClassName}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              value={draft.subjectName}
                              disabled={!draft.included}
                              onChange={event =>
                                updateDraft(
                                  draft.id,
                                  {
                                    subjectName:
                                      event.target.value
                                  }
                                )
                              }
                              placeholder="Disciplina"
                              className={inputClassName}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {duties.length > 0 ? (
              <div className="mt-6">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-violet-100">
                      Cargos / componente não letiva
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      O MA-Professor programa as ocorrências no calendário. O sumário de cada ocorrência pode ser escrito antecipadamente ou no próprio dia.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-violet-300/15">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead className="bg-violet-300/[0.04] text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Usar</th>
                        <th className="px-3 py-3">Dia</th>
                        <th className="px-3 py-3">Início</th>
                        <th className="px-3 py-3">Fim</th>
                        <th className="px-3 py-3">Cargo / atividade</th>
                      </tr>
                    </thead>

                    <tbody>
                      {duties.map(duty => (
                        <tr
                          key={duty.id}
                          className="border-t border-white/[0.07]"
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={duty.included}
                              onChange={event =>
                                updateDuty(
                                  duty.id,
                                  {
                                    included:
                                      event.target.checked
                                  }
                                )
                              }
                              className="h-4 w-4 accent-violet-300"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <select
                              value={duty.weekday}
                              disabled={!duty.included}
                              onChange={event =>
                                updateDuty(
                                  duty.id,
                                  {
                                    weekday:
                                      Number(event.target.value) as Weekday
                                  }
                                )
                              }
                              className={inputClassName}
                            >
                              {weekdays.map(day => (
                                <option
                                  key={day.value}
                                  value={day.value}
                                >
                                  {day.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={duty.startTime}
                              disabled={!duty.included}
                              onChange={event =>
                                updateDuty(
                                  duty.id,
                                  {
                                    startTime:
                                      event.target.value
                                  }
                                )
                              }
                              className={inputClassName}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={duty.endTime}
                              disabled={!duty.included}
                              onChange={event =>
                                updateDuty(
                                  duty.id,
                                  {
                                    endTime:
                                      event.target.value
                                  }
                                )
                              }
                              className={inputClassName}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              value={duty.name}
                              disabled={!duty.included}
                              onChange={event =>
                                updateDuty(
                                  duty.id,
                                  {
                                    name:
                                      event.target.value
                                  }
                                )
                              }
                              placeholder="Ex.: Eq Pedag"
                              className={inputClassName}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onContinueWithoutPdf}
                disabled={busy}
                className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:text-white disabled:opacity-50"
              >
                Ignorar importação
              </button>

              <button
                type="button"
                onClick={applyImport}
                disabled={
                  busy ||
                  includedCount === 0
                }
                className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-5 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'A aplicar...'
                  : `Confirmar ${includedCount} bloco${includedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}

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

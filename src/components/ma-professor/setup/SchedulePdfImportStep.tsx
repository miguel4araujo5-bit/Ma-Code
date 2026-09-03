import {
  type ChangeEvent,
  useMemo,
  useState
} from 'react'

import {
  extractTextFromPdf,
  type ExtractedPdfCell,
  type ExtractedPdfPage
} from '../../../lib/maPdf/extractPdfText'
import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import type { Weekday } from '../types'

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

type DayColumn = {
  weekday: Weekday
  centerX: number
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
    new Map<
      Weekday,
      DayColumn
    >()

  for (const cell of cells) {
    const weekday =
      detectWeekday(
        cell.text
      )

    if (
      !weekday ||
      detected.has(
        weekday
      )
    ) {
      continue
    }

    detected.set(
      weekday,
      {
        weekday,
        centerX:
          getCellCenter(
            cell
          )
      }
    )
  }

  return Array.from(
    detected.values()
  ).sort(
    (
      left,
      right
    ) =>
      left.centerX -
      right.centerX
  )
}

function resolveColumnWeekday(
  cell: ExtractedPdfCell,
  columns: DayColumn[]
): Weekday | null {
  if (
    columns.length < 2
  ) {
    return null
  }

  const centerX =
    getCellCenter(
      cell
    )

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
) {
  const drafts: Draft[] = []
  const seen = new Set<string>()
  let sequence = 0

  function addDraft(
    weekday: Weekday,
    startTime: string,
    endTime: string,
    raw: string
  ) {
    const cleanedRaw =
      clean(raw)

    if (!cleanedRaw) {
      return
    }

    const groupName =
      extractGroupName(
        cleanedRaw
      )

    const subjectName =
      stripLessonNoise(
        cleanedRaw,
        groupName
      )

    if (
      !groupName &&
      !subjectName
    ) {
      return
    }

    const key = [
      weekday,
      startTime,
      endTime,
      normalize(groupName),
      normalize(subjectName)
    ].join('|')

    if (seen.has(key)) {
      return
    }

    seen.add(key)

    drafts.push({
      id:
        `pdf-slot-${sequence += 1}`,
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
      subjectName
    })
  }

  for (const page of pages) {
    let dayColumns: DayColumn[] = []

    for (const line of page.lines) {
      const positionedCells =
        line.positionedCells ?? []

      const detectedColumns =
        detectDayColumns(
          positionedCells
        )

      if (
        detectedColumns.length >= 2
      ) {
        dayColumns = detectedColumns
        continue
      }

      const time =
        extractTimeRange(
          line.text
        )

      if (!time) {
        continue
      }

      let addedFromColumns = false

      if (
        dayColumns.length >= 2 &&
        positionedCells.length > 0
      ) {
        const contentByDay =
          new Map<
            Weekday,
            string[]
          >()

        for (const cell of positionedCells) {
          if (
            extractTimeRange(
              cell.text
            )
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

          const current =
            contentByDay.get(
              weekday
            ) ?? []

          current.push(content)

          contentByDay.set(
            weekday,
            current
          )
        }

        for (
          const [weekday, parts] of
          contentByDay
        ) {
          const raw =
            clean(
              parts.join(' ')
            )

          if (!raw) {
            continue
          }

          const beforeCount =
            drafts.length

          addDraft(
            weekday,
            time.startTime,
            time.endTime,
            raw
          )

          addedFromColumns =
            addedFromColumns ||
            drafts.length > beforeCount
        }
      }

      if (!addedFromColumns) {
        const explicitDay =
          detectWeekday(
            line.text
          )

        if (explicitDay) {
          addDraft(
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
    }
  }

  return drafts
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
  drafts: Draft[]
) {
  for (
    let firstIndex = 0;
    firstIndex < drafts.length;
    firstIndex += 1
  ) {
    const first = drafts[firstIndex]

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < drafts.length;
      secondIndex += 1
    ) {
      const second = drafts[secondIndex]

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
          `Há dois blocos sobrepostos na proposta: ${draftLabel(first)} e ${draftLabel(second)}, à ${weekdayLabel(first.weekday)}, entre ${first.startTime} e ${first.endTime}. Corrija ou desmarque um deles antes de importar.`
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

  if (!assignment) {
    return false
  }

  const group =
    snapshot.groups.find(
      item => item.id === assignment.groupId
    )

  const subject =
    snapshot.subjects.find(
      item => item.id === assignment.subjectId
    )

  return Boolean(
    group &&
    subject &&
    normalize(group.name) === normalize(draft.groupName) &&
    normalize(subject.name) === normalize(draft.subjectName)
  )
}

function validateExistingScheduleConflicts(
  drafts: Draft[],
  snapshot: SetupSnapshot
) {
  const activeSlots =
    snapshot.weeklyScheduleSlots.filter(
      slot => slot.active
    )

  for (const draft of drafts) {
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
}

export default function SchedulePdfImportStep({
  snapshot,
  onImported,
  onContinueWithoutPdf
}: Props) {
  const [fileName, setFileName] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const included = useMemo(
    () => drafts.filter(
      draft => draft.included
    ),
    [drafts]
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

      const next =
        parsePages(
          extracted.pages,
          settings.defaultPeriodMinutes
        )

      if (next.length === 0) {
        throw new Error(
          'Foi possível ler o PDF, mas não reconhecer automaticamente blocos do horário com segurança. Pode continuar com a configuração manual sem perder nada.'
        )
      }

      setDrafts(next)
      setProgress(
        `${next.length} bloco${next.length === 1 ? '' : 's'} encontrado${next.length === 1 ? '' : 's'}. Reveja antes de confirmar.`
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

  async function applyImport() {
    if (busy) {
      return
    }

    if (included.length === 0) {
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
      )
    ) {
      setError(
        'Reveja os blocos: cada um precisa de turma, disciplina, horas e número de tempos válidos.'
      )
      return
    }

    setBusy(true)
    setError('')
    setProgress('A validar a proposta...')

    try {
      const academicYearId = snapshot.academicYear.id

      let current =
        await maProfessorRepository.getSetupSnapshot(
          academicYearId
        )

      validateDraftConflicts(included)
      validateExistingScheduleConflicts(
        included,
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
        const groupName = clean(draft.groupName)
        const subjectName = clean(draft.subjectName)

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
              shortName: shortName(subjectName),
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
            normalize(clean(draft.groupName))
          )

        const subject =
          subjects.get(
            normalize(clean(draft.subjectName))
          )

        if (!group || !subject) {
          throw new Error(
            'Não foi possível associar uma turma ou disciplina importada.'
          )
        }

        const pair = `${group.id}|${subject.id}`
        let assignment = assignments.get(pair)

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

          assignments.set(pair, assignment)
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
          validFrom: snapshot.academicYear.startDate,
          validUntil: snapshot.academicYear.endDate,
          active: true
        })

        existingSlots.add(key)
      }

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
              O MA-Professor lê o PDF no seu dispositivo e prepara uma proposta com turmas, disciplinas, dias, horas e tempos. Nada é aplicado antes da sua confirmação.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">
            Leitura local · sem envio do PDF
          </div>
        </div>

        {drafts.length === 0 ? (
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
                Corrija o que estiver errado e desmarque os blocos que não pretende importar.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
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
                  included.length === 0
                }
                className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-5 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'A aplicar...'
                  : `Confirmar ${included.length} bloco${included.length === 1 ? '' : 's'}`}
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

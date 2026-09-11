import {
  type ChangeEvent,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  extractTextFromPdf
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
  commitScheduleImport,
  readScheduleImportState
} from './scheduleImportRepository'

import {
  extractScheduleGroupName,
  normalizeScheduleText,
  parseSchedulePdfPages,
  type ScheduleDutyDraft as DutyDraft,
  type ScheduleLessonDraft as Draft,
  type ScheduleUnresolvedDraft as UnresolvedDraft
} from './schedulePdfParser'

import ScheduleImportVisualGrid from './ScheduleImportVisualGrid'

type Props = {
  snapshot: SetupSnapshot
  onImported: (snapshot: SetupSnapshot) => void | Promise<void>
  onContinueWithoutPdf: () => void
}

const MAX_SCHEDULE_PDF_BYTES =
  20 * 1024 * 1024

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

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50'

const UNSAVED_SCHEDULE_IMPORT_MESSAGE =
  'Existe uma proposta de horário importada por confirmar. Se continuar, essa proposta e as correções feitas serão perdidas. Pretende continuar?'

function errorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function manualId(
  prefix: string
) {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
}

function suggestedPeriods(
  startTime: string,
  endTime: string,
  defaultMinutes: number
) {
  const [startHour, startMinute] =
    startTime
      .split(':')
      .map(Number)

  const [endHour, endMinute] =
    endTime
      .split(':')
      .map(Number)

  const duration =
    endHour * 60 +
    endMinute -
    (
      startHour * 60 +
      startMinute
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

function weekdayLabel(
  weekday: Weekday
) {
  return (
    weekdays.find(
      day =>
        day.value === weekday
    )?.label ??
    'Dia'
  )
}

export default function SchedulePdfImportStep({
  snapshot,
  onImported,
  onContinueWithoutPdf
}: Props) {
  const [
    fileName,
    setFileName
  ] =
    useState('')

  const [
    drafts,
    setDrafts
  ] =
    useState<Draft[]>([])

  const [
    duties,
    setDuties
  ] =
    useState<DutyDraft[]>([])

  const [
    unresolved,
    setUnresolved
  ] =
    useState<UnresolvedDraft[]>([])

  const [
    expectedFingerprint,
    setExpectedFingerprint
  ] =
    useState('')

  const [
    defaultPeriodMinutes,
    setDefaultPeriodMinutes
  ] =
    useState(50)

  const [
    progress,
    setProgress
  ] =
    useState('')

  const [
    error,
    setError
  ] =
    useState('')

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const rootRef =
    useRef<HTMLDivElement>(
      null
    )

  const canUseSavedSchedule =
    snapshot.weeklyScheduleSlots.some(
      slot => slot.active
    )

  const included =
    useMemo(
      () =>
        drafts.filter(
          draft =>
            draft.included
        ),
      [drafts]
    )

  const includedDuties =
    useMemo(
      () =>
        duties.filter(
          duty =>
            duty.included
        ),
      [duties]
    )

  const unconfirmedSubjects =
    useMemo(
      () =>
        included.filter(
          draft =>
            !draft.subjectConfirmed
        ),
      [included]
    )

  const courseConflicts =
    useMemo(
      () => {
        const conflicts =
          new Map<string, string>()

        for (const draft of included) {
          const importedCourse =
            draft.courseName.trim()

          if (!importedCourse) {
            continue
          }

          const existingGroup =
            snapshot.groups.find(
              group =>
                normalizeScheduleText(
                  group.name
                ) ===
                  normalizeScheduleText(
                    draft.groupName
                  )
            )

          const existingCourse =
            existingGroup
              ?.courseName
              ?.trim() ??
            ''

          if (
            existingGroup &&
            existingCourse &&
            normalizeScheduleText(
              existingCourse
            ) !==
              normalizeScheduleText(
                importedCourse
              )
          ) {
            conflicts.set(
              draft.id,
              existingCourse
            )
          }
        }

        return conflicts
      },
      [
        included,
        snapshot.groups
      ]
    )

  const hasProposal =
    drafts.length > 0 ||
    duties.length > 0 ||
    unresolved.length > 0

  const includedCount =
    included.length +
    includedDuties.length

  useMAProfessorUnsavedWorkspaceProtection(
    hasProposal,
    rootRef,
    UNSAVED_SCHEDULE_IMPORT_MESSAGE
  )

  function clearProposal() {
    setDrafts([])
    setDuties([])
    setUnresolved([])
    setExpectedFingerprint('')
    setFileName('')
    setProgress('')
    setError('')
  }

  async function useSavedSchedule() {
    if (busy) {
      return
    }

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

      await onImported(
        current
      )

      clearProposal()
    } catch (
      readError
    ) {
      setError(
        errorMessage(
          readError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    if (
      file.type !==
        'application/pdf' &&
      !file.name
        .toLocaleLowerCase(
          'pt-PT'
        )
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

    setBusy(true)
    setError('')
    setDrafts([])
    setDuties([])
    setUnresolved([])
    setExpectedFingerprint('')
    setFileName(file.name)

    try {
      const extracted =
        await extractTextFromPdf(
          {
            id:
              `ma-professor-schedule-${Date.now()}`,
            file
          },
          setProgress
        )

      const [
        settings,
        importState
      ] =
        await Promise.all([
          maProfessorRepository
            .getSettings(),
          readScheduleImportState()
        ])

      setDefaultPeriodMinutes(
        settings.defaultPeriodMinutes
      )

      const proposal =
        parseSchedulePdfPages(
          extracted.pages,
          settings.defaultPeriodMinutes
        )

      if (
        proposal.lessons.length ===
          0 &&
        proposal.duties.length ===
          0 &&
        proposal.unresolved.length ===
          0
      ) {
        throw new Error(
          'Foi possível ler o PDF, mas não reconhecer automaticamente blocos do horário com segurança. Pode continuar com a configuração manual sem perder nada.'
        )
      }

      setDrafts(
        proposal.lessons
      )
      setDuties(
        proposal.duties
      )
      setUnresolved(
        proposal.unresolved
      )
      setExpectedFingerprint(
        importState.fingerprint
      )

      const pendingSubjectCount =
        proposal.lessons.filter(
          lesson =>
            !lesson.subjectConfirmed
        ).length

      const foundCount =
        proposal.lessons.length +
        proposal.duties.length

      setProgress(
        `${proposal.lessons.length} aula${proposal.lessons.length === 1 ? '' : 's'} e ${proposal.duties.length} cargo${proposal.duties.length === 1 ? '' : 's'} reconhecido${foundCount === 1 ? '' : 's'}. ${proposal.unresolved.length > 0 ? `${proposal.unresolved.length} elemento${proposal.unresolved.length === 1 ? '' : 's'} ficou${proposal.unresolved.length === 1 ? '' : 'aram'} por rever; nada será descartado silenciosamente. ` : ''}${pendingSubjectCount > 0 ? `${pendingSubjectCount} disciplina${pendingSubjectCount === 1 ? '' : 's'} precisa${pendingSubjectCount === 1 ? '' : 'm'} de confirmação. ` : ''}AP/TAP é tratado como curso Técnico de Apoio Psicossocial quando surge como sigla separada.`
      )
    } catch (
      readError
    ) {
      setError(
        errorMessage(
          readError
        )
      )
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  function updateDraft(
    id: string,
    changes:
      Partial<Draft>
  ) {
    setDrafts(
      current =>
        current.map(
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
    changes:
      Partial<DutyDraft>
  ) {
    setDuties(
      current =>
        current.map(
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

  function addManualLesson() {
    if (busy) {
      return
    }

    setDrafts(
      current => [
        ...current,
        {
          id:
            manualId(
              'manual-slot'
            ),
          included:
            true,
          weekday:
            1,
          startTime:
            '08:30',
          endTime:
            '09:20',
          periodCount:
            1,
          groupName:
            '',
          courseName:
            '',
          subjectName:
            '',
          subjectConfirmed:
            false
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
            manualId(
              'manual-duty'
            ),
          included:
            true,
          weekday:
            1,
          startTime:
            '08:30',
          endTime:
            '09:20',
          name:
            ''
        }
      ]
    )

    setError('')
  }

  function removeUnresolved(
    id: string
  ) {
    setUnresolved(
      current =>
        current.filter(
          item => item.id !== id
        )
    )

    setError('')
  }

  function resolveAsLesson(
    item: UnresolvedDraft
  ) {
    const groupName =
      extractScheduleGroupName(
        item.rawText
      )

    setDrafts(
      current => [
        ...current,
        {
          id:
            manualId(
              'review-slot'
            ),
          included:
            true,
          weekday:
            item.weekday,
          startTime:
            item.startTime,
          endTime:
            item.endTime,
          periodCount:
            suggestedPeriods(
              item.startTime,
              item.endTime,
              defaultPeriodMinutes
            ),
          groupName,
          courseName:
            '',
          subjectName:
            item.rawText,
          subjectConfirmed:
            false
        }
      ]
    )

    removeUnresolved(
      item.id
    )
  }

  function resolveAsDuty(
    item: UnresolvedDraft
  ) {
    setDuties(
      current => [
        ...current,
        {
          id:
            manualId(
              'review-duty'
            ),
          included:
            true,
          weekday:
            item.weekday,
          startTime:
            item.startTime,
          endTime:
            item.endTime,
          name:
            item.rawText
        }
      ]
    )

    removeUnresolved(
      item.id
    )
  }

  async function applyImport() {
    if (busy) {
      return
    }

    if (
      unresolved.length > 0
    ) {
      setError(
        'Existem elementos por rever. Classifique cada um como aula, cargo ou ignore-o explicitamente antes de guardar.'
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
        'Existem siglas ou nomes de disciplina por confirmar. Corrija a disciplina em cada linha assinalada ou escolha “Confirmar como disciplina”. O MA-Professor não vai criar disciplinas a partir de siglas ambíguas sem confirmação.'
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
        await commitScheduleImport({
          confirmed:
            true,
          academicYearId,
          expectedFingerprint,
          lessons:
            included,
          duties:
            includedDuties
        })

      const courseNotice =
        result.preservedCourses > 0
          ? ` ${result.preservedCourses} conflito${result.preservedCourses === 1 ? '' : 's'} de curso foi${result.preservedCourses === 1 ? '' : 'ram'} resolvido${result.preservedCourses === 1 ? '' : 's'} mantendo o curso que já estava confirmado no MA-Professor.`
          : ''

      setProgress(
        `${included.length} aula${included.length === 1 ? '' : 's'} preparada${included.length === 1 ? '' : 's'}; ${result.createdSlots} novo${result.createdSlots === 1 ? '' : 's'} bloco${result.createdSlots === 1 ? '' : 's'} de horário criado${result.createdSlots === 1 ? '' : 's'} e ${result.createdDutyOccurrences} ocorrência${result.createdDutyOccurrences === 1 ? '' : 's'} de cargos programada${result.createdDutyOccurrences === 1 ? '' : 's'}.${courseNotice}`
      )

      await onImported(
        await maProfessorRepository
          .getSetupSnapshot(
            academicYearId
          )
      )

      // O painel pode permanecer montado no setup detalhado. Depois de um
      // commit bem-sucedido já não existe proposta pendente a proteger.
      setDrafts([])
      setDuties([])
      setUnresolved([])
      setExpectedFingerprint('')
      setFileName('')
    } catch (
      submitError
    ) {
      setError(
        errorMessage(
          submitError
        )
      )
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  function requestContinueWithoutPdf() {
    if (busy) {
      return
    }

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

    clearProposal()
    onContinueWithoutPdf()
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
              O MA-Professor lê o PDF no seu dispositivo e prepara aulas e cargos. As salas são ignoradas. Nada é aplicado antes da sua confirmação. Um elemento ambíguo fica visível para revisão em vez de desaparecer. Curso, turma e disciplina continuam editáveis antes de guardar.
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
                disabled={busy}
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
                disabled={busy}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              disabled={busy}
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
                Proposta extraída de {fileName}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Compare a vista com o PDF original. Corrija o que estiver errado, acrescente blocos em falta e desmarque o que não pretende importar. Um curso que já exista na turma nunca é substituído silenciosamente por uma inferência do PDF.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={addManualLesson}
                  className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/[0.14] disabled:opacity-50"
                >
                  + Adicionar aula / hora
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={addManualDuty}
                  className="rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2.5 text-sm font-black text-violet-100 transition hover:bg-violet-300/[0.14] disabled:opacity-50"
                >
                  + Adicionar cargo
                </button>
              </div>
            </div>

            {unresolved.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.055] p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                    Elementos por rever
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-50/80">
                    Estes blocos foram encontrados no PDF, mas o MA-Professor não conseguiu classificá-los com segurança. Nada será apagado automaticamente. Escolha o que cada elemento representa ou ignore-o explicitamente.
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
                  {unresolved.map(item => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-amber-300/15 bg-slate-950/55 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">
                            {weekdayLabel(item.weekday)} · {item.startTime}–{item.endTime}
                          </p>

                          <p className="mt-1 text-sm text-amber-100">
                            {item.rawText}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {item.reason}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              resolveAsLesson(
                                item
                              )
                            }
                            className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-50"
                          >
                            Tratar como aula
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              resolveAsDuty(
                                item
                              )
                            }
                            className="rounded-lg border border-violet-300/25 bg-violet-300/[0.08] px-3 py-2 text-xs font-black text-violet-100 disabled:opacity-50"
                          >
                            Tratar como cargo
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              removeUnresolved(
                                item.id
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-50"
                          >
                            Ignorar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {drafts.length > 0 ||
            duties.length > 0 ? (
              <div className="mt-5">
                <ScheduleImportVisualGrid
                  lessons={drafts}
                  duties={duties}
                  disabled={busy}
                  onUpdateLesson={updateDraft}
                  onUpdateDuty={updateDuty}
                />
              </div>
            ) : null}

            {drafts.length > 0 ? (
              <div className="mt-7">
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-cyan-100">
                  Vista detalhada · aulas
                </h2>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[1180px] border-collapse text-left">
                    <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Usar</th>
                        <th className="px-3 py-3">Dia</th>
                        <th className="px-3 py-3">Início</th>
                        <th className="px-3 py-3">Fim</th>
                        <th className="px-3 py-3">Tempos</th>
                        <th className="px-3 py-3">Turma</th>
                        <th className="px-3 py-3">Curso</th>
                        <th className="px-3 py-3">Disciplina</th>
                      </tr>
                    </thead>

                    <tbody>
                      {drafts.map(draft => {
                        const existingCourse =
                          courseConflicts.get(
                            draft.id
                          )

                        return (
                          <tr
                            key={draft.id}
                            className="border-t border-white/[0.07] align-top"
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
                                        Number(
                                          event.target.value
                                        ) as Weekday
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
                                          Number(
                                            event.target.value
                                          ) || 1
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
                              <div className="min-w-60">
                                <input
                                  value={draft.courseName}
                                  disabled={!draft.included}
                                  onChange={event =>
                                    updateDraft(
                                      draft.id,
                                      {
                                        courseName:
                                          event.target.value
                                      }
                                    )
                                  }
                                  placeholder="Ex.: Técnico de Apoio Psicossocial"
                                  className={
                                    existingCourse
                                      ? `${inputClassName} border-amber-300/40`
                                      : inputClassName
                                  }
                                />

                                {existingCourse ? (
                                  <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-2 text-[0.68rem] leading-4 text-amber-100">
                                    Esta turma já tem o curso “{existingCourse}”. Por segurança, esse valor será mantido; o PDF não o substitui automaticamente.
                                  </p>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <div className="min-w-52">
                                <input
                                  value={draft.subjectName}
                                  disabled={!draft.included}
                                  onChange={event =>
                                    updateDraft(
                                      draft.id,
                                      {
                                        subjectName:
                                          event.target.value,
                                        subjectConfirmed:
                                          Boolean(
                                            event.target.value.trim()
                                          )
                                      }
                                    )
                                  }
                                  placeholder="Disciplina"
                                  className={
                                    draft.included &&
                                    !draft.subjectConfirmed
                                      ? `${inputClassName} border-amber-300/40 focus:border-amber-300/60 focus:ring-amber-300/10`
                                      : inputClassName
                                  }
                                />

                                {draft.included &&
                                !draft.subjectConfirmed ? (
                                  <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-2.5">
                                    <p className="text-xs leading-5 text-amber-100">
                                      “{draft.subjectName || '—'}” ainda não é uma disciplina confirmada. Corrija o nome ou confirme explicitamente.
                                    </p>

                                    <button
                                      type="button"
                                      disabled={
                                        !draft
                                          .subjectName
                                          .trim()
                                      }
                                      onClick={() =>
                                        updateDraft(
                                          draft.id,
                                          {
                                            subjectConfirmed:
                                              true
                                          }
                                        )
                                      }
                                      className="mt-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 py-1.5 text-[0.68rem] font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Confirmar como disciplina
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
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
                      Vista detalhada · cargos / componente não letiva
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
                                      Number(
                                        event.target.value
                                      ) as Weekday
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
                              placeholder="Ex.: Co PCE"
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
              {canUseSavedSchedule ? (
                <button
                  type="button"
                  onClick={useSavedSchedule}
                  disabled={busy}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2.5 text-sm font-bold text-cyan-50 disabled:opacity-50"
                >
                  Usar horário guardado
                </button>
              ) : null}

              <button
                type="button"
                onClick={requestContinueWithoutPdf}
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
                  includedCount === 0 ||
                  unresolved.length > 0 ||
                  unconfirmedSubjects.length > 0
                }
                className="rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-5 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'A aplicar...'
                  : unresolved.length > 0
                    ? `Rever ${unresolved.length} elemento${unresolved.length === 1 ? '' : 's'} primeiro`
                    : unconfirmedSubjects.length > 0
                      ? `Confirmar ${unconfirmedSubjects.length} disciplina${unconfirmedSubjects.length === 1 ? '' : 's'} primeiro`
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

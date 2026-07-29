import {
  forwardRef,
  type ChangeEvent,
  useEffect,
  useImperativeHandle,
  useState
} from 'react'

import {
  attendanceRepository,
  type LessonAttendanceRegisterRow
} from '../attendance/attendanceRepository'

import type {
  EntityId,
  Lesson
} from '../types'

interface LessonAttendanceSectionProps {
  lessonId: EntityId
  disabled: boolean
}

export interface LessonAttendanceSectionHandle {
  saveAttendance: (
    lesson: Lesson
  ) => Promise<void>
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

const LessonAttendanceSection =
  forwardRef<
    LessonAttendanceSectionHandle,
    LessonAttendanceSectionProps
  >(
    function LessonAttendanceSection(
      {
        lessonId,
        disabled
      },
      ref
    ) {
      const [
        rows,
        setRows
      ] =
        useState<
          LessonAttendanceRegisterRow[]
        >([])

      const [
        loading,
        setLoading
      ] =
        useState(true)

      const [
        loadError,
        setLoadError
      ] =
        useState('')

      useEffect(() => {
        let active =
          true

        setLoading(
          true
        )

        setLoadError(
          ''
        )

        attendanceRepository
          .getLessonAttendanceRegister(
            lessonId
          )
          .then(
            (
              register
            ) => {
              if (
                !active
              ) {
                return
              }

              setRows(
                register.rows
              )
            }
          )
          .catch(
            (
              error
            ) => {
              if (
                !active
              ) {
                return
              }

              setLoadError(
                getErrorMessage(
                  error
                )
              )
            }
          )
          .finally(() => {
            if (
              active
            ) {
              setLoading(
                false
              )
            }
          })

        return () => {
          active =
            false
        }
      }, [
        lessonId
      ])

      useImperativeHandle(
        ref,
        () => ({
          async saveAttendance(
            lesson
          ) {
            if (
              lesson.status !==
              'taught'
            ) {
              return
            }

            if (
              loading
            ) {
              throw new Error(
                'A lista de alunos ainda está a carregar. Aguarde um momento e volte a guardar.'
              )
            }

            if (
              loadError
            ) {
              throw new Error(
                `Não foi possível preparar a assiduidade: ${loadError}`
              )
            }

            await attendanceRepository
              .saveLessonAttendance(
                lesson.id,
                rows.map(
                  (
                    row
                  ) => ({
                    studentId:
                      row.student.id,

                    status:
                      row.effectiveStatus,

                    code:
                      row.effectiveStatus ===
                      'absent'
                        ? (
                            row.effectiveCode.trim() ||
                            'F'
                          )
                        : '',

                    note:
                      row.effectiveNote
                  })
                ),
                {
                  fillMissingAsPresent:
                    true,

                  synchronizeRecoveries:
                    true
                }
              )
          }
        }),
        [
          loadError,
          loading,
          rows
        ]
      )

      function updateRow(
        studentId:
          EntityId,
        changes:
          Partial<
            Pick<
              LessonAttendanceRegisterRow,
              | 'effectiveStatus'
              | 'effectiveCode'
              | 'effectiveNote'
            >
          >
      ) {
        setRows(
          (
            current
          ) =>
            current.map(
              (
                row
              ) =>
                row.student.id ===
                studentId
                  ? {
                      ...row,
                      ...changes
                    }
                  : row
            )
        )
      }

      function markStudentPresent(
        studentId:
          EntityId
      ) {
        updateRow(
          studentId,
          {
            effectiveStatus:
              'present',

            effectiveCode:
              '',

            effectiveNote:
              ''
          }
        )
      }

      function markStudentAbsent(
        row:
          LessonAttendanceRegisterRow
      ) {
        updateRow(
          row.student.id,
          {
            effectiveStatus:
              'absent',

            effectiveCode:
              row.effectiveCode.trim() ||
              'F'
          }
        )
      }

      function markAllPresent() {
        setRows(
          (
            current
          ) =>
            current.map(
              (
                row
              ) => ({
                ...row,

                effectiveStatus:
                  'present',

                effectiveCode:
                  '',

                effectiveNote:
                  ''
              })
            )
        )
      }

      const absentCount =
        rows.filter(
          (
            row
          ) =>
            row.effectiveStatus ===
            'absent'
        ).length

      const presentCount =
        rows.length -
        absentCount

      return (
        <section className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-300/[0.035] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                Assiduidade
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Todos os alunos aparecem como presentes por defeito. Assinale apenas as faltas.
              </p>
            </div>

            <button
              type="button"
              onClick={
                markAllPresent
              }
              disabled={
                disabled ||
                loading ||
                rows.length ===
                  0
              }
              className="rounded-xl border border-emerald-200/25 bg-emerald-300/10 px-4 py-2.5 text-xs font-black text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Marcar todos presentes
            </button>
          </div>

          {!loading &&
          !loadError &&
          rows.length >
            0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-100">
                {presentCount}{' '}
                presentes
              </span>

              <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-black text-rose-100">
                {absentCount}{' '}
                faltas
              </span>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-4 text-sm text-slate-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-100/20 border-t-emerald-200" />

              <span>
                A carregar os alunos da turma...
              </span>
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
            >
              {loadError}
            </div>
          ) : rows.length ===
            0 ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
              <p className="text-sm font-black text-amber-100">
                A turma ainda não possui alunos.
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-100/70">
                Adicione os alunos na configuração inicial para poder registar a assiduidade.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {rows.map(
                (
                  row
                ) => {
                  const absent =
                    row.effectiveStatus ===
                    'absent'

                  return (
                    <article
                      key={
                        row.student.id
                      }
                      className={`rounded-2xl border p-4 transition ${
                        absent
                          ? 'border-rose-300/20 bg-rose-300/[0.055]'
                          : 'border-white/10 bg-slate-900/55'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                            N.º{' '}
                            {row.student.number}
                          </p>

                          <p className="mt-1 truncate text-sm font-black text-white">
                            {row.student.name}
                          </p>
                        </div>

                        <div className="grid shrink-0 grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              markStudentPresent(
                                row.student.id
                              )
                            }
                            disabled={
                              disabled
                            }
                            className={`rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${
                              !absent
                                ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
                                : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                            }`}
                          >
                            Presente
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              markStudentAbsent(
                                row
                              )
                            }
                            disabled={
                              disabled
                            }
                            className={`rounded-xl border px-4 py-2.5 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${
                              absent
                                ? 'border-rose-300/25 bg-rose-300/10 text-rose-50'
                                : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'
                            }`}
                          >
                            Falta
                          </button>
                        </div>
                      </div>

                      {absent ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-[8rem_1fr]">
                          <label className="block">
                            <FieldLabel>
                              Código
                            </FieldLabel>

                            <input
                              type="text"
                              value={
                                row.effectiveCode
                              }
                              onChange={(
                                event:
                                  ChangeEvent<HTMLInputElement>
                              ) =>
                                updateRow(
                                  row.student.id,
                                  {
                                    effectiveCode:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={
                                disabled
                              }
                              placeholder="F"
                              className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-rose-300/50 focus:ring-4 focus:ring-rose-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>

                          <label className="block">
                            <FieldLabel optional>
                              Observação
                            </FieldLabel>

                            <input
                              type="text"
                              value={
                                row.effectiveNote
                              }
                              onChange={(
                                event:
                                  ChangeEvent<HTMLInputElement>
                              ) =>
                                updateRow(
                                  row.student.id,
                                  {
                                    effectiveNote:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={
                                disabled
                              }
                              placeholder="Justificação ou nota sobre a falta."
                              className="w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-rose-300/50 focus:ring-4 focus:ring-rose-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>
                        </div>
                      ) : null}
                    </article>
                  )
                }
              )}
            </div>
          )}
        </section>
      )
    }
  )

LessonAttendanceSection.displayName =
  'LessonAttendanceSection'

export default LessonAttendanceSection

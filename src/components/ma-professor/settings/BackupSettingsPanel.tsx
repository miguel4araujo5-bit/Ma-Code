import {
  type ChangeEvent,
  useRef,
  useState
} from 'react'

import type {
  BackupValidationResult,
  MAProfessorBackup
} from '../types'

import {
  createMAProfessorBackup,
  getBackupFileName,
  parseMAProfessorBackupFile,
  resetMAProfessorDatabase,
  restoreMAProfessorBackup
} from './backupRepository'

import {
  downloadTextFile,
  exportAttendanceCsv,
  exportGradesCsv,
  exportLessonsCsv,
  exportStudentsCsv
} from './csvExport'

import {
  EncryptedSyncPanel
} from './EncryptedSyncPanel'

interface BackupSettingsPanelProps {
  onDataChanged?: () => void
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function today() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    )
}

export function BackupSettingsPanel({
  onDataChanged
}: BackupSettingsPanelProps) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const [
    busy,
    setBusy
  ] =
    useState('')

  const [
    feedback,
    setFeedback
  ] =
    useState<{
      tone:
        'success' |
        'error'

      message:
        string
    } | null>(
      null
    )

  const [
    pendingBackup,
    setPendingBackup
  ] =
    useState<MAProfessorBackup | null>(
      null
    )

  const [
    validation,
    setValidation
  ] =
    useState<BackupValidationResult | null>(
      null
    )

  const [
    restoreConfirmation,
    setRestoreConfirmation
  ] =
    useState('')

  const [
    resetConfirmation,
    setResetConfirmation
  ] =
    useState('')

  const run =
    async (
      key: string,
      operation:
        () =>
          Promise<void>,
      successMessage?: string
    ) => {
      setBusy(
        key
      )

      setFeedback(
        null
      )

      try {
        await operation()

        if (
          successMessage
        ) {
          setFeedback({
            tone:
              'success',

            message:
              successMessage
          })
        }
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy('')
      }
    }

  const handleJsonExport =
    () =>
      run(
        'json',

        async () => {
          const backup =
            await createMAProfessorBackup()

          downloadTextFile(
            getBackupFileName(
              backup.exportedAt
            ),
            JSON.stringify(
              backup,
              null,
              2
            ),
            'application/json;charset=utf-8'
          )
        },

        'Cópia de segurança criada.'
      )

  const handleCsvExport =
    (
      kind:
        | 'students'
        | 'lessons'
        | 'attendance'
        | 'grades'
    ) =>
      run(
        `csv-${kind}`,

        async () => {
          const backup =
            await createMAProfessorBackup()

          const exports = {
            students: {
              name:
                `ma-professor-alunos-${today()}.csv`,

              content:
                exportStudentsCsv(
                  backup.data
                )
            },

            lessons: {
              name:
                `ma-professor-sumarios-${today()}.csv`,

              content:
                exportLessonsCsv(
                  backup.data
                )
            },

            attendance: {
              name:
                `ma-professor-faltas-${today()}.csv`,

              content:
                exportAttendanceCsv(
                  backup.data
                )
            },

            grades: {
              name:
                `ma-professor-avaliacoes-${today()}.csv`,

              content:
                exportGradesCsv(
                  backup.data
                )
            }
          }

          const selected =
            exports[
              kind
            ]

          downloadTextFile(
            selected.name,
            selected.content,
            'text/csv;charset=utf-8'
          )
        },

        'Ficheiro CSV exportado.'
      )

  const handleFile =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0]

      event.target.value =
        ''

      if (!file) {
        return
      }

      setBusy(
        'validate'
      )

      setFeedback(
        null
      )

      setPendingBackup(
        null
      )

      setValidation(
        null
      )

      setRestoreConfirmation(
        ''
      )

      try {
        const parsed =
          await parseMAProfessorBackupFile(
            file
          )

        setPendingBackup(
          parsed.backup
        )

        setValidation(
          parsed.validation
        )

        if (
          !parsed.validation
            .valid
        ) {
          setFeedback({
            tone:
              'error',

            message:
              'O ficheiro foi lido, mas contém erros que impedem o restauro.'
          })
        }
      } catch (
        error
      ) {
        setFeedback({
          tone:
            'error',

          message:
            getErrorMessage(
              error
            )
        })
      } finally {
        setBusy('')
      }
    }

  const handleRestore =
    () => {
      if (
        !pendingBackup ||
        !validation?.valid
      ) {
        return
      }

      if (
        restoreConfirmation
          .trim()
          .toUpperCase() !==
        'RESTAURAR'
      ) {
        setFeedback({
          tone:
            'error',

          message:
            'Escreva RESTAURAR para confirmar.'
        })

        return
      }

      void run(
        'restore',

        async () => {
          await restoreMAProfessorBackup(
            pendingBackup
          )

          setPendingBackup(
            null
          )

          setValidation(
            null
          )

          setRestoreConfirmation(
            ''
          )

          onDataChanged?.()
        },

        'Cópia de segurança restaurada. A aplicação já pode ser recarregada.'
      )
    }

  const handleReset =
    () => {
      if (
        resetConfirmation
          .trim()
          .toUpperCase() !==
        'APAGAR'
      ) {
        setFeedback({
          tone:
            'error',

          message:
            'Escreva APAGAR para confirmar.'
        })

        return
      }

      void run(
        'reset',

        async () => {
          await resetMAProfessorDatabase()

          setResetConfirmation(
            ''
          )

          onDataChanged?.()
        },

        'Todos os dados escolares foram eliminados deste browser.'
      )
    }

  return (
    <div className="space-y-6">
      <EncryptedSyncPanel />

      <section className="rounded-3xl border border-cyan-300/15 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          Cópia para guardar consigo
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Descarregar uma cópia completa
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          O ficheiro JSON inclui anos letivos, turmas, alunos, planificações, aulas, sumários, faltas, avaliações e definições. Guarde-o num local seguro como cópia adicional controlada por si.
        </p>

        <button
          type="button"
          disabled={
            Boolean(
              busy
            )
          }
          onClick={() =>
            void handleJsonExport()
          }
          className="mt-5 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ===
          'json'
            ? 'A criar cópia…'
            : 'Descarregar cópia completa'}
        </button>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
          Exportações CSV
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Abrir dados no Excel
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Os CSV usam ponto e vírgula e são compatíveis com o Excel em português.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [
                'students',
                'Alunos'
              ],

              [
                'lessons',
                'Sumários'
              ],

              [
                'attendance',
                'Faltas'
              ],

              [
                'grades',
                'Avaliações'
              ]
            ] as const
          ).map(
            (
              [
                kind,
                label
              ]
            ) => (
              <button
                key={
                  kind
                }
                type="button"
                disabled={
                  Boolean(
                    busy
                  )
                }
                onClick={() =>
                  void handleCsvExport(
                    kind
                  )
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-black text-slate-200 transition hover:border-violet-300/30 hover:bg-violet-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ===
                `csv-${kind}`
                  ? 'A exportar…'
                  : label}
              </button>
            )
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
          Restauro local
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Recuperar uma cópia JSON
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          O ficheiro é validado antes de qualquer alteração. O restauro substitui todos os dados escolares atualmente guardados neste browser.
        </p>

        <input
          ref={
            fileInputRef
          }
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={
            event =>
              void handleFile(
                event
              )
          }
        />

        <button
          type="button"
          disabled={
            Boolean(
              busy
            )
          }
          onClick={() =>
            fileInputRef.current
              ?.click()
          }
          className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-300/15 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ===
          'validate'
            ? 'A validar…'
            : 'Escolher ficheiro JSON'}
        </button>

        {validation ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="grid gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="text-2xl font-black text-white">
                  {
                    validation
                      .summary
                      .academicYears
                  }
                </p>

                <p className="text-xs text-slate-500">
                  Anos letivos
                </p>
              </div>

              <div>
                <p className="text-2xl font-black text-white">
                  {
                    validation
                      .summary
                      .students
                  }
                </p>

                <p className="text-xs text-slate-500">
                  Alunos
                </p>
              </div>

              <div>
                <p className="text-2xl font-black text-white">
                  {
                    validation
                      .summary
                      .lessons
                  }
                </p>

                <p className="text-xs text-slate-500">
                  Aulas
                </p>
              </div>

              <div>
                <p className="text-2xl font-black text-white">
                  {
                    validation
                      .summary
                      .assessmentResults
                  }
                </p>

                <p className="text-xs text-slate-500">
                  Resultados
                </p>
              </div>
            </div>

            {validation
              .issues
              .length >
            0 ? (
              <ul className="mt-4 space-y-2">
                {validation
                  .issues
                  .map(
                    (
                      issue,
                      index
                    ) => (
                      <li
                        key={`${issue.path}-${index}`}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          issue.severity ===
                          'error'
                            ? 'bg-rose-400/10 text-rose-200'
                            : 'bg-amber-400/10 text-amber-200'
                        }`}
                      >
                        {issue.path}: {issue.message}
                      </li>
                    )
                  )}
              </ul>
            ) : (
              <p className="mt-4 text-sm font-bold text-emerald-300">
                Ficheiro válido e pronto a restaurar.
              </p>
            )}

            {validation
              .valid ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={
                    restoreConfirmation
                  }
                  onChange={
                    event =>
                      setRestoreConfirmation(
                        event.target.value
                      )
                  }
                  placeholder="Escreva RESTAURAR"
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/50"
                />

                <button
                  type="button"
                  disabled={
                    Boolean(
                      busy
                    )
                  }
                  onClick={
                    handleRestore
                  }
                  className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ===
                  'restore'
                    ? 'A restaurar…'
                    : 'Restaurar'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-rose-400/20 bg-rose-400/5 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
          Zona de risco
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Apagar dados deste browser
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Esta operação não pode ser anulada. Crie primeiro uma cópia de segurança completa.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={
              resetConfirmation
            }
            onChange={
              event =>
                setResetConfirmation(
                  event.target.value
                )
            }
            placeholder="Escreva APAGAR"
            className="rounded-xl border border-rose-400/20 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-300/50"
          />

          <button
            type="button"
            disabled={
              Boolean(
                busy
              )
            }
            onClick={
              handleReset
            }
            className="rounded-xl bg-rose-400 px-4 py-2.5 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ===
            'reset'
              ? 'A apagar…'
              : 'Apagar tudo'}
          </button>
        </div>
      </section>

      {feedback ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone ===
              'success'
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/20 bg-rose-400/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  )
}

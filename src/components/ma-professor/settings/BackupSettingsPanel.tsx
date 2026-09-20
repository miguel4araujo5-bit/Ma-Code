import {
  useEffect,
  useState
} from 'react'

import {
  createMAProfessorBackup,
  getBackupFileName,
  resetMAProfessorDatabase
} from './backupRepository'

import {
  downloadTextFile,
  exportAttendanceCsv,
  exportGradesCsv,
  exportLessonsCsv,
  exportStudentsCsv
} from './csvExport'

import {
  BackupLocalSafetyPanel
} from './BackupLocalSafetyPanel'

import {
  EncryptedSyncPanel
} from './EncryptedSyncPanel'

import {
  RestoreSettingsPanel
} from './RestoreSettingsPanel'

export type SecuritySection =
  | 'protection'
  | 'backup'
  | 'restore'
  | 'export'
  | 'advanced'
  | 'reset'

interface BackupSettingsPanelProps {
  onDataChanged?: () => void
  initialSection?: SecuritySection
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
    .slice(0, 10)
}

export function BackupSettingsPanel({
  onDataChanged,
  initialSection = 'protection'
}: BackupSettingsPanelProps) {
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
      tone: 'success' | 'error'
      message: string
    } | null>(null)

  const [
    resetConfirmation,
    setResetConfirmation
  ] =
    useState('')

  useEffect(() => {
    if (
      initialSection ===
      'protection'
    ) {
      return
    }

    const targetId =
      initialSection ===
        'reset'
        ? 'ma-professor-security-reset'
        : `ma-professor-security-${initialSection}`

    const frame =
      window.requestAnimationFrame(
        () => {
          const target =
            document.getElementById(
              targetId
            )

          if (
            initialSection ===
              'reset' &&
            target instanceof
              HTMLDetailsElement
          ) {
            target.open = true
          }

          target?.scrollIntoView({
            block: 'start'
          })
        }
      )

    return () => {
      window.cancelAnimationFrame(
        frame
      )
    }
  }, [
    initialSection
  ])

  const run =
    async (
      key: string,
      operation: () => Promise<void>,
      successMessage?: string
    ) => {
      setBusy(key)
      setFeedback(null)

      try {
        await operation()

        if (successMessage) {
          setFeedback({
            tone: 'success',
            message: successMessage
          })
        }
      } catch (error) {
        setFeedback({
          tone: 'error',
          message:
            getErrorMessage(error)
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
        'Cópia de segurança descarregada para este dispositivo.'
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
            exports[kind]

          downloadTextFile(
            selected.name,
            selected.content,
            'text/csv;charset=utf-8'
          )
        },
        'Ficheiro CSV exportado.'
      )

  const handleReset =
    () => {
      if (
        resetConfirmation
          .trim()
          .toUpperCase() !==
        'APAGAR'
      ) {
        setFeedback({
          tone: 'error',
          message:
            'Escreva APAGAR para confirmar.'
        })
        return
      }

      void run(
        'reset',
        async () => {
          await resetMAProfessorDatabase()
          setResetConfirmation('')
          onDataChanged?.()
        },
        'Todos os dados escolares foram eliminados deste browser.'
      )
    }

  return (
    <div
      className="space-y-8"
      data-initial-security-section={
        initialSection
      }
    >
      <section
        id="ma-professor-security-restore"
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            Restaurar
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Restaurar uma cópia
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Escolha onde está a cópia que pretende recuperar. Nenhum dado atual é substituído sem validação e confirmação.
          </p>
        </div>

        <RestoreSettingsPanel
          onDataChanged={
            onDataChanged
          }
        />
      </section>

      <section
        id="ma-professor-security-backup"
        className="scroll-mt-24 space-y-4"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Cópias de segurança
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Criar uma cópia de segurança
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Escolha se quer guardar a cópia na nuvem ou descarregá-la para este dispositivo.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Proteção automática: escolha abaixo se pretende ativar a cópia online neste dispositivo. Desativá-la mantém disponíveis as cópias já guardadas e o restauro.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <EncryptedSyncPanel />

          <section className="h-full rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Dispositivo
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Descarregar cópia de segurança para o seu dispositivo
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cria um ficheiro completo com anos letivos, turmas, alunos, planificações, aulas, sumários, faltas, avaliações e definições para guardar onde quiser.
            </p>

            <p className="mt-2 text-xs leading-5 text-amber-200/80">
              Esta cópia local não está cifrada. Guarde-a apenas num local seguro.
            </p>

            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void handleJsonExport()
              }
              className="mt-5 w-full rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {busy === 'json'
                ? 'A criar e descarregar…'
                : 'Descarregar cópia de segurança para o seu dispositivo'}
            </button>
          </section>
        </div>
      </section>

      <section
        id="ma-professor-security-export"
        className="scroll-mt-24 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6"
      >
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
          Exportar
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Abrir dados no Excel
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Esta área não cria uma cópia de segurança. Serve apenas para exportar listas ou registos específicos em CSV.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['students', 'Alunos'],
              ['lessons', 'Sumários'],
              ['attendance', 'Faltas'],
              ['grades', 'Avaliações']
            ] as const
          ).map(
            ([kind, label]) => (
              <button
                key={kind}
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void handleCsvExport(kind)
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-black text-slate-200 transition hover:border-violet-300/30 hover:bg-violet-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                {busy === `csv-${kind}`
                  ? 'A exportar…'
                  : label}
              </button>
            )
          )}
        </div>
      </section>

      <section
        id="ma-professor-security-advanced"
        className="scroll-mt-24 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6"
      >
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
          Opções avançadas
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Armazenamento local e operações sensíveis
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Estas opções não são necessárias no uso normal. Abra-as apenas quando precisar de verificar o armazenamento do browser ou eliminar os dados locais.
        </p>

        <div className="mt-5 space-y-3">
          <details className="group rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <summary className="cursor-pointer list-none text-sm font-black text-slate-200">
              <span className="flex items-center justify-between gap-3">
                <span>
                  Armazenamento local e navegação privada
                </span>
                <span
                  aria-hidden="true"
                  className="text-slate-500 transition group-open:rotate-180"
                >
                  ↓
                </span>
              </span>
            </summary>

            <div className="mt-4">
              <BackupLocalSafetyPanel />
            </div>
          </details>

          <details
            id="ma-professor-security-reset"
            className="group scroll-mt-24 rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-4"
          >
            <summary className="cursor-pointer list-none text-sm font-black text-rose-200">
              <span className="flex items-center justify-between gap-3">
                <span>
                  Apagar dados deste browser
                </span>
                <span
                  aria-hidden="true"
                  className="text-rose-300/60 transition group-open:rotate-180"
                >
                  ↓
                </span>
              </span>
            </summary>

            <div className="mt-4 border-t border-rose-400/10 pt-4">
              <p className="text-sm leading-6 text-slate-400">
                Esta operação não pode ser anulada. Confirme que tem uma cópia de segurança antes de continuar.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={event =>
                    setResetConfirmation(
                      event.target.value
                    )
                  }
                  placeholder="Escreva APAGAR"
                  className="rounded-xl border border-rose-400/20 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-300/50"
                />

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={handleReset}
                  className="rounded-xl bg-rose-400 px-4 py-2.5 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy === 'reset'
                    ? 'A apagar…'
                    : 'Apagar tudo'}
                </button>
              </div>
            </div>
          </details>
        </div>
      </section>

      {feedback ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone === 'success'
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

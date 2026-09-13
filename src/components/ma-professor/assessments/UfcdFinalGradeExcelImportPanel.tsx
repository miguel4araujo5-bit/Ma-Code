import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState
} from 'react'

import type {
  EntityId
} from '../types'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import {
  readUfcdFinalGradeExcelFile,
  type UfcdFinalGradeImportDraftChanges,
  type UfcdFinalGradeImportPreview,
  type UfcdFinalGradeImportPreviewRow
} from './ufcdFinalGradeExcelImport'

interface Props {
  snapshot: AssessmentWorkspaceSnapshot
  disabled?: boolean
  onApplyDraft: (
    studentId: EntityId,
    changes: UfcdFinalGradeImportDraftChanges
  ) => void
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

function rowStatusLabel(
  row: UfcdFinalGradeImportPreviewRow
) {
  switch (row.status) {
    case 'matched':
      return row.matchedBy === 'both'
        ? 'Correspondência por número e nome'
        : row.matchedBy === 'number'
          ? 'Correspondência por número'
          : 'Correspondência por nome'

    case 'unmatched':
      return 'Aluno não encontrado'

    case 'ambiguous':
      return 'Correspondência ambígua'

    default:
      return 'Sem campos importáveis'
  }
}

function rowStatusClass(
  row: UfcdFinalGradeImportPreviewRow
) {
  switch (row.status) {
    case 'matched':
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'

    case 'unmatched':
    case 'ambiguous':
      return 'border-amber-300/20 bg-amber-300/10 text-amber-100'

    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400'
  }
}

function formatImportedChanges(
  row: UfcdFinalGradeImportPreviewRow
) {
  const parts: string[] = []

  if (
    row.draftChanges.usesAcs !==
    undefined
  ) {
    parts.push(
      row.draftChanges.usesAcs
        ? 'ACS: sim'
        : 'ACS: não'
    )
  }

  if (
    row.draftChanges
      .selfAssessmentGrade !==
    undefined
  ) {
    parts.push(
      `Autoavaliação: ${row.draftChanges.selfAssessmentGrade}`
    )
  }

  if (
    row.draftChanges.finalGrade !==
    undefined
  ) {
    parts.push(
      `Nível final: ${row.draftChanges.finalGrade}`
    )
  }

  return parts.join(' · ')
}

export default function UfcdFinalGradeExcelImportPanel({
  snapshot,
  disabled = false,
  onApplyDraft
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const [
    preview,
    setPreview
  ] =
    useState<UfcdFinalGradeImportPreview | null>(
      null
    )

  const [
    reading,
    setReading
  ] =
    useState(false)

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback>(null)

  useEffect(() => {
    setPreview(null)
    setFeedback(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [
    snapshot.selectedAssignment?.id,
    snapshot.selectedModule?.id
  ])

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    setReading(true)
    setFeedback(null)
    setPreview(null)

    try {
      const nextPreview =
        await readUfcdFinalGradeExcelFile(
          file,
          snapshot
        )

      setPreview(
        nextPreview
      )
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível analisar a grelha Excel.'
      })
    } finally {
      setReading(false)
    }
  }

  function applyPreview() {
    if (
      !preview ||
      preview.blockingErrors.length > 0 ||
      preview.matchedCount === 0 ||
      disabled ||
      reading
    ) {
      return
    }

    let applied = 0

    preview.rows.forEach(row => {
      if (
        row.status !== 'matched' ||
        !row.studentId
      ) {
        return
      }

      onApplyDraft(
        row.studentId,
        row.draftChanges
      )

      applied += 1
    })

    setFeedback({
      tone: 'success',
      message:
        `${applied} aluno(s) foram colocados em rascunho. Reveja a grelha e guarde as classificações antes de sair.`
    })
  }

  const canImport =
    Boolean(
      snapshot.selectedModule &&
      snapshot.selectedGroup &&
      snapshot.studentRows.length > 0
    )

  return (
    <section className="overflow-hidden rounded-[2rem] border border-sky-300/15 bg-slate-950/70 shadow-xl shadow-black/20">
      <div className="border-b border-white/10 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">
              Importar grelha Excel
            </p>

            <h2 className="mt-2 text-lg font-black text-white">
              Pré-visualização antes de alterar classificações
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Aceita .xlsx, .xlsm e .xls. O ficheiro é lido apenas neste dispositivo. ACS, Autoavaliação e Nível Final entram primeiro como rascunho; os domínios e o Nível Automático continuam a ser calculados pelo MA-Professor.
            </p>
          </div>

          <label
            className={`inline-flex shrink-0 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-black transition ${
              disabled ||
              reading ||
              !canImport
                ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-600'
                : 'cursor-pointer border-sky-200/25 bg-sky-300/10 text-sky-50 hover:bg-sky-300/15'
            }`}
          >
            {reading
              ? 'A analisar…'
              : 'Selecionar Excel'}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12"
              disabled={
                disabled ||
                reading ||
                !canImport
              }
              onChange={event =>
                void handleFileChange(
                  event
                )
              }
              className="sr-only"
            />
          </label>
        </div>

        {disabled ? (
          <p className="mt-3 text-xs font-semibold text-amber-200/80">
            Guarde ou descarte os rascunhos atuais antes de importar outra grelha.
          </p>
        ) : null}
      </div>

      {feedback ? (
        <div
          role={
            feedback.tone === 'error'
              ? 'alert'
              : 'status'
          }
          className={`mx-5 mt-5 rounded-xl border p-3 text-xs font-semibold leading-5 sm:mx-7 ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-100'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-5 px-5 py-5 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                Ficheiro
              </p>
              <p className="mt-1 truncate text-xs font-black text-slate-200">
                {preview.fileName}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                Folha detetada
              </p>
              <p className="mt-1 text-xs font-black text-slate-200">
                {preview.sheetName}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-emerald-200/70">
                Correspondências
              </p>
              <p className="mt-1 text-lg font-black text-emerald-100">
                {preview.matchedCount}
              </p>
            </div>

            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-amber-200/70">
                A rever
              </p>
              <p className="mt-1 text-lg font-black text-amber-100">
                {preview.unmatchedCount +
                  preview.ambiguousCount +
                  preview.invalidCount}
              </p>
            </div>
          </div>

          {preview.blockingErrors.length > 0 ? (
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-4">
              <p className="text-xs font-black text-rose-100">
                Esta grelha não pode ser aplicada à UFCD selecionada.
              </p>

              <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-100/80">
                {preview.blockingErrors.map(
                  message => (
                    <li key={message}>
                      • {message}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
              <ul className="space-y-1 text-xs leading-5 text-amber-100/80">
                {preview.warnings.map(
                  message => (
                    <li key={message}>
                      • {message}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}

          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {preview.rows.map(row => (
              <article
                key={`${row.sourceRow}-${row.studentNumber}-${row.studentName}`}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-white">
                      {row.studentNumber
                        ? `N.º ${row.studentNumber} · `
                        : ''}
                      {row.studentName ||
                        'Aluno sem nome'}
                    </p>

                    {row.matchedStudentName &&
                    row.matchedStudentName !==
                      row.studentName ? (
                      <p className="mt-1 text-[0.68rem] text-slate-500">
                        Correspondente no MA-Professor: {row.matchedStudentName}
                      </p>
                    ) : null}

                    {formatImportedChanges(row) ? (
                      <p className="mt-1 text-[0.68rem] font-semibold text-slate-400">
                        {formatImportedChanges(row)}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.07em] ${rowStatusClass(row)}`}
                  >
                    {rowStatusLabel(row)}
                  </span>
                </div>

                {row.warnings.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-[0.65rem] leading-5 text-amber-100/70">
                    {row.warnings.map(
                      warning => (
                        <li key={warning}>
                          • {warning}
                        </li>
                      )
                    )}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-5 text-slate-500">
              Aplicar não grava na base de dados. Apenas preenche os rascunhos da grelha atual para poder confirmar cada valor antes de guardar.
            </p>

            <button
              type="button"
              onClick={applyPreview}
              disabled={
                disabled ||
                reading ||
                preview.blockingErrors.length > 0 ||
                preview.matchedCount === 0
              }
              className="shrink-0 rounded-xl bg-sky-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-600"
            >
              Aplicar ao rascunho
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-5 text-xs leading-6 text-slate-500 sm:px-7">
          O importador procura automaticamente a folha da grelha final, incluindo nomes como PRINTCFP/CFP. O ficheiro original nunca é alterado.
        </div>
      )}
    </section>
  )
}

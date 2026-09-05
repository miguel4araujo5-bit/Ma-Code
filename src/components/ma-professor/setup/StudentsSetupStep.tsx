import {
  type FormEvent,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot,
  type StudentDraft
} from '../repository'

import type {
  EntityId,
  Student
} from '../types'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'

type StudentsSetupStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
}

type StudentFormRow = {
  localId: string
  number: string
  name: string
  notes: string
  persisted: boolean
}

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-900/85 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-55'

const textareaClassName =
  'min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

const discardStudentDraftMessage =
  'Existem alterações por guardar nos alunos desta turma. Se continuar, essas alterações serão perdidas. Pretende continuar?'

const discardNewStudentWorkMessage =
  'Existem alunos novos ou texto de importação por guardar. Se limpar, esses dados serão perdidos. Pretende continuar?'

function createLocalId() {
  const uuid =
    globalThis.crypto?.randomUUID?.()

  if (uuid) {
    return uuid
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function createEmptyStudentRow(): StudentFormRow {
  return {
    localId: createLocalId(),
    number: '',
    name: '',
    notes: '',
    persisted: false
  }
}

function createStudentRow(
  student: Student
): StudentFormRow {
  return {
    localId: student.id,
    number: student.number,
    name: student.name,
    notes: student.notes,
    persisted: true
  }
}

function normalizeComparisonText(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')
}

function sortStudents(
  students: Student[]
) {
  return [...students].sort(
    (
      left,
      right
    ) =>
      left.number.localeCompare(
        right.number,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function getStudentsForGroup(
  snapshot: SetupSnapshot,
  groupId: EntityId
) {
  return sortStudents(
    snapshot.students.filter(
      (
        student
      ) =>
        student.groupId ===
          groupId &&
        student.active
    )
  )
}

function buildRowsForGroup(
  snapshot: SetupSnapshot,
  groupId: EntityId
) {
  const students =
    getStudentsForGroup(
      snapshot,
      groupId
    )

  if (
    students.length ===
    0
  ) {
    return [
      createEmptyStudentRow()
    ]
  }

  return students.map(
    createStudentRow
  )
}

function getInitialGroupId(
  snapshot: SetupSnapshot
) {
  const activeGroups =
    snapshot.groups.filter(
      (
        group
      ) =>
        group.active
    )

  const firstGroupWithoutStudents =
    activeGroups.find(
      (
        group
      ) =>
        !snapshot.students.some(
          (
            student
          ) =>
            student.active &&
            student.groupId ===
              group.id
        )
    )

  return (
    firstGroupWithoutStudents?.id ??
    activeGroups[0]?.id ??
    ''
  )
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

function isMeaningfulRow(
  row: StudentFormRow
) {
  return Boolean(
    row.number.trim() ||
      row.name.trim() ||
      row.notes.trim()
  )
}

function parseStudentLine(
  value: string,
  lineNumber: number
): StudentFormRow {
  const line =
    value.trim()

  const separatedMatch =
    line.match(
      /^([^;\t,]+)[;\t,]\s*(.+)$/
    )

  if (
    separatedMatch
  ) {
    return {
      localId:
        createLocalId(),
      number:
        separatedMatch[1].trim(),
      name:
        separatedMatch[2].trim(),
      notes: '',
      persisted: false
    }
  }

  const whitespaceMatch =
    line.match(
      /^(\S+)\s+(.+)$/
    )

  if (
    whitespaceMatch
  ) {
    return {
      localId:
        createLocalId(),
      number:
        whitespaceMatch[1].trim(),
      name:
        whitespaceMatch[2].trim(),
      notes: '',
      persisted: false
    }
  }

  throw new Error(
    `Não foi possível interpretar a linha ${lineNumber}. Utilize o formato “número; nome”.`
  )
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-200">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-xs font-medium text-slate-500">
          Opcional
        </span>
      ) : null}
    </span>
  )
}

function GroupStatus({
  configured
}: {
  configured: boolean
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
        configured
          ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
          : 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
      }`}
    >
      {configured
        ? 'Configurada'
        : 'Sem alunos'}
    </span>
  )
}

export default function StudentsSetupStep({
  snapshot,
  onSnapshotChange,
  onCompleted
}: StudentsSetupStepProps) {
  const rootRef =
    useRef<HTMLDivElement>(null)

  const initialGroupId =
    getInitialGroupId(
      snapshot
    )

  const [
    selectedGroupId,
    setSelectedGroupId
  ] =
    useState<EntityId>(
      initialGroupId
    )

  const [
    rows,
    setRows
  ] =
    useState<
      StudentFormRow[]
    >(() =>
      buildRowsForGroup(
        snapshot,
        initialGroupId
      )
    )

  const [
    importText,
    setImportText
  ] =
    useState('')

  const [
    busy,
    setBusy
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  const [
    success,
    setSuccess
  ] =
    useState('')

  const activeGroups =
    useMemo(
      () =>
        snapshot.groups
          .filter(
            (
              group
            ) =>
              group.active
          )
          .sort(
            (
              left,
              right
            ) =>
              left.name.localeCompare(
                right.name,
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
          ),
      [
        snapshot.groups
      ]
    )

  const studentsByGroup =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          Student[]
        >()

      activeGroups.forEach(
        (
          group
        ) => {
          result.set(
            group.id,
            []
          )
        }
      )

      snapshot.students
        .filter(
          (
            student
          ) =>
            student.active
        )
        .forEach(
          (
            student
          ) => {
            const current =
              result.get(
                student.groupId
              ) ??
              []

            current.push(
              student
            )

            result.set(
              student.groupId,
              current
            )
          }
        )

      result.forEach(
        (
          students
        ) => {
          students.sort(
            (
              left,
              right
            ) =>
              left.number.localeCompare(
                right.number,
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
          )
        }
      )

      return result
    }, [
      activeGroups,
      snapshot.students
    ])

  const selectedGroup =
    useMemo(
      () =>
        activeGroups.find(
          (
            group
          ) =>
            group.id ===
            selectedGroupId
        ) ??
        null,
      [
        activeGroups,
        selectedGroupId
      ]
    )

  const groupsWithoutStudents =
    useMemo(
      () =>
        activeGroups.filter(
          (
            group
          ) =>
            (
              studentsByGroup.get(
                group.id
              ) ??
              []
            ).length ===
            0
        ),
      [
        activeGroups,
        studentsByGroup
      ]
    )

  const totalStudents =
    useMemo(
      () =>
        Array.from(
          studentsByGroup.values()
        ).reduce(
          (
            total,
            students
          ) =>
            total +
            students.length,
          0
        ),
      [
        studentsByGroup
      ]
    )

  const meaningfulRows =
    useMemo(
      () =>
        rows.filter(
          isMeaningfulRow
        ),
      [
        rows
      ]
    )

  const persistedStudentsById =
    useMemo(
      () =>
        new Map(
          (
            studentsByGroup.get(
              selectedGroupId
            ) ??
            []
          ).map(
            (
              student
            ) => [
              student.id,
              student
            ]
          )
        ),
      [
        selectedGroupId,
        studentsByGroup
      ]
    )

  const hasUnsavedNewStudentRows =
    rows.some(
      (
        row
      ) =>
        !row.persisted &&
        isMeaningfulRow(row)
    )

  const hasDirtyPersistedStudentRows =
    rows.some(
      (
        row
      ) => {
        if (!row.persisted) {
          return false
        }

        const persistedStudent =
          persistedStudentsById.get(
            row.localId
          )

        return Boolean(
          persistedStudent &&
          (
            row.name !==
              persistedStudent.name ||
            row.notes !==
              persistedStudent.notes
          )
        )
      }
    )

  const hasPendingStudentImport =
    Boolean(
      importText.trim()
    )

  const hasUnsavedStudentsSetupChanges =
    hasUnsavedNewStudentRows ||
    hasDirtyPersistedStudentRows ||
    hasPendingStudentImport

  const hasDiscardableNewStudentWork =
    hasUnsavedNewStudentRows ||
    hasPendingStudentImport

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedStudentsSetupChanges,
    rootRef,
    discardStudentDraftMessage
  )

  async function refreshSnapshot() {
    const nextSnapshot =
      await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )

    onSnapshotChange(
      nextSnapshot
    )

    return nextSnapshot
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function confirmDiscardStudentDraft() {
    return (
      !hasUnsavedStudentsSetupChanges ||
      window.confirm(
        discardStudentDraftMessage
      )
    )
  }

  function confirmDiscardNewStudentWork() {
    return (
      !hasDiscardableNewStudentWork ||
      window.confirm(
        discardNewStudentWorkMessage
      )
    )
  }

  function selectGroup(
    groupId: EntityId
  ) {
    setSelectedGroupId(
      groupId
    )

    setRows(
      buildRowsForGroup(
        snapshot,
        groupId
      )
    )

    setImportText('')
    clearMessages()

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  function requestSelectGroup(
    groupId: EntityId
  ) {
    if (
      busy ||
      groupId ===
        selectedGroupId
    ) {
      return
    }

    if (
      !confirmDiscardStudentDraft()
    ) {
      return
    }

    selectGroup(
      groupId
    )
  }

  function updateRow(
    localId: string,
    changes: Partial<
      Pick<
        StudentFormRow,
        | 'number'
        | 'name'
        | 'notes'
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
            row.localId ===
            localId
              ? {
                  ...row,
                  ...changes
                }
              : row
        )
    )

    clearMessages()
  }

  function addStudentRow() {
    setRows(
      (
        current
      ) => [
        ...current,
        createEmptyStudentRow()
      ]
    )

    clearMessages()
  }

  function removeStudentRow(
    localId: string
  ) {
    const row =
      rows.find(
        (
          current
        ) =>
          current.localId ===
          localId
      )

    if (
      row?.persisted
    ) {
      setError(
        'Os alunos já guardados não são eliminados durante a configuração inicial. Pode corrigir o nome e as observações.'
      )

      return
    }

    setRows(
      (
        current
      ) => {
        const remaining =
          current.filter(
            (
              currentRow
            ) =>
              currentRow.localId !==
              localId
          )

        return remaining.length >
          0
          ? remaining
          : [
              createEmptyStudentRow()
            ]
      }
    )

    clearMessages()
  }

  function clearUnsavedRows() {
    const persistedRows =
      rows.filter(
        (
          row
        ) =>
          row.persisted
      )

    setRows(
      persistedRows.length >
        0
        ? persistedRows
        : [
            createEmptyStudentRow()
          ]
    )

    setImportText('')
    clearMessages()
  }

  function requestClearUnsavedRows() {
    if (
      busy ||
      !confirmDiscardNewStudentWork()
    ) {
      return
    }

    clearUnsavedRows()
  }

  function importStudents() {
    try {
      const lines =
        importText
          .split(/\r?\n/)
          .map(
            (
              line
            ) =>
              line.trim()
          )
          .filter(Boolean)

      if (
        lines.length ===
        0
      ) {
        throw new Error(
          'Cole pelo menos um aluno antes de importar.'
        )
      }

      const importedRows =
        lines.map(
          (
            line,
            index
          ) =>
            parseStudentLine(
              line,
              index +
                1
            )
        )

      const existingNumbers =
        new Set(
          meaningfulRows
            .map(
              (
                row
              ) =>
                normalizeComparisonText(
                  row.number
                )
            )
            .filter(Boolean)
        )

      const duplicatedNumbers =
        new Set<string>()

      importedRows.forEach(
        (
          row
        ) => {
          const normalizedNumber =
            normalizeComparisonText(
              row.number
            )

          if (
            existingNumbers.has(
              normalizedNumber
            )
          ) {
            duplicatedNumbers.add(
              row.number
            )
          }

          existingNumbers.add(
            normalizedNumber
          )
        }
      )

      if (
        duplicatedNumbers.size >
        0
      ) {
        throw new Error(
          `Existem números repetidos na importação: ${Array.from(
            duplicatedNumbers
          ).join(', ')}.`
        )
      }

      setRows(
        (
          current
        ) => {
          const hasOnlyEmptyRow =
            current.length ===
              1 &&
            !isMeaningfulRow(
              current[0]
            )

          return hasOnlyEmptyRow
            ? importedRows
            : [
                ...current,
                ...importedRows
              ]
        }
      )

      setImportText('')
      setError('')

      setSuccess(
        `${importedRows.length} ${
          importedRows.length ===
          1
            ? 'aluno importado'
            : 'alunos importados'
        }. Confirme os dados e guarde a turma.`
      )
    } catch (
      importError
    ) {
      setError(
        getErrorMessage(
          importError
        )
      )

      setSuccess('')
    }
  }

  function validateRows():
    StudentDraft[] {
    if (
      !selectedGroupId
    ) {
      throw new Error(
        'Selecione uma turma.'
      )
    }

    const rowsToSave =
      rows.filter(
        isMeaningfulRow
      )

    if (
      rowsToSave.length ===
      0
    ) {
      throw new Error(
        'Adicione pelo menos um aluno à turma.'
      )
    }

    const seenNumbers =
      new Set<string>()

    return rowsToSave.map(
      (
        row,
        index
      ) => {
        const number =
          row.number
            .trim()
            .replace(
              /\s+/g,
              ' '
            )

        const name =
          row.name
            .trim()
            .replace(
              /\s+/g,
              ' '
            )

        if (
          !number
        ) {
          throw new Error(
            `Indique o número do aluno na linha ${index + 1}.`
          )
        }

        if (
          !name
        ) {
          throw new Error(
            `Indique o nome do aluno na linha ${index + 1}.`
          )
        }

        const normalizedNumber =
          normalizeComparisonText(
            number
          )

        if (
          seenNumbers.has(
            normalizedNumber
          )
        ) {
          throw new Error(
            `O número de aluno “${number}” está repetido.`
          )
        }

        seenNumbers.add(
          normalizedNumber
        )

        return {
          number,
          name,
          notes:
            row.notes
        }
      }
    )
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      busy
    ) {
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const drafts =
        validateRows()

      await maProfessorRepository.saveStudentsForGroup(
        snapshot.academicYear.id,
        selectedGroupId,
        drafts
      )

      const nextSnapshot =
        await refreshSnapshot()

      setRows(
        buildRowsForGroup(
          nextSnapshot,
          selectedGroupId
        )
      )

      setImportText('')

      setSuccess(
        `${drafts.length} ${
          drafts.length ===
          1
            ? 'aluno guardado'
            : 'alunos guardados'
        } com sucesso.`
      )
    } catch (
      submitError
    ) {
      setError(
        getErrorMessage(
          submitError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    if (
      busy
    ) {
      return
    }

    if (
      hasUnsavedStudentsSetupChanges
    ) {
      setError(
        'Existem alterações por guardar neste passo. Guarde os alunos desta turma ou descarte o trabalho pendente antes de continuar.'
      )

      return
    }

    if (
      totalStudents ===
      0
    ) {
      setError(
        'Adicione os alunos antes de continuar.'
      )

      return
    }

    if (
      groupsWithoutStudents.length >
      0
    ) {
      setError(
        `Ainda faltam alunos em: ${groupsWithoutStudents
          .map(
            (
              group
            ) =>
              group.name
          )
          .join(', ')}.`
      )

      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'students'
      )

      const nextSnapshot =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      onSnapshotChange(
        nextSnapshot
      )

      onCompleted(
        nextSnapshot
      )
    } catch (
      continueError
    ) {
      setError(
        getErrorMessage(
          continueError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  if (
    activeGroups.length ===
    0
  ) {
    return (
      <div className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[0.06] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          Passo 8 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black text-white">
          Não existem turmas ativas.
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Regresse ao passo das turmas e adicione pelo menos uma turma
          antes de configurar os alunos.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Passo 8 de 9
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Alunos
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Adicione o número e o nome de cada aluno. Estes dados serão
          utilizados nas presenças, faltas, avaliações, classificações
          e recuperações de aprendizagens.
        </p>

        <div className="mt-7">
          <label className="block">
            <FieldLabel>
              Turma
            </FieldLabel>

            <select
              value={
                selectedGroupId
              }
              onChange={(
                event
              ) =>
                requestSelectGroup(
                  event.target.value
                )
              }
              required
              disabled={
                busy
              }
              className={
                inputClassName
              }
            >
              {activeGroups.map(
                (
                  group
                ) => {
                  const studentCount =
                    (
                      studentsByGroup.get(
                        group.id
                      ) ??
                      []
                    ).length

                  return (
                    <option
                      key={
                        group.id
                      }
                      value={
                        group.id
                      }
                    >
                      {group.name}
                      {' — '}
                      {studentCount}
                      {' '}
                      {studentCount ===
                      1
                        ? 'aluno'
                        : 'alunos'}
                    </option>
                  )
                }
              )}
            </select>
          </label>

          {selectedGroup ? (
            <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                Turma selecionada
              </p>

              <p className="mt-2 text-lg font-black text-white">
                {
                  selectedGroup.name
                }
              </p>

              <p className="mt-1 text-xs leading-6 text-slate-400">
                {selectedGroup.courseName ||
                  'Curso não indicado'}

                {selectedGroup.gradeLevel
                  ? ` · ${selectedGroup.gradeLevel}`
                  : ''}
              </p>
            </div>
          ) : null}
        </div>

        <section className="mt-7 border-t border-white/10 pt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Lista da turma
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                Número e nome
              </h3>
            </div>

            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
              {
                meaningfulRows.length
              }{' '}
              {meaningfulRows.length ===
              1
                ? 'aluno'
                : 'alunos'}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {rows.map(
              (
                row,
                index
              ) => (
                <article
                  key={
                    row.localId
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                        {index +
                          1}
                      </span>

                      <div>
                        <p className="text-sm font-black text-white">
                          Aluno
                        </p>

                        {row.persisted ? (
                          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-emerald-200">
                            Guardado
                          </p>
                        ) : (
                          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                            Novo
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        row.persisted
                      }
                      onClick={() =>
                        removeStudentRow(
                          row.localId
                        )
                      }
                      className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr]">
                    <label className="block">
                      <FieldLabel>
                        Número
                      </FieldLabel>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          row.number
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.localId,
                            {
                              number:
                                event
                                  .target
                                  .value
                            }
                          )
                        }
                        readOnly={
                          row.persisted
                        }
                        placeholder="1"
                        required={
                          isMeaningfulRow(
                            row
                          )
                        }
                        className={`${inputClassName} ${
                          row.persisted
                            ? 'bg-slate-950/70 text-slate-400'
                            : ''
                        }`}
                      />
                    </label>

                    <label className="block">
                      <FieldLabel>
                        Nome completo
                      </FieldLabel>

                      <input
                        type="text"
                        value={
                          row.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.localId,
                            {
                              name:
                                event
                                  .target
                                  .value
                            }
                          )
                        }
                        placeholder="Ana Sofia Silva"
                        autoComplete="off"
                        required={
                          isMeaningfulRow(
                            row
                          )
                        }
                        className={
                          inputClassName
                        }
                      />
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <FieldLabel optional>
                      Observações
                    </FieldLabel>

                    <input
                      type="text"
                      value={
                        row.notes
                      }
                      onChange={(
                        event
                      ) =>
                        updateRow(
                          row.localId,
                          {
                            notes:
                              event
                                .target
                                .value
                          }
                        )
                      }
                      placeholder="Informação pedagógica útil para o professor."
                      autoComplete="off"
                      className={
                        inputClassName
                      }
                    />
                  </label>

                  {row.persisted ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      O número fica protegido para evitar a criação
                      acidental de um registo duplicado.
                    </p>
                  ) : null}
                </article>
              )
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={
                busy
              }
              onClick={
                addStudentRow
              }
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.04] px-5 py-3.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] disabled:opacity-50"
            >
              Adicionar aluno
            </button>

            <button
              type="button"
              disabled={
                busy
              }
              onClick={
                requestClearUnsavedRows
              }
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Limpar novos
            </button>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-violet-300/15 bg-violet-300/[0.045] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Importação rápida
          </p>

          <h3 className="mt-2 text-lg font-black text-white">
            Cole vários alunos
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Utilize uma linha por aluno. Separe o número e o nome com
            ponto e vírgula, tabulação, vírgula ou espaço.
          </p>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 font-mono text-xs leading-6 text-slate-400">
            1; Ana Sofia Silva
            <br />
            2; Bruno Manuel Costa
            <br />
            3; Carla Alexandra Sousa
          </div>

          <textarea
            value={
              importText
            }
            onChange={(
              event
            ) =>
              setImportText(
                event.target.value
              )
            }
            placeholder={`1; Ana Sofia Silva
2; Bruno Manuel Costa
3; Carla Alexandra Sousa`}
            className={`${textareaClassName} mt-4`}
          />

          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              importStudents
            }
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] px-5 py-3.5 text-sm font-black text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-300/[0.12] disabled:opacity-50"
          >
            Importar alunos
          </button>
        </section>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-100"
          >
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            busy ||
            !selectedGroupId
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
        >
          {busy
            ? 'A guardar...'
            : 'Guardar alunos desta turma'}
        </button>
      </form>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Ano letivo
            </p>

            <h3 className="mt-2 text-xl font-black text-white">
              Turmas e alunos
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
              {
                activeGroups.length
              }{' '}
              {activeGroups.length ===
              1
                ? 'turma'
                : 'turmas'}
            </span>

            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100">
              {
                totalStudents
              }{' '}
              {totalStudents ===
              1
                ? 'aluno'
                : 'alunos'}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {activeGroups.map(
            (
              group
            ) => {
              const students =
                studentsByGroup.get(
                  group.id
                ) ??
                []

              const configured =
                students.length >
                0

              const selected =
                group.id ===
                selectedGroupId

              return (
                <article
                  key={
                    group.id
                  }
                  className={`rounded-2xl border p-4 transition ${
                    selected
                      ? 'border-cyan-300/35 bg-cyan-300/[0.075]'
                      : 'border-white/10 bg-white/[0.025]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">
                        {
                          group.name
                        }
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {group.courseName ||
                          'Curso não indicado'}

                        {group.gradeLevel
                          ? ` · ${group.gradeLevel}`
                          : ''}
                      </p>
                    </div>

                    <GroupStatus
                      configured={
                        configured
                      }
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-3">
                    <p className="text-sm font-bold text-slate-300">
                      {
                        students.length
                      }{' '}
                      {students.length ===
                      1
                        ? 'aluno guardado'
                        : 'alunos guardados'}
                    </p>

                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        requestSelectGroup(
                          group.id
                        )
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100 disabled:opacity-50"
                    >
                      {configured
                        ? 'Ver ou editar'
                        : 'Adicionar'}
                    </button>
                  </div>

                  {students.length >
                  0 ? (
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                      {students.map(
                        (
                          student
                        ) => (
                          <div
                            key={
                              student.id
                            }
                            className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3"
                          >
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] px-2 text-xs font-black text-cyan-100">
                              {
                                student.number
                              }
                            </span>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-200">
                                {
                                  student.name
                                }
                              </p>

                              {student.notes ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                  {
                                    student.notes
                                  }
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                </article>
              )
            }
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-4">
          <p className="text-sm font-bold text-violet-100">
            Todas as turmas devem ter alunos.
          </p>

          <p className="mt-2 text-xs leading-6 text-violet-100/65">
            O número do aluno é utilizado para manter o mesmo registo
            quando o nome ou as observações são atualizados.
          </p>
        </div>

        {groupsWithoutStudents.length >
        0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <p className="text-sm font-bold text-amber-100">
              Ainda faltam alunos em{' '}
              {
                groupsWithoutStudents.length
              }{' '}
              {groupsWithoutStudents.length ===
              1
                ? 'turma'
                : 'turmas'}
              .
            </p>

            <p className="mt-2 text-xs leading-6 text-amber-100/70">
              {groupsWithoutStudents
                .map(
                  (
                    group
                  ) =>
                    group.name
                )
                .join(', ')}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={
            busy ||
            totalStudents ===
              0 ||
            groupsWithoutStudents.length >
              0
          }
          onClick={() =>
            void handleContinue()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar alunos e continuar
        </button>
      </section>
    </div>
  )
}

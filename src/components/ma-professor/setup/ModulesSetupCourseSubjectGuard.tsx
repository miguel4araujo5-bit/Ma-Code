import {
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import ModulesSetupStep from './ModulesSetupStep'

type Props = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
  onEditSubjects: () => void
}

const legacyCourseSubjectAliases =
  new Set([
    'ap',
    'tap',
    'apoio psicossocial',
    'tecnico de apoio psicossocial'
  ])

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')
}

export function isLegacyCourseSubjectName(
  value: string
) {
  return legacyCourseSubjectAliases.has(
    normalize(value)
  )
}

export default function ModulesSetupCourseSubjectGuard({
  snapshot,
  onSnapshotChange,
  onCompleted,
  onEditSubjects
}: Props) {
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState('')

  const legacySubjects = useMemo(
    () =>
      snapshot.subjects.filter(
        subject =>
          subject.active &&
          isLegacyCourseSubjectName(
            subject.name
          )
      ),
    [snapshot.subjects]
  )

  const legacySubjectIds = useMemo(
    () =>
      new Set(
        legacySubjects.map(
          subject => subject.id
        )
      ),
    [legacySubjects]
  )

  const groupById = useMemo(
    () =>
      new Map(
        snapshot.groups.map(group => [
          group.id,
          group
        ])
      ),
    [snapshot.groups]
  )

  const regularAssignments = useMemo(
    () =>
      snapshot.teachingAssignments.filter(
        assignment =>
          assignment.active &&
          groupById.get(
            assignment.groupId
          )?.educationType ===
            'regular'
      ),
    [
      groupById,
      snapshot.teachingAssignments
    ]
  )

  const regularAssignmentIds = useMemo(
    () =>
      new Set(
        regularAssignments.map(
          assignment => assignment.id
        )
      ),
    [regularAssignments]
  )

  const legacyAssignments = useMemo(
    () =>
      snapshot.teachingAssignments.filter(
        assignment =>
          assignment.active &&
          legacySubjectIds.has(
            assignment.subjectId
          )
      ),
    [
      legacySubjectIds,
      snapshot.teachingAssignments
    ]
  )

  const legacyAssignmentIds = useMemo(
    () =>
      new Set(
        legacyAssignments.map(
          assignment => assignment.id
        )
      ),
    [legacyAssignments]
  )

  const excludedAssignmentIds = useMemo(
    () =>
      new Set([
        ...legacyAssignmentIds,
        ...regularAssignmentIds
      ]),
    [
      legacyAssignmentIds,
      regularAssignmentIds
    ]
  )

  const remainingAssignments = useMemo(
    () =>
      snapshot.teachingAssignments.filter(
        assignment =>
          !excludedAssignmentIds.has(
            assignment.id
          ) &&
          !legacySubjectIds.has(
            assignment.subjectId
          )
      ),
    [
      excludedAssignmentIds,
      legacySubjectIds,
      snapshot.teachingAssignments
    ]
  )

  const remainingActiveSubjectIds = useMemo(
    () =>
      new Set(
        remainingAssignments
          .filter(
            assignment =>
              assignment.active
          )
          .map(
            assignment =>
              assignment.subjectId
          )
      ),
    [remainingAssignments]
  )

  const filteredSnapshot = useMemo<SetupSnapshot>(
    () => ({
      ...snapshot,
      subjects:
        snapshot.subjects.filter(
          subject =>
            !legacySubjectIds.has(
              subject.id
            ) &&
            (
              !subject.active ||
              remainingActiveSubjectIds.has(
                subject.id
              )
            )
        ),
      teachingAssignments:
        remainingAssignments,
      modules:
        snapshot.modules.filter(
          module =>
            !excludedAssignmentIds.has(
              module.teachingAssignmentId
            )
        )
    }),
    [
      excludedAssignmentIds,
      legacySubjectIds,
      remainingActiveSubjectIds,
      remainingAssignments,
      snapshot
    ]
  )

  const professionalAssignments = useMemo(
    () =>
      remainingAssignments.filter(
        assignment =>
          assignment.active
      ),
    [remainingAssignments]
  )

  const affectedGroups = useMemo(
    () => {
      const names =
        legacyAssignments
          .map(assignment =>
            groupById.get(
              assignment.groupId
            )?.name ?? ''
          )
          .filter(Boolean)

      return Array.from(
        new Set(names)
      )
    },
    [
      groupById,
      legacyAssignments
    ]
  )

  const regularGroupNames = useMemo(
    () =>
      Array.from(
        new Set(
          regularAssignments
            .map(assignment =>
              groupById.get(
                assignment.groupId
              )?.name ?? ''
            )
            .filter(Boolean)
        )
      ),
    [
      groupById,
      regularAssignments
    ]
  )

  async function continueRegularOnly() {
    if (busy) {
      return
    }

    setBusy(true)
    setError('')

    try {
      await maProfessorRepository.completeSetupStep(
        snapshot.academicYear.id,
        'modules'
      )

      const nextSnapshot =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      onSnapshotChange(nextSnapshot)
      onCompleted(nextSnapshot)
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : 'Não foi possível continuar a configuração.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {legacySubjects.length > 0 ? (
        <section className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/[0.06] p-5 text-amber-50 shadow-xl shadow-black/10 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">
            Correção de dados importados anteriormente
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            AP/TAP/Apoio Psicossocial não será tratado como disciplina
          </h2>

          <p className="mt-3 text-sm leading-7 text-amber-50/90">
            Foi encontrada uma entrada antiga guardada como disciplina com a designação {legacySubjects.map(subject => `“${subject.name}”`).join(', ')}. AP, TAP e Apoio Psicossocial identificam o curso Técnico de Apoio Psicossocial neste fluxo e não uma disciplina. Por segurança, esta entrada deixou de ser apresentada como disciplina no passo das UFCD/módulos.
          </p>

          {affectedGroups.length > 0 ? (
            <p className="mt-3 text-sm leading-6 text-amber-100/80">
              Turmas afetadas: {affectedGroups.join(', ')}.
            </p>
          ) : null}

          <p className="mt-3 text-sm leading-7 text-slate-300">
            Nenhum dado foi apagado, convertido ou reassociado automaticamente. O MA-Professor não tenta adivinhar se estes blocos pertencem a Área de Expressões, Animação Sociocultural ou outra disciplina. Pode importar a planificação com a disciplina correta e rever esta entrada no passo “Disciplinas”.
          </p>

          <button
            type="button"
            onClick={onEditSubjects}
            className="mt-4 rounded-xl border border-amber-200/30 bg-amber-200/10 px-4 py-2.5 text-sm font-black text-amber-50 transition hover:bg-amber-200/15"
          >
            Corrigir no passo Disciplinas
          </button>
        </section>
      ) : null}

      {regularAssignments.length > 0 ? (
        <section className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-300/[0.055] p-5 text-emerald-50 shadow-xl shadow-black/10 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
            Ensino regular
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            Não precisa de criar UFCD ou módulos
          </h2>

          <p className="mt-3 text-sm leading-7 text-emerald-50/90">
            Para as turmas de ensino regular, o MA-Professor organiza a disciplina como uma componente anual. A carga prevista será calculada automaticamente a partir do horário semanal, sem lhe pedir uma UFCD artificial.
          </p>

          {regularGroupNames.length > 0 ? (
            <p className="mt-3 text-sm leading-6 text-emerald-100/80">
              Turmas regulares: {regularGroupNames.join(', ')}.
            </p>
          ) : null}
        </section>
      ) : null}

      {professionalAssignments.length > 0 ? (
        <ModulesSetupStep
          snapshot={filteredSnapshot}
          onSnapshotChange={onSnapshotChange}
          onCompleted={onCompleted}
        />
      ) : (
        <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Passo 4 de 9
          </p>

          <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Organização curricular
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            Todas as disciplinas ativas deste ano letivo pertencem a turmas de ensino regular. Não há UFCD ou módulos para introduzir neste passo.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void continueRegularOnly()
            }
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/45 bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-200 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/30 disabled:cursor-wait disabled:opacity-55"
          >
            {busy
              ? 'A guardar...'
              : 'Continuar para o horário semanal'}
          </button>
        </section>
      )}
    </div>
  )
}

import { useMemo } from 'react'

import type {
  SetupSnapshot
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
    'tap'
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

  const filteredSnapshot = useMemo<SetupSnapshot>(
    () => ({
      ...snapshot,
      subjects:
        snapshot.subjects.filter(
          subject =>
            !legacySubjectIds.has(
              subject.id
            )
        ),
      teachingAssignments:
        snapshot.teachingAssignments.filter(
          assignment =>
            !legacySubjectIds.has(
              assignment.subjectId
            )
        ),
      modules:
        snapshot.modules.filter(
          module =>
            !legacyAssignmentIds.has(
              module.teachingAssignmentId
            )
        )
    }),
    [
      legacyAssignmentIds,
      legacySubjectIds,
      snapshot
    ]
  )

  const affectedGroups = useMemo(
    () => {
      const names =
        legacyAssignments
          .map(assignment =>
            snapshot.groups.find(
              group =>
                group.id ===
                assignment.groupId
            )?.name ?? ''
          )
          .filter(Boolean)

      return Array.from(
        new Set(names)
      )
    },
    [
      legacyAssignments,
      snapshot.groups
    ]
  )

  return (
    <div className="space-y-6">
      {legacySubjects.length > 0 ? (
        <section className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/[0.06] p-5 text-amber-50 shadow-xl shadow-black/10 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">
            Correção de dados importados anteriormente
          </p>

          <h2 className="mt-3 text-xl font-black text-white">
            AP/TAP não será tratado como disciplina
          </h2>

          <p className="mt-3 text-sm leading-7 text-amber-50/90">
            Foi encontrada uma entrada antiga guardada como disciplina com a designação {legacySubjects.map(subject => `“${subject.name}”`).join(', ')}. AP/TAP identifica o curso Técnico de Apoio Psicossocial neste fluxo e não uma disciplina. Por segurança, esta entrada deixou de ser apresentada como disciplina no passo das UFCD/módulos.
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

      <ModulesSetupStep
        snapshot={filteredSnapshot}
        onSnapshotChange={onSnapshotChange}
        onCompleted={onCompleted}
      />
    </div>
  )
}

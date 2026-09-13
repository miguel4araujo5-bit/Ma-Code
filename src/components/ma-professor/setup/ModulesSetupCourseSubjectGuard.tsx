import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'

import ModulesSetupStep from './ModulesSetupStep'

import {
  ensureRegularAnnualModules,
  getProfessionalAssignments,
  isRegularAnnualModule,
  isRegularEducationGroup
} from './regularEducationModules'

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

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
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
  const [
    preparingRegularEducation,
    setPreparingRegularEducation
  ] = useState(false)

  const [
    preparationError,
    setPreparationError
  ] = useState('')

  const activeGroupById = useMemo(
    () =>
      new Map(
        snapshot.groups
          .filter(group => group.active)
          .map(group => [
            group.id,
            group
          ])
      ),
    [snapshot.groups]
  )

  const activeAssignments = useMemo(
    () =>
      snapshot.teachingAssignments.filter(
        assignment =>
          assignment.active &&
          activeGroupById.has(
            assignment.groupId
          )
      ),
    [
      activeGroupById,
      snapshot.teachingAssignments
    ]
  )

  const regularAssignments = useMemo(
    () =>
      activeAssignments.filter(
        assignment => {
          const group =
            activeGroupById.get(
              assignment.groupId
            )

          return Boolean(
            group &&
            isRegularEducationGroup(
              group
            )
          )
        }
      ),
    [
      activeAssignments,
      activeGroupById
    ]
  )

  const professionalAssignments = useMemo(
    () =>
      getProfessionalAssignments(
        snapshot.teachingAssignments,
        snapshot.groups
      ),
    [
      snapshot.groups,
      snapshot.teachingAssignments
    ]
  )

  useEffect(() => {
    if (
      regularAssignments.length === 0
    ) {
      return
    }

    let cancelled = false

    async function prepare() {
      setPreparingRegularEducation(true)
      setPreparationError('')

      try {
        const created =
          await ensureRegularAnnualModules(
            snapshot.academicYear.id
          )

        let nextSnapshot =
          created.length > 0
            ? await maProfessorRepository.getSetupSnapshot(
                snapshot.academicYear.id
              )
            : snapshot

        if (
          cancelled
        ) {
          return
        }

        if (
          created.length > 0
        ) {
          onSnapshotChange(
            nextSnapshot
          )
        }

        const remainingProfessionalAssignments =
          getProfessionalAssignments(
            nextSnapshot.teachingAssignments,
            nextSnapshot.groups
          )

        if (
          remainingProfessionalAssignments.length === 0 &&
          !nextSnapshot.progress?.completedSteps.includes(
            'modules'
          )
        ) {
          await maProfessorRepository.completeSetupStep(
            snapshot.academicYear.id,
            'modules'
          )

          nextSnapshot =
            await maProfessorRepository.getSetupSnapshot(
              snapshot.academicYear.id
            )

          if (
            cancelled
          ) {
            return
          }

          onSnapshotChange(
            nextSnapshot
          )
          onCompleted(
            nextSnapshot
          )
        }
      } catch (error) {
        if (!cancelled) {
          setPreparationError(
            getErrorMessage(error)
          )
        }
      } finally {
        if (!cancelled) {
          setPreparingRegularEducation(false)
        }
      }
    }

    void prepare()

    return () => {
      cancelled = true
    }
  }, [
    snapshot.academicYear.id
  ])

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
      professionalAssignments.filter(
        assignment =>
          legacySubjectIds.has(
            assignment.subjectId
          )
      ),
    [
      legacySubjectIds,
      professionalAssignments
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

  const professionalAssignmentIds = useMemo(
    () =>
      new Set(
        professionalAssignments
          .filter(
            assignment =>
              !legacySubjectIds.has(
                assignment.subjectId
              )
          )
          .map(
            assignment => assignment.id
          )
      ),
    [
      legacySubjectIds,
      professionalAssignments
    ]
  )

  const professionalGroupIds = useMemo(
    () =>
      new Set(
        professionalAssignments
          .filter(
            assignment =>
              professionalAssignmentIds.has(
                assignment.id
              )
          )
          .map(
            assignment =>
              assignment.groupId
          )
      ),
    [
      professionalAssignmentIds,
      professionalAssignments
    ]
  )

  const professionalSubjectIds = useMemo(
    () =>
      new Set(
        professionalAssignments
          .filter(
            assignment =>
              professionalAssignmentIds.has(
                assignment.id
              )
          )
          .map(
            assignment =>
              assignment.subjectId
          )
      ),
    [
      professionalAssignmentIds,
      professionalAssignments
    ]
  )

  const professionalModuleIds = useMemo(
    () =>
      new Set(
        snapshot.modules
          .filter(
            module =>
              professionalAssignmentIds.has(
                module.teachingAssignmentId
              ) &&
              !isRegularAnnualModule(
                module
              )
          )
          .map(
            module => module.id
          )
      ),
    [
      professionalAssignmentIds,
      snapshot.modules
    ]
  )

  const filteredSnapshot = useMemo<SetupSnapshot>(
    () => ({
      ...snapshot,
      groups:
        snapshot.groups.filter(
          group =>
            professionalGroupIds.has(
              group.id
            )
        ),
      subjects:
        snapshot.subjects.filter(
          subject =>
            professionalSubjectIds.has(
              subject.id
            ) &&
            !legacySubjectIds.has(
              subject.id
            )
        ),
      teachingAssignments:
        snapshot.teachingAssignments.filter(
          assignment =>
            professionalAssignmentIds.has(
              assignment.id
            )
        ),
      modules:
        snapshot.modules.filter(
          module =>
            professionalAssignmentIds.has(
              module.teachingAssignmentId
            ) &&
            !isRegularAnnualModule(
              module
            )
        ),
      planifications:
        snapshot.planifications.filter(
          planification =>
            professionalAssignmentIds.has(
              planification.teachingAssignmentId
            ) &&
            professionalModuleIds.has(
              planification.moduleId
            )
        )
    }),
    [
      legacySubjectIds,
      professionalAssignmentIds,
      professionalGroupIds,
      professionalModuleIds,
      professionalSubjectIds,
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

  if (
    regularAssignments.length > 0 &&
    professionalAssignments.length === 0
  ) {
    return (
      <section className="rounded-[1.75rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          Organização curricular
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Ensino regular
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          No ensino regular não precisa de criar UFCD ou módulos. O MA-Professor prepara automaticamente uma componente anual técnica para cada disciplina e turma, apenas para manter aulas, planificações e avaliação ligadas ao mesmo motor interno.
        </p>

        {preparationError ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
          >
            {preparationError}
          </div>
        ) : (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-100"
          >
            {preparingRegularEducation
              ? 'A preparar a organização anual das disciplinas…'
              : 'Organização anual preparada. A avançar para o passo seguinte…'}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {regularAssignments.length > 0 ? (
        <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/[0.05] p-5 text-cyan-50 shadow-xl shadow-black/10 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            Ensino regular preparado automaticamente
          </p>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            As turmas de ensino regular não aparecem neste passo: cada disciplina regular utiliza uma componente anual técnica criada automaticamente. A configuração abaixo aplica-se apenas às turmas de ensino profissional.
          </p>

          {preparationError ? (
            <p className="mt-3 text-sm leading-6 text-rose-200">
              {preparationError}
            </p>
          ) : null}
        </section>
      ) : null}

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

      <ModulesSetupStep
        snapshot={filteredSnapshot}
        onSnapshotChange={onSnapshotChange}
        onCompleted={onCompleted}
      />
    </div>
  )
}

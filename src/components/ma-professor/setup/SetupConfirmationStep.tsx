import {
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'

import type {
  EntityId,
  SetupStepId
} from '../types'

type SetupConfirmationStepProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (
    snapshot: SetupSnapshot
  ) => void
  onCompleted: (
    snapshot: SetupSnapshot
  ) => void
  onEditStep?: (
    step: SetupStepId
  ) => void
}

type SetupIssue = {
  id: string
  title: string
  description: string
  step: SetupStepId
}

type SetupMetricProps = {
  label: string
  value: number
  description: string
}

const requiredCompletedSteps: SetupStepId[] = [
  'academic_year',
  'groups',
  'subjects',
  'modules',
  'assessment_criteria',
  'planifications',
  'weekly_schedule',
  'students'
]

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

function formatDate(
  value: string
) {
  if (!value) {
    return '—'
  }

  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  )
}

function formatNumber(
  value: number,
  maximumFractionDigits =
    2
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits
    }
  ).format(value)
}

function getModuleLabel(
  code: string,
  name: string
) {
  return code
    ? `${code} — ${name}`
    : name
}

function SetupMetric({
  label,
  value,
  description
}: SetupMetricProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {formatNumber(
          value,
          0
        )}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  step,
  onEditStep
}: {
  eyebrow: string
  title: string
  description: string
  step?: SetupStepId
  onEditStep?: (
    step: SetupStepId
  ) => void
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </p>

        <h3 className="mt-2 text-xl font-black text-white">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>

      {step &&
      onEditStep ? (
        <button
          type="button"
          onClick={() =>
            onEditStep(
              step
            )
          }
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100"
        >
          Rever
        </button>
      ) : null}
    </div>
  )
}

function StatusBadge({
  ready,
  readyLabel =
    'Configurado',
  pendingLabel =
    'Incompleto'
}: {
  ready: boolean
  readyLabel?: string
  pendingLabel?: string
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
        ready
          ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
          : 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
      }`}
    >
      {ready
        ? readyLabel
        : pendingLabel}
    </span>
  )
}

export default function SetupConfirmationStep({
  snapshot,
  onSnapshotChange,
  onCompleted,
  onEditStep
}: SetupConfirmationStepProps) {
  const [
    confirmedReview,
    setConfirmedReview
  ] =
    useState(false)

  const [
    confirmedLocalStorage,
    setConfirmedLocalStorage
  ] =
    useState(false)

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

  const activeSubjects =
    useMemo(
      () =>
        snapshot.subjects.filter(
          (
            subject
          ) =>
            subject.active
        ),
      [
        snapshot.subjects
      ]
    )

  const activeAssignments =
    useMemo(
      () =>
        snapshot
          .teachingAssignments
          .filter(
            (
              assignment
            ) =>
              assignment.active
          )
          .sort(
            (
              left,
              right
            ) =>
              left.displayName.localeCompare(
                right.displayName,
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
          ),
      [
        snapshot
          .teachingAssignments
      ]
    )

  const activeModules =
    useMemo(
      () =>
        snapshot.modules.filter(
          (
            module
          ) =>
            module.active
        ),
      [
        snapshot.modules
      ]
    )

  const activeStudents =
    useMemo(
      () =>
        snapshot.students.filter(
          (
            student
          ) =>
            student.active
        ),
      [
        snapshot.students
      ]
    )

  const activeSchemes =
    useMemo(
      () =>
        snapshot
          .assessmentSchemes
          .filter(
            (
              scheme
            ) =>
              scheme.active
          ),
      [
        snapshot
          .assessmentSchemes
      ]
    )

  const activeCriteria =
    useMemo(
      () =>
        snapshot
          .assessmentCriteria
          .filter(
            (
              criterion
            ) =>
              criterion.active
          ),
      [
        snapshot
          .assessmentCriteria
      ]
    )

  const activePlanifications =
    useMemo(
      () =>
        snapshot.planifications.filter(
          (
            planification
          ) =>
            planification.active
        ),
      [
        snapshot.planifications
      ]
    )

  const activeScheduleSlots =
    useMemo(
      () =>
        snapshot
          .weeklyScheduleSlots
          .filter(
            (
              slot
            ) =>
              slot.active
          ),
      [
        snapshot
          .weeklyScheduleSlots
      ]
    )

  const groupById =
    useMemo(
      () =>
        new Map(
          activeGroups.map(
            (
              group
            ) => [
              group.id,
              group
            ]
          )
        ),
      [
        activeGroups
      ]
    )

  const subjectById =
    useMemo(
      () =>
        new Map(
          activeSubjects.map(
            (
              subject
            ) => [
              subject.id,
              subject
            ]
          )
        ),
      [
        activeSubjects
      ]
    )

  const studentsByGroup =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof activeStudents
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

      activeStudents.forEach(
        (
          student
        ) => {
          const students =
            result.get(
              student.groupId
            ) ??
            []

          students.push(
            student
          )

          result.set(
            student.groupId,
            students
          )
        }
      )

      return result
    }, [
      activeGroups,
      activeStudents
    ])

  const modulesByAssignment =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof activeModules
        >()

      activeAssignments.forEach(
        (
          assignment
        ) => {
          result.set(
            assignment.id,
            []
          )
        }
      )

      activeModules.forEach(
        (
          module
        ) => {
          const modules =
            result.get(
              module.teachingAssignmentId
            ) ??
            []

          modules.push(
            module
          )

          result.set(
            module.teachingAssignmentId,
            modules
          )
        }
      )

      result.forEach(
        (
          modules
        ) => {
          modules.sort(
            (
              left,
              right
            ) =>
              left.order -
              right.order
          )
        }
      )

      return result
    }, [
      activeAssignments,
      activeModules
    ])

  const schemesByAssignment =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof activeSchemes
        >()

      activeAssignments.forEach(
        (
          assignment
        ) => {
          result.set(
            assignment.id,
            []
          )
        }
      )

      activeSchemes.forEach(
        (
          scheme
        ) => {
          const schemes =
            result.get(
              scheme.teachingAssignmentId
            ) ??
            []

          schemes.push(
            scheme
          )

          result.set(
            scheme.teachingAssignmentId,
            schemes
          )
        }
      )

      return result
    }, [
      activeAssignments,
      activeSchemes
    ])

  const criteriaByScheme =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof activeCriteria
        >()

      activeSchemes.forEach(
        (
          scheme
        ) => {
          result.set(
            scheme.id,
            []
          )
        }
      )

      activeCriteria.forEach(
        (
          criterion
        ) => {
          const criteria =
            result.get(
              criterion.schemeId
            ) ??
            []

          criteria.push(
            criterion
          )

          result.set(
            criterion.schemeId,
            criteria
          )
        }
      )

      return result
    }, [
      activeSchemes,
      activeCriteria
    ])

  const planificationByModule =
    useMemo(
      () =>
        new Map(
          activePlanifications.map(
            (
              planification
            ) => [
              planification.moduleId,
              planification
            ]
          )
        ),
      [
        activePlanifications
      ]
    )

  const itemsByPlanification =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof snapshot.planificationItems
        >()

      snapshot.planificationItems.forEach(
        (
          item
        ) => {
          const items =
            result.get(
              item.planificationId
            ) ??
            []

          items.push(
            item
          )

          result.set(
            item.planificationId,
            items
          )
        }
      )

      return result
    }, [
      snapshot
        .planificationItems
    ])

  const scheduleSlotsByAssignment =
    useMemo(() => {
      const result =
        new Map<
          EntityId,
          typeof activeScheduleSlots
        >()

      activeAssignments.forEach(
        (
          assignment
        ) => {
          result.set(
            assignment.id,
            []
          )
        }
      )

      activeScheduleSlots.forEach(
        (
          slot
        ) => {
          const slots =
            result.get(
              slot.teachingAssignmentId
            ) ??
            []

          slots.push(
            slot
          )

          result.set(
            slot.teachingAssignmentId,
            slots
          )
        }
      )

      return result
    }, [
      activeAssignments,
      activeScheduleSlots
    ])

  const validationIssues =
    useMemo(() => {
      const issues:
        SetupIssue[] =
        []

      if (
        activeGroups.length ===
        0
      ) {
        issues.push({
          id:
            'missing-groups',
          title:
            'Não existem turmas',
          description:
            'Adicione pelo menos uma turma antes de concluir a configuração.',
          step:
            'groups'
        })
      }

      if (
        activeSubjects.length ===
        0 ||
        activeAssignments.length ===
        0
      ) {
        issues.push({
          id:
            'missing-subjects',
          title:
            'Não existem disciplinas associadas',
          description:
            'Adicione uma disciplina e associe-a a pelo menos uma turma.',
          step:
            'subjects'
        })
      }

      activeAssignments.forEach(
        (
          assignment
        ) => {
          const modules =
            modulesByAssignment.get(
              assignment.id
            ) ??
            []

          if (
            modules.length ===
            0
          ) {
            issues.push({
              id:
                `missing-modules-${assignment.id}`,
              title:
                `UFCD em falta — ${assignment.displayName}`,
              description:
                'Esta turma e disciplina não possuem nenhuma UFCD ou módulo.',
              step:
                'modules'
            })

            return
          }

          const schemes =
            schemesByAssignment.get(
              assignment.id
            ) ??
            []

          const hasSubjectScheme =
            schemes.some(
              (
                scheme
              ) =>
                scheme.scope ===
                  'subject'
            )

          if (
            !hasSubjectScheme
          ) {
            const modulesWithoutScheme =
              modules.filter(
                (
                  module
                ) =>
                  !schemes.some(
                    (
                      scheme
                    ) =>
                      scheme.scope ===
                        'module' &&
                      scheme.moduleId ===
                        module.id
                  )
              )

            if (
              modulesWithoutScheme.length >
              0
            ) {
              issues.push({
                id:
                  `missing-criteria-${assignment.id}`,
                title:
                  `Critérios em falta — ${assignment.displayName}`,
                description:
                  `Faltam critérios em ${modulesWithoutScheme.length} ${
                    modulesWithoutScheme.length ===
                    1
                      ? 'UFCD ou módulo'
                      : 'UFCD ou módulos'
                  }.`,
                step:
                  'assessment_criteria'
              })
            }
          }

          const slots =
            scheduleSlotsByAssignment.get(
              assignment.id
            ) ??
            []

          if (
            slots.length ===
            0
          ) {
            issues.push({
              id:
                `missing-schedule-${assignment.id}`,
              title:
                `Horário em falta — ${assignment.displayName}`,
              description:
                'Esta turma e disciplina não possuem nenhum bloco no horário semanal.',
              step:
                'weekly_schedule'
            })
          }
        }
      )

      activeSchemes.forEach(
        (
          scheme
        ) => {
          const criteria =
            criteriaByScheme.get(
              scheme.id
            ) ??
            []

          if (
            criteria.length ===
            0
          ) {
            issues.push({
              id:
                `empty-scheme-${scheme.id}`,
              title:
                `Conjunto de critérios vazio — ${scheme.name}`,
              description:
                'Adicione pelo menos um critério ativo a este conjunto.',
              step:
                'assessment_criteria'
            })

            return
          }

          const total =
            criteria.reduce(
              (
                sum,
                criterion
              ) =>
                sum +
                criterion.weightPercent,
              0
            )

          if (
            Math.abs(
              total -
                100
            ) >
            0.001
          ) {
            issues.push({
              id:
                `invalid-weight-${scheme.id}`,
              title:
                `Ponderação inválida — ${scheme.name}`,
              description:
                `Os critérios totalizam ${formatNumber(
                  total
                )}% em vez de 100%.`,
              step:
                'assessment_criteria'
            })
          }
        }
      )

      activeModules.forEach(
        (
          module
        ) => {
          const planification =
            planificationByModule.get(
              module.id
            )

          if (
            !planification
          ) {
            issues.push({
              id:
                `missing-planification-${module.id}`,
              title:
                `Planificação em falta — ${getModuleLabel(
                  module.code,
                  module.name
                )}`,
              description:
                'Esta UFCD ou módulo ainda não possui uma planificação.',
              step:
                'planifications'
            })

            return
          }

          const items =
            itemsByPlanification.get(
              planification.id
            ) ??
            []

          if (
            items.length ===
            0
          ) {
            issues.push({
              id:
                `empty-planification-${planification.id}`,
              title:
                `Planificação vazia — ${planification.title}`,
              description:
                'Adicione pelo menos um conteúdo, atividade, objetivo ou proposta de sumário.',
              step:
                'planifications'
            })
          }
        }
      )

      activeGroups.forEach(
        (
          group
        ) => {
          const students =
            studentsByGroup.get(
              group.id
            ) ??
            []

          if (
            students.length ===
            0
          ) {
            issues.push({
              id:
                `missing-students-${group.id}`,
              title:
                `Alunos em falta — ${group.name}`,
              description:
                'Esta turma ainda não possui alunos ativos.',
              step:
                'students'
            })
          }
        }
      )

      const completedSteps =
        new Set(
          snapshot.progress
            ?.completedSteps ??
            []
        )

      const missingCompletedSteps =
        requiredCompletedSteps.filter(
          (
            step
          ) =>
            !completedSteps.has(
              step
            )
        )

      if (
        missingCompletedSteps.length >
        0
      ) {
        issues.push({
          id:
            'unfinished-steps',
          title:
            'Existem passos ainda não concluídos',
          description:
            'Percorra e guarde todos os passos anteriores antes de terminar a configuração.',
          step:
            missingCompletedSteps[0]
        })
      }

      return issues
    }, [
      activeGroups,
      activeSubjects,
      activeAssignments,
      activeModules,
      activeSchemes,
      modulesByAssignment,
      schemesByAssignment,
      criteriaByScheme,
      planificationByModule,
      itemsByPlanification,
      scheduleSlotsByAssignment,
      studentsByGroup,
      snapshot.progress
    ])

  const totalPlannedPeriods =
    useMemo(
      () =>
        activeModules.reduce(
          (
            total,
            module
          ) =>
            total +
            module.plannedPeriods,
          0
        ),
      [
        activeModules
      ]
    )

  const totalWeeklyPeriods =
    useMemo(
      () =>
        activeScheduleSlots.reduce(
          (
            total,
            slot
          ) =>
            total +
            slot.periodCount,
          0
        ),
      [
        activeScheduleSlots
      ]
    )

  const allChecksConfirmed =
    confirmedReview &&
    confirmedLocalStorage

  const readyToFinish =
    validationIssues.length ===
      0 &&
    allChecksConfirmed &&
    !busy

  async function handleFinishSetup() {
    if (
      busy
    ) {
      return
    }

    if (
      validationIssues.length >
      0
    ) {
      setError(
        'Corrija os elementos indicados antes de concluir a configuração.'
      )

      return
    }

    if (
      !confirmedReview
    ) {
      setError(
        'Confirme que reviu os dados apresentados.'
      )

      return
    }

    if (
      !confirmedLocalStorage
    ) {
      setError(
        'Confirme que compreende onde os dados escolares ficam guardados.'
      )

      return
    }

    setBusy(true)
    setError('')

    try {
      await maProfessorRepository.finishSetup(
        snapshot.academicYear.id
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
      finishError
    ) {
      setError(
        getErrorMessage(
          finishError
        )
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-xl shadow-cyan-950/15 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              Passo 9 de 9
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Confirmação
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Reveja a estrutura do ano letivo antes de abrir o painel
              principal. A configuração poderá continuar a ser alterada
              posteriormente nas definições do MA-Professor.
            </p>
          </div>

          <StatusBadge
            ready={
              validationIssues.length ===
              0
            }
            readyLabel="Pronto a concluir"
            pendingLabel="Revisão necessária"
          />
        </div>

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Ano letivo
              </p>

              <p className="mt-2 text-2xl font-black text-white">
                {
                  snapshot
                    .academicYear
                    .name
                }
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {formatDate(
                  snapshot
                    .academicYear
                    .startDate
                )}
                {' a '}
                {formatDate(
                  snapshot
                    .academicYear
                    .endDate
                )}
              </p>
            </div>

            {onEditStep ? (
              <button
                type="button"
                onClick={() =>
                  onEditStep(
                    'academic_year'
                  )
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100"
              >
                Rever ano letivo
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          <SetupMetric
            label="Turmas"
            value={
              activeGroups.length
            }
            description="Turmas ativas."
          />

          <SetupMetric
            label="Disciplinas"
            value={
              activeSubjects.length
            }
            description="Disciplinas criadas."
          />

          <SetupMetric
            label="Associações"
            value={
              activeAssignments.length
            }
            description="Turma e disciplina."
          />

          <SetupMetric
            label="UFCD"
            value={
              activeModules.length
            }
            description={`${formatNumber(
              totalPlannedPeriods,
              0
            )} tempos previstos.`}
          />

          <SetupMetric
            label="Critérios"
            value={
              activeCriteria.length
            }
            description={`${activeSchemes.length} conjuntos.`}
          />

          <SetupMetric
            label="Horário"
            value={
              activeScheduleSlots.length
            }
            description={`${formatNumber(
              totalWeeklyPeriods,
              0
            )} tempos semanais.`}
          />

          <SetupMetric
            label="Alunos"
            value={
              activeStudents.length
            }
            description="Alunos ativos."
          />
        </div>
      </section>

      {validationIssues.length >
      0 ? (
        <section className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[0.055] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-lg font-black text-amber-100">
              !
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                Elementos por corrigir
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                A configuração ainda não pode ser concluída.
              </h3>

              <p className="mt-2 text-sm leading-6 text-amber-50/70">
                Corrija os elementos abaixo e volte a esta confirmação.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {validationIssues.map(
              (
                issue
              ) => (
                <article
                  key={
                    issue.id
                  }
                  className="rounded-2xl border border-amber-300/15 bg-slate-950/45 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-black text-amber-50">
                        {
                          issue.title
                        }
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {
                          issue.description
                        }
                      </p>
                    </div>

                    {onEditStep ? (
                      <button
                        type="button"
                        onClick={() =>
                          onEditStep(
                            issue.step
                          )
                        }
                        className="shrink-0 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-300/[0.12]"
                      >
                        Corrigir
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-300/[0.055] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-lg font-black text-emerald-100">
              ✓
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                Verificação concluída
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                A estrutura obrigatória está completa.
              </h3>

              <p className="mt-2 text-sm leading-6 text-emerald-50/70">
                Todas as turmas, disciplinas, UFCD, critérios,
                planificações, horários e listas de alunos passaram na
                validação final.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/15 sm:p-6">
        <SectionHeader
          eyebrow="Turmas"
          title="Alunos por turma"
          description="Confirme o número de alunos ativos em cada turma."
          step="students"
          onEditStep={
            onEditStep
          }
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeGroups.map(
            (
              group
            ) => {
              const students =
                studentsByGroup.get(
                  group.id
                ) ??
                []

              return (
                <article
                  key={
                    group.id
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
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

                    <StatusBadge
                      ready={
                        students.length >
                        0
                      }
                      readyLabel={`${students.length} ${
                        students.length ===
                        1
                          ? 'aluno'
                          : 'alunos'
                      }`}
                      pendingLabel="Sem alunos"
                    />
                  </div>
                </article>
              )
            }
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/15 sm:p-6">
        <SectionHeader
          eyebrow="Estrutura pedagógica"
          title="Turmas, disciplinas e UFCD"
          description="Reveja a cobertura pedagógica de cada associação."
          step="modules"
          onEditStep={
            onEditStep
          }
        />

        <div className="mt-5 space-y-4">
          {activeAssignments.map(
            (
              assignment
            ) => {
              const group =
                groupById.get(
                  assignment.groupId
                )

              const subject =
                subjectById.get(
                  assignment.subjectId
                )

              const modules =
                modulesByAssignment.get(
                  assignment.id
                ) ??
                []

              const schemes =
                schemesByAssignment.get(
                  assignment.id
                ) ??
                []

              const slots =
                scheduleSlotsByAssignment.get(
                  assignment.id
                ) ??
                []

              const subjectScheme =
                schemes.find(
                  (
                    scheme
                  ) =>
                    scheme.scope ===
                    'subject'
                )

              const coveredModuleCount =
                subjectScheme
                  ? modules.length
                  : modules.filter(
                      (
                        module
                      ) =>
                        schemes.some(
                          (
                            scheme
                          ) =>
                            scheme.scope ===
                              'module' &&
                            scheme.moduleId ===
                              module.id
                        )
                    ).length

              const plannedModuleCount =
                modules.filter(
                  (
                    module
                  ) =>
                    planificationByModule.has(
                      module.id
                    )
                ).length

              const assignmentWeeklyPeriods =
                slots.reduce(
                  (
                    total,
                    slot
                  ) =>
                    total +
                    slot.periodCount,
                  0
                )

              const ready =
                modules.length >
                  0 &&
                coveredModuleCount ===
                  modules.length &&
                plannedModuleCount ===
                  modules.length &&
                slots.length >
                  0

              return (
                <article
                  key={
                    assignment.id
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-white">
                        {
                          assignment.displayName
                        }
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Turma:{' '}
                        {group?.name ??
                          '—'}

                        {' · '}

                        Disciplina:{' '}
                        {subject?.name ??
                          '—'}
                      </p>
                    </div>

                    <StatusBadge
                      ready={
                        ready
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        UFCD
                      </p>

                      <p className="mt-2 text-lg font-black text-white">
                        {
                          modules.length
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Critérios
                      </p>

                      <p className="mt-2 text-lg font-black text-white">
                        {
                          coveredModuleCount
                        }
                        /
                        {
                          modules.length
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Planificações
                      </p>

                      <p className="mt-2 text-lg font-black text-white">
                        {
                          plannedModuleCount
                        }
                        /
                        {
                          modules.length
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Horário
                      </p>

                      <p className="mt-2 text-lg font-black text-white">
                        {
                          assignmentWeeklyPeriods
                        }{' '}
                        <span className="text-xs font-bold text-slate-500">
                          tempos/semana
                        </span>
                      </p>
                    </div>
                  </div>

                  {modules.length >
                  0 ? (
                    <div className="mt-4 space-y-2">
                      {modules.map(
                        (
                          module
                        ) => {
                          const hasCriteria =
                            Boolean(
                              subjectScheme
                            ) ||
                            schemes.some(
                              (
                                scheme
                              ) =>
                                scheme.scope ===
                                  'module' &&
                                scheme.moduleId ===
                                  module.id
                            )

                          const hasPlanification =
                            planificationByModule.has(
                              module.id
                            )

                          return (
                            <div
                              key={
                                module.id
                              }
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-200">
                                  {getModuleLabel(
                                    module.code,
                                    module.name
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {
                                    module.plannedPeriods
                                  }{' '}
                                  {module.plannedPeriods ===
                                  1
                                    ? 'tempo previsto'
                                    : 'tempos previstos'}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full border px-2.5 py-1.5 text-[0.65rem] font-bold ${
                                    hasCriteria
                                      ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
                                      : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100'
                                  }`}
                                >
                                  {hasCriteria
                                    ? 'Critérios'
                                    : 'Sem critérios'}
                                </span>

                                <span
                                  className={`rounded-full border px-2.5 py-1.5 text-[0.65rem] font-bold ${
                                    hasPlanification
                                      ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
                                      : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100'
                                  }`}
                                >
                                  {hasPlanification
                                    ? 'Planificação'
                                    : 'Sem planificação'}
                                </span>
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  ) : null}
                </article>
              )
            }
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-violet-300/15 bg-violet-300/[0.045] p-5 sm:p-6">
        <SectionHeader
          eyebrow="Dados escolares"
          title="Confirmações finais"
          description="Estas confirmações são necessárias antes de abrir o painel."
        />

        <div className="mt-5 space-y-3">
          <label
            className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
              confirmedReview
                ? 'border-emerald-300/25 bg-emerald-300/[0.065]'
                : 'border-white/10 bg-slate-950/35 hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={
                confirmedReview
              }
              onChange={(
                event
              ) => {
                setConfirmedReview(
                  event.target.checked
                )

                setError('')
              }}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-slate-900 text-emerald-300 focus:ring-emerald-300/30"
            />

            <span>
              <span className="block font-black text-white">
                Revisei os dados apresentados.
              </span>

              <span className="mt-1 block text-sm leading-6 text-slate-400">
                Confirmei as turmas, disciplinas, UFCD, critérios,
                planificações, horários e listas de alunos.
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
              confirmedLocalStorage
                ? 'border-cyan-300/25 bg-cyan-300/[0.065]'
                : 'border-white/10 bg-slate-950/35 hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={
                confirmedLocalStorage
              }
              onChange={(
                event
              ) => {
                setConfirmedLocalStorage(
                  event.target.checked
                )

                setError('')
              }}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
            />

            <span>
              <span className="block font-black text-white">
                Compreendo que os dados escolares ficam neste
                dispositivo.
              </span>

              <span className="mt-1 block text-sm leading-6 text-slate-400">
                Nesta fase, não devo limpar os dados do browser ou
                utilizar outro dispositivo sem uma cópia de segurança.
              </span>
            </span>
          </label>
        </div>

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
          disabled={
            !readyToFinish
          }
          onClick={() =>
            void handleFinishSetup()
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy
            ? 'A concluir a configuração...'
            : validationIssues.length >
                0
              ? 'Corrija os elementos em falta'
              : !allChecksConfirmed
                ? 'Confirme os dois pontos anteriores'
                : 'Concluir configuração e abrir o painel'}
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          A conclusão não elimina nem altera os dados introduzidos.
        </p>
      </section>
    </div>
  )
}

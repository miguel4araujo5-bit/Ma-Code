import {
  type ChangeEvent,
  useMemo,
  useState
} from 'react'

import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import type {
  SetupStepId
} from '../types'
import AssessmentCriteriaPdfImportPanel from './AssessmentCriteriaPdfImportPanel'
import AssessmentCriteriaSetupStep from './AssessmentCriteriaSetupStep'
import GroupsSetupStep from './GroupsSetupStep'
import ModulePlanificationImportPanel from './ModulePlanificationImportPanel'
import ModulesSetupCourseSubjectGuard from './ModulesSetupCourseSubjectGuard'
import PlanificationsSetupStep from './PlanificationsSetupStep'
import SchedulePdfImportStep from './SchedulePdfImportStep'
import SetupConfirmationStep from './SetupConfirmationStep'
import StudentsSetupStep from './StudentsSetupStep'
import SubjectsSetupStep from './SubjectsSetupStep'
import WeeklyScheduleSetupStep from './WeeklyScheduleSetupStep'
import {
  getMAProfessorSetupReadiness,
  hasCompleteScheduleCoverage,
  MA_PROFESSOR_OPEN_DAILY_EVENT
} from './setupReadiness'

type SetupWizardProps = {
  snapshot: SetupSnapshot
  onSnapshotChange: (snapshot: SetupSnapshot) => void
  onCompleted: (snapshot: SetupSnapshot) => void
}

type SetupStepDefinition = {
  id: SetupStepId
  number: number
  title: string
  shortTitle: string
  description: string
}

type GuidedStage =
  | 'schedule'
  | 'planifications'
  | 'criteria'
  | 'ready'

const setupSteps: SetupStepDefinition[] = [
  { id: 'groups', number: 2, title: 'Turmas', shortTitle: 'Turmas', description: 'Selecione rapidamente as turmas do ensino profissional que leciona.' },
  { id: 'subjects', number: 3, title: 'Disciplinas', shortTitle: 'Disciplinas', description: 'Escolha as disciplinas e associe cada uma às turmas onde a leciona.' },
  { id: 'modules', number: 4, title: 'UFCD ou módulos', shortTitle: 'UFCD', description: 'Introduza cada UFCD uma vez e indique apenas as turmas onde se aplica.' },
  { id: 'weekly_schedule', number: 5, title: 'Horário semanal', shortTitle: 'Horário', description: 'Indique os dias, as horas e os tempos letivos.' },
  { id: 'assessment_criteria', number: 6, title: 'Critérios de avaliação', shortTitle: 'Critérios', description: 'Configure critérios e ponderações que totalizem 100%.' },
  { id: 'planifications', number: 7, title: 'Planificações', shortTitle: 'Planos', description: 'Organize conteúdos, atividades, objetivos e sumários.' },
  { id: 'students', number: 8, title: 'Alunos', shortTitle: 'Alunos', description: 'Adicione o número e o nome dos alunos de cada turma.' },
  { id: 'confirmation', number: 9, title: 'Confirmação', shortTitle: 'Confirmar', description: 'Reveja os dados e conclua a configuração pedagógica.' }
]

const importedScheduleSteps: SetupStepId[] = [
  'groups',
  'subjects',
  'weekly_schedule'
]

const selectClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value || '—'

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day))
}

function getEffectiveCompletedSteps(
  snapshot: SetupSnapshot
) {
  const completed = new Set<SetupStepId>(
    snapshot.progress?.completedSteps ?? []
  )

  if (hasCompleteScheduleCoverage(snapshot)) {
    for (const step of importedScheduleSteps) {
      completed.add(step)
    }
  }

  return completed
}

function getFirstIncompleteStep(
  snapshot: SetupSnapshot
): SetupStepId {
  const completedSteps = getEffectiveCompletedSteps(snapshot)

  return (
    setupSteps.find(
      step => !completedSteps.has(step.id)
    )?.id ?? 'confirmation'
  )
}

async function reconcileImportedScheduleProgress(
  snapshot: SetupSnapshot
) {
  if (!hasCompleteScheduleCoverage(snapshot)) {
    return snapshot
  }

  const persistedCompleted = new Set<SetupStepId>(
    snapshot.progress?.completedSteps ?? []
  )
  let changed = false

  for (const step of importedScheduleSteps) {
    if (persistedCompleted.has(step)) continue

    await maProfessorRepository.completeSetupStep(
      snapshot.academicYear.id,
      step
    )
    persistedCompleted.add(step)
    changed = true
  }

  return changed
    ? maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )
    : snapshot
}

function activeAssignmentIds(snapshot: SetupSnapshot) {
  const activeGroupIds = new Set(
    snapshot.groups
      .filter(group => group.active)
      .map(group => group.id)
  )
  const activeSubjectIds = new Set(
    snapshot.subjects
      .filter(subject => subject.active)
      .map(subject => subject.id)
  )

  return snapshot.teachingAssignments
    .filter(assignment =>
      assignment.active &&
      activeGroupIds.has(assignment.groupId) &&
      activeSubjectIds.has(assignment.subjectId)
    )
    .map(assignment => assignment.id)
}

function hasPlanificationCoverage(snapshot: SetupSnapshot) {
  const assignments = activeAssignmentIds(snapshot)
  if (assignments.length === 0) return false

  const activeModules = snapshot.modules.filter(module => module.active)
  const planifiedModuleIds = new Set(
    snapshot.planifications
      .filter(planification => planification.active)
      .map(planification => planification.moduleId)
  )

  return assignments.every(assignmentId => {
    const modules = activeModules.filter(
      module => module.teachingAssignmentId === assignmentId
    )

    return (
      modules.length > 0 &&
      modules.every(module => planifiedModuleIds.has(module.id))
    )
  })
}

function hasCriteriaCoverage(snapshot: SetupSnapshot) {
  const assignments = activeAssignmentIds(snapshot)
  if (assignments.length === 0) return false

  const activeCriterionSchemeIds = new Set(
    snapshot.assessmentCriteria
      .filter(criterion => criterion.active)
      .map(criterion => criterion.schemeId)
  )
  const activeSchemes = snapshot.assessmentSchemes.filter(
    scheme =>
      scheme.active &&
      activeCriterionSchemeIds.has(scheme.id)
  )
  const activeModules = snapshot.modules.filter(module => module.active)

  return assignments.every(assignmentId => {
    const hasSubjectScheme = activeSchemes.some(scheme =>
      scheme.teachingAssignmentId === assignmentId &&
      scheme.scope === 'subject'
    )

    if (hasSubjectScheme) return true

    const modules = activeModules.filter(
      module => module.teachingAssignmentId === assignmentId
    )

    return (
      modules.length > 0 &&
      modules.every(module =>
        activeSchemes.some(scheme =>
          scheme.teachingAssignmentId === assignmentId &&
          scheme.scope === 'module' &&
          scheme.moduleId === module.id
        )
      )
    )
  })
}

function getInitialGuidedStage(
  snapshot: SetupSnapshot
): GuidedStage {
  if (!hasCompleteScheduleCoverage(snapshot)) return 'schedule'
  if (!hasPlanificationCoverage(snapshot)) return 'planifications'
  if (!hasCriteriaCoverage(snapshot)) return 'criteria'
  return 'ready'
}

function AcademicYearSummary({
  snapshot,
  onContinue
}: {
  snapshot: SetupSnapshot
  onContinue: () => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Contexto automático</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Ano letivo</h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">O MA-Professor mantém os dados separados por ano letivo, mas não precisa de preencher esta informação durante a configuração inicial.</p>
        <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Ano ativo</p>
          <p className="mt-3 text-2xl font-black text-white">{snapshot.academicYear.name}</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">{formatDate(snapshot.academicYear.startDate)} a {formatDate(snapshot.academicYear.endDate)}</p>
        </div>
      </section>
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/15 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Informação</p>
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.065] p-4">
          <p className="font-black text-white">Não precisa de alterar nada aqui.</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">Mais tarde poderá alternar entre anos letivos existentes no menu principal, sem misturar os respetivos dados.</p>
        </div>
        <button type="button" onClick={onContinue} className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3.5 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.09]">Voltar à configuração</button>
      </section>
    </div>
  )
}

function GuidedProgress({
  stage,
  scheduleReady,
  planificationsReady,
  criteriaReady
}: {
  stage: GuidedStage
  scheduleReady: boolean
  planificationsReady: boolean
  criteriaReady: boolean
}) {
  const steps = [
    { id: 'schedule', number: 1, label: 'Horário', done: scheduleReady },
    { id: 'planifications', number: 2, label: 'Planificações', done: planificationsReady },
    { id: 'criteria', number: 3, label: 'Critérios', done: criteriaReady }
  ] as const

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map(step => {
        const active = stage === step.id
        return (
          <div
            key={step.id}
            className={`rounded-2xl border px-4 py-3 ${
              active
                ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                : step.done
                  ? 'border-emerald-300/20 bg-emerald-300/[0.045]'
                  : 'border-white/10 bg-white/[0.025]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-8 w-8 place-items-center rounded-xl border text-xs font-black ${
                step.done
                  ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                  : active
                    ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-500'
              }`}>
                {step.done ? '✓' : step.number}
              </span>
              <span className="text-sm font-black text-white">{step.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SetupWizard({
  snapshot,
  onSnapshotChange,
  onCompleted
}: SetupWizardProps) {
  const [advancedMode, setAdvancedMode] = useState(false)
  const [guidedStage, setGuidedStage] = useState<GuidedStage>(
    () => getInitialGuidedStage(snapshot)
  )
  const [activeStep, setActiveStep] = useState<SetupStepId>(
    () => getFirstIncompleteStep(snapshot)
  )

  const completedSteps = useMemo(
    () => getEffectiveCompletedSteps(snapshot),
    [
      snapshot.progress?.completedSteps,
      snapshot.groups.length,
      snapshot.subjects.length,
      snapshot.teachingAssignments.length,
      snapshot.weeklyScheduleSlots.length
    ]
  )
  const readiness = getMAProfessorSetupReadiness(snapshot)
  const scheduleReady = hasCompleteScheduleCoverage(snapshot)
  const planificationsReady = hasPlanificationCoverage(snapshot)
  const criteriaReady = hasCriteriaCoverage(snapshot)
  const currentProgressStep = getFirstIncompleteStep(snapshot)
  const activeStepDefinition = setupSteps.find(step => step.id === activeStep) ?? setupSteps[0]
  const completedSetupSteps = setupSteps.filter(step => completedSteps.has(step.id)).length
  const totalSetupSteps = setupSteps.length + 1
  const completedCount = completedSetupSteps + 1
  const completionPercent = Math.round((completedCount / totalSetupSteps) * 100)

  function isStepUnlocked(_stepId: SetupStepId) {
    return true
  }

  function navigateToStep(stepId: SetupStepId) {
    setActiveStep(stepId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function refreshSnapshot() {
    const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
      snapshot.academicYear.id
    )
    onSnapshotChange(nextSnapshot)
    return nextSnapshot
  }

  async function handleStepCompleted(nextSnapshot: SetupSnapshot) {
    const preparedSnapshot = await reconcileImportedScheduleProgress(
      nextSnapshot
    )

    onSnapshotChange(preparedSnapshot)
    if (
      preparedSnapshot.academicYear.setupCompletedAt ||
      preparedSnapshot.progress?.completedAt
    ) {
      onCompleted(preparedSnapshot)
      return
    }

    setActiveStep(getFirstIncompleteStep(preparedSnapshot))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleGuidedScheduleImported(
    nextSnapshot: SetupSnapshot
  ) {
    const preparedSnapshot = await reconcileImportedScheduleProgress(
      nextSnapshot
    )
    onSnapshotChange(preparedSnapshot)
    setGuidedStage('planifications')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openDaily() {
    window.dispatchEvent(
      new Event(MA_PROFESSOR_OPEN_DAILY_EVENT)
    )
  }

  const commonProps = {
    snapshot,
    onSnapshotChange,
    onCompleted: handleStepCompleted
  }

  function renderActiveStep() {
    switch (activeStep) {
      case 'academic_year':
        return (
          <AcademicYearSummary
            snapshot={snapshot}
            onContinue={() => navigateToStep(currentProgressStep)}
          />
        )
      case 'groups':
        return <GroupsSetupStep {...commonProps} />
      case 'subjects':
        return <SubjectsSetupStep {...commonProps} />
      case 'modules':
        return (
          <ModulesSetupCourseSubjectGuard
            {...commonProps}
            onEditSubjects={() => navigateToStep('subjects')}
          />
        )
      case 'weekly_schedule':
        return (
          <div className="space-y-6">
            <SchedulePdfImportStep
              snapshot={snapshot}
              onImported={async nextSnapshot => {
                const prepared = await reconcileImportedScheduleProgress(nextSnapshot)
                onSnapshotChange(prepared)
              }}
              onContinueWithoutPdf={() => undefined}
            />
            <WeeklyScheduleSetupStep {...commonProps} />
          </div>
        )
      case 'assessment_criteria':
        return (
          <div className="space-y-6">
            <AssessmentCriteriaPdfImportPanel
              snapshot={snapshot}
              onImported={onSnapshotChange}
            />
            <AssessmentCriteriaSetupStep {...commonProps} />
          </div>
        )
      case 'planifications':
        return <PlanificationsSetupStep {...commonProps} />
      case 'students':
        return <StudentsSetupStep {...commonProps} />
      case 'confirmation':
        return (
          <SetupConfirmationStep
            {...commonProps}
            onEditStep={navigateToStep}
          />
        )
      default:
        return null
    }
  }

  if (!advancedMode) {
    const activeModuleCount = snapshot.modules.filter(module => module.active).length
    const activePlanificationCount = snapshot.planifications.filter(planification => planification.active).length
    const activeSchemeCount = snapshot.assessmentSchemes.filter(scheme => scheme.active).length

    return (
      <div className="mx-auto max-w-[100rem]">
        <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-6 lg:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            Configuração inicial · {snapshot.academicYear.name}
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Vamos preparar o essencial, um passo de cada vez.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Comece pelo horário. Depois usamos a estrutura já confirmada para associar planificações e critérios às disciplinas certas. Pode saltar qualquer etapa e voltar mais tarde.
          </p>

          <div className="mt-6">
            <GuidedProgress
              stage={guidedStage}
              scheduleReady={scheduleReady}
              planificationsReady={planificationsReady}
              criteriaReady={criteriaReady}
            />
          </div>
        </section>

        {guidedStage === 'schedule' ? (
          <div className="mt-6">
            <SchedulePdfImportStep
              snapshot={snapshot}
              onImported={handleGuidedScheduleImported}
              onContinueWithoutPdf={() => {
                setGuidedStage('planifications')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        ) : null}

        {guidedStage === 'planifications' ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 text-white shadow-xl shadow-black/15 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">2 · Planificações</p>
              <h2 className="mt-2 text-xl font-black">Agora já conhecemos a estrutura do seu horário.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Adicione uma planificação de cada vez. O MA-Professor tenta reconhecer a disciplina e criar as respetivas UFCD/módulos e planificações. Só abra os detalhes quando precisar de corrigir alguma coisa.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">{snapshot.subjects.filter(subject => subject.active).length} disciplinas</span>
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">{activeModuleCount} UFCD/módulos</span>
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5">{activePlanificationCount} planificações</span>
              </div>
            </section>

            <ModulePlanificationImportPanel
              snapshot={snapshot}
              disabled={false}
              onActiveChange={() => undefined}
              onImported={refreshSnapshot}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-sm leading-6 text-slate-400">
                Pode adicionar mais planificações ou avançar. O que faltar fica pendente e não é inventado.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setGuidedStage('schedule')}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300"
                >
                  Voltar ao horário
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuidedStage('criteria')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
                >
                  Continuar para critérios
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {guidedStage === 'criteria' ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 text-white shadow-xl shadow-black/15 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">3 · Critérios</p>
              <h2 className="mt-2 text-xl font-black">Por fim, adicione os critérios que já tiver.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Como as disciplinas e UFCD/módulos já foram preparados nos passos anteriores, a correspondência é mais segura. As ponderações têm sempre de vir do documento; o MA-Professor não assume 60/20/20 nem outro modelo por defeito.
              </p>
              <p className="mt-3 text-xs font-bold text-slate-500">Conjuntos atualmente configurados: {activeSchemeCount}</p>
            </section>

            <AssessmentCriteriaPdfImportPanel
              snapshot={snapshot}
              onImported={onSnapshotChange}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-sm leading-6 text-slate-400">
                Se ainda não tiver todos os critérios, pode tratá-los mais tarde sem bloquear o trabalho diário.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setGuidedStage('planifications')}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300"
                >
                  Voltar às planificações
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuidedStage('ready')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
                >
                  Concluir por agora
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {guidedStage === 'ready' ? (
          <section className="mt-6 rounded-[2rem] border border-emerald-300/20 bg-slate-950/75 p-6 text-white shadow-2xl shadow-black/20 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Preparação concluída por agora</p>
            <h2 className="mt-3 text-2xl font-black">{readiness.operationalReady ? 'Já pode começar a trabalhar.' : 'Pode continuar depois sem perder o que já configurou.'}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-500">Horário</p><p className="mt-2 font-black">{scheduleReady ? '✓ Preparado' : '◌ Pendente'}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-500">Planificações</p><p className="mt-2 font-black">{planificationsReady ? '✓ Preparadas' : '◌ Por completar'}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-500">Critérios</p><p className="mt-2 font-black">{criteriaReady ? '✓ Configurados' : '◌ Por completar'}</p></div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {readiness.operationalReady ? (
                <button
                  type="button"
                  onClick={openDaily}
                  className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950"
                >
                  Começar a trabalhar
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setGuidedStage('schedule')} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200">Rever horário</button>
                  <button type="button" onClick={() => setGuidedStage('planifications')} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200">Rever planificações</button>
                </>
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setAdvancedMode(true)
              setActiveStep(getFirstIncompleteStep(snapshot))
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="text-xs font-bold text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-slate-300"
          >
            Configuração avançada / editar manualmente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Configuração avançada · Ensino profissional / secundário</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Editar manualmente todas as áreas.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Ano letivo ativo: {snapshot.academicYear.name}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="min-w-[12rem] rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Configuração completa</span><span className="text-sm font-black text-cyan-100">{completedCount}/{totalSetupSteps}</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${completionPercent}%` }} /></div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdvancedMode(false)
                setGuidedStage(getInitialGuidedStage(snapshot))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300"
            >
              Voltar ao assistente simples
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.055] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Configuração flexível</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Pode abrir qualquer área, saltar o que ainda não tem e voltar mais tarde. Uma informação em falta deixa uma pendência; não bloqueia os restantes passos.</p>
        </div>

        {readiness.operationalReady && !readiness.fullSetupCompleted ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.075] p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Pronto para trabalhar</p>
              <p className="mt-2 font-black text-white">Turmas, disciplinas, UFCD e horário já permitem gerar as aulas.</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">Pode escrever o primeiro sumário agora e continuar critérios, planificações e alunos mais tarde.</p>
            </div>
            <button type="button" onClick={openDaily} className="shrink-0 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-black text-emerald-950 transition hover:brightness-110">Abrir aula de hoje</button>
          </div>
        ) : null}

        <div className="mt-6 lg:hidden">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Área apresentada</span>
            <select value={activeStep === 'academic_year' ? currentProgressStep : activeStep} onChange={(event: ChangeEvent<HTMLSelectElement>) => navigateToStep(event.target.value as SetupStepId)} className={selectClassName}>
              {setupSteps.map(step => <option key={step.id} value={step.id}>{step.number}. {step.title}{completedSteps.has(step.id) ? ' — concluído' : ' — por completar'}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6 hidden grid-cols-2 gap-3 lg:grid xl:grid-cols-8">
          {setupSteps.map(step => {
            const completed = completedSteps.has(step.id)
            const active = activeStep === step.id
            return (
              <button key={step.id} type="button" onClick={() => navigateToStep(step.id)} className={`min-w-0 rounded-2xl border p-3 text-left transition ${active ? 'border-cyan-300/40 bg-cyan-300/[0.09]' : completed ? 'border-emerald-300/20 bg-emerald-300/[0.05]' : 'border-white/10 bg-white/[0.025]'}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${active ? 'border-cyan-300/35 bg-cyan-300/15 text-cyan-50' : completed ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/[0.035] text-slate-400'}`}>{completed ? '✓' : step.number}</span>
                  <span className="truncate text-xs font-black text-white">{step.shortTitle}</span>
                </div>
              </button>
            )
          })}
        </div>

        {activeStep !== 'academic_year' ? (
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Passo {activeStepDefinition.number} de {totalSetupSteps}</p>
              <p className="mt-2 font-black text-white">{activeStepDefinition.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{activeStepDefinition.description}</p>
            </div>
            {activeStep !== currentProgressStep ? <button type="button" onClick={() => navigateToStep(currentProgressStep)} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">Ir para o passo atual</button> : null}
          </div>
        ) : null}
      </section>

      <div key={activeStep} className="mt-6">{renderActiveStep()}</div>

      <p className="mt-6 text-center text-xs leading-6 text-slate-500">A configuração avançada permanece disponível para correções e exceções. O assistente simples é o percurso recomendado para o primeiro arranque.</p>
    </div>
  )
}

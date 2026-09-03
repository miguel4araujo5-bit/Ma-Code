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
import AssessmentCriteriaSetupStep from './AssessmentCriteriaSetupStep'
import GroupsSetupStep from './GroupsSetupStep'
import ModulesSetupStep from './ModulesSetupStep'
import PlanificationsSetupStep from './PlanificationsSetupStep'
import SchedulePdfImportStep from './SchedulePdfImportStep'
import SetupConfirmationStep from './SetupConfirmationStep'
import StudentsSetupStep from './StudentsSetupStep'
import SubjectsSetupStep from './SubjectsSetupStep'
import WeeklyScheduleSetupStep from './WeeklyScheduleSetupStep'

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

type EducationMode =
  | 'professional'
  | 'regular'
  | 'mixed'

const setupSteps: SetupStepDefinition[] = [
  { id: 'groups', number: 2, title: 'Turmas', shortTitle: 'Turmas', description: 'Selecione rapidamente as turmas do ensino profissional que leciona.' },
  { id: 'subjects', number: 3, title: 'Disciplinas', shortTitle: 'Disciplinas', description: 'Escolha as disciplinas e associe cada uma às turmas onde a leciona.' },
  { id: 'modules', number: 4, title: 'UFCD ou módulos', shortTitle: 'UFCD', description: 'Introduza cada UFCD uma vez e indique apenas as turmas onde se aplica.' },
  { id: 'assessment_criteria', number: 5, title: 'Critérios de avaliação', shortTitle: 'Critérios', description: 'Configure critérios e ponderações que totalizem 100%.' },
  { id: 'planifications', number: 6, title: 'Planificações', shortTitle: 'Planos', description: 'Organize conteúdos, atividades, objetivos e sumários.' },
  { id: 'weekly_schedule', number: 7, title: 'Horário semanal', shortTitle: 'Horário', description: 'Indique os dias, as horas e os tempos letivos.' },
  { id: 'students', number: 8, title: 'Alunos', shortTitle: 'Alunos', description: 'Adicione o número e o nome dos alunos de cada turma.' },
  { id: 'confirmation', number: 9, title: 'Confirmação', shortTitle: 'Confirmar', description: 'Reveja os dados e conclua a configuração inicial.' }
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

function hasCompleteImportedSchedule(
  snapshot: SetupSnapshot
) {
  return (
    snapshot.groups.length > 0 &&
    snapshot.subjects.length > 0 &&
    snapshot.teachingAssignments.length > 0 &&
    snapshot.weeklyScheduleSlots.length > 0
  )
}

function getEffectiveCompletedSteps(
  snapshot: SetupSnapshot
) {
  const completed = new Set<SetupStepId>(
    snapshot.progress?.completedSteps ?? []
  )

  if (hasCompleteImportedSchedule(snapshot)) {
    for (const step of importedScheduleSteps) {
      completed.add(step)
    }
  }

  return completed
}

function getFirstIncompleteStep(
  snapshot: SetupSnapshot
): SetupStepId {
  const completedSteps =
    getEffectiveCompletedSteps(snapshot)

  return (
    setupSteps.find(
      step => !completedSteps.has(step.id)
    )?.id ?? 'confirmation'
  )
}

function getInitialStep(snapshot: SetupSnapshot): SetupStepId {
  return getFirstIncompleteStep(snapshot)
}

function shouldOfferScheduleImport(snapshot: SetupSnapshot) {
  return (
    !snapshot.academicYear.setupCompletedAt &&
    snapshot.groups.length === 0 &&
    snapshot.subjects.length === 0 &&
    snapshot.teachingAssignments.length === 0 &&
    snapshot.weeklyScheduleSlots.length === 0
  )
}

async function reconcileImportedScheduleProgress(
  snapshot: SetupSnapshot
) {
  if (!hasCompleteImportedSchedule(snapshot)) {
    return snapshot
  }

  const persistedCompleted = new Set<SetupStepId>(
    snapshot.progress?.completedSteps ?? []
  )
  let changed = false

  for (const step of importedScheduleSteps) {
    if (persistedCompleted.has(step)) {
      continue
    }

    await maProfessorRepository.completeSetupStep(
      snapshot.academicYear.id,
      step
    )
    persistedCompleted.add(step)
    changed = true
  }

  if (!changed) {
    return snapshot
  }

  return maProfessorRepository.getSetupSnapshot(
    snapshot.academicYear.id
  )
}

function AcademicYearSummary({ snapshot, onContinue }: { snapshot: SetupSnapshot; onContinue: () => void }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Contexto automático</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Ano letivo</h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">O MA-Professor mantém os dados separados por ano letivo, mas não precisa de preencher esta informação durante a configuração inicial.</p>
        <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Ano ativo</p>
          <p className="mt-3 text-2xl font-black text-white">{snapshot.academicYear.name}</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">{formatDate(snapshot.academicYear.startDate)} a{' '}{formatDate(snapshot.academicYear.endDate)}</p>
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

function EducationModeSelector({ onSelectProfessional }: { onSelectProfessional: () => void }) {
  const [notice, setNotice] = useState('')
  const modes: Array<{ id: EducationMode; title: string; description: string; available: boolean }> = [
    { id: 'professional', title: 'Ensino profissional', description: 'Turmas do 10.º, 11.º e 12.º ano, com UFCD ou módulos.', available: true },
    { id: 'regular', title: 'Ensino regular', description: 'Configuração para turmas do ensino regular.', available: false },
    { id: 'mixed', title: 'Misto', description: 'Para docentes que lecionam simultaneamente ensino regular e profissional.', available: false }
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Passo 1 de 9 · Primeira configuração</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Que tipo de ensino leciona?</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">Esta escolha permite ao MA-Professor mostrar apenas o que faz sentido para o seu trabalho e evitar perguntas desnecessárias.</p>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {modes.map(mode => (
            <button key={mode.id} type="button" onClick={() => {
              if (mode.available) {
                setNotice('')
                onSelectProfessional()
                return
              }
              setNotice(`${mode.title} será disponibilizado numa fase posterior. Para já, estamos a concluir o fluxo do ensino profissional.`)
            }} className={`rounded-3xl border p-5 text-left transition ${mode.available ? 'border-cyan-300/25 bg-cyan-300/[0.07] hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-300/[0.11]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-lg font-black text-white">{mode.title}</span>
                <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${mode.available ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/[0.06] text-slate-500'}`}>{mode.available ? 'Disponível' : 'Em breve'}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{mode.description}</p>
            </button>
          ))}
        </div>
        {notice ? <p className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-4 text-sm leading-6 text-violet-100">{notice}</p> : null}
      </section>
    </div>
  )
}

export default function SetupWizard({ snapshot, onSnapshotChange, onCompleted }: SetupWizardProps) {
  const [activeStep, setActiveStep] = useState<SetupStepId>(() => getInitialStep(snapshot))
  const [educationMode, setEducationMode] = useState<'professional' | null>(snapshot.groups.length > 0 ? 'professional' : null)
  const [showScheduleImport, setShowScheduleImport] = useState(false)

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
  const currentProgressStep = getFirstIncompleteStep(snapshot)
  const activeStepDefinition = setupSteps.find(step => step.id === activeStep) ?? setupSteps[0]
  const completedSetupSteps = setupSteps.filter(step => completedSteps.has(step.id)).length
  const totalVisibleSteps = 9
  const completedCount = 1 + completedSetupSteps
  const completionPercent = Math.round((completedCount / totalVisibleSteps) * 100)

  function isStepUnlocked(stepId: SetupStepId) {
    if (stepId === 'academic_year') return true
    const stepIndex = setupSteps.findIndex(step => step.id === stepId)
    if (stepIndex <= 0) return true
    const previousStep = setupSteps[stepIndex - 1]
    return completedSteps.has(stepId) || completedSteps.has(previousStep.id) || currentProgressStep === stepId
  }

  function navigateToStep(stepId: SetupStepId) {
    if (!isStepUnlocked(stepId)) return
    setActiveStep(stepId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleStepCompleted(nextSnapshot: SetupSnapshot) {
    const preparedSnapshot =
      await reconcileImportedScheduleProgress(nextSnapshot)

    onSnapshotChange(preparedSnapshot)
    if (preparedSnapshot.academicYear.setupCompletedAt || preparedSnapshot.progress?.completedAt) {
      onCompleted(preparedSnapshot)
      return
    }
    setActiveStep(getFirstIncompleteStep(preparedSnapshot))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleScheduleImported(nextSnapshot: SetupSnapshot) {
    const preparedSnapshot =
      await reconcileImportedScheduleProgress(nextSnapshot)

    onSnapshotChange(preparedSnapshot)
    setShowScheduleImport(false)
    setEducationMode('professional')
    setActiveStep(getFirstIncompleteStep(preparedSnapshot))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const commonProps = { snapshot, onSnapshotChange, onCompleted: handleStepCompleted }

  function renderActiveStep() {
    switch (activeStep) {
      case 'academic_year': return <AcademicYearSummary snapshot={snapshot} onContinue={() => navigateToStep(currentProgressStep)} />
      case 'groups': return <GroupsSetupStep {...commonProps} />
      case 'subjects': return <SubjectsSetupStep {...commonProps} />
      case 'modules': return <ModulesSetupStep {...commonProps} />
      case 'assessment_criteria': return <AssessmentCriteriaSetupStep {...commonProps} />
      case 'planifications': return <PlanificationsSetupStep {...commonProps} />
      case 'weekly_schedule': return <WeeklyScheduleSetupStep {...commonProps} />
      case 'students': return <StudentsSetupStep {...commonProps} />
      case 'confirmation': return <SetupConfirmationStep {...commonProps} onEditStep={navigateToStep} />
      default: return null
    }
  }

  if (!educationMode && snapshot.groups.length === 0) {
    return (
      <EducationModeSelector
        onSelectProfessional={() => {
          setEducationMode('professional')
          setShowScheduleImport(shouldOfferScheduleImport(snapshot))
        }}
      />
    )
  }

  if (showScheduleImport) {
    return <SchedulePdfImportStep snapshot={snapshot} onImported={handleScheduleImported} onContinueWithoutPdf={() => setShowScheduleImport(false)} />
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Configuração · Ensino profissional</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Vamos preparar apenas o essencial.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Ano letivo ativo: {snapshot.academicYear.name}</p>
          </div>
          <div className="min-w-[12rem] rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Progresso</span><span className="text-sm font-black text-cyan-100">{completedCount}/{totalVisibleSteps}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 transition-[width] duration-300" style={{ width: `${completionPercent}%` }} /></div>
          </div>
        </div>

        <div className="mt-6 lg:hidden">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Passo apresentado</span>
            <select value={activeStep === 'academic_year' ? currentProgressStep : activeStep} onChange={(event: ChangeEvent<HTMLSelectElement>) => navigateToStep(event.target.value as SetupStepId)} className={selectClassName}>
              {setupSteps.map(step => <option key={step.id} value={step.id} disabled={!isStepUnlocked(step.id)}>{step.number}. {step.title}{completedSteps.has(step.id) ? ' — concluído' : ''}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6 hidden grid-cols-2 gap-3 lg:grid xl:grid-cols-8">
          {setupSteps.map(step => {
            const completed = completedSteps.has(step.id)
            const active = activeStep === step.id
            const unlocked = isStepUnlocked(step.id)
            return (
              <button key={step.id} type="button" disabled={!unlocked} onClick={() => navigateToStep(step.id)} className={`min-w-0 rounded-2xl border p-3 text-left transition ${active ? 'border-cyan-300/40 bg-cyan-300/[0.09] shadow-lg shadow-cyan-950/15' : completed ? 'border-emerald-300/20 bg-emerald-300/[0.05] hover:border-emerald-300/35' : unlocked ? 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]' : 'cursor-not-allowed border-white/[0.06] bg-white/[0.015] opacity-40'}`}>
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
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Passo {activeStepDefinition.number} de {totalVisibleSteps}</p>
              <p className="mt-2 font-black text-white">{activeStepDefinition.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{activeStepDefinition.description}</p>
            </div>
            {activeStep !== currentProgressStep && isStepUnlocked(currentProgressStep) ? <button type="button" onClick={() => navigateToStep(currentProgressStep)} className="shrink-0 rounded-xl border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-300/[0.12]">Ir para o passo atual</button> : null}
          </div>
        ) : null}
      </section>

      <div key={activeStep} className="mt-6">{renderActiveStep()}</div>
      <p className="mt-6 text-center text-xs leading-6 text-slate-500">Os passos concluídos podem ser revistos sem eliminar os dados dos passos seguintes.</p>
    </div>
  )
}

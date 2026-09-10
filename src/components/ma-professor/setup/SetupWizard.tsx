import {
  type ChangeEvent,
  useEffect,
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
import ModulesSetupCourseSubjectGuard from './ModulesSetupCourseSubjectGuard'
import PlanificationsSetupStep from './PlanificationsSetupStep'
import SchedulePdfImportStep from './SchedulePdfImportStep'
import SetupConfirmationStep from './SetupConfirmationStep'
import SetupDocumentIntakePanel from './SetupDocumentIntakePanel'
import StudentsSetupStep from './StudentsSetupStep'
import SubjectsSetupStep from './SubjectsSetupStep'
import WeeklyScheduleSetupStep from './WeeklyScheduleSetupStep'
import type {
  SetupImportDocumentKind
} from './setupDocumentClassifier'
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

type IntakeKind = Exclude<
  SetupImportDocumentKind,
  'unknown'
>

type QueuedDocument = {
  kind: IntakeKind
  file: File
}

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

function hasCompleteImportedSchedule(
  snapshot: SetupSnapshot
) {
  return hasCompleteScheduleCoverage(
    snapshot
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

function findButtonByText(value: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('button')
  ).find(button =>
    button.textContent?.trim() === value
  ) ?? null
}

function attachFileToInput(
  input: HTMLInputElement,
  file: File
) {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
  input.dispatchEvent(
    new Event('change', { bubbles: true })
  )
}

export default function SetupWizard({ snapshot, onSnapshotChange, onCompleted }: SetupWizardProps) {
  const [activeStep, setActiveStep] = useState<SetupStepId>(() => getInitialStep(snapshot))
  const [showScheduleImport, setShowScheduleImport] = useState(false)
  const [queuedDocument, setQueuedDocument] =
    useState<QueuedDocument | null>(null)

  useEffect(() => {
    if (!queuedDocument) {
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 30

    const tryHandoff = () => {
      if (cancelled || !queuedDocument) {
        return true
      }

      attempts += 1

      if (queuedDocument.kind === 'schedule') {
        if (!showScheduleImport) {
          return false
        }

        const input = document.querySelector<HTMLInputElement>(
          'input[type="file"][accept="application/pdf,.pdf"]'
        )

        if (!input) {
          return false
        }

        attachFileToInput(input, queuedDocument.file)
        setQueuedDocument(null)
        return true
      }

      if (
        queuedDocument.kind === 'criteria' &&
        activeStep === 'assessment_criteria'
      ) {
        let input = document.querySelector<HTMLInputElement>(
          'input[type="file"][accept="application/pdf,.pdf"]'
        )

        if (!input) {
          findButtonByText('Importar PDF')?.click()
          input = document.querySelector<HTMLInputElement>(
            'input[type="file"][accept="application/pdf,.pdf"]'
          )
        }

        if (!input) {
          return false
        }

        attachFileToInput(input, queuedDocument.file)
        setQueuedDocument(null)
        return true
      }

      if (
        queuedDocument.kind === 'planification' &&
        activeStep === 'modules'
      ) {
        let input = document.querySelector<HTMLInputElement>(
          'input[type="file"][accept=".pdf,.docx"]'
        )

        if (!input) {
          findButtonByText('Importar PDF ou Word')?.click()
          input = document.querySelector<HTMLInputElement>(
            'input[type="file"][accept=".pdf,.docx"]'
          )
        }

        if (!input) {
          return false
        }

        attachFileToInput(input, queuedDocument.file)
        setQueuedDocument(null)
        return true
      }

      return false
    }

    if (tryHandoff()) {
      return
    }

    const interval = window.setInterval(() => {
      if (
        tryHandoff() ||
        attempts >= maxAttempts
      ) {
        window.clearInterval(interval)
      }
    }, 75)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [
    activeStep,
    queuedDocument,
    showScheduleImport
  ])

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
  const readiness =
    getMAProfessorSetupReadiness(
      snapshot
    )
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

  function handleOpenDocument(
    kind: IntakeKind,
    file: File
  ) {
    setQueuedDocument({ kind, file })

    if (kind === 'schedule') {
      setShowScheduleImport(true)
      return
    }

    navigateToStep(
      kind === 'criteria'
        ? 'assessment_criteria'
        : 'modules'
    )
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
    setQueuedDocument(null)
    setShowScheduleImport(false)
    setActiveStep(getFirstIncompleteStep(preparedSnapshot))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const commonProps = { snapshot, onSnapshotChange, onCompleted: handleStepCompleted }

  function renderActiveStep() {
    switch (activeStep) {
      case 'academic_year': return <AcademicYearSummary snapshot={snapshot} onContinue={() => navigateToStep(currentProgressStep)} />
      case 'groups': return <GroupsSetupStep {...commonProps} />
      case 'subjects': return <SubjectsSetupStep {...commonProps} />
      case 'modules': return (
        <ModulesSetupCourseSubjectGuard
          {...commonProps}
          onEditSubjects={() => navigateToStep('subjects')}
        />
      )
      case 'weekly_schedule': return <WeeklyScheduleSetupStep {...commonProps} />
      case 'assessment_criteria': return (
        <div className="space-y-6">
          <AssessmentCriteriaPdfImportPanel
            snapshot={snapshot}
            onImported={onSnapshotChange}
          />
          <AssessmentCriteriaSetupStep {...commonProps} />
        </div>
      )
      case 'planifications': return <PlanificationsSetupStep {...commonProps} />
      case 'students': return <StudentsSetupStep {...commonProps} />
      case 'confirmation': return <SetupConfirmationStep {...commonProps} onEditStep={navigateToStep} />
      default: return null
    }
  }

  if (showScheduleImport) {
    return <SchedulePdfImportStep snapshot={snapshot} onImported={handleScheduleImported} onContinueWithoutPdf={() => {
      setShowScheduleImport(false)
      setQueuedDocument(null)
    }} />
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Configuração · Ensino profissional / secundário</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Prepare o essencial e complete o resto quando quiser.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Ano letivo ativo: {snapshot.academicYear.name}</p>
          </div>
          <div className="min-w-[12rem] rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Configuração completa</span><span className="text-sm font-black text-cyan-100">{completedCount}/{totalSetupSteps}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${completionPercent}%` }} /></div>
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
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new Event(
                    MA_PROFESSOR_OPEN_DAILY_EVENT
                  )
                )
              }
              className="shrink-0 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-black text-emerald-950 transition hover:brightness-110"
            >
              Abrir aula de hoje
            </button>
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
              <button key={step.id} type="button" onClick={() => navigateToStep(step.id)} className={`min-w-0 rounded-2xl border p-3 text-left transition ${active ? 'border-cyan-300/40 bg-cyan-300/[0.09] shadow-lg shadow-cyan-950/15' : completed ? 'border-emerald-300/20 bg-emerald-300/[0.05] hover:border-emerald-300/35' : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]'}`}>
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
            {activeStep !== currentProgressStep ? <button type="button" onClick={() => navigateToStep(currentProgressStep)} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100">Ir para o passo atual</button> : null}
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        <SetupDocumentIntakePanel
          onOpenDocument={handleOpenDocument}
        />
      </div>

      {queuedDocument ? (
        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4 text-sm leading-6 text-amber-50">
          <span className="font-black">Documento preparado:</span>{' '}
          {queuedDocument.file.name}. O MA-Professor está a encaminhá-lo para o importador especializado correspondente.
        </div>
      ) : null}

      <div key={activeStep} className="mt-6">{renderActiveStep()}</div>
      <p className="mt-6 text-center text-xs leading-6 text-slate-500">Pode saltar qualquer área e regressar depois. O MA-Professor apenas impede guardar dados estruturalmente inválidos; uma pendência não bloqueia o resto da configuração.</p>
    </div>
  )
}

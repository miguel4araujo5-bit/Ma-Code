import {
  liveQuery
} from 'dexie'

import {
  useEffect,
  useState
} from 'react'

import MAProfessorApp, {
  type MAProfessorWorkspaceView
} from '../MAProfessorApp'
import {
  maProfessorRepository,
  type SetupSnapshot
} from '../repository'
import SetupWizard from '../setup/SetupWizard'
import {
  SettingsWorkspaceView
} from '../settings/SettingsWorkspaceView'
import type {
  AcademicYear,
  SetupStepId
} from '../types'
import {
  AttendanceProductWorkspace
} from './AttendanceProductWorkspace'
import {
  ManagementSidebarBridge
} from './ManagementSidebarBridge'
import {
  ScheduleProductWorkspace
} from './ScheduleProductWorkspace'

type MenuSection =
  | 'home'
  | 'management'
  | 'attendance'
  | 'schedule'
  | 'configuration'
  | 'settings'
  | 'restore'

export type ProductMenuNavigationTarget =
  | MAProfessorWorkspaceView
  | 'attendance'
  | 'schedule'
  | 'settings'

export interface ProductMenuNavigationRequest {
  id: number
  target: ProductMenuNavigationTarget
}

interface ProductMenuWorkspaceProps {
  academicYear: AcademicYear | null
  navigationRequest?: ProductMenuNavigationRequest | null
  onDataChanged: () => void | Promise<void>
  onOpenDaily: () => void
  onOpenCalendar: () => void
}

interface SuggestedAcademicYear {
  name: string
  startDate: string
  endDate: string
}

const managementWorkspaceTargets: MAProfessorWorkspaceView[] = [
  'dashboard',
  'giae',
  'assessments',
  'planifications',
  'groups'
]

function isManagementWorkspaceTarget(
  target: ProductMenuNavigationTarget
): target is MAProfessorWorkspaceView {
  return managementWorkspaceTargets.includes(
    target as MAProfessorWorkspaceView
  )
}

const correctionCompletedSteps: SetupStepId[] = [
  'academic_year',
  'groups',
  'subjects',
  'modules',
  'weekly_schedule',
  'assessment_criteria',
  'planifications',
  'students',
  'confirmation'
]

const menuCards: Array<{
  id: Exclude<MenuSection, 'home'>
  eyebrow: string
  title: string
  description: string
  icon: string
}> = [
  {
    id: 'management',
    eyebrow: 'Pedagogia',
    title: 'Sumários, avaliações e planificações',
    description:
      'Consulte os sumários pendentes, as médias, o progresso das UFCD, as turmas e as planificações.',
    icon: '▤'
  },
  {
    id: 'attendance',
    eyebrow: 'Acompanhamento',
    title: 'Faltas e recuperações',
    description:
      'Consulte percentagens de faltas, alertas e atividades de recuperação.',
    icon: '✓'
  },
  {
    id: 'schedule',
    eyebrow: 'Organização',
    title: 'Horário e calendário escolar',
    description:
      'Altere o horário semanal e registe feriados, interrupções e outros eventos.',
    icon: '▦'
  },
  {
    id: 'configuration',
    eyebrow: 'Configuração pedagógica',
    title: 'Corrigir configuração inicial',
    description:
      'Reabra o assistente simples ou a configuração avançada para corrigir horário, planificações, critérios, turmas ou alunos sem reiniciar o ano letivo.',
    icon: '↶'
  },
  {
    id: 'settings',
    eyebrow: 'Configuração',
    title: 'Definições e segurança',
    description:
      'Aceda ao perfil, pesquisa global, segurança e recuperação, exportações e licença.',
    icon: '⚙'
  },
  {
    id: 'restore',
    eyebrow: 'Recuperação',
    title: 'Restaurar dados',
    description:
      'Recupere a cópia cifrada da nuvem ou escolha uma cópia guardada neste dispositivo.',
    icon: '↺'
  }
]

let academicYearPreparationPromise: Promise<AcademicYear> | null = null

function toISODate(
  year: number,
  month: number,
  day: number
) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-')
}

function getSuggestedAcademicYear(): SuggestedAcademicYear {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const startYear = currentMonth >= 7 ? currentYear : currentYear - 1

  return {
    name: `${startYear}/${startYear + 1}`,
    startDate: toISODate(startYear, 9, 1),
    endDate: toISODate(startYear + 1, 8, 31)
  }
}

function getErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return 'Não foi possível preparar automaticamente o ano letivo.'
}

function normalizeCompletedCorrectionSnapshot(
  snapshot: SetupSnapshot
) {
  const completed = Boolean(
    snapshot.academicYear.setupCompletedAt ||
    snapshot.progress?.completedAt
  )

  if (
    !completed ||
    !snapshot.progress
  ) {
    return snapshot
  }

  return {
    ...snapshot,
    progress: {
      ...snapshot.progress,
      completedSteps: Array.from(
        new Set<SetupStepId>([
          ...snapshot.progress.completedSteps,
          ...correctionCompletedSteps
        ])
      )
    }
  }
}

async function ensureAcademicYear(): Promise<AcademicYear> {
  if (academicYearPreparationPromise) {
    return academicYearPreparationPromise
  }

  const preparation = (async () => {
    const activeAcademicYear =
      await maProfessorRepository.getActiveAcademicYear()

    if (activeAcademicYear) {
      return activeAcademicYear
    }

    const suggested = getSuggestedAcademicYear()
    const existingYears =
      await maProfessorRepository.listAcademicYears()

    const existingSuggestedYear = existingYears.find(
      year => year.name.trim() === suggested.name
    )

    if (existingSuggestedYear) {
      if (existingSuggestedYear.active) {
        return existingSuggestedYear
      }

      return maProfessorRepository.setActiveAcademicYear(
        existingSuggestedYear.id
      )
    }

    return maProfessorRepository.createAcademicYear({
      name: suggested.name,
      startDate: suggested.startDate,
      endDate: suggested.endDate,
      active: true
    })
  })()

  academicYearPreparationPromise = preparation

  try {
    return await preparation
  } finally {
    if (academicYearPreparationPromise === preparation) {
      academicYearPreparationPromise = null
    }
  }
}

function MenuHeader({
  title,
  onBack
}: {
  title: string
  onBack: () => void
}) {
  return (
    <div className="border-b border-white/10 bg-slate-950/80 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white"
        >
          ← Menu
        </button>

        <div className="min-w-0">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
            MA-Professor
          </p>

          <h1 className="truncate text-base font-black text-white sm:text-lg">
            {title}
          </h1>
        </div>
      </div>
    </div>
  )
}

export function ProductMenuWorkspace({
  academicYear,
  navigationRequest = null,
  onDataChanged,
  onOpenDaily,
  onOpenCalendar
}: ProductMenuWorkspaceProps) {
  const [section, setSection] = useState<MenuSection>('home')
  const [preparingYear, setPreparingYear] = useState(!academicYear)
  const [yearError, setYearError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [availableYears, setAvailableYears] = useState<AcademicYear[]>([])
  const [changingYear, setChangingYear] = useState(false)
  const [configurationSnapshot, setConfigurationSnapshot] =
    useState<SetupSnapshot | null>(null)
  const [configurationLoading, setConfigurationLoading] = useState(false)
  const [configurationError, setConfigurationError] = useState('')
  const [configurationReloadKey, setConfigurationReloadKey] = useState(0)

  const setupCompleted = Boolean(academicYear?.setupCompletedAt)

  useEffect(() => {
    if (!setupCompleted) {
      setSection('management')
    }
  }, [setupCompleted])

  useEffect(() => {
    const target =
      navigationRequest?.target

    if (!target) {
      return
    }

    if (
      isManagementWorkspaceTarget(
        target
      )
    ) {
      setSection('management')
      return
    }

    setSection(target)
  }, [navigationRequest?.id])

  useEffect(() => {
    if (
      !academicYear ||
      setupCompleted
    ) {
      return
    }

    let disposed = false

    const subscription =
      liveQuery(
        () =>
          maProfessorRepository.getAcademicYear(
            academicYear.id
          )
      ).subscribe({
        next: persistedYear => {
          if (
            disposed ||
            !persistedYear?.setupCompletedAt
          ) {
            return
          }

          disposed = true
          setSection('home')
          subscription.unsubscribe()

          void Promise.resolve(
            onDataChanged()
          ).catch(() => {
            // O estado persistido continua válido; a atualização exterior
            // poderá ser repetida pela navegação seguinte ou por reload.
          })
        },
        error: () => {
          // Falhar esta observação nunca pode bloquear o setup local.
        }
      })

    return () => {
      disposed = true
      subscription.unsubscribe()
    }
  }, [
    academicYear,
    onDataChanged,
    setupCompleted
  ])

  useEffect(() => {
    if (academicYear) {
      setPreparingYear(false)
      setYearError('')
      return
    }

    let cancelled = false

    setPreparingYear(true)
    setYearError('')

    void ensureAcademicYear()
      .then(async () => {
        if (cancelled) {
          return
        }

        await onDataChanged()
      })
      .catch(error => {
        if (cancelled) {
          return
        }

        setYearError(getErrorMessage(error))
        setPreparingYear(false)
      })

    return () => {
      cancelled = true
    }
  }, [academicYear, onDataChanged, retryKey])

  useEffect(() => {
    if (!academicYear) {
      setAvailableYears([])
      return
    }

    let cancelled = false

    void maProfessorRepository.listAcademicYears()
      .then(years => {
        if (!cancelled) {
          setAvailableYears(years)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableYears([academicYear])
        }
      })

    return () => {
      cancelled = true
    }
  }, [academicYear])

  useEffect(() => {
    if (
      section !== 'configuration' ||
      !academicYear
    ) {
      return
    }

    let cancelled = false

    setConfigurationLoading(true)
    setConfigurationError('')

    void maProfessorRepository
      .getSetupSnapshot(academicYear.id)
      .then(nextSnapshot => {
        if (!cancelled) {
          setConfigurationSnapshot(
            normalizeCompletedCorrectionSnapshot(nextSnapshot)
          )
        }
      })
      .catch(error => {
        if (!cancelled) {
          setConfigurationError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setConfigurationLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    academicYear?.id,
    configurationReloadKey,
    section
  ])

  async function handleAcademicYearChange(nextAcademicYearId: string) {
    if (
      !nextAcademicYearId ||
      !academicYear ||
      nextAcademicYearId === academicYear.id ||
      changingYear
    ) {
      return
    }

    setChangingYear(true)

    try {
      await maProfessorRepository.setActiveAcademicYear(nextAcademicYearId)
      setConfigurationSnapshot(null)
      await onDataChanged()
    } finally {
      setChangingYear(false)
    }
  }

  function handleConfigurationSnapshotChange(
    nextSnapshot: SetupSnapshot
  ) {
    setConfigurationSnapshot(
      normalizeCompletedCorrectionSnapshot(nextSnapshot)
    )
  }

  async function handleLeaveConfiguration() {
    try {
      await onDataChanged()
    } catch {
      // As correções já ficaram persistidas localmente. Um refresh posterior
      // volta a sincronizar o estado exterior do produto.
    } finally {
      setSection('home')
    }
  }

  if (!academicYear && preparingYear) {
    return (
      <main className="flex min-h-[calc(100vh-58px)] items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
        <section className="w-full max-w-lg rounded-3xl border border-cyan-300/15 bg-slate-900/70 p-7 text-center shadow-2xl shadow-cyan-950/20">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

          <h1 className="mt-5 text-xl font-black">
            A preparar o MA-Professor
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            O ano letivo é preparado automaticamente. Não precisa de preencher datas antes de começar.
          </p>
        </section>
      </main>
    )
  }

  if (!academicYear && yearError) {
    return (
      <main className="flex min-h-[calc(100vh-58px)] items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
        <section className="w-full max-w-lg rounded-3xl border border-rose-300/20 bg-slate-900/70 p-7 text-center shadow-2xl shadow-black/20">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
            Não foi possível preparar a aplicação
          </p>

          <h1 className="mt-3 text-xl font-black">
            O ano letivo não pôde ser preparado automaticamente.
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            {yearError}
          </p>

          <button
            type="button"
            onClick={() => setRetryKey(current => current + 1)}
            className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-110"
          >
            Tentar novamente
          </button>
        </section>
      </main>
    )
  }

  if (section === 'management') {
    return (
      <div className="min-h-[calc(100vh-58px)] bg-slate-950">
        {setupCompleted ? (
          <MenuHeader
            title="Sumários, avaliações e planificações"
            onBack={() => setSection('home')}
          />
        ) : null}

        <MAProfessorApp
          workspaceRequest={
            navigationRequest &&
            isManagementWorkspaceTarget(
              navigationRequest.target
            )
              ? {
                  id:
                    navigationRequest.id,
                  workspace:
                    navigationRequest.target
                }
              : null
          }
        />
        <ManagementSidebarBridge
          onOpenAttendance={() => setSection('attendance')}
          onOpenSchedule={() => setSection('schedule')}
          onOpenSettings={() => setSection('settings')}
        />
      </div>
    )
  }

  if (section === 'attendance' && academicYear) {
    return (
      <div className="min-h-[calc(100vh-58px)] bg-slate-950">
        <MenuHeader
          title="Faltas e recuperações"
          onBack={() => setSection('home')}
        />

        <AttendanceProductWorkspace academicYearId={academicYear.id} />
      </div>
    )
  }

  if (section === 'schedule' && academicYear) {
    return (
      <div className="min-h-[calc(100vh-58px)] bg-slate-950">
        <MenuHeader
          title="Horário e calendário escolar"
          onBack={() => setSection('home')}
        />

        <ScheduleProductWorkspace academicYearId={academicYear.id} />
      </div>
    )
  }

  if (section === 'configuration' && academicYear) {
    return (
      <div className="min-h-[calc(100vh-58px)] bg-slate-950">
        <MenuHeader
          title="Corrigir configuração"
          onBack={() => void handleLeaveConfiguration()}
        />

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[100rem]">
            <section className="mb-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 text-white sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                Correção segura
              </p>
              <h1 className="mt-2 text-xl font-black sm:text-2xl">
                A configuração continua concluída enquanto corrige os dados.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Pode voltar ao horário, planificações, critérios, alunos ou abrir o assistente simples. As alterações guardadas substituem apenas os dados que editar; não reiniciam o ano letivo nem apagam o trabalho existente.
              </p>
            </section>

            {configurationLoading && !configurationSnapshot ? (
              <section className="rounded-3xl border border-white/10 bg-slate-900/65 p-8 text-center text-white">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
                <p className="mt-4 text-sm font-black">
                  A abrir a configuração atual…
                </p>
              </section>
            ) : configurationError ? (
              <section className="rounded-3xl border border-rose-300/20 bg-rose-300/[0.06] p-6 text-white">
                <p className="text-sm font-bold text-rose-100">
                  {configurationError}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setConfigurationReloadKey(current => current + 1)
                  }
                  className="mt-4 rounded-xl border border-rose-200/20 bg-rose-200/10 px-4 py-2.5 text-sm font-black text-rose-50"
                >
                  Tentar novamente
                </button>
              </section>
            ) : configurationSnapshot ? (
              <SetupWizard
                snapshot={configurationSnapshot}
                onSnapshotChange={handleConfigurationSnapshotChange}
                onCompleted={handleConfigurationSnapshotChange}
                initialMode="advanced"
              />
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (
    section === 'settings' ||
    section === 'restore'
  ) {
    const isRestore =
      section === 'restore'

    return (
      <div className="min-h-[calc(100vh-58px)] bg-slate-950">
        <MenuHeader
          title={
            isRestore
              ? 'Restaurar dados'
              : 'Definições'
          }
          onBack={() =>
            setSection(
              setupCompleted
                ? 'home'
                : 'management'
            )
          }
        />

        <SettingsWorkspaceView
          academicYearId={academicYear?.id ?? null}
          onDataChanged={onDataChanged}
          initialTab={
            isRestore
              ? 'backup'
              : 'profile'
          }
          initialSecuritySection={
            isRestore
              ? 'restore'
              : 'protection'
          }
        />
      </div>
    )
  }

  return (
    <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                Menu
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Tudo o que não precisa todos os dias.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                A área principal fica reservada ao sumário, faltas e notas. A configuração e os relatórios continuam disponíveis aqui.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              {availableYears.length > 1 ? (
                <label className="block">
                  <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
                    Ano letivo
                  </span>

                  <select
                    value={academicYear?.id ?? ''}
                    disabled={changingYear}
                    onChange={event =>
                      void handleAcademicYearChange(event.target.value)
                    }
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-black text-slate-200 outline-none transition focus:border-cyan-300/40 disabled:opacity-50"
                  >
                    {availableYears.map(year => (
                      <option
                        key={year.id}
                        value={year.id}
                      >
                        {year.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <button
                type="button"
                onClick={onOpenDaily}
                className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110"
              >
                Abrir hoje
              </button>

              <button
                type="button"
                onClick={onOpenCalendar}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-white transition hover:border-cyan-300/30"
              >
                Calendário
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          {menuCards.map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSection(card.id)}
              className="group rounded-3xl border border-white/10 bg-slate-900/55 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-slate-900 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-lg font-black text-cyan-200">
                  {card.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                    {card.eyebrow}
                  </span>

                  <span className="mt-1 block text-lg font-black text-white">
                    {card.title}
                  </span>

                  <span className="mt-2 block text-sm leading-6 text-slate-400">
                    {card.description}
                  </span>
                </span>

                <span className="mt-1 text-lg text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-200">
                  →
                </span>
              </div>
            </button>
          ))}
        </section>
      </div>
    </main>
  )
}

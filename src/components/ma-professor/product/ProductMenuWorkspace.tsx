import {
  liveQuery
} from 'dexie'

import {
  useEffect,
  useState
} from 'react'

import MAProfessorApp from '../MAProfessorApp'
import {
  maProfessorRepository
} from '../repository'
import {
  SettingsWorkspaceView
} from '../settings/SettingsWorkspaceView'
import type {
  AcademicYear
} from '../types'
import {
  AttendanceProductWorkspace
} from './AttendanceProductWorkspace'
import {
  ScheduleProductWorkspace
} from './ScheduleProductWorkspace'

type MenuSection =
  | 'home'
  | 'management'
  | 'attendance'
  | 'schedule'
  | 'settings'

interface ProductMenuWorkspaceProps {
  academicYear: AcademicYear | null
  onDataChanged: () => void | Promise<void>
  onOpenDaily: () => void
  onOpenCalendar: () => void
}

interface SuggestedAcademicYear {
  name: string
  startDate: string
  endDate: string
}

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
    id: 'settings',
    eyebrow: 'Configuração',
    title: 'Definições, pesquisa e cópias',
    description:
      'Aceda ao perfil, pesquisa global, cópias de segurança, restauro e licença.',
    icon: '⚙'
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

  const setupCompleted = Boolean(academicYear?.setupCompletedAt)

  useEffect(() => {
    if (!setupCompleted) {
      setSection('management')
    }
  }, [setupCompleted])

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
      await onDataChanged()
    } finally {
      setChangingYear(false)
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

        <MAProfessorApp />
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

  if (section === 'settings') {
    return (
      <div className="min-h-[calc(100vh-58px)] bg-slate-950">
        <MenuHeader
          title="Definições e dados"
          onBack={() => setSection('home')}
        />

        <SettingsWorkspaceView
          academicYearId={academicYear?.id ?? null}
          onDataChanged={onDataChanged}
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

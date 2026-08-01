import { useEffect, useState } from 'react'

import MAProfessorApp from '../MAProfessorApp'
import { SettingsWorkspaceView } from '../settings/SettingsWorkspaceView'
import type { AcademicYear } from '../types'
import { AttendanceProductWorkspace } from './AttendanceProductWorkspace'
import { ScheduleProductWorkspace } from './ScheduleProductWorkspace'

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
  const setupCompleted = Boolean(academicYear?.setupCompletedAt)

  useEffect(() => {
    if (!setupCompleted) {
      setSection('management')
    }
  }, [setupCompleted])

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
                A área principal fica reservada ao sumário, faltas e notas. A
                configuração e os relatórios continuam disponíveis aqui.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
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

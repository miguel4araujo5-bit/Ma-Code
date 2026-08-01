import { useCallback, useEffect, useState } from 'react'

import { AccessGate } from '../access/AccessGate'
import DailyWorkspaceView from '../daily/DailyWorkspaceView'
import { maProfessorRepository } from '../repository'
import type { AcademicYear, EntityId, ISODate } from '../types'
import { CalendarProductWorkspace } from './CalendarProductWorkspace'
import { ProductMenuWorkspace } from './ProductMenuWorkspace'
import {
  ProductNavigation,
  type ProductTheme,
  type ProductWorkspace
} from './ProductNavigation'

import './maProfessorTheme.css'

interface DailyTarget {
  date?: ISODate
  lessonId?: EntityId
}

const THEME_STORAGE_KEY = 'ma-professor-theme'

function getInitialTheme(): ProductTheme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }
  } catch {
    // O tema continua a funcionar mesmo que o armazenamento esteja bloqueado.
  }

  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function ProductContent() {
  const [workspace, setWorkspace] = useState<ProductWorkspace>('daily')
  const [academicYear, setAcademicYear] =
    useState<AcademicYear | null>(null)
  const [checkingYear, setCheckingYear] = useState(true)
  const [dailyTarget, setDailyTarget] = useState<DailyTarget>({})
  const [theme, setTheme] = useState<ProductTheme>(getInitialTheme)

  const refreshAcademicYear = useCallback(async () => {
    setCheckingYear(true)

    try {
      const activeYear =
        await maProfessorRepository.getActiveAcademicYear()

      setAcademicYear(activeYear ?? null)

      return activeYear ?? null
    } catch {
      setAcademicYear(null)

      return null
    } finally {
      setCheckingYear(false)
    }
  }, [])

  useEffect(() => {
    void refreshAcademicYear().then(activeYear => {
      if (!activeYear?.setupCompletedAt) {
        setWorkspace('menu')
      }
    })
  }, [refreshAcademicYear])

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // O seletor mantém-se funcional durante a sessão atual.
    }
  }, [theme])

  const handleSelect = async (nextWorkspace: ProductWorkspace) => {
    if (nextWorkspace === 'menu') {
      await refreshAcademicYear()
      setWorkspace('menu')

      return
    }

    const activeYear = await refreshAcademicYear()

    if (!activeYear?.setupCompletedAt) {
      setWorkspace('menu')

      return
    }

    if (nextWorkspace === 'daily') {
      setDailyTarget({})
    }

    setWorkspace(nextWorkspace)
  }

  const handleDataChanged = async () => {
    await refreshAcademicYear()
  }

  const openLessonFromCalendar = (
    date: ISODate,
    lessonId: EntityId
  ) => {
    setDailyTarget({
      date,
      lessonId
    })

    setWorkspace('daily')
  }

  const showLoading = workspace !== 'menu' && checkingYear

  return (
    <div
      className={`ma-professor-product min-h-screen ${
        theme === 'dark'
          ? 'bg-slate-950 text-white'
          : 'bg-slate-50 text-slate-950'
      }`}
      data-theme={theme}
    >
      <ProductNavigation
        workspace={workspace}
        academicYearName={academicYear?.name ?? null}
        theme={theme}
        onSelect={next => void handleSelect(next)}
        onToggleTheme={() =>
          setTheme(current => (current === 'dark' ? 'light' : 'dark'))
        }
      />

      {showLoading ? (
        <main className="flex min-h-[calc(100vh-58px)] items-center justify-center bg-slate-950 px-6 text-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

            <p className="mt-4 text-sm font-semibold text-slate-400">
              A preparar o ano letivo…
            </p>
          </div>
        </main>
      ) : null}

      {workspace === 'daily' &&
      academicYear?.setupCompletedAt &&
      !checkingYear ? (
        <DailyWorkspaceView
          key={`${dailyTarget.date ?? 'today'}-${
            dailyTarget.lessonId ?? 'auto'
          }`}
          academicYearId={academicYear.id}
          initialDate={dailyTarget.date}
          initialLessonId={dailyTarget.lessonId}
        />
      ) : null}

      {workspace === 'calendar' &&
      academicYear?.setupCompletedAt &&
      !checkingYear ? (
        <CalendarProductWorkspace
          academicYearId={academicYear.id}
          onOpenLesson={openLessonFromCalendar}
        />
      ) : null}

      {workspace === 'menu' ? (
        <ProductMenuWorkspace
          academicYear={academicYear}
          onDataChanged={handleDataChanged}
          onOpenDaily={() => void handleSelect('daily')}
          onOpenCalendar={() => void handleSelect('calendar')}
        />
      ) : null}

      {workspace !== 'menu' &&
      !checkingYear &&
      !academicYear ? (
        <main className="min-h-[calc(100vh-58px)] bg-slate-950 px-4 py-10 text-white">
          <section className="mx-auto max-w-2xl rounded-3xl border border-amber-300/20 bg-slate-900 p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
              Configuração necessária
            </p>

            <h1 className="mt-3 text-2xl font-black">
              Termine primeiro a configuração inicial.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Crie o ano letivo, as turmas, as disciplinas e os módulos
              antes de abrir esta área.
            </p>

            <button
              type="button"
              onClick={() => setWorkspace('menu')}
              className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
            >
              Abrir configuração
            </button>
          </section>
        </main>
      ) : null}
    </div>
  )
}

export function MAProfessorProduct() {
  return (
    <AccessGate>
      <ProductContent />
    </AccessGate>
  )
}

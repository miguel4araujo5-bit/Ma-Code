import {
  useCallback,
  useEffect,
  useState
} from 'react'

import MAProfessorApp from '../MAProfessorApp'
import { AccessGate } from '../access/AccessGate'
import { maProfessorRepository } from '../repository'
import { SettingsWorkspaceView } from '../settings/SettingsWorkspaceView'
import type { AcademicYear } from '../types'
import { AttendanceProductWorkspace } from './AttendanceProductWorkspace'
import {
  ProductNavigation,
  type ProductWorkspace
} from './ProductNavigation'
import { ScheduleProductWorkspace } from './ScheduleProductWorkspace'

function ProductContent() {
  const [workspace, setWorkspace] =
    useState<ProductWorkspace>('application')
  const [academicYear, setAcademicYear] =
    useState<AcademicYear | null>(null)
  const [checkingYear, setCheckingYear] = useState(true)

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
    void refreshAcademicYear()
  }, [refreshAcademicYear])

  const handleSelect = async (nextWorkspace: ProductWorkspace) => {
    if (nextWorkspace === 'application') {
      setWorkspace(nextWorkspace)
      return
    }

    const activeYear = await refreshAcademicYear()

    if (!activeYear && nextWorkspace !== 'settings') {
      setWorkspace('application')
      return
    }

    setWorkspace(nextWorkspace)
  }

  const handleDataChanged = () => {
    void refreshAcademicYear()
    setWorkspace('application')
  }

  return (
    <div className="ma-professor-product min-h-screen bg-slate-950">
      <ProductNavigation
        workspace={workspace}
        academicYearName={academicYear?.name ?? null}
        onSelect={next => void handleSelect(next)}
      />

      {workspace !== 'application' && checkingYear ? (
        <main className="flex min-h-[calc(100vh-58px)] items-center justify-center bg-slate-950 px-6 text-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
            <p className="mt-4 text-sm font-semibold text-slate-400">
              A preparar o ano letivo…
            </p>
          </div>
        </main>
      ) : null}

      {workspace === 'application' ? <MAProfessorApp /> : null}

      {workspace === 'attendance' && academicYear ? (
        <AttendanceProductWorkspace
          academicYearId={academicYear.id}
        />
      ) : null}

      {workspace === 'schedule' && academicYear ? (
        <ScheduleProductWorkspace
          academicYearId={academicYear.id}
        />
      ) : null}

      {workspace === 'settings' ? (
        <SettingsWorkspaceView
          academicYearId={academicYear?.id ?? null}
          onDataChanged={handleDataChanged}
        />
      ) : null}

      {workspace !== 'application' && !checkingYear && !academicYear && workspace !== 'settings' ? (
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
              onClick={() => setWorkspace('application')}
              className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
            >
              Abrir configuração
            </button>
          </section>
        </main>
      ) : null}

      <style>{`
        .ma-professor-product > div:not(header) aside button[title="Em breve"] {
          display: none;
        }
      `}</style>
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

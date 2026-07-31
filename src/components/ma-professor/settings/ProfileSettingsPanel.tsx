import {
  type FormEvent,
  useEffect,
  useState
} from 'react'

import { maProfessorRepository } from '../repository'

interface FormState {
  displayName: string
  schoolName: string
  defaultPeriodMinutes: string
  defaultAbsentAssessmentScore: string
  defaultExemptAssessmentScore: string
  absenceWarningPercent: string
  learningRecoveryThresholdPercent: string
  weekStartsOn: '1' | '7'
  theme: 'dark' | 'system'
}

const emptyForm: FormState = {
  displayName: '',
  schoolName: '',
  defaultPeriodMinutes: '50',
  defaultAbsentAssessmentScore: '0',
  defaultExemptAssessmentScore: '10',
  absenceWarningPercent: '8',
  learningRecoveryThresholdPercent: '10',
  weekStartsOn: '1',
  theme: 'dark'
}

const fieldClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível guardar as definições.'
}

export function ProfileSettingsPanel() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    let active = true

    void Promise.all([
      maProfessorRepository.getTeacherProfile(),
      maProfessorRepository.getSettings()
    ])
      .then(([profile, settings]) => {
        if (!active) {
          return
        }

        setForm({
          displayName: profile?.displayName ?? '',
          schoolName: profile?.schoolName ?? '',
          defaultPeriodMinutes: String(
            settings.defaultPeriodMinutes
          ),
          defaultAbsentAssessmentScore: String(
            settings.defaultAbsentAssessmentScore
          ),
          defaultExemptAssessmentScore: String(
            settings.defaultExemptAssessmentScore
          ),
          absenceWarningPercent: String(
            settings.absenceWarningPercent
          ),
          learningRecoveryThresholdPercent: String(
            settings.learningRecoveryThresholdPercent
          ),
          weekStartsOn: String(settings.weekStartsOn) as '1' | '7',
          theme: settings.theme
        })
      })
      .catch(error => {
        if (active) {
          setFeedback({
            tone: 'error',
            message: getErrorMessage(error)
          })
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const update = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm(current => ({
      ...current,
      [key]: value
    }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(null)
    setSaving(true)

    try {
      const numeric = {
        defaultPeriodMinutes: Number(form.defaultPeriodMinutes),
        defaultAbsentAssessmentScore: Number(
          form.defaultAbsentAssessmentScore
        ),
        defaultExemptAssessmentScore: Number(
          form.defaultExemptAssessmentScore
        ),
        absenceWarningPercent: Number(form.absenceWarningPercent),
        learningRecoveryThresholdPercent: Number(
          form.learningRecoveryThresholdPercent
        )
      }

      if (
        Object.values(numeric).some(value => !Number.isFinite(value))
      ) {
        throw new Error(
          'Preencha todos os valores numéricos corretamente.'
        )
      }

      await Promise.all([
        maProfessorRepository.saveTeacherProfile({
          displayName: form.displayName,
          schoolName: form.schoolName
        }),
        maProfessorRepository.updateSettings({
          ...numeric,
          weekStartsOn: Number(form.weekStartsOn) as 1 | 7,
          theme: form.theme,
          locale: 'pt-PT'
        })
      ])

      setFeedback({
        tone: 'success',
        message: 'Perfil e regras gerais guardados.'
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: getErrorMessage(error)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Perfil local
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Professor e escola
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Estes dados aparecem apenas no MA-Professor deste browser.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-300">
            Nome do professor
            <input
              type="text"
              value={form.displayName}
              disabled={loading || saving}
              onChange={event =>
                update('displayName', event.target.value)
              }
              placeholder="Nome a apresentar"
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Escola ou agrupamento
            <input
              type="text"
              value={form.schoolName}
              disabled={loading || saving}
              onChange={event =>
                update('schoolName', event.target.value)
              }
              placeholder="Nome da escola"
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
          Regras gerais
        </p>
        <h2 className="mt-2 text-xl font-black text-white">
          Tempos, avaliações e faltas
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-bold text-slate-300">
            Minutos por tempo
            <input
              type="number"
              min="1"
              step="1"
              value={form.defaultPeriodMinutes}
              disabled={loading || saving}
              onChange={event =>
                update('defaultPeriodMinutes', event.target.value)
              }
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Nota quando faltou
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={form.defaultAbsentAssessmentScore}
              disabled={loading || saving}
              onChange={event =>
                update(
                  'defaultAbsentAssessmentScore',
                  event.target.value
                )
              }
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Nota quando dispensado
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={form.defaultExemptAssessmentScore}
              disabled={loading || saving}
              onChange={event =>
                update(
                  'defaultExemptAssessmentScore',
                  event.target.value
                )
              }
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Aviso preventivo de faltas (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.absenceWarningPercent}
              disabled={loading || saving}
              onChange={event =>
                update('absenceWarningPercent', event.target.value)
              }
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Limite para recuperação (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.learningRecoveryThresholdPercent}
              disabled={loading || saving}
              onChange={event =>
                update(
                  'learningRecoveryThresholdPercent',
                  event.target.value
                )
              }
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Primeiro dia da semana
            <select
              value={form.weekStartsOn}
              disabled={loading || saving}
              onChange={event =>
                update(
                  'weekStartsOn',
                  event.target.value as '1' | '7'
                )
              }
              className={fieldClass}
            >
              <option value="1">Segunda-feira</option>
              <option value="7">Domingo</option>
            </select>
          </label>

          <label className="text-sm font-bold text-slate-300">
            Aparência
            <select
              value={form.theme}
              disabled={loading || saving}
              onChange={event =>
                update(
                  'theme',
                  event.target.value as 'dark' | 'system'
                )
              }
              className={fieldClass}
            >
              <option value="dark">Escuro</option>
              <option value="system">Seguir dispositivo</option>
            </select>
          </label>
        </div>
      </section>

      {feedback ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/20 bg-rose-400/10 text-rose-200'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || saving}
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? 'A guardar…' : 'Guardar definições'}
        </button>
      </div>
    </form>
  )
}

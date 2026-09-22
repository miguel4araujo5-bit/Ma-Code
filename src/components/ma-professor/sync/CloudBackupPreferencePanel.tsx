import { useState } from 'react'

import { useMAProfessorAccess } from '../access/AccessGate'
import {
  CLOUD_BACKUP_PRIVACY_NOTICE,
  useCloudBackupPreference,
  writeCloudBackupPreference
} from './cloudBackupPreference'

export default function CloudBackupPreferencePanel({
  onlyUnanswered = false,
  onOpenSettings,
  canEnable = true
}: {
  onlyUnanswered?: boolean
  onOpenSettings?: () => void
  canEnable?: boolean
}) {
  const { session } = useMAProfessorAccess()
  const preference = useCloudBackupPreference(session)
  const [error, setError] = useState('')

  if (onlyUnanswered && preference !== 'unset') {
    return null
  }

  function choose(enabled: boolean) {
    if (enabled && !canEnable) return

    const saved = writeCloudBackupPreference(
      session,
      enabled ? 'enabled' : 'disabled'
    )
    setError(saved ? '' : 'Não foi possível guardar a escolha. Verifique se o armazenamento do browser está disponível e tente novamente.')
  }

  if (onOpenSettings) {
    return (
      <aside
        aria-label="Preferência de cópia automática"
        className="mx-3 mt-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 sm:mx-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Cópia automática desativada.</span>{' '}
            Pode ativá-la em Segurança e recuperação.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/5"
            >
              Configurar cópias
            </button>
            <button
              type="button"
              onClick={() => choose(false)}
              className="rounded-lg px-2 py-2 text-xs text-slate-400 transition hover:text-white"
            >
              Manter desativada
            </button>
          </div>
        </div>
        {error ? <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p> : null}
      </aside>
    )
  }

  return (
    <section
      aria-label="Preferência de cópia automática"
      className="rounded-2xl border border-violet-300/20 bg-slate-900 p-4 text-sm text-slate-200"
    >
      <p className="font-black text-white">
        Cópia automática neste dispositivo: {preference === 'enabled' ? 'ativa' : 'desativada'}
      </p>
      <p className="mt-2 text-xs leading-6 text-slate-300">
        {CLOUD_BACKUP_PRIVACY_NOTICE}
      </p>
      <p className="mt-2 text-xs leading-6 text-slate-400">
        Esta escolha aplica-se à sua conta neste dispositivo. Desativar impede novos envios automáticos e mantém as cópias já guardadas, o restauro e as cópias manuais.
      </p>
      <a
        href="/privacidade/ma-professor"
        className="mt-2 inline-block text-xs font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
      >
        Consultar informação de privacidade
      </a>
      <div className="mt-3 flex flex-wrap gap-3">
        {preference !== 'enabled' && canEnable ? (
          <button
            type="button"
            onClick={() => choose(true)}
            className="rounded-xl border border-violet-300/30 bg-violet-300/10 px-4 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-300/20"
          >
            Ativar cópia automática
          </button>
        ) : null}
        {preference !== 'disabled' ? (
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/5"
          >
            {preference === 'enabled' ? 'Desativar cópia automática' : 'Continuar sem cópia automática'}
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : null}
    </section>
  )
}

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
  canEnable = true,
  onEnableBlocked,
  onChoice
}: {
  onlyUnanswered?: boolean
  onOpenSettings?: () => void
  canEnable?: boolean
  onEnableBlocked?: () => void
  onChoice?: (enabled: boolean) => void
}) {
  const { session } = useMAProfessorAccess()
  const preference = useCloudBackupPreference(session)
  const [error, setError] = useState('')

  if (onlyUnanswered && preference !== 'unset') {
    return null
  }

  function choose(enabled: boolean) {
    if (
      enabled &&
      !canEnable
    ) {
      onEnableBlocked?.()
      return
    }

    const saved = writeCloudBackupPreference(
      session,
      enabled ? 'enabled' : 'disabled'
    )

    setError(
      saved
        ? ''
        : 'Não foi possível guardar a escolha. Verifique se o armazenamento do browser está disponível e tente novamente.'
    )

    if (saved) {
      onChoice?.(enabled)
    }
  }

  if (onOpenSettings) {
    return (
      <aside
        aria-label="Preferência de lembretes de cópia online"
        className="mx-3 mt-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 sm:mx-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Lembretes de cópia online desativados.</span>{' '}
            Pode ativá-los em Segurança e recuperação.
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
              Manter desativados
            </button>
          </div>
        </div>
        {error ? <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p> : null}
      </aside>
    )
  }

  return (
    <section
      aria-label="Preferência de lembretes de cópia online"
      className="rounded-2xl border border-violet-300/20 bg-slate-900 p-4 text-sm text-slate-200"
    >
      <p className="font-black text-white">
        Lembretes de cópia online: {preference === 'enabled' ? 'ativos' : 'desativados'}
      </p>
      <p className="mt-2 text-xs leading-6 text-slate-300">
        {CLOUD_BACKUP_PRIVACY_NOTICE}
      </p>
      <p className="mt-2 text-xs leading-6 text-slate-400">
        Quando tiver alterações por guardar, mostramos um aviso. A cópia só é enviada se escolher «Sim» e substitui a única cópia online anterior. Pode desativar os lembretes a qualquer momento, mantendo a cópia manual e o restauro.
      </p>
      <a
        href="/privacidade/ma-professor"
        className="mt-2 inline-block text-xs font-bold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
      >
        Consultar informação de privacidade
      </a>
      <div className="mt-3 flex flex-wrap gap-3">
        {preference !== 'enabled' ? (
          <button
            type="button"
            onClick={() => choose(true)}
            className="rounded-xl border border-violet-300/30 bg-violet-300/10 px-4 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-300/20"
          >
            Ativar lembretes de cópia
          </button>
        ) : null}
        {preference !== 'disabled' ? (
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/5"
          >
            {preference === 'enabled' ? 'Desativar lembretes de cópia' : 'Manter desativados'}
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : null}
    </section>
  )
}

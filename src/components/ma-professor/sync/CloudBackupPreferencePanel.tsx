import { useState } from 'react'

import { useMAProfessorAccess } from '../access/AccessGate'
import {
  CLOUD_BACKUP_PRIVACY_NOTICE,
  useCloudBackupPreference,
  writeCloudBackupPreference
} from './cloudBackupPreference'

export default function CloudBackupPreferencePanel({
  onlyUnanswered = false
}: {
  onlyUnanswered?: boolean
}) {
  const { session } = useMAProfessorAccess()
  const preference = useCloudBackupPreference(session)
  const [error, setError] = useState('')

  if (onlyUnanswered && preference !== 'unset') {
    return null
  }

  function choose(enabled: boolean) {
    const saved = writeCloudBackupPreference(
      session,
      enabled ? 'enabled' : 'disabled'
    )
    setError(saved ? '' : 'Não foi possível guardar a escolha. Verifique se o armazenamento do browser está disponível e tente novamente.')
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
        A cópia automática só começa depois de a ativar. Pode alterar esta escolha em Segurança e recuperação. Desativar impede novos envios automáticos neste dispositivo e mantém as cópias já guardadas. As cópias manuais continuam disponíveis.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {preference !== 'enabled' ? (
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

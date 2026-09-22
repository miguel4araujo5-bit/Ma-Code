import { useEffect, useState, type FormEvent } from 'react'
import { useMAProfessorAccess } from '../access/AccessGate'
import { MA_PROFESSOR_OPAQUE_KEY_EVENT, readMAProfessorOpaqueExportKey } from '../access/accessStorage'
import { MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT } from './cloudBackupService'

interface CloudBackupReauthenticationProps {
  forceRequired?: boolean
  embedded?: boolean
}

export default function CloudBackupReauthentication({
  forceRequired = false,
  embedded = false
}: CloudBackupReauthenticationProps = {}) {
  const { session, reauthenticate } = useMAProfessorAccess()
  const [required, setRequired] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const request = (event: Event) => {
      if ((event as CustomEvent<string>).detail === session.email) setRequired(true)
    }
    const unlocked = () => {
      if (readMAProfessorOpaqueExportKey(session.email)) {
        setRequired(false)
        setPassword('')
        setError('')
      }
    }
    window.addEventListener(MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT, request)
    window.addEventListener(MA_PROFESSOR_OPAQUE_KEY_EVENT, unlocked)
    return () => {
      window.removeEventListener(MA_PROFESSOR_BACKUP_AUTH_REQUIRED_EVENT, request)
      window.removeEventListener(MA_PROFESSOR_OPAQUE_KEY_EVENT, unlocked)
    }
  }, [session.email])

  async function unlock(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const suppliedPassword = password
    setPassword('')
    try {
      await reauthenticate(suppliedPassword)
      setRequired(false)
    } catch {
      setError('Não foi possível confirmar a password. Verifique-a e tente novamente quando tiver ligação à Internet.')
    } finally {
      setBusy(false)
    }
  }

  if (!forceRequired && !required) return null

  return (
    <aside
      aria-label="Desbloquear cópia protegida"
      className={
        embedded
          ? 'rounded-xl border border-amber-300/30 bg-slate-950/60 px-4 py-3 text-sm text-slate-200'
          : 'mx-3 my-3 rounded-xl border border-amber-300/30 bg-slate-900 px-4 py-3 text-sm text-slate-200 sm:mx-5'
      }
    >
      <p role="status" className="font-bold text-amber-100">A cópia protegida precisa da sua password.</p>
      <p className="mt-1">Volte a introduzir a sua password para retomar a cópia protegida. Pode continuar a trabalhar: os dados permanecem guardados neste dispositivo.</p>
      <form onSubmit={unlock} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="block text-xs">Password pessoal</span>
          <input type="password" autoComplete="current-password" required value={password}
            onChange={event => setPassword(event.target.value)} disabled={busy}
            className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white" />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-amber-200 px-4 py-2 font-bold text-slate-950 disabled:opacity-60">
          {busy ? 'A confirmar…' : 'Desbloquear cópia protegida'}
        </button>
      </form>
      {error ? <p role="alert" className="mt-2 text-rose-200">{error}</p> : null}
    </aside>
  )
}

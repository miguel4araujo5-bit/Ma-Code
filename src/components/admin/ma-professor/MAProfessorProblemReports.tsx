import { useEffect, useState } from 'react'

type ReportStatus = 'new' | 'in_review' | 'resolved'
interface Report {
  id: string
  contact_email: string | null
  account_id: string | null
  error_type: string
  app_version: string
  screen: string
  browser: string
  device: string
  occurred_at: string
  message: string
  status: ReportStatus
  internal_note: string
}
const ENDPOINT = '/api/admin/ma-professor/problem-reports'
const STATUS_LABELS = { new: 'Novo', in_review: 'Em análise', resolved: 'Resolvido' } as const

async function readResponse(response: Response) {
  const data = await response.json() as { success?: boolean; reports?: Report[]; message?: string }
  if (!response.ok || data.success !== true) throw new Error(data.message || 'Não foi possível consultar os relatórios técnicos.')
  return data
}

export default function MAProfessorProblemReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [status, setStatus] = useState<ReportStatus>('new')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = reports.find(report => report.id === selectedId)

  async function load() {
    setBusy(true)
    setError('')
    try {
      const data = await readResponse(await fetch(ENDPOINT, { credentials: 'include', cache: 'no-store' }))
      setReports(data.reports ?? [])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível consultar os relatórios.')
    } finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])

  async function save() {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await readResponse(await fetch(`${ENDPOINT}/update`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, status, internalNote: note })
      }))
      setReports(current => current.map(report => report.id === selected.id ? { ...report, status, internal_note: note } : report))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o relatório.')
    } finally { setBusy(false) }
  }

  return <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-black text-white">Relatórios técnicos</h2><p className="mt-1 text-xs text-slate-400">Até 100 relatórios recentes, com prioridade aos que aguardam análise.</p></div>
      <button type="button" disabled={busy} onClick={() => { void load() }} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-slate-200 disabled:opacity-50">Atualizar relatórios</button>
    </div>
    {error ? <p role="alert" className="mt-4 text-sm text-rose-200">{error}</p> : null}
    {!reports.length ? <p role="status" className="mt-4 text-sm text-slate-400">{busy ? 'A consultar relatórios…' : 'Ainda não existem relatórios técnicos.'}</p> : null}
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="max-h-[32rem] space-y-2 overflow-y-auto">
        {reports.map(report => <button key={report.id} type="button" disabled={busy} onClick={() => {
          setSelectedId(report.id); setStatus(report.status); setNote(report.internal_note)
        }} className={`w-full rounded-xl border p-3 text-left ${report.id === selectedId ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 bg-slate-950/40'}`}>
          <span className="block text-sm font-bold text-white">{report.error_type}</span>
          <span className="mt-1 block text-xs text-slate-400">{report.contact_email || 'Sem conta associada'} · {STATUS_LABELS[report.status]}</span>
          <time className="mt-1 block text-xs text-slate-500">{new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(report.occurred_at))}</time>
        </button>)}
      </div>
      {selected ? <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <h3 className="font-black text-white">{selected.error_type}</h3>
        <dl className="mt-3 space-y-2 text-xs text-slate-300">
          <div><dt className="text-slate-500">Conta/contacto</dt><dd>{selected.contact_email || 'Sem sessão válida associada'}</dd></div>
          <div><dt className="text-slate-500">Versão e ecrã</dt><dd className="break-words">{selected.app_version} · {selected.screen}</dd></div>
          <div><dt className="text-slate-500">Dispositivo/browser</dt><dd>{selected.device} · {selected.browser}</dd></div>
          <div><dt className="text-slate-500">Data/hora no dispositivo</dt><dd>{selected.occurred_at}</dd></div>
          <div><dt className="text-slate-500">Mensagem do professor</dt><dd className="whitespace-pre-wrap break-words">{selected.message || 'Não fornecida.'}</dd></div>
        </dl>
        <label className="mt-4 block text-sm text-white">Estado
          <select value={status} disabled={busy} onChange={event => setStatus(event.target.value as ReportStatus)} className="mt-2 block w-full rounded-xl border border-white/20 bg-slate-900 p-2">
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="mt-4 block text-sm text-white">Nota interna de resolução
          <textarea value={note} maxLength={1600} disabled={busy} onChange={event => setNote(event.target.value)} rows={4} className="mt-2 block w-full rounded-xl border border-white/20 bg-slate-900 p-3" />
        </label>
        <p className="mt-2 text-xs text-slate-500">Visível apenas no Admin. Não inclua dados escolares nem credenciais.</p>
        <button type="button" disabled={busy} onClick={() => { void save() }} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? 'A guardar…' : 'Guardar estado e nota'}</button>
      </div> : null}
    </div>
  </section>
}

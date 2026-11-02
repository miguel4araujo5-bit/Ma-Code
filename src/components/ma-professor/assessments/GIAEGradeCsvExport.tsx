import { useState } from 'react'
import { downloadBlob } from '../../../lib/maPdf/fileUtils'
import type { AssessmentWorkspaceSnapshot } from './assessmentWorkspaceRepository'
import { buildGIAEGradeCsvExport } from './giaeGradeCsvModel'

export default function GIAEGradeCsvExport({ snapshot, disabled, hasUnsavedChanges }: {
  snapshot: AssessmentWorkspaceSnapshot
  disabled: boolean
  hasUnsavedChanges: boolean
}) {
  const [error, setError] = useState('')
  if (!snapshot.selectedGroup || !snapshot.selectedSubject || !snapshot.selectedModule) return null
  const prepared = buildGIAEGradeCsvExport(snapshot)

  function download() {
    if (disabled || prepared.rows.length === 0) return
    try {
      downloadBlob(new Blob([prepared.csv], { type: 'text/csv;charset=utf-8' }), prepared.fileName)
      setError('')
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Não foi possível descarregar o CSV.')
    }
  }

  return (
    <details className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300">
      <summary className="cursor-pointer font-black text-cyan-100">Exportar para GIAE (CSV)</summary>
      <p className="mt-3 font-bold text-white">
        {snapshot.selectedGroup.name} · {snapshot.selectedSubject.name} · {snapshot.selectedModule.code} {snapshot.selectedModule.name}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        O ficheiro contém as classificações finais guardadas e o n.º de processo de cada aluno.
        No GIAE, selecione esta turma, disciplina e módulo/UC/UFCD e importe o CSV com codificação UTF-8.
        A alínea e a síntese ficam vazias.
      </p>
      {hasUnsavedChanges ? (
        <p role="status" className="mt-3 text-xs text-amber-200">
          Existem alterações por guardar. O CSV usa apenas as classificações finais já guardadas, apresentadas abaixo.
        </p>
      ) : null}
      {prepared.omittedRows.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-300/5 p-3 text-xs text-amber-100">
          <p className="font-bold">Alunos que ficam fora deste ficheiro: {prepared.omittedRows.length}</p>
          <ul className="mt-2 space-y-1">
            {prepared.omittedRows.map(row => <li key={row.studentId}>{row.studentName}: {row.reason}.</li>)}
          </ul>
        </div>
      ) : null}
      {prepared.rows.length > 0 ? (
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-slate-400"><th className="p-2">Aluno</th><th className="p-2">N.º de processo</th><th className="p-2">Nota final</th></tr></thead>
            <tbody>{prepared.rows.map(row => (
              <tr key={row.studentId} className="border-t border-white/10">
                <td className="p-2">{row.studentNumber} · {row.studentName}</td>
                <td className="p-2">{row.processNumber}</td><td className="p-2 font-bold text-white">{row.grade}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="mt-3 text-xs text-slate-400">Ainda não há notas finais com n.º de processo prontas para exportar.</p>}
      <button type="button" disabled={disabled || prepared.rows.length === 0} onClick={download}
        className="mt-4 rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45">
        Descarregar CSV · {prepared.rows.length} {prepared.rows.length === 1 ? 'nota' : 'notas'}
      </button>
      {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : null}
    </details>
  )
}

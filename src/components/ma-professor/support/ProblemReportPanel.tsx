import {
  useState
} from 'react'

import {
  ProblemReportDialog
} from './ProblemReportDialog'

export function ProblemReportPanel() {
  const [
    reportOpen,
    setReportOpen
  ] =
    useState(false)

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        Diagnóstico e suporte
      </p>

      <h2 className="mt-2 text-2xl font-black text-white">
        Reportar um problema
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
        Se notar algo que não está a funcionar como esperado, pode enviar um relatório técnico. Nada é enviado automaticamente.
      </p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p className="text-sm font-black text-slate-200">
          O que é incluído
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Apenas um resumo técnico, a versão da aplicação, o ecrã atual, o navegador e a data. Não são recolhidos automaticamente dados escolares, ficheiros, conteúdos do IndexedDB ou passwords.
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setReportOpen(
            true
          )
        }}
        className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
      >
        Reportar problema
      </button>

      <ProblemReportDialog
        open={
          reportOpen
        }
        errorSummary="Problema reportado manualmente."
        onClose={() => {
          setReportOpen(
            false
          )
        }}
      />
    </section>
  )
}

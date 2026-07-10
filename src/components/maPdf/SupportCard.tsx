import { useState } from 'react'
import { MBWAY_NUMBER } from '../../lib/maPdf/constants'

export default function SupportCard() {
  const [copied, setCopied] = useState(false)

  const copyNumber = async () => {
    if (!MBWAY_NUMBER) {
      return
    }

    try {
      await navigator.clipboard.writeText(MBWAY_NUMBER)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-6 rounded-[1.6rem] border border-violet-300/20 bg-violet-400/[0.08] p-5">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
        Apoio voluntário
      </span>

      <h3 className="mt-3 text-lg font-semibold text-white">
        Esta ferramenta é gratuita.
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Se o MA PDF lhe foi útil, pode apoiar o desenvolvimento de novas
        ferramentas com 1 € por MB WAY.
      </p>

      {MBWAY_NUMBER ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
            <span className="block text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-400">
              Número MB WAY
            </span>

            <strong className="mt-1 block text-lg text-white">
              {MBWAY_NUMBER}
            </strong>
          </div>

          <button
            type="button"
            onClick={copyNumber}
            className="btn-secondary hightech-button-secondary"
          >
            {copied ? 'Número copiado' : 'Copiar número'}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          O número para apoio por MB WAY será disponibilizado brevemente.
        </div>
      )}
    </div>
  )
}

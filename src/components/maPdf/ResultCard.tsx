import { downloadBlob, formatFileSize } from '../../lib/maPdf/fileUtils'
import type { ResultData } from '../../types/maPdf'
import SupportCard from './SupportCard'

type ResultCardProps = {
  result: ResultData
  onReset: () => void
}

export default function ResultCard({ result, onReset }: ResultCardProps) {
  const reduction =
    result.originalSize &&
    result.finalSize &&
    result.originalSize > result.finalSize
      ? Math.round(
          ((result.originalSize - result.finalSize) / result.originalSize) *
            100
        )
      : 0

  return (
    <div className="mt-6 rounded-[2rem] border border-emerald-300/20 bg-emerald-400/[0.08] p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
            Ficheiro pronto
          </span>

          <h3 className="mt-3 text-xl font-semibold text-white">
            {result.fileName}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {result.message}
          </p>

          {result.originalSize && result.finalSize ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                Original: {formatFileSize(result.originalSize)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                Resultado: {formatFileSize(result.finalSize)}
              </span>

              {reduction > 0 ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-emerald-100">
                  Redução: {reduction}%
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.fileName)}
            className="btn-primary hightech-button"
          >
            <span className="btn-shine" />
            <span className="relative z-10">Descarregar resultado</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="btn-secondary hightech-button-secondary"
          >
            Nova operação
          </button>
        </div>
      </div>

      <SupportCard />
    </div>
  )
}

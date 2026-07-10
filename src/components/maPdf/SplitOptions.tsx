import type { SplitMode } from '../../types/maPdf'

type SplitOptionsProps = {
  splitMode: SplitMode
  splitRanges: string
  onModeChange: (mode: SplitMode) => void
  onRangesChange: (value: string) => void
}

export default function SplitOptions({
  splitMode,
  splitRanges,
  onModeChange,
  onRangesChange
}: SplitOptionsProps) {
  return (
    <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
      <span className="input-label">Como pretende dividir?</span>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onModeChange('ranges')}
          className={`rounded-2xl border p-4 text-left transition ${
            splitMode === 'ranges'
              ? 'border-cyan-200/40 bg-cyan-300/10'
              : 'border-white/10 bg-white/[0.03] hover:border-cyan-200/25'
          }`}
        >
          <strong className="block text-sm text-white">
            Extrair páginas ou intervalos
          </strong>

          <span className="mt-2 block text-xs leading-5 text-slate-400">
            Cria um novo PDF apenas com as páginas selecionadas.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('individual')}
          className={`rounded-2xl border p-4 text-left transition ${
            splitMode === 'individual'
              ? 'border-cyan-200/40 bg-cyan-300/10'
              : 'border-white/10 bg-white/[0.03] hover:border-cyan-200/25'
          }`}
        >
          <strong className="block text-sm text-white">
            Uma página por ficheiro
          </strong>

          <span className="mt-2 block text-xs leading-5 text-slate-400">
            Cria vários PDF e entrega todos dentro de um ZIP.
          </span>
        </button>
      </div>

      {splitMode === 'ranges' ? (
        <div className="mt-5">
          <label htmlFor="split-ranges" className="input-label">
            Páginas a extrair
          </label>

          <input
            id="split-ranges"
            type="text"
            value={splitRanges}
            onChange={(event) => onRangesChange(event.target.value)}
            className="input-field"
            placeholder="Exemplo: 1-3, 5, 8-10"
          />

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Separe intervalos com vírgulas. Exemplo: 1-3, 5, 8-10.
          </p>
        </div>
      ) : null}
    </div>
  )
}

import type { SplitMode } from '../../types/maPdf'

type SplitOptionsProps = {
  splitMode: SplitMode
  splitRanges: string
  splitGroupSize: number
  onModeChange: (mode: SplitMode) => void
  onRangesChange: (value: string) => void
  onGroupSizeChange: (value: number) => void
}

export default function SplitOptions({
  splitMode,
  splitRanges,
  splitGroupSize,
  onModeChange,
  onRangesChange,
  onGroupSizeChange
}: SplitOptionsProps) {
  return (
    <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
      <span className="input-label">Como pretende dividir?</span>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
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
            Intervalos personalizados
          </strong>

          <span className="mt-2 block text-xs leading-5 text-slate-400">
            Cria um PDF independente para cada intervalo indicado.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('groups')}
          className={`rounded-2xl border p-4 text-left transition ${
            splitMode === 'groups'
              ? 'border-cyan-200/40 bg-cyan-300/10'
              : 'border-white/10 bg-white/[0.03] hover:border-cyan-200/25'
          }`}
        >
          <strong className="block text-sm text-white">
            Grupos com tamanho fixo
          </strong>

          <span className="mt-2 block text-xs leading-5 text-slate-400">
            Divide automaticamente todo o PDF em grupos com o mesmo tamanho.
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
            Cria um PDF individual para cada página do documento.
          </span>
        </button>
      </div>

      {splitMode === 'ranges' ? (
        <div className="mt-5">
          <label htmlFor="split-ranges" className="input-label">
            Intervalos a separar
          </label>

          <input
            id="split-ranges"
            type="text"
            value={splitRanges}
            onChange={(event) => onRangesChange(event.target.value)}
            className="input-field"
            placeholder="Exemplo: 1-3, 4-6, 8-10"
          />

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Cada intervalo separado por vírgula cria um PDF diferente. Quando
            indicar vários intervalos, os ficheiros são entregues dentro de um
            ZIP.
          </p>
        </div>
      ) : null}

      {splitMode === 'groups' ? (
        <div className="mt-5">
          <label htmlFor="split-group-size" className="input-label">
            Páginas por grupo
          </label>

          <input
            id="split-group-size"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={splitGroupSize}
            onChange={(event) => {
              const value = Number(event.target.value)

              onGroupSizeChange(
                Number.isFinite(value)
                  ? Math.max(0, Math.floor(value))
                  : 0
              )
            }}
            className="input-field"
          />

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Exemplo: num PDF com 12 páginas, grupos de 5 criam os ficheiros
            1-5, 6-10 e 11-12. Todos são entregues dentro de um ZIP.
          </p>
        </div>
      ) : null}
    </div>
  )
}

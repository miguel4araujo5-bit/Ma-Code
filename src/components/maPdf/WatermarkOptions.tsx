import type { WatermarkPosition } from '../../lib/maPdf/watermarkPdf'

type WatermarkOptionsProps = {
  text: string
  position: WatermarkPosition
  fontSize: number
  opacity: number
  rotation: number
  onTextChange: (value: string) => void
  onPositionChange: (position: WatermarkPosition) => void
  onFontSizeChange: (value: number) => void
  onOpacityChange: (value: number) => void
  onRotationChange: (value: number) => void
}

const positionOptions: Array<{
  value: WatermarkPosition
  label: string
  description: string
}> = [
  {
    value: 'center',
    label: 'Centro',
    description: 'Coloca a marca de água no centro de todas as páginas.'
  },
  {
    value: 'top',
    label: 'Topo',
    description: 'Coloca a marca de água junto à parte superior.'
  },
  {
    value: 'bottom',
    label: 'Rodapé',
    description: 'Coloca a marca de água junto à parte inferior.'
  }
]

function getNumericValue(
  value: string,
  fallback: number
) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback
}

export default function WatermarkOptions({
  text,
  position,
  fontSize,
  opacity,
  rotation,
  onTextChange,
  onPositionChange,
  onFontSizeChange,
  onOpacityChange,
  onRotationChange
}: WatermarkOptionsProps) {
  const opacityPercentage = Math.round(
    opacity * 100
  )

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-violet-300/15 bg-violet-300/[0.04]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200/80">
          Personalizar marca de água
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Defina o texto e a apresentação
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          A marca de água será aplicada em todas as páginas do documento.
          O ficheiro é processado diretamente no seu dispositivo.
        </p>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <label
            htmlFor="watermark-text"
            className="input-label"
          >
            Texto da marca de água
          </label>

          <input
            id="watermark-text"
            type="text"
            value={text}
            maxLength={120}
            className="input-field"
            placeholder="Exemplo: CONFIDENCIAL"
            autoComplete="off"
            onChange={(event) =>
              onTextChange(event.target.value)
            }
          />

          <div className="mt-2 flex items-center justify-between gap-4 text-xs text-slate-400">
            <span>
              Utilize letras, números e pontuação simples.
            </span>

            <span className="shrink-0">
              {text.length}/120
            </span>
          </div>
        </div>

        <fieldset>
          <legend className="input-label">
            Posição
          </legend>

          <div
            className="grid gap-3 md:grid-cols-3"
            role="radiogroup"
            aria-label="Posição da marca de água"
          >
            {positionOptions.map((option) => {
              const isSelected =
                position === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() =>
                    onPositionChange(option.value)
                  }
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-violet-200/40 bg-violet-300/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-violet-200/25 hover:bg-violet-300/[0.06]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-violet-200 bg-violet-200'
                          : 'border-slate-500 bg-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected ? (
                        <span className="h-2 w-2 rounded-full bg-slate-950" />
                      ) : null}
                    </span>

                    <strong className="text-sm font-semibold text-white">
                      {option.label}
                    </strong>
                  </span>

                  <span className="mt-3 block text-xs leading-5 text-slate-400">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="watermark-font-size"
                className="text-sm font-semibold text-white"
              >
                Tamanho do texto
              </label>

              <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.08] px-3 py-1 text-xs font-semibold text-violet-100">
                {fontSize} pt
              </span>
            </div>

            <input
              id="watermark-font-size"
              type="range"
              min={12}
              max={180}
              step={1}
              value={fontSize}
              className="mt-5 w-full accent-violet-300"
              onChange={(event) =>
                onFontSizeChange(
                  getNumericValue(
                    event.target.value,
                    48
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>12 pt</span>
              <span>180 pt</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="watermark-opacity"
                className="text-sm font-semibold text-white"
              >
                Opacidade
              </label>

              <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.08] px-3 py-1 text-xs font-semibold text-violet-100">
                {opacityPercentage}%
              </span>
            </div>

            <input
              id="watermark-opacity"
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={opacity}
              className="mt-5 w-full accent-violet-300"
              onChange={(event) =>
                onOpacityChange(
                  getNumericValue(
                    event.target.value,
                    0.18
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>Discreta</span>
              <span>Visível</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label
                htmlFor="watermark-rotation"
                className="text-sm font-semibold text-white"
              >
                Rotação
              </label>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Utilize 0° para texto horizontal ou 45° para uma marca
                diagonal.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[0, 45, 90].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    onRotationChange(preset)
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    rotation === preset
                      ? 'border-violet-200/40 bg-violet-300/10 text-violet-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-violet-200/25 hover:text-white'
                  }`}
                >
                  {preset}°
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <input
              id="watermark-rotation"
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              className="min-w-0 flex-1 accent-violet-300"
              onChange={(event) =>
                onRotationChange(
                  getNumericValue(
                    event.target.value,
                    45
                  )
                )
              }
            />

            <div className="flex w-24 shrink-0 items-center">
              <input
                type="number"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                aria-label="Rotação em graus"
                className="input-field py-2 text-center"
                onChange={(event) =>
                  onRotationChange(
                    getNumericValue(
                      event.target.value,
                      0
                    )
                  )
                }
              />
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
            <span>-180°</span>
            <span>0°</span>
            <span>180°</span>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/75">
            Pré-visualização aproximada
          </span>

          <div className="relative mt-4 flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white">
            <div className="absolute inset-4 rounded border border-slate-200">
              <div className="space-y-2 p-5 opacity-40">
                <div className="h-2 w-2/3 rounded bg-slate-300" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-5/6 rounded bg-slate-200" />
                <div className="mt-5 h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-4/5 rounded bg-slate-200" />
              </div>
            </div>

            <span
              className={`absolute left-1/2 max-w-[85%] -translate-x-1/2 whitespace-nowrap text-center font-black uppercase text-slate-600 ${
                position === 'top'
                  ? 'top-8'
                  : position === 'bottom'
                    ? 'bottom-8'
                    : 'top-1/2 -translate-y-1/2'
              }`}
              style={{
                fontSize: `${Math.min(
                  Math.max(fontSize / 3, 12),
                  40
                )}px`,
                opacity,
                transform:
                  position === 'center'
                    ? `translate(-50%, -50%) rotate(${rotation}deg)`
                    : `translateX(-50%) rotate(${rotation}deg)`
              }}
            >
              {text.trim() || 'MARCA DE ÁGUA'}
            </span>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            A dimensão final adapta-se automaticamente ao tamanho de cada
            página do PDF.
          </p>
        </div>
      </div>
    </div>
  )
}

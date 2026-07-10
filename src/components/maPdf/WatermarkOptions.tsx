import type { WatermarkPosition } from '../../lib/maPdf/watermarkPdf'

type WatermarkOptionsProps = {
  text: string
  position: WatermarkPosition
  fontSize: number
  opacity: number
  rotation: number
  onTextChange: (text: string) => void
  onPositionChange: (position: WatermarkPosition) => void
  onFontSizeChange: (fontSize: number) => void
  onOpacityChange: (opacity: number) => void
  onRotationChange: (rotation: number) => void
}

const watermarkPositions: Array<{
  value: WatermarkPosition
  title: string
  description: string
}> = [
  {
    value: 'top',
    title: 'Superior',
    description: 'Colocar a marca de água na zona superior de cada página.'
  },
  {
    value: 'center',
    title: 'Centro',
    description: 'Colocar a marca de água ao centro de cada página.'
  },
  {
    value: 'bottom',
    title: 'Inferior',
    description: 'Colocar a marca de água na zona inferior de cada página.'
  }
]

function clampNumber(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.min(Math.max(value, minimum), maximum)
}

function getPreviewAlignment(position: WatermarkPosition) {
  if (position === 'top') {
    return 'items-start pt-8'
  }

  if (position === 'bottom') {
    return 'items-end pb-8'
  }

  return 'items-center'
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
  const previewFontSize = clampNumber(fontSize / 2.4, 16, 52)

  const handlePositionChange = (newPosition: WatermarkPosition) => {
    onPositionChange(newPosition)

    if (newPosition === 'center' && rotation === 0) {
      onRotationChange(45)
      return
    }

    if (newPosition !== 'center' && rotation === 45) {
      onRotationChange(0)
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-sky-300/20 bg-sky-300/[0.05]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
          Configurar marca de água
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Texto, posição e aparência
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          A marca de água será aplicada automaticamente a todas as páginas do
          documento PDF.
        </p>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="watermark-text" className="input-label mb-0">
              Texto da marca de água
            </label>

            <span className="text-xs text-slate-500">
              {text.length}/120
            </span>
          </div>

          <input
            id="watermark-text"
            type="text"
            maxLength={120}
            value={text}
            className="input-field mt-3"
            placeholder="Exemplo: CONFIDENCIAL"
            onChange={(event) => onTextChange(event.target.value)}
          />

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Utilize letras, números e pontuação simples. O texto vazio impede o
            processamento do documento.
          </p>
        </div>

        <div>
          <span className="input-label">Posição na página</span>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {watermarkPositions.map((watermarkPosition) => {
              const selected = position === watermarkPosition.value

              return (
                <button
                  key={watermarkPosition.value}
                  type="button"
                  onClick={() =>
                    handlePositionChange(watermarkPosition.value)
                  }
                  aria-pressed={selected}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-sky-200/45 bg-sky-300/12 shadow-lg shadow-sky-950/20'
                      : 'border-white/10 bg-white/[0.03] hover:border-sky-200/25 hover:bg-sky-300/[0.06]'
                  }`}
                >
                  <strong className="block text-sm font-semibold text-white">
                    {watermarkPosition.title}
                  </strong>

                  <span className="mt-2 block text-xs leading-5 text-slate-400">
                    {watermarkPosition.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="watermark-size" className="input-label mb-0">
                Tamanho
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-sky-100">
                {fontSize} pt
              </span>
            </div>

            <input
              id="watermark-size"
              type="range"
              min={12}
              max={180}
              step={2}
              value={fontSize}
              className="mt-4 w-full accent-sky-300"
              onChange={(event) =>
                onFontSizeChange(
                  clampNumber(Number(event.target.value), 12, 180)
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>Pequena</span>
              <span>Grande</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="watermark-opacity" className="input-label mb-0">
                Opacidade
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-sky-100">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            <input
              id="watermark-opacity"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity}
              className="mt-4 w-full accent-sky-300"
              onChange={(event) =>
                onOpacityChange(
                  clampNumber(Number(event.target.value), 0.05, 1)
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>Discreta</span>
              <span>Forte</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="watermark-rotation" className="input-label mb-0">
                Rotação
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-sky-100">
                {rotation}°
              </span>
            </div>

            <input
              id="watermark-rotation"
              type="range"
              min={-180}
              max={180}
              step={5}
              value={rotation}
              className="mt-4 w-full accent-sky-300"
              onChange={(event) =>
                onRotationChange(
                  clampNumber(Number(event.target.value), -180, 180)
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>-180°</span>
              <span>180°</span>
            </div>
          </div>
        </div>

        <div>
          <span className="input-label">Pré-visualização aproximada</span>

          <div
            className={`relative mt-3 flex min-h-64 justify-center overflow-hidden rounded-3xl border border-white/10 bg-white p-6 ${getPreviewAlignment(
              position
            )}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:100%_32px]" />

            <div className="pointer-events-none absolute left-5 top-5 h-2 w-24 rounded-full bg-slate-200" />
            <div className="pointer-events-none absolute left-5 top-10 h-2 w-40 rounded-full bg-slate-100" />
            <div className="pointer-events-none absolute bottom-5 left-5 h-2 w-32 rounded-full bg-slate-100" />

            <span
              className="relative z-10 max-w-full break-words text-center font-black uppercase leading-tight text-slate-600"
              style={{
                fontSize: `${previewFontSize}px`,
                opacity,
                transform: `rotate(${rotation}deg)`
              }}
            >
              {text.trim() || 'MARCA DE ÁGUA'}
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            A disposição final adapta-se automaticamente às dimensões reais de
            cada página do PDF.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-xs leading-5 text-emerald-50/90">
          O PDF é processado localmente no navegador. O documento não é enviado
          para servidores.
        </div>
      </div>
    </div>
  )
}

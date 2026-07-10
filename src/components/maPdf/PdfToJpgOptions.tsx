import type { JpgQuality } from '../../types/maPdf'

type PdfToJpgOptionsProps = {
  jpgQuality: JpgQuality
  onQualityChange: (quality: JpgQuality) => void
}

export default function PdfToJpgOptions({
  jpgQuality,
  onQualityChange
}: PdfToJpgOptionsProps) {
  return (
    <div className="mt-6 rounded-[1.6rem] border border-amber-300/20 bg-amber-300/[0.06] p-5">
      <span className="input-label">Qualidade das imagens JPG</span>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onQualityChange('standard')}
          className={`rounded-2xl border p-4 text-left transition ${
            jpgQuality === 'standard'
              ? 'border-amber-200/40 bg-amber-300/10'
              : 'border-white/10 bg-white/[0.03] hover:border-amber-200/25'
          }`}
        >
          <strong className="block text-sm text-white">
            Qualidade normal
          </strong>

          <span className="mt-2 block text-xs leading-5 text-slate-400">
            Boa definição e ficheiros mais leves para enviar ou publicar.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onQualityChange('high')}
          className={`rounded-2xl border p-4 text-left transition ${
            jpgQuality === 'high'
              ? 'border-amber-200/40 bg-amber-300/10'
              : 'border-white/10 bg-white/[0.03] hover:border-amber-200/25'
          }`}
        >
          <strong className="block text-sm text-white">
            Alta qualidade
          </strong>

          <span className="mt-2 block text-xs leading-5 text-slate-400">
            Mais resolução para impressão, arquivo ou detalhe visual.
          </span>
        </button>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Um PDF com uma página gera um JPG. Documentos com várias páginas são
        entregues num ficheiro ZIP com uma imagem por página.
      </p>
    </div>
  )
}

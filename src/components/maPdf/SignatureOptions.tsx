import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import type { SignaturePosition } from '../../lib/maPdf/signPdf'

export type SignaturePageMode = 'last' | 'all' | 'custom'

type SignatureOptionsProps = {
  signatureFile: File | null
  pageMode: SignaturePageMode
  pageNumber: number
  position: SignaturePosition
  width: number
  opacity: number
  onFileChange: (file: File | null) => void
  onPageModeChange: (mode: SignaturePageMode) => void
  onPageNumberChange: (pageNumber: number) => void
  onPositionChange: (position: SignaturePosition) => void
  onWidthChange: (width: number) => void
  onOpacityChange: (opacity: number) => void
}

const pageModes: Array<{
  value: SignaturePageMode
  title: string
  description: string
}> = [
  {
    value: 'last',
    title: 'Última página',
    description: 'Adicionar a assinatura apenas na última página.'
  },
  {
    value: 'all',
    title: 'Todas as páginas',
    description: 'Repetir a assinatura em todas as páginas do documento.'
  },
  {
    value: 'custom',
    title: 'Página específica',
    description: 'Escolher manualmente a página que deve receber a assinatura.'
  }
]

const signaturePositions: Array<{
  value: SignaturePosition
  label: string
}> = [
  {
    value: 'top-left',
    label: 'Superior esquerda'
  },
  {
    value: 'top-center',
    label: 'Superior centro'
  },
  {
    value: 'top-right',
    label: 'Superior direita'
  },
  {
    value: 'center',
    label: 'Centro'
  },
  {
    value: 'bottom-left',
    label: 'Inferior esquerda'
  },
  {
    value: 'bottom-center',
    label: 'Inferior centro'
  },
  {
    value: 'bottom-right',
    label: 'Inferior direita'
  }
]

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB'
  }

  const kilobytes = bytes / 1024

  if (kilobytes < 1024) {
    return `${Math.max(1, Math.round(kilobytes))} KB`
  }

  return `${(kilobytes / 1024).toFixed(2)} MB`
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.min(Math.max(Math.trunc(value), minimum), maximum)
}

function clampNumber(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.min(Math.max(value, minimum), maximum)
}

export default function SignatureOptions({
  signatureFile,
  pageMode,
  pageNumber,
  position,
  width,
  opacity,
  onFileChange,
  onPageModeChange,
  onPageNumberChange,
  onPositionChange,
  onWidthChange,
  onOpacityChange
}: SignatureOptionsProps) {
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!signatureFile) {
      setPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(signatureFile)

    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [signatureFile])

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    onFileChange(file)

    event.target.value = ''
  }

  const handleRemoveSignature = () => {
    onFileChange(null)

    if (signatureInputRef.current) {
      signatureInputRef.current.value = ''
    }
  }

  const handlePageNumberChange = (value: number) => {
    onPageNumberChange(clampInteger(value, 1, 99999))
  }

  const handleWidthChange = (value: number) => {
    onWidthChange(clampInteger(value, 40, 400))
  }

  const handleOpacityChange = (value: number) => {
    onOpacityChange(clampNumber(value, 0.1, 1))
  }

  return (
    <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-violet-300/20 bg-violet-300/[0.05]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
          Configurar assinatura
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Imagem, página e posição
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          Escolha uma imagem PNG, JPG ou JPEG com a sua assinatura. Para obter
          um resultado mais limpo, utilize preferencialmente uma imagem PNG com
          fundo transparente.
        </p>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <span className="input-label">Imagem da assinatura</span>

          <input
            ref={signatureInputRef}
            id="ma-pdf-signature-file"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="sr-only"
            onChange={handleFileInputChange}
          />

          {!signatureFile ? (
            <label
              htmlFor="ma-pdf-signature-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-violet-200/30 bg-slate-950/45 px-5 py-8 text-center transition hover:border-violet-200/50 hover:bg-violet-300/[0.07]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200/20 bg-violet-300/10 text-xl text-violet-100">
                ✍
              </span>

              <strong className="mt-4 text-sm font-semibold text-white">
                Escolher imagem da assinatura
              </strong>

              <span className="mt-2 text-xs leading-5 text-slate-400">
                PNG, JPG ou JPEG · máximo de 10 MB
              </span>
            </label>
          ) : (
            <div className="rounded-3xl border border-violet-200/20 bg-slate-950/55 p-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white p-3">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Pré-visualização da assinatura"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-white">
                      {signatureFile.name}
                    </strong>

                    <span className="mt-1 block text-xs text-slate-400">
                      {formatFileSize(signatureFile.size)}
                    </span>

                    <span className="mt-2 block text-xs leading-5 text-violet-100/80">
                      A imagem será incorporada diretamente no PDF.
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:flex-col">
                  <label
                    htmlFor="ma-pdf-signature-file"
                    className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-violet-200/25 bg-violet-300/10 px-4 py-2 text-xs font-semibold text-violet-50 transition hover:border-violet-200/45 hover:bg-violet-300/15"
                  >
                    Alterar
                  </label>

                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="inline-flex items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/[0.07] px-4 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/40 hover:bg-red-300/10"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <span className="input-label">Página onde será aplicada</span>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {pageModes.map((mode) => {
              const selected = pageMode === mode.value

              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onPageModeChange(mode.value)}
                  aria-pressed={selected}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-violet-200/45 bg-violet-300/12 shadow-lg shadow-violet-950/20'
                      : 'border-white/10 bg-white/[0.03] hover:border-violet-200/25 hover:bg-violet-300/[0.06]'
                  }`}
                >
                  <strong className="block text-sm font-semibold text-white">
                    {mode.title}
                  </strong>

                  <span className="mt-2 block text-xs leading-5 text-slate-400">
                    {mode.description}
                  </span>
                </button>
              )
            })}
          </div>

          {pageMode === 'custom' ? (
            <div className="mt-4 max-w-xs">
              <label htmlFor="signature-page-number" className="input-label">
                Número da página
              </label>

              <input
                id="signature-page-number"
                type="number"
                min={1}
                step={1}
                value={pageNumber}
                className="input-field"
                onChange={(event) =>
                  handlePageNumberChange(Number(event.target.value))
                }
              />

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Se indicar uma página que não existe, a ferramenta apresentará
                um aviso antes de criar o ficheiro.
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="signature-position" className="input-label">
              Posição da assinatura
            </label>

            <select
              id="signature-position"
              className="input-field"
              value={position}
              onChange={(event) =>
                onPositionChange(event.target.value as SignaturePosition)
              }
            >
              {signaturePositions.map((signaturePosition) => (
                <option
                  key={signaturePosition.value}
                  value={signaturePosition.value}
                >
                  {signaturePosition.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="signature-width" className="input-label mb-0">
                Tamanho
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-violet-100">
                {width} px
              </span>
            </div>

            <input
              id="signature-width"
              type="range"
              min={40}
              max={400}
              step={5}
              value={width}
              className="mt-4 w-full accent-violet-300"
              onChange={(event) =>
                handleWidthChange(Number(event.target.value))
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>Pequena</span>
              <span>Grande</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="signature-opacity" className="input-label mb-0">
              Opacidade
            </label>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-violet-100">
              {Math.round(opacity * 100)}%
            </span>
          </div>

          <input
            id="signature-opacity"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            className="mt-4 w-full accent-violet-300"
            onChange={(event) =>
              handleOpacityChange(Number(event.target.value))
            }
          />

          <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
            <span>Transparente</span>
            <span>Totalmente visível</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-xs leading-5 text-emerald-50/90">
          O documento e a imagem da assinatura são processados localmente no
          navegador. Nenhum dos ficheiros é enviado para servidores.
        </div>
      </div>
    </div>
  )
}

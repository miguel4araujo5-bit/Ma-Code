import {
  useEffect,
  useRef,
  useState
} from 'react'

import { formatFileSize } from '../../lib/maPdf/fileUtils'

import type {
  SignaturePosition
} from '../../lib/maPdf/signPdf'

export type SignaturePageMode =
  | 'last'
  | 'all'
  | 'custom'

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

const pageModeOptions: Array<{
  value: SignaturePageMode
  title: string
  description: string
}> = [
  {
    value: 'last',
    title: 'Última página',
    description: 'Adiciona a assinatura apenas à última página do documento.'
  },
  {
    value: 'all',
    title: 'Todas as páginas',
    description: 'Repete a assinatura em todas as páginas do documento.'
  },
  {
    value: 'custom',
    title: 'Página específica',
    description: 'Permite escolher uma página concreta para receber a assinatura.'
  }
]

const positionOptions: Array<{
  value: SignaturePosition
  label: string
  marker: string
}> = [
  {
    value: 'top-left',
    label: 'Topo esquerdo',
    marker: '↖'
  },
  {
    value: 'top-center',
    label: 'Topo centro',
    marker: '↑'
  },
  {
    value: 'top-right',
    label: 'Topo direito',
    marker: '↗'
  },
  {
    value: 'center',
    label: 'Centro',
    marker: '●'
  },
  {
    value: 'bottom-left',
    label: 'Fundo esquerdo',
    marker: '↙'
  },
  {
    value: 'bottom-center',
    label: 'Fundo centro',
    marker: '↓'
  },
  {
    value: 'bottom-right',
    label: 'Fundo direito',
    marker: '↘'
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

function getPreviewPositionClass(
  position: SignaturePosition
) {
  if (position === 'top-left') {
    return 'left-5 top-5'
  }

  if (position === 'top-center') {
    return 'left-1/2 top-5 -translate-x-1/2'
  }

  if (position === 'top-right') {
    return 'right-5 top-5'
  }

  if (position === 'bottom-left') {
    return 'bottom-5 left-5'
  }

  if (position === 'bottom-center') {
    return 'bottom-5 left-1/2 -translate-x-1/2'
  }

  if (position === 'bottom-right') {
    return 'bottom-5 right-5'
  }

  return 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
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
  const [previewUrl, setPreviewUrl] = useState('')

  const fileInputRef =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!signatureFile) {
      setPreviewUrl('')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      return
    }

    const objectUrl =
      URL.createObjectURL(signatureFile)

    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [signatureFile])

  const openFilePicker = () => {
    if (!fileInputRef.current) {
      return
    }

    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  const opacityPercentage =
    Math.round(opacity * 100)

  const previewWidth = Math.min(
    Math.max(width / 2.4, 45),
    170
  )

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-emerald-300/15 bg-emerald-300/[0.04]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200/80">
          Configurar assinatura
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Adicione uma imagem da assinatura
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          Escolha uma imagem PNG, JPG ou JPEG, indique a página e
          defina onde pretende colocar a assinatura.
        </p>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <span className="input-label">
            Imagem da assinatura
          </span>

          <input
            ref={fileInputRef}
            id="signature-image-file"
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={(event) => {
              const file =
                event.target.files?.[0] ?? null

              onFileChange(file)
            }}
          />

          {!signatureFile ? (
            <button
              type="button"
              onClick={openFilePicker}
              className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300/25 bg-emerald-300/[0.05] px-5 py-8 text-center transition hover:border-emerald-200/45 hover:bg-emerald-300/[0.08]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-xl text-emerald-100">
                ✎
              </span>

              <strong className="mt-4 text-sm font-semibold text-white">
                Escolher imagem da assinatura
              </strong>

              <span className="mt-2 text-xs leading-5 text-slate-400">
                Formatos permitidos: PNG, JPG e JPEG. Máximo de 10 MB.
              </span>

              <span className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-semibold text-emerald-100">
                Selecionar imagem
              </span>
            </button>
          ) : (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white sm:w-40">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Pré-visualização da assinatura"
                      className="max-h-20 max-w-[90%] object-contain"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-white">
                    {signatureFile.name}
                  </strong>

                  <span className="mt-1 block text-xs text-slate-400">
                    {formatFileSize(signatureFile.size)}
                  </span>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/40 hover:bg-emerald-300/15"
                    >
                      Substituir imagem
                    </button>

                    <button
                      type="button"
                      onClick={() => onFileChange(null)}
                      className="rounded-xl border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-200/30 hover:bg-red-300/10"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <fieldset>
          <legend className="input-label">
            Páginas a assinar
          </legend>

          <div
            className="grid gap-3 md:grid-cols-3"
            role="radiogroup"
            aria-label="Páginas onde será colocada a assinatura"
          >
            {pageModeOptions.map((option) => {
              const isSelected =
                pageMode === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() =>
                    onPageModeChange(option.value)
                  }
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-emerald-200/40 bg-emerald-300/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-emerald-200/25 hover:bg-emerald-300/[0.05]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-emerald-200 bg-emerald-200'
                          : 'border-slate-500'
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected ? (
                        <span className="h-2 w-2 rounded-full bg-slate-950" />
                      ) : null}
                    </span>

                    <strong className="text-sm font-semibold text-white">
                      {option.title}
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

        {pageMode === 'custom' ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label
              htmlFor="signature-page-number"
              className="input-label"
            >
              Número da página
            </label>

            <input
              id="signature-page-number"
              type="number"
              min={1}
              step={1}
              value={pageNumber}
              className="input-field"
              onChange={(event) => {
                const nextPage = Math.max(
                  1,
                  Math.trunc(
                    getNumericValue(
                      event.target.value,
                      1
                    )
                  )
                )

                onPageNumberChange(nextPage)
              }}
            />

            <p className="mt-2 text-xs leading-5 text-slate-400">
              A primeira página corresponde ao número 1. O sistema
              confirmará se a página existe antes de criar o documento.
            </p>
          </div>
        ) : null}

        <fieldset>
          <legend className="input-label">
            Posição da assinatura
          </legend>

          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            role="radiogroup"
            aria-label="Posição da assinatura no documento"
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
                      ? 'border-emerald-200/40 bg-emerald-300/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-emerald-200/25 hover:bg-emerald-300/[0.05]'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm ${
                      isSelected
                        ? 'border-emerald-200/40 bg-emerald-200 text-slate-950'
                        : 'border-white/10 bg-white/[0.04] text-slate-300'
                    }`}
                    aria-hidden="true"
                  >
                    {option.marker}
                  </span>

                  <strong className="mt-3 block text-xs font-semibold text-white">
                    {option.label}
                  </strong>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="signature-width"
                className="text-sm font-semibold text-white"
              >
                Tamanho
              </label>

              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-100">
                {width} pt
              </span>
            </div>

            <input
              id="signature-width"
              type="range"
              min={40}
              max={400}
              step={5}
              value={width}
              className="mt-5 w-full accent-emerald-300"
              onChange={(event) =>
                onWidthChange(
                  getNumericValue(
                    event.target.value,
                    150
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>Pequena</span>
              <span>Grande</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="signature-opacity"
                className="text-sm font-semibold text-white"
              >
                Opacidade
              </label>

              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-100">
                {opacityPercentage}%
              </span>
            </div>

            <input
              id="signature-opacity"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              className="mt-5 w-full accent-emerald-300"
              onChange={(event) =>
                onOpacityChange(
                  getNumericValue(
                    event.target.value,
                    1
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>Discreta</span>
              <span>Total</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/75">
            Pré-visualização aproximada
          </span>

          <div className="relative mt-4 min-h-[24rem] overflow-hidden rounded-xl border border-white/10 bg-white shadow-xl">
            <div className="absolute inset-5 rounded border border-slate-200">
              <div className="space-y-3 p-6 opacity-50">
                <div className="h-3 w-2/3 rounded bg-slate-300" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-5/6 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-200" />

                <div className="pt-5">
                  <div className="h-2 w-full rounded bg-slate-200" />
                  <div className="mt-3 h-2 w-4/5 rounded bg-slate-200" />
                  <div className="mt-3 h-2 w-full rounded bg-slate-200" />
                  <div className="mt-3 h-2 w-3/4 rounded bg-slate-200" />
                </div>
              </div>
            </div>

            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Posição aproximada da assinatura"
                className={`absolute max-h-28 object-contain ${getPreviewPositionClass(
                  position
                )}`}
                style={{
                  width: `${previewWidth}px`,
                  opacity
                }}
              />
            ) : (
              <div
                className={`absolute flex h-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-400 px-5 text-xs font-semibold text-slate-500 ${getPreviewPositionClass(
                  position
                )}`}
                style={{
                  width: `${previewWidth}px`,
                  opacity
                }}
              >
                Assinatura
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            A posição e o tamanho apresentados são aproximados. O resultado
            adapta-se automaticamente às dimensões reais da página.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
          <strong className="block text-sm font-semibold text-amber-100">
            Assinatura visual
          </strong>

          <p className="mt-2 text-xs leading-5 text-amber-50/75">
            Esta ferramenta coloca uma imagem da assinatura no documento.
            Não cria uma assinatura digital qualificada, certificado
            criptográfico ou validação de identidade.
          </p>
        </div>
      </div>
    </div>
  )
}

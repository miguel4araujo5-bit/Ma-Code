import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'

import {
  formatFileSize,
  isJpgFile
} from '../../lib/maPdf/fileUtils'

import type {
  PdfEditElement,
  PdfEditImageElement,
  PdfEditLineElement,
  PdfEditPageSelection,
  PdfEditRectangleElement,
  PdfEditTextElement
} from '../../lib/maPdf/editPdf'

type PdfViewport = {
  width: number
  height: number
}

type PdfRenderTask = {
  promise: Promise<void>
  cancel: () => void
}

type PdfPageProxy = {
  getViewport: (options: {
    scale: number
  }) => PdfViewport

  render: (options: {
    canvas: HTMLCanvasElement
    canvasContext: CanvasRenderingContext2D
    viewport: PdfViewport
    background: string
  }) => PdfRenderTask

  cleanup: () => void
}

type PdfDocumentProxy = {
  numPages: number
  getPage: (
    pageNumber: number
  ) => Promise<PdfPageProxy>
}

type PdfDocumentLoadingTask = {
  promise: Promise<PdfDocumentProxy>
  destroy: () => Promise<void>
}

type EditPdfOptionsProps = {
  pdfFile?: File
  elements: PdfEditElement[]
  onElementsChange: (
    elements: PdfEditElement[]
  ) => void
}

type PageTargetFieldsProps = {
  idPrefix: string
  page: PdfEditPageSelection
  pageCount: number
  defaultPage: number
  onChange: (
    page: PdfEditPageSelection
  ) => void
}

type NumberFieldProps = {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (
    value: number
  ) => void
}

type ElementEditorProps<
  T extends PdfEditElement
> = {
  element: T
  pageCount: number
  previewPage: number
  onChange: (
    element: T
  ) => void
}

type PreviewSize = {
  width: number
  height: number
}

type BoxBounds = {
  left: number
  top: number
  width: number
  height: number
}

type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

type MoveState = {
  pointerId: number
  element: PdfEditElement
  startClientX: number
  startClientY: number
  widthPercent: number
  heightPercent: number
}

type ResizeState = {
  pointerId: number

  element:
    | PdfEditTextElement
    | PdfEditImageElement
    | PdfEditRectangleElement

  handle: ResizeHandle
  bounds: BoxBounds
}

type LinePoint =
  | 'start'
  | 'end'

type LinePointState = {
  pointerId: number
  element: PdfEditLineElement
  point: LinePoint
}

const MAX_IMAGE_SIZE_BYTES =
  20 * 1024 * 1024

const DEFAULT_PREVIEW_WIDTH =
  760

const MIN_BOX_SIZE_PX =
  18

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  )
}

function getNumericValue(
  value: string,
  fallback: number
) {
  const parsedValue =
    Number(value)

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : fallback
}

function createElementId(
  prefix: string
) {
  return `${prefix}-${crypto.randomUUID()}`
}

function isPngFile(
  file: File
) {
  return (
    file.type === 'image/png' ||
    file.name
      .toLowerCase()
      .endsWith('.png')
  )
}

function isSupportedImage(
  file: File
) {
  return (
    isPngFile(file) ||
    isJpgFile(file)
  )
}

function getElementTitle(
  element: PdfEditElement
) {
  if (
    element.type === 'text'
  ) {
    const text =
      element.text.trim()

    return text
      ? `Texto: ${text.slice(
          0,
          36
        )}${
          text.length > 36
            ? '…'
            : ''
        }`
      : 'Elemento de texto'
  }

  if (
    element.type === 'image'
  ) {
    return `Imagem: ${element.file.name}`
  }

  if (
    element.type ===
    'rectangle'
  ) {
    return 'Retângulo'
  }

  return 'Linha'
}

function getElementBadge(
  element: PdfEditElement
) {
  if (
    element.type === 'text'
  ) {
    return 'TXT'
  }

  if (
    element.type === 'image'
  ) {
    return 'IMG'
  }

  if (
    element.type ===
    'rectangle'
  ) {
    return '▭'
  }

  return '—'
}

function getElementAccentClasses(
  element: PdfEditElement
) {
  if (
    element.type === 'text'
  ) {
    return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
  }

  if (
    element.type === 'image'
  ) {
    return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
  }

  if (
    element.type ===
    'rectangle'
  ) {
    return 'border-violet-300/20 bg-violet-300/10 text-violet-100'
  }

  return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
}

function getPageLabel(
  page: PdfEditPageSelection
) {
  return page === 'all'
    ? 'Todas as páginas'
    : `Página ${page}`
}

function PageTargetFields({
  idPrefix,
  page,
  pageCount,
  defaultPage,
  onChange
}: PageTargetFieldsProps) {
  const pageMode =
    page === 'all'
      ? 'all'
      : 'specific'

  const safeMaximum =
    Math.max(
      pageCount,
      1
    )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label
          htmlFor={`${idPrefix}-page-mode`}
          className="input-label"
        >
          Aplicar em
        </label>

        <select
          id={`${idPrefix}-page-mode`}
          className="input-field"
          value={pageMode}
          onChange={(event) => {
            onChange(
              event.target.value ===
                'all'
                ? 'all'
                : clamp(
                    defaultPage,
                    1,
                    safeMaximum
                  )
            )
          }}
        >
          <option value="specific">
            Página específica
          </option>

          <option value="all">
            Todas as páginas
          </option>
        </select>
      </div>

      {page !== 'all' ? (
        <div>
          <label
            htmlFor={`${idPrefix}-page-number`}
            className="input-label"
          >
            Número da página
          </label>

          <input
            id={`${idPrefix}-page-number`}
            type="number"
            min={1}
            max={safeMaximum}
            step={1}
            className="input-field"
            value={page}
            onChange={(event) => {
              onChange(
                clamp(
                  Math.trunc(
                    getNumericValue(
                      event.target
                        .value,
                      defaultPage
                    )
                  ),
                  1,
                  safeMaximum
                )
              )
            }}
          />
        </div>
      ) : (
        <div className="flex items-end">
          <div className="w-full rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-sm leading-6 text-cyan-50/80">
            Este elemento será
            repetido na mesma
            posição relativa em
            todas as páginas.
          </div>
        </div>
      )}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange
}: NumberFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="input-label"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          className={`input-field ${
            suffix
              ? 'pr-12'
              : ''
          }`}
          onChange={(event) => {
            onChange(
              clamp(
                getNumericValue(
                  event.target.value,
                  value
                ),
                min,
                max
              )
            )
          }}
        />

        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function OpacityField({
  id,
  opacity,
  onChange
}: {
  id: string
  opacity: number
  onChange: (
    opacity: number
  ) => void
}) {
  const percentage =
    Math.round(
      opacity * 100
    )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={id}
          className="text-sm font-semibold text-white"
        >
          Opacidade
        </label>

        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold text-cyan-100">
          {percentage}%
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={0.05}
        max={1}
        step={0.05}
        value={opacity}
        className="mt-5 w-full accent-cyan-300"
        onChange={(event) => {
          onChange(
            clamp(
              getNumericValue(
                event.target.value,
                1
              ),
              0.05,
              1
            )
          )
        }}
      />

      <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
        <span>
          Discreto
        </span>

        <span>
          Total
        </span>
      </div>
    </div>
  )
}

function ImagePreview({
  file,
  alt,
  className
}: {
  file: File
  alt: string
  className?: string
}) {
  const [
    previewUrl,
    setPreviewUrl
  ] = useState('')

  useEffect(() => {
    const objectUrl =
      URL.createObjectURL(
        file
      )

    setPreviewUrl(
      objectUrl
    )

    return () => {
      URL.revokeObjectURL(
        objectUrl
      )
    }
  }, [file])

  if (!previewUrl) {
    return null
  }

  return (
    <img
      src={previewUrl}
      alt={alt}
      draggable={false}
      className={className}
    />
  )
}

function TextElementEditor({
  element,
  pageCount,
  previewPage,
  onChange
}: ElementEditorProps<PdfEditTextElement>) {
  return (
    <div className="space-y-5">
      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
        pageCount={pageCount}
        defaultPage={previewPage}
        onChange={(page) => {
          onChange({
            ...element,
            page
          })
        }}
      />

      <div>
        <label
          htmlFor={`${element.id}-text`}
          className="input-label"
        >
          Texto
        </label>

        <textarea
          id={`${element.id}-text`}
          rows={4}
          maxLength={10000}
          className="input-field input-textarea min-h-28"
          value={element.text}
          placeholder="Escreva o texto que pretende adicionar ao PDF."
          onChange={(event) => {
            onChange({
              ...element,
              text:
                event.target
                  .value
            })
          }}
        />

        <div className="mt-2 flex justify-end text-xs text-slate-500">
          {element.text.length}
          /10 000
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          id={`${element.id}-x`}
          label="Posição horizontal"
          value={
            element.xPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            xPercent
          ) => {
            onChange({
              ...element,
              xPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-y`}
          label="Posição vertical"
          value={
            element.yPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            yPercent
          ) => {
            onChange({
              ...element,
              yPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-width`}
          label="Largura máxima"
          value={
            element.maxWidthPercent ??
            80
          }
          min={5}
          max={100}
          suffix="%"
          onChange={(
            maxWidthPercent
          ) => {
            onChange({
              ...element,
              maxWidthPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-font-size`}
          label="Tamanho"
          value={
            element.fontSize ??
            18
          }
          min={6}
          max={144}
          suffix="pt"
          onChange={(
            fontSize
          ) => {
            onChange({
              ...element,
              fontSize
            })
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          id={`${element.id}-line-height`}
          label="Altura da linha"
          value={
            element.lineHeight ??
            23
          }
          min={6}
          max={220}
          suffix="pt"
          onChange={(
            lineHeight
          ) => {
            onChange({
              ...element,
              lineHeight
            })
          }}
        />

        <div>
          <label
            htmlFor={`${element.id}-color`}
            className="input-label"
          >
            Cor do texto
          </label>

          <div className="flex items-center gap-3">
            <input
              id={`${element.id}-color`}
              type="color"
              value={
                element.color ??
                '#111827'
              }
              className="h-12 w-16 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
              onChange={(event) => {
                onChange({
                  ...element,
                  color:
                    event.target
                      .value
                })
              }}
            />

            <input
              type="text"
              value={
                element.color ??
                '#111827'
              }
              aria-label="Código da cor do texto"
              className="input-field"
              onChange={(event) => {
                onChange({
                  ...element,
                  color:
                    event.target
                      .value
                })
              }}
            />
          </div>
        </div>

        <div>
          <span className="input-label">
            Estilo
          </span>

          <button
            type="button"
            aria-pressed={
              element.bold ??
              false
            }
            onClick={() => {
              onChange({
                ...element,
                bold:
                  !element.bold
              })
            }}
            className={`flex min-h-12 w-full items-center justify-center rounded-2xl border px-4 text-sm font-bold transition ${
              element.bold
                ? 'border-cyan-200/40 bg-cyan-300/10 text-cyan-50'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-200/25 hover:text-white'
            }`}
          >
            B · Negrito
          </button>
        </div>
      </div>

      <OpacityField
        id={`${element.id}-opacity`}
        opacity={
          element.opacity ??
          1
        }
        onChange={(opacity) => {
          onChange({
            ...element,
            opacity
          })
        }}
      />
    </div>
  )
}

function ImageElementEditor({
  element,
  pageCount,
  previewPage,
  onChange
}: ElementEditorProps<PdfEditImageElement>) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white sm:w-40">
          <ImagePreview
            file={element.file}
            alt={`Pré-visualização de ${element.file.name}`}
            className="max-h-20 max-w-[90%] object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold text-white">
            {element.file.name}
          </strong>

          <span className="mt-1 block text-xs text-slate-400">
            {formatFileSize(
              element.file.size
            )}
          </span>

          <span className="mt-3 inline-flex rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
            PNG, JPG ou JPEG
          </span>
        </div>
      </div>

      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
        pageCount={pageCount}
        defaultPage={previewPage}
        onChange={(page) => {
          onChange({
            ...element,
            page
          })
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          id={`${element.id}-x`}
          label="Posição horizontal"
          value={
            element.xPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            xPercent
          ) => {
            onChange({
              ...element,
              xPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-y`}
          label="Posição vertical"
          value={
            element.yPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            yPercent
          ) => {
            onChange({
              ...element,
              yPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-width`}
          label="Largura"
          value={
            element.widthPercent ??
            30
          }
          min={1}
          max={100}
          suffix="%"
          onChange={(
            widthPercent
          ) => {
            onChange({
              ...element,
              widthPercent
            })
          }}
        />

        <div>
          <label
            htmlFor={`${element.id}-height`}
            className="input-label"
          >
            Altura opcional
          </label>

          <div className="relative">
            <input
              id={`${element.id}-height`}
              type="number"
              min={1}
              max={100}
              step={1}
              value={
                element.heightPercent ??
                ''
              }
              placeholder="Automática"
              className="input-field pr-12"
              onChange={(event) => {
                const value =
                  event.target.value.trim()

                onChange({
                  ...element,

                  heightPercent:
                    value
                      ? clamp(
                          getNumericValue(
                            value,
                            1
                          ),
                          1,
                          100
                        )
                      : undefined
                })
              }}
            />

            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-slate-500">
              %
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Vazio mantém a
            proporção. Ao
            redimensionar no
            preview, a proporção
            fica preservada.
          </p>
        </div>
      </div>

      <OpacityField
        id={`${element.id}-opacity`}
        opacity={
          element.opacity ??
          1
        }
        onChange={(opacity) => {
          onChange({
            ...element,
            opacity
          })
        }}
      />
    </div>
  )
}

function RectangleElementEditor({
  element,
  pageCount,
  previewPage,
  onChange
}: ElementEditorProps<PdfEditRectangleElement>) {
  return (
    <div className="space-y-5">
      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
        pageCount={pageCount}
        defaultPage={previewPage}
        onChange={(page) => {
          onChange({
            ...element,
            page
          })
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          id={`${element.id}-x`}
          label="Posição horizontal"
          value={
            element.xPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            xPercent
          ) => {
            onChange({
              ...element,
              xPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-y`}
          label="Posição vertical"
          value={
            element.yPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            yPercent
          ) => {
            onChange({
              ...element,
              yPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-width`}
          label="Largura"
          value={
            element.widthPercent
          }
          min={1}
          max={100}
          suffix="%"
          onChange={(
            widthPercent
          ) => {
            onChange({
              ...element,
              widthPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-height`}
          label="Altura"
          value={
            element.heightPercent
          }
          min={1}
          max={100}
          suffix="%"
          onChange={(
            heightPercent
          ) => {
            onChange({
              ...element,
              heightPercent
            })
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor={`${element.id}-fill`}
            className="input-label"
          >
            Cor de preenchimento
          </label>

          <div className="flex items-center gap-3">
            <input
              id={`${element.id}-fill`}
              type="color"
              value={
                element.fillColor ??
                '#2563eb'
              }
              className="h-12 w-16 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
              onChange={(event) => {
                onChange({
                  ...element,
                  fillColor:
                    event.target
                      .value
                })
              }}
            />

            <input
              type="text"
              value={
                element.fillColor ??
                '#2563eb'
              }
              aria-label="Código da cor de preenchimento"
              className="input-field"
              onChange={(event) => {
                onChange({
                  ...element,
                  fillColor:
                    event.target
                      .value
                })
              }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`${element.id}-border-color`}
            className="input-label"
          >
            Cor do contorno
          </label>

          <div className="flex items-center gap-3">
            <input
              id={`${element.id}-border-color`}
              type="color"
              value={
                element.borderColor ??
                '#1d4ed8'
              }
              className="h-12 w-16 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
              onChange={(event) => {
                onChange({
                  ...element,
                  borderColor:
                    event.target
                      .value
                })
              }}
            />

            <input
              type="text"
              value={
                element.borderColor ??
                '#1d4ed8'
              }
              aria-label="Código da cor do contorno"
              className="input-field"
              onChange={(event) => {
                onChange({
                  ...element,
                  borderColor:
                    event.target
                      .value
                })
              }}
            />
          </div>
        </div>

        <NumberField
          id={`${element.id}-border-width`}
          label="Espessura do contorno"
          value={
            element.borderWidth ??
            1
          }
          min={0}
          max={30}
          step={0.5}
          suffix="pt"
          onChange={(
            borderWidth
          ) => {
            onChange({
              ...element,
              borderWidth
            })
          }}
        />
      </div>

      <OpacityField
        id={`${element.id}-opacity`}
        opacity={
          element.opacity ??
          0.18
        }
        onChange={(opacity) => {
          onChange({
            ...element,
            opacity
          })
        }}
      />
    </div>
  )
}

function LineElementEditor({
  element,
  pageCount,
  previewPage,
  onChange
}: ElementEditorProps<PdfEditLineElement>) {
  return (
    <div className="space-y-5">
      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
        pageCount={pageCount}
        defaultPage={previewPage}
        onChange={(page) => {
          onChange({
            ...element,
            page
          })
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          id={`${element.id}-start-x`}
          label="Início horizontal"
          value={
            element.startXPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            startXPercent
          ) => {
            onChange({
              ...element,
              startXPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-start-y`}
          label="Início vertical"
          value={
            element.startYPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            startYPercent
          ) => {
            onChange({
              ...element,
              startYPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-end-x`}
          label="Fim horizontal"
          value={
            element.endXPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            endXPercent
          ) => {
            onChange({
              ...element,
              endXPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-end-y`}
          label="Fim vertical"
          value={
            element.endYPercent
          }
          min={0}
          max={100}
          suffix="%"
          onChange={(
            endYPercent
          ) => {
            onChange({
              ...element,
              endYPercent
            })
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${element.id}-color`}
            className="input-label"
          >
            Cor da linha
          </label>

          <div className="flex items-center gap-3">
            <input
              id={`${element.id}-color`}
              type="color"
              value={
                element.color ??
                '#2563eb'
              }
              className="h-12 w-16 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
              onChange={(event) => {
                onChange({
                  ...element,
                  color:
                    event.target
                      .value
                })
              }}
            />

            <input
              type="text"
              value={
                element.color ??
                '#2563eb'
              }
              aria-label="Código da cor da linha"
              className="input-field"
              onChange={(event) => {
                onChange({
                  ...element,
                  color:
                    event.target
                      .value
                })
              }}
            />
          </div>
        </div>

        <NumberField
          id={`${element.id}-thickness`}
          label="Espessura"
          value={
            element.thickness ??
            2
          }
          min={0.5}
          max={40}
          step={0.5}
          suffix="pt"
          onChange={(
            thickness
          ) => {
            onChange({
              ...element,
              thickness
            })
          }}
        />
      </div>

      <OpacityField
        id={`${element.id}-opacity`}
        opacity={
          element.opacity ??
          1
        }
        onChange={(opacity) => {
          onChange({
            ...element,
            opacity
          })
        }}
      />
    </div>
  )
}

function ResizeHandles({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: {
  onPointerDown: (
    event:
      ReactPointerEvent<HTMLSpanElement>,
    handle: ResizeHandle
  ) => void

  onPointerMove: (
    event:
      ReactPointerEvent<HTMLSpanElement>
  ) => void

  onPointerUp: (
    event:
      ReactPointerEvent<HTMLSpanElement>
  ) => void

  onPointerCancel: (
    event:
      ReactPointerEvent<HTMLSpanElement>
  ) => void
}) {
  return (
    <>
      <span
        aria-hidden="true"
        title="Redimensionar pelo canto superior esquerdo"
        className="absolute -left-2 -top-2 z-30 h-4 w-4 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-cyan-600 shadow-md shadow-black/40"
        onPointerMove={
          onPointerMove
        }
        onPointerUp={
          onPointerUp
        }
        onPointerCancel={
          onPointerCancel
        }
        onPointerDown={(
          event
        ) => {
          onPointerDown(
            event,
            'top-left'
          )
        }}
      />

      <span
        aria-hidden="true"
        title="Redimensionar pelo canto superior direito"
        className="absolute -right-2 -top-2 z-30 h-4 w-4 touch-none cursor-nesw-resize rounded-full border-2 border-white bg-cyan-600 shadow-md shadow-black/40"
        onPointerMove={
          onPointerMove
        }
        onPointerUp={
          onPointerUp
        }
        onPointerCancel={
          onPointerCancel
        }
        onPointerDown={(
          event
        ) => {
          onPointerDown(
            event,
            'top-right'
          )
        }}
      />

      <span
        aria-hidden="true"
        title="Redimensionar pelo canto inferior esquerdo"
        className="absolute -bottom-2 -left-2 z-30 h-4 w-4 touch-none cursor-nesw-resize rounded-full border-2 border-white bg-cyan-600 shadow-md shadow-black/40"
        onPointerMove={
          onPointerMove
        }
        onPointerUp={
          onPointerUp
        }
        onPointerCancel={
          onPointerCancel
        }
        onPointerDown={(
          event
        ) => {
          onPointerDown(
            event,
            'bottom-left'
          )
        }}
      />

      <span
        aria-hidden="true"
        title="Redimensionar pelo canto inferior direito"
        className="absolute -bottom-2 -right-2 z-30 h-4 w-4 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-cyan-600 shadow-md shadow-black/40"
        onPointerMove={
          onPointerMove
        }
        onPointerUp={
          onPointerUp
        }
        onPointerCancel={
          onPointerCancel
        }
        onPointerDown={(
          event
        ) => {
          onPointerDown(
            event,
            'bottom-right'
          )
        }}
      />
    </>
  )
}

export default function EditPdfOptions({
  pdfFile,
  elements,
  onElementsChange
}: EditPdfOptionsProps) {
  const [
    imageError,
    setImageError
  ] = useState('')

  const [
    previewPage,
    setPreviewPage
  ] = useState(1)

  const [
    selectedElementId,
    setSelectedElementId
  ] =
    useState<string | null>(
      null
    )

  const [
    pdfDocument,
    setPdfDocument
  ] =
    useState<PdfDocumentProxy | null>(
      null
    )

  const [
    pageCount,
    setPageCount
  ] = useState(0)

  const [
    availablePreviewWidth,
    setAvailablePreviewWidth
  ] = useState(
    DEFAULT_PREVIEW_WIDTH
  )

  const [
    previewSize,
    setPreviewSize
  ] = useState<PreviewSize>({
    width: 0,
    height: 0
  })

  const [
    pdfPageSize,
    setPdfPageSize
  ] = useState<PreviewSize>({
    width: 0,
    height: 0
  })

  const [
    isPreviewLoading,
    setIsPreviewLoading
  ] = useState(true)

  const [
    previewError,
    setPreviewError
  ] = useState('')

  const [
    imageRatios,
    setImageRatios
  ] = useState<
    Record<string, number>
  >({})

  const imageInputRef =
    useRef<HTMLInputElement>(
      null
    )

  const previewViewportRef =
    useRef<HTMLDivElement>(
      null
    )

  const previewPageRef =
    useRef<HTMLDivElement>(
      null
    )

  const canvasRef =
    useRef<HTMLCanvasElement>(
      null
    )

  const moveStateRef =
    useRef<MoveState | null>(
      null
    )

  const resizeStateRef =
    useRef<ResizeState | null>(
      null
    )

  const linePointStateRef =
    useRef<LinePointState | null>(
      null
    )

  useEffect(() => {
    if (
      selectedElementId &&
      elements.some(
        (element) =>
          element.id ===
          selectedElementId
      )
    ) {
      return
    }

    setSelectedElementId(
      elements[0]?.id ??
        null
    )
  }, [
    elements,
    selectedElementId
  ])

  useEffect(() => {
    const previewViewport =
      previewViewportRef.current

    if (!previewViewport) {
      return
    }

    const updateAvailableWidth =
      () => {
        setAvailablePreviewWidth(
          clamp(
            previewViewport.clientWidth -
              32,
            260,
            920
          )
        )
      }

    updateAvailableWidth()

    const resizeObserver =
      new ResizeObserver(
        updateAvailableWidth
      )

    resizeObserver.observe(
      previewViewport
    )

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    let loadingTask:
      | PdfDocumentLoadingTask
      | null = null

    setPdfDocument(null)
    setPageCount(0)
    setPreviewPage(1)
    setPreviewError('')
    setIsPreviewLoading(true)

    if (!pdfFile) {
      setPreviewError(
        'Não foi possível carregar o ficheiro PDF no editor.'
      )

      setIsPreviewLoading(
        false
      )

      return
    }

    const sourceFile =
      pdfFile

    const loadPdf =
      async () => {
        try {
          const [
            pdfJs,
            workerModule
          ] =
            await Promise.all([
              import(
                'pdfjs-dist'
              ),

              import(
                'pdfjs-dist/build/pdf.worker.min.mjs?url'
              )
            ])

          pdfJs.GlobalWorkerOptions.workerSrc =
            workerModule.default

          const data =
            new Uint8Array(
              await sourceFile.arrayBuffer()
            )

          loadingTask =
            pdfJs.getDocument({
              data
            }) as unknown as PdfDocumentLoadingTask

          const loadedDocument =
            await loadingTask.promise

          if (cancelled) {
            await loadingTask.destroy()
            return
          }

          if (
            loadedDocument.numPages ===
            0
          ) {
            throw new Error(
              'O documento não contém páginas.'
            )
          }

          setPdfDocument(
            loadedDocument
          )

          setPageCount(
            loadedDocument.numPages
          )
        } catch (error) {
          if (cancelled) {
            return
          }

          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Não foi possível criar a pré-visualização deste PDF.'
          )

          setIsPreviewLoading(
            false
          )
        }
      }

    void loadPdf()

    return () => {
      cancelled = true

      if (loadingTask) {
        void loadingTask.destroy()
      }
    }
  }, [pdfFile])

  useEffect(() => {
    if (
      pageCount <= 0
    ) {
      return
    }

    setPreviewPage(
      (currentPage) =>
        clamp(
          currentPage,
          1,
          pageCount
        )
    )
  }, [pageCount])

  useEffect(() => {
    if (
      !pdfDocument ||
      !canvasRef.current ||
      previewPage < 1
    ) {
      return
    }

    let cancelled = false

    let renderTask:
      | PdfRenderTask
      | null = null

    const renderPreview =
      async () => {
        setIsPreviewLoading(
          true
        )

        setPreviewError('')

        try {
          const page =
            await pdfDocument.getPage(
              previewPage
            )

          const baseViewport =
            page.getViewport({
              scale: 1
            })

          const cssScale =
            availablePreviewWidth /
            baseViewport.width

          const cssViewport =
            page.getViewport({
              scale: cssScale
            })

          const outputScale =
            clamp(
              window.devicePixelRatio ||
                1,
              1,
              2
            )

          const renderViewport =
            page.getViewport({
              scale:
                cssScale *
                outputScale
            })

          const canvas =
            canvasRef.current

          const context =
            canvas?.getContext(
              '2d',
              {
                alpha: false
              }
            )

          if (
            !canvas ||
            !context
          ) {
            throw new Error(
              'O navegador não conseguiu preparar a pré-visualização da página.'
            )
          }

          canvas.width =
            Math.max(
              1,
              Math.ceil(
                renderViewport.width
              )
            )

          canvas.height =
            Math.max(
              1,
              Math.ceil(
                renderViewport.height
              )
            )

          canvas.style.width =
            `${cssViewport.width}px`

          canvas.style.height =
            `${cssViewport.height}px`

          setPreviewSize({
            width:
              cssViewport.width,

            height:
              cssViewport.height
          })

          setPdfPageSize({
            width:
              baseViewport.width,

            height:
              baseViewport.height
          })

          renderTask =
            page.render({
              canvas,

              canvasContext:
                context,

              viewport:
                renderViewport,

              background:
                'rgb(255, 255, 255)'
            })

          await renderTask.promise

          if (!cancelled) {
            setIsPreviewLoading(
              false
            )
          }

          page.cleanup()
        } catch (error) {
          if (
            cancelled ||
            (
              error instanceof
                Error &&
              error.name ===
                'RenderingCancelledException'
            )
          ) {
            return
          }

          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Não foi possível mostrar esta página.'
          )

          setIsPreviewLoading(
            false
          )
        }
      }

    void renderPreview()

    return () => {
      cancelled = true

      renderTask?.cancel()
    }
  }, [
    availablePreviewWidth,
    pdfDocument,
    previewPage
  ])

  useEffect(() => {
    const imageElements =
      elements.filter(
        (
          element
        ): element is PdfEditImageElement =>
          element.type ===
          'image'
      )

    const objectUrls:
      string[] = []

    let cancelled = false

    for (
      const element of
      imageElements
    ) {
      if (
        imageRatios[
          element.id
        ]
      ) {
        continue
      }

      const objectUrl =
        URL.createObjectURL(
          element.file
        )

      objectUrls.push(
        objectUrl
      )

      const image =
        new Image()

      image.onload = () => {
        if (
          cancelled ||
          image.naturalWidth <=
            0 ||
          image.naturalHeight <=
            0
        ) {
          return
        }

        setImageRatios(
          (current) => ({
            ...current,

            [element.id]:
              image.naturalWidth /
              image.naturalHeight
          })
        )
      }

      image.src =
        objectUrl
    }

    return () => {
      cancelled = true

      for (
        const objectUrl of
        objectUrls
      ) {
        URL.revokeObjectURL(
          objectUrl
        )
      }
    }
  }, [
    elements,
    imageRatios
  ])

  const replaceElement = (
    nextElement:
      PdfEditElement
  ) => {
    onElementsChange(
      elements.map(
        (element) =>
          element.id ===
          nextElement.id
            ? nextElement
            : element
      )
    )
  }

  const removeElement = (
    elementId: string
  ) => {
    onElementsChange(
      elements.filter(
        (element) =>
          element.id !==
          elementId
      )
    )

    if (
      selectedElementId ===
      elementId
    ) {
      setSelectedElementId(
        null
      )
    }
  }

  const addTextElement =
    () => {
      const element:
        PdfEditTextElement = {
        id:
          createElementId(
            'text'
          ),

        type: 'text',
        page: previewPage,
        text: 'Novo texto',
        xPercent: 10,
        yPercent: 10,
        maxWidthPercent: 50,
        fontSize: 18,
        lineHeight: 23,
        color: '#111827',
        bold: false,
        opacity: 1
      }

      onElementsChange([
        ...elements,
        element
      ])

      setSelectedElementId(
        element.id
      )
    }

  const addRectangleElement =
    () => {
      const element:
        PdfEditRectangleElement = {
        id:
          createElementId(
            'rectangle'
          ),

        type: 'rectangle',
        page: previewPage,
        xPercent: 10,
        yPercent: 20,
        widthPercent: 40,
        heightPercent: 15,
        fillColor: '#2563eb',
        borderColor: '#1d4ed8',
        borderWidth: 1,
        opacity: 0.18
      }

      onElementsChange([
        ...elements,
        element
      ])

      setSelectedElementId(
        element.id
      )
    }

  const addLineElement =
    () => {
      const element:
        PdfEditLineElement = {
        id:
          createElementId(
            'line'
          ),

        type: 'line',
        page: previewPage,
        startXPercent: 10,
        startYPercent: 50,
        endXPercent: 90,
        endYPercent: 50,
        color: '#2563eb',
        thickness: 2,
        opacity: 1
      }

      onElementsChange([
        ...elements,
        element
      ])

      setSelectedElementId(
        element.id
      )
    }

  const openImagePicker =
    () => {
      setImageError('')

      if (
        !imageInputRef.current
      ) {
        return
      }

      imageInputRef.current.value =
        ''

      imageInputRef.current.click()
    }

  const handleImageSelection =
    (
      file: File | null
    ) => {
      setImageError('')

      if (!file) {
        return
      }

      if (
        !isSupportedImage(
          file
        )
      ) {
        setImageError(
          'A imagem deve estar no formato PNG, JPG ou JPEG.'
        )

        return
      }

      if (
        file.size === 0
      ) {
        setImageError(
          'O ficheiro da imagem está vazio.'
        )

        return
      }

      if (
        file.size >
        MAX_IMAGE_SIZE_BYTES
      ) {
        setImageError(
          'A imagem ultrapassa o limite de 20 MB.'
        )

        return
      }

      const element:
        PdfEditImageElement = {
        id:
          createElementId(
            'image'
          ),

        type: 'image',
        page: previewPage,
        file,
        xPercent: 10,
        yPercent: 10,
        widthPercent: 30,
        opacity: 1
      }

      onElementsChange([
        ...elements,
        element
      ])

      setSelectedElementId(
        element.id
      )
    }

  const visiblePreviewElements =
    useMemo(
      () =>
        elements.filter(
          (element) =>
            element.page ===
              'all' ||
            element.page ===
              previewPage
        ),
      [
        elements,
        previewPage
      ]
    )

  const pageScale =
    pdfPageSize.width > 0
      ? previewSize.width /
        pdfPageSize.width
      : 1

  const getImageHeightPercent =
    (
      element:
        PdfEditImageElement
    ) => {
      if (
        element.heightPercent !==
        undefined
      ) {
        return element.heightPercent
      }

      const ratio =
        imageRatios[
          element.id
        ]

      if (
        !ratio ||
        previewSize.height <=
          0
      ) {
        return 20
      }

      const widthPercent =
        element.widthPercent ??
        30

      return clamp(
        widthPercent *
          (
            previewSize.width /
            previewSize.height
          ) /
          ratio,
        1,
        100
      )
    }

  const getElementBounds =
    (
      target: HTMLElement
    ): BoxBounds => {
      const pageRectangle =
        previewPageRef.current?.getBoundingClientRect()

      const targetRectangle =
        target.getBoundingClientRect()

      if (!pageRectangle) {
        return {
          left: 0,
          top: 0,
          width: 0,
          height: 0
        }
      }

      return {
        left:
          targetRectangle.left -
          pageRectangle.left,

        top:
          targetRectangle.top -
          pageRectangle.top,

        width:
          targetRectangle.width,

        height:
          targetRectangle.height
      }
    }

  const handleMovePointerDown =
    (
      event:
        ReactPointerEvent<Element>,

      element:
        PdfEditElement
    ) => {
      const previewPageElement =
        previewPageRef.current

      if (
        !previewPageElement ||
        previewSize.width <= 0 ||
        previewSize.height <=
          0
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      setSelectedElementId(
        element.id
      )

      event.currentTarget.setPointerCapture(
        event.pointerId
      )

      let widthPercent = 0
      let heightPercent = 0

      if (
        element.type !== 'line'
      ) {
        const bounds =
          getElementBounds(
            event.currentTarget as HTMLElement
          )

        widthPercent =
          (
            bounds.width /
            previewSize.width
          ) *
          100

        heightPercent =
          (
            bounds.height /
            previewSize.height
          ) *
          100
      }

      moveStateRef.current = {
        pointerId:
          event.pointerId,

        element,

        startClientX:
          event.clientX,

        startClientY:
          event.clientY,

        widthPercent,
        heightPercent
      }
    }

  const handleMovePointerMove =
    (
      event:
        ReactPointerEvent<Element>
    ) => {
      const moveState =
        moveStateRef.current

      if (
        !moveState ||
        moveState.pointerId !==
          event.pointerId ||
        previewSize.width <=
          0 ||
        previewSize.height <=
          0
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const deltaXPercent =
        (
          event.clientX -
          moveState.startClientX
        ) /
        previewSize.width *
        100

      const deltaYPercent =
        (
          event.clientY -
          moveState.startClientY
        ) /
        previewSize.height *
        100

      const element =
        moveState.element

      if (
        element.type === 'line'
      ) {
        const minimumX =
          Math.min(
            element.startXPercent,
            element.endXPercent
          )

        const maximumX =
          Math.max(
            element.startXPercent,
            element.endXPercent
          )

        const minimumY =
          Math.min(
            element.startYPercent,
            element.endYPercent
          )

        const maximumY =
          Math.max(
            element.startYPercent,
            element.endYPercent
          )

        const safeDeltaX =
          clamp(
            deltaXPercent,
            -minimumX,
            100 - maximumX
          )

        const safeDeltaY =
          clamp(
            deltaYPercent,
            -minimumY,
            100 - maximumY
          )

        replaceElement({
          ...element,

          startXPercent:
            element.startXPercent +
            safeDeltaX,

          startYPercent:
            element.startYPercent +
            safeDeltaY,

          endXPercent:
            element.endXPercent +
            safeDeltaX,

          endYPercent:
            element.endYPercent +
            safeDeltaY
        })

        return
      }

      replaceElement({
        ...element,

        xPercent:
          clamp(
            element.xPercent +
              deltaXPercent,
            0,
            Math.max(
              100 -
                moveState.widthPercent,
              0
            )
          ),

        yPercent:
          clamp(
            element.yPercent +
              deltaYPercent,
            0,
            Math.max(
              100 -
                moveState.heightPercent,
              0
            )
          )
      })
    }

  const finishMove =
    (
      event:
        ReactPointerEvent<Element>
    ) => {
      if (
        moveStateRef.current
          ?.pointerId ===
        event.pointerId
      ) {
        moveStateRef.current =
          null
      }

      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        )
      }
    }

  const handleResizePointerDown =
    (
      event:
        ReactPointerEvent<HTMLSpanElement>,

      element:
        | PdfEditTextElement
        | PdfEditImageElement
        | PdfEditRectangleElement,

      handle: ResizeHandle
    ) => {
      const parentElement =
        event.currentTarget.parentElement

      if (
        !parentElement ||
        !previewPageRef.current
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      setSelectedElementId(
        element.id
      )

      event.currentTarget.setPointerCapture(
        event.pointerId
      )

      resizeStateRef.current = {
        pointerId:
          event.pointerId,

        element,
        handle,

        bounds:
          getElementBounds(
            parentElement
          )
      }
    }

  const handleResizePointerMove =
    (
      event:
        ReactPointerEvent<HTMLSpanElement>
    ) => {
      const resizeState =
        resizeStateRef.current

      const pageElement =
        previewPageRef.current

      if (
        !resizeState ||
        resizeState.pointerId !==
          event.pointerId ||
        !pageElement ||
        previewSize.width <= 0 ||
        previewSize.height <=
          0
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const pageRectangle =
        pageElement.getBoundingClientRect()

      const pointerX =
        clamp(
          event.clientX -
            pageRectangle.left,
          0,
          previewSize.width
        )

      const pointerY =
        clamp(
          event.clientY -
            pageRectangle.top,
          0,
          previewSize.height
        )

      const isLeft =
        resizeState.handle.endsWith(
          'left'
        )

      const isTop =
        resizeState.handle.startsWith(
          'top'
        )

      const anchorX =
        isLeft
          ? resizeState.bounds.left +
            resizeState.bounds.width
          : resizeState.bounds.left

      const anchorY =
        isTop
          ? resizeState.bounds.top +
            resizeState.bounds.height
          : resizeState.bounds.top

      const horizontalDirection =
        isLeft
          ? -1
          : 1

      const verticalDirection =
        isTop
          ? -1
          : 1

      const horizontalDistance =
        horizontalDirection *
        (
          pointerX -
          anchorX
        )

      const verticalDistance =
        verticalDirection *
        (
          pointerY -
          anchorY
        )

      const maximumWidth =
        isLeft
          ? anchorX
          : previewSize.width -
            anchorX

      const maximumHeight =
        isTop
          ? anchorY
          : previewSize.height -
            anchorY

      const originalElement =
        resizeState.element

      if (
        originalElement.type ===
        'rectangle'
      ) {
        const nextWidth =
          clamp(
            horizontalDistance,
            MIN_BOX_SIZE_PX,
            Math.max(
              maximumWidth,
              MIN_BOX_SIZE_PX
            )
          )

        const nextHeight =
          clamp(
            verticalDistance,
            MIN_BOX_SIZE_PX,
            Math.max(
              maximumHeight,
              MIN_BOX_SIZE_PX
            )
          )

        const nextLeft =
          isLeft
            ? anchorX -
              nextWidth
            : anchorX

        const nextTop =
          isTop
            ? anchorY -
              nextHeight
            : anchorY

        replaceElement({
          ...originalElement,

          xPercent:
            (
              nextLeft /
              previewSize.width
            ) *
            100,

          yPercent:
            (
              nextTop /
              previewSize.height
            ) *
            100,

          widthPercent:
            (
              nextWidth /
              previewSize.width
            ) *
            100,

          heightPercent:
            (
              nextHeight /
              previewSize.height
            ) *
            100
        })

        return
      }

      const originalRatio =
        originalElement.type ===
        'image'
          ? imageRatios[
              originalElement.id
            ] ??
            (
              resizeState.bounds.width /
              Math.max(
                resizeState.bounds.height,
                1
              )
            )
          : (
              resizeState.bounds.width /
              Math.max(
                resizeState.bounds.height,
                1
              )
            )

      const safeRatio =
        Math.max(
          originalRatio,
          0.05
        )

      const projectedWidth =
        (
          horizontalDistance +
          verticalDistance /
            safeRatio
        ) /
        (
          1 +
          1 /
            (
              safeRatio *
              safeRatio
            )
        )

      const maximumProportionalWidth =
        Math.min(
          maximumWidth,
          maximumHeight *
            safeRatio
        )

      const nextWidth =
        clamp(
          projectedWidth,
          MIN_BOX_SIZE_PX,
          Math.max(
            maximumProportionalWidth,
            MIN_BOX_SIZE_PX
          )
        )

      const nextHeight =
        nextWidth /
        safeRatio

      const nextLeft =
        isLeft
          ? anchorX -
            nextWidth
          : anchorX

      const nextTop =
        isTop
          ? anchorY -
            nextHeight
          : anchorY

      if (
        originalElement.type ===
        'image'
      ) {
        replaceElement({
          ...originalElement,

          xPercent:
            (
              nextLeft /
              previewSize.width
            ) *
            100,

          yPercent:
            (
              nextTop /
              previewSize.height
            ) *
            100,

          widthPercent:
            (
              nextWidth /
              previewSize.width
            ) *
            100,

          heightPercent:
            undefined
        })

        return
      }

      const scale =
        nextWidth /
        Math.max(
          resizeState.bounds.width,
          1
        )

      replaceElement({
        ...originalElement,

        xPercent:
          (
            nextLeft /
            previewSize.width
          ) *
          100,

        yPercent:
          (
            nextTop /
            previewSize.height
          ) *
          100,

        maxWidthPercent:
          (
            nextWidth /
            previewSize.width
          ) *
          100,

        fontSize:
          clamp(
            (
              originalElement.fontSize ??
              18
            ) *
              scale,
            6,
            144
          ),

        lineHeight:
          clamp(
            (
              originalElement.lineHeight ??
              23
            ) *
              scale,
            6,
            220
          )
      })
    }

  const finishResize =
    (
      event:
        ReactPointerEvent<HTMLSpanElement>
    ) => {
      event.preventDefault()
      event.stopPropagation()

      if (
        resizeStateRef.current
          ?.pointerId ===
        event.pointerId
      ) {
        resizeStateRef.current =
          null
      }

      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        )
      }
    }

  const handleLinePointPointerDown =
    (
      event:
        ReactPointerEvent<SVGCircleElement>,

      element:
        PdfEditLineElement,

      point: LinePoint
    ) => {
      event.preventDefault()
      event.stopPropagation()

      setSelectedElementId(
        element.id
      )

      event.currentTarget.setPointerCapture(
        event.pointerId
      )

      linePointStateRef.current = {
        pointerId:
          event.pointerId,

        element,
        point
      }
    }

  const handleLinePointPointerMove =
    (
      event:
        ReactPointerEvent<SVGCircleElement>
    ) => {
      const linePointState =
        linePointStateRef.current

      const pageElement =
        previewPageRef.current

      if (
        !linePointState ||
        linePointState.pointerId !==
          event.pointerId ||
        !pageElement
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const pageRectangle =
        pageElement.getBoundingClientRect()

      const xPercent =
        clamp(
          (
            event.clientX -
            pageRectangle.left
          ) /
            previewSize.width *
            100,
          0,
          100
        )

      const yPercent =
        clamp(
          (
            event.clientY -
            pageRectangle.top
          ) /
            previewSize.height *
            100,
          0,
          100
        )

      if (
        linePointState.point ===
        'start'
      ) {
        replaceElement({
          ...linePointState.element,

          startXPercent:
            xPercent,

          startYPercent:
            yPercent
        })

        return
      }

      replaceElement({
        ...linePointState.element,

        endXPercent:
          xPercent,

        endYPercent:
          yPercent
      })
    }

  const finishLinePoint =
    (
      event:
        ReactPointerEvent<SVGCircleElement>
    ) => {
      event.preventDefault()
      event.stopPropagation()

      if (
        linePointStateRef.current
          ?.pointerId ===
        event.pointerId
      ) {
        linePointStateRef.current =
          null
      }

      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        )
      }
    }

  const renderPreviewElement =
    (
      element:
        PdfEditElement
    ) => {
      const isSelected =
        selectedElementId ===
        element.id

      if (
        element.type === 'text'
      ) {
        const fontSize =
          (
            element.fontSize ??
            18
          ) *
          pageScale

        const lineHeight =
          (
            element.lineHeight ??
            23
          ) *
          pageScale

        return (
          <div
            key={element.id}
            role="button"
            tabIndex={0}
            aria-label="Mover ou redimensionar texto"
            className={`absolute z-20 touch-none select-none whitespace-pre-wrap break-words p-0.5 text-left ${
              isSelected
                ? 'cursor-grab border-2 border-dashed border-cyan-600/80 bg-cyan-100/10 shadow-lg shadow-cyan-950/20 active:cursor-grabbing'
                : 'cursor-grab border border-transparent hover:border-cyan-500/45'
            } ${
              element.bold
                ? 'font-bold'
                : 'font-normal'
            }`}
            style={{
              left:
                `${element.xPercent}%`,

              top:
                `${element.yPercent}%`,

              width:
                `${
                  element.maxWidthPercent ??
                  80
                }%`,

              fontSize:
                `${fontSize}px`,

              lineHeight:
                `${lineHeight}px`,

              fontFamily:
                'Helvetica, Arial, sans-serif',

              color:
                element.color ??
                '#111827'
            }}
            onPointerDown={(
              event
            ) => {
              handleMovePointerDown(
                event,
                element
              )
            }}
            onPointerMove={
              handleMovePointerMove
            }
            onPointerUp={
              finishMove
            }
            onPointerCancel={
              finishMove
            }
          >
            <div
              className="pointer-events-none"
              style={{
                opacity:
                  element.opacity ??
                  1
              }}
            >
              {element.text ||
                'Texto'}
            </div>

            {isSelected ? (
              <ResizeHandles
                onPointerDown={(
                  event,
                  handle
                ) => {
                  handleResizePointerDown(
                    event,
                    element,
                    handle
                  )
                }}
                onPointerMove={
                  handleResizePointerMove
                }
                onPointerUp={
                  finishResize
                }
                onPointerCancel={
                  finishResize
                }
              />
            ) : null}
          </div>
        )
      }

      if (
        element.type === 'image'
      ) {
        const heightPercent =
          getImageHeightPercent(
            element
          )

        return (
          <div
            key={element.id}
            role="button"
            tabIndex={0}
            aria-label="Mover ou redimensionar imagem"
            className={`absolute z-20 touch-none select-none ${
              isSelected
                ? 'cursor-grab border-2 border-dashed border-cyan-600/80 bg-cyan-100/10 shadow-lg shadow-cyan-950/20 active:cursor-grabbing'
                : 'cursor-grab border border-transparent hover:border-cyan-500/45'
            }`}
            style={{
              left:
                `${element.xPercent}%`,

              top:
                `${element.yPercent}%`,

              width:
                `${
                  element.widthPercent ??
                  30
                }%`,

              height:
                `${heightPercent}%`
            }}
            onPointerDown={(
              event
            ) => {
              handleMovePointerDown(
                event,
                element
              )
            }}
            onPointerMove={
              handleMovePointerMove
            }
            onPointerUp={
              finishMove
            }
            onPointerCancel={
              finishMove
            }
          >
            <div
              className="pointer-events-none h-full w-full"
              style={{
                opacity:
                  element.opacity ??
                  1
              }}
            >
              <ImagePreview
                file={element.file}
                alt=""
                className="h-full w-full object-contain"
              />
            </div>

            {isSelected ? (
              <ResizeHandles
                onPointerDown={(
                  event,
                  handle
                ) => {
                  handleResizePointerDown(
                    event,
                    element,
                    handle
                  )
                }}
                onPointerMove={
                  handleResizePointerMove
                }
                onPointerUp={
                  finishResize
                }
                onPointerCancel={
                  finishResize
                }
              />
            ) : null}
          </div>
        )
      }

      if (
        element.type ===
        'rectangle'
      ) {
        return (
          <div
            key={element.id}
            role="button"
            tabIndex={0}
            aria-label="Mover ou redimensionar retângulo"
            className={`absolute z-20 touch-none select-none ${
              isSelected
                ? 'cursor-grab border-2 border-dashed border-cyan-600/80 shadow-lg shadow-cyan-950/20 active:cursor-grabbing'
                : 'cursor-grab border border-transparent hover:border-cyan-500/45'
            }`}
            style={{
              left:
                `${element.xPercent}%`,

              top:
                `${element.yPercent}%`,

              width:
                `${element.widthPercent}%`,

              height:
                `${element.heightPercent}%`
            }}
            onPointerDown={(
              event
            ) => {
              handleMovePointerDown(
                event,
                element
              )
            }}
            onPointerMove={
              handleMovePointerMove
            }
            onPointerUp={
              finishMove
            }
            onPointerCancel={
              finishMove
            }
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundColor:
                  element.fillColor ??
                  '#2563eb',

                borderColor:
                  element.borderColor ??
                  '#1d4ed8',

                borderStyle:
                  'solid',

                borderWidth:
                  `${Math.max(
                    0,
                    (
                      element.borderWidth ??
                      1
                    ) *
                      pageScale
                  )}px`,

                opacity:
                  element.opacity ??
                  0.18
              }}
            />

            {isSelected ? (
              <ResizeHandles
                onPointerDown={(
                  event,
                  handle
                ) => {
                  handleResizePointerDown(
                    event,
                    element,
                    handle
                  )
                }}
                onPointerMove={
                  handleResizePointerMove
                }
                onPointerUp={
                  finishResize
                }
                onPointerCancel={
                  finishResize
                }
              />
            ) : null}
          </div>
        )
      }

      const strokeWidth =
        clamp(
          (
            element.thickness ??
            2
          ) *
            pageScale,
          0.75,
          40
        )

      return (
        <svg
          key={element.id}
          className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label="Linha editável"
        >
          <line
            x1={
              element.startXPercent
            }
            y1={
              element.startYPercent
            }
            x2={
              element.endXPercent
            }
            y2={
              element.endYPercent
            }
            stroke={
              element.color ??
              '#2563eb'
            }
            strokeWidth={
              strokeWidth
            }
            opacity={
              element.opacity ??
              1
            }
            vectorEffect="non-scaling-stroke"
          />

          <line
            x1={
              element.startXPercent
            }
            y1={
              element.startYPercent
            }
            x2={
              element.endXPercent
            }
            y2={
              element.endYPercent
            }
            stroke="transparent"
            strokeWidth={18}
            vectorEffect="non-scaling-stroke"
            className="pointer-events-auto touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(
              event
            ) => {
              handleMovePointerDown(
                event,
                element
              )
            }}
            onPointerMove={
              handleMovePointerMove
            }
            onPointerUp={
              finishMove
            }
            onPointerCancel={
              finishMove
            }
          />

          {isSelected ? (
            <>
              <circle
                cx={
                  element.startXPercent
                }
                cy={
                  element.startYPercent
                }
                r={1.5}
                fill="#0891b2"
                stroke="white"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-auto touch-none cursor-crosshair"
                onPointerDown={(
                  event
                ) => {
                  handleLinePointPointerDown(
                    event,
                    element,
                    'start'
                  )
                }}
                onPointerMove={
                  handleLinePointPointerMove
                }
                onPointerUp={
                  finishLinePoint
                }
                onPointerCancel={
                  finishLinePoint
                }
              />

              <circle
                cx={
                  element.endXPercent
                }
                cy={
                  element.endYPercent
                }
                r={1.5}
                fill="#0891b2"
                stroke="white"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-auto touch-none cursor-crosshair"
                onPointerDown={(
                  event
                ) => {
                  handleLinePointPointerDown(
                    event,
                    element,
                    'end'
                  )
                }}
                onPointerMove={
                  handleLinePointPointerMove
                }
                onPointerUp={
                  finishLinePoint
                }
                onPointerCancel={
                  finishLinePoint
                }
              />
            </>
          ) : null}
        </svg>
      )
    }

  const renderElementEditor =
    (
      element:
        PdfEditElement
    ) => {
      if (
        element.type === 'text'
      ) {
        return (
          <TextElementEditor
            element={element}
            pageCount={pageCount}
            previewPage={
              previewPage
            }
            onChange={
              replaceElement
            }
          />
        )
      }

      if (
        element.type === 'image'
      ) {
        return (
          <ImageElementEditor
            element={element}
            pageCount={pageCount}
            previewPage={
              previewPage
            }
            onChange={
              replaceElement
            }
          />
        )
      }

      if (
        element.type ===
        'rectangle'
      ) {
        return (
          <RectangleElementEditor
            element={element}
            pageCount={pageCount}
            previewPage={
              previewPage
            }
            onChange={
              replaceElement
            }
          />
        )
      }

      return (
        <LineElementEditor
          element={element}
          pageCount={pageCount}
          previewPage={
            previewPage
          }
          onChange={
            replaceElement
          }
        />
      )
    }

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-cyan-300/[0.035]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200/80">
          Editor de PDF
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Adicione, mova e
          redimensione elementos
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          A página real do PDF
          aparece no editor. Pode
          agarrar texto, imagens,
          retângulos e linhas para
          os mover. Puxe os quatro
          cantos para redimensionar;
          nas linhas, mova os dois
          pontos das extremidades.
        </p>

        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
          <strong className="block text-sm font-semibold text-amber-100">
            Edição por
            sobreposição
          </strong>

          <p className="mt-2 text-xs leading-5 text-amber-50/75">
            Esta ferramenta
            adiciona novos
            elementos sobre o PDF.
            Não altera nem elimina
            diretamente o texto
            original já existente
            no documento.
          </p>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={(event) => {
            handleImageSelection(
              event.target.files?.[0] ??
                null
            )
          }}
        />

        <div>
          <span className="input-label">
            Adicionar elemento à
            página {previewPage}
          </span>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={
                addTextElement
              }
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                TXT
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar texto
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Insira títulos,
                notas ou outras
                informações.
              </span>
            </button>

            <button
              type="button"
              onClick={
                openImagePicker
              }
              className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-amber-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-xs font-black text-amber-100">
                IMG
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar imagem
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Utilize PNG, JPG
                ou JPEG até 20 MB.
              </span>
            </button>

            <button
              type="button"
              onClick={
                addRectangleElement
              }
              className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-200/40 hover:bg-violet-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-lg font-black text-violet-100">
                ▭
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar
                retângulo
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Destaque, cubra ou
                enquadre uma área.
              </span>
            </button>

            <button
              type="button"
              onClick={
                addLineElement
              }
              className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200/40 hover:bg-emerald-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-lg font-black text-emerald-100">
                —
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar linha
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Crie separadores
                ou sublinhados.
              </span>
            </button>
          </div>
        </div>

        {imageError ? (
          <div
            className="status-message status-message--error"
            role="alert"
          >
            {imageError}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <strong className="block text-sm font-semibold text-white">
                Pré-visualização da
                página real
              </strong>

              <span className="mt-1 block text-xs text-slate-400">
                Clique num elemento
                para o selecionar.
                Arraste para mover e
                puxe os controlos
                para redimensionar.
              </span>
            </div>

            {pageCount > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                    )
                  }}
                  disabled={
                    previewPage <= 1
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white transition hover:border-cyan-200/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Ver página anterior"
                >
                  ←
                </button>

                <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50">
                  Página{' '}
                  {previewPage} de{' '}
                  {pageCount}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewPage(
                      (current) =>
                        Math.min(
                          pageCount,
                          current + 1
                        )
                    )
                  }}
                  disabled={
                    previewPage >=
                    pageCount
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white transition hover:border-cyan-200/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Ver página seguinte"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>

          <div
            ref={
              previewViewportRef
            }
            className="relative flex min-h-[24rem] items-start justify-center overflow-auto bg-slate-900/80 p-4"
          >
            {previewError ? (
              <div className="my-auto max-w-lg rounded-2xl border border-red-300/20 bg-red-300/[0.07] p-4 text-center text-sm leading-6 text-red-100">
                Não foi possível
                apresentar a
                pré-visualização.{' '}
                {previewError}
              </div>
            ) : (
              <div
                ref={
                  previewPageRef
                }
                className="relative shrink-0 overflow-hidden bg-white shadow-2xl shadow-black/50"
                style={{
                  width:
                    previewSize.width ||
                    availablePreviewWidth,

                  height:
                    previewSize.height ||
                    availablePreviewWidth *
                      1.414
                }}
                onPointerDown={(
                  event
                ) => {
                  if (
                    event.target ===
                      event.currentTarget ||
                    event.target ===
                      canvasRef.current
                  ) {
                    setSelectedElementId(
                      null
                    )
                  }
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="block"
                  aria-label={`Pré-visualização da página ${previewPage}`}
                />

                {isPreviewLoading ? (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 text-sm font-semibold text-white backdrop-blur-sm">
                    <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-cyan-200/25 border-t-cyan-200" />

                    A carregar a
                    página...
                  </div>
                ) : null}

                {!isPreviewLoading
                  ? visiblePreviewElements.map(
                      renderPreviewElement
                    )
                  : null}

                {!isPreviewLoading &&
                visiblePreviewElements.length ===
                  0 ? (
                  <div className="pointer-events-none absolute inset-x-5 bottom-5 rounded-xl border border-slate-200 bg-white/95 p-3 text-center text-xs text-slate-500 shadow">
                    Ainda não existem
                    elementos na
                    página{' '}
                    {previewPage}.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {elements.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-8 text-center">
            <strong className="block text-sm font-semibold text-white">
              Ainda não adicionou
              alterações
            </strong>

            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-400">
              Escolha texto,
              imagem, retângulo ou
              linha. O novo
              elemento será
              colocado na página
              atualmente visível.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="input-label mb-0">
                Alterações
                configuradas
              </span>

              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-100">
                {elements.length}{' '}
                elemento
                {elements.length ===
                1
                  ? ''
                  : 's'}
              </span>
            </div>

            {elements.map(
              (element) => {
                const isSelected =
                  selectedElementId ===
                  element.id

                return (
                  <div
                    key={
                      element.id
                    }
                    className={`overflow-hidden rounded-2xl border bg-slate-950/45 ${
                      isSelected
                        ? 'border-cyan-200/35 shadow-lg shadow-cyan-950/15'
                        : 'border-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedElementId(
                          element.id
                        )

                        if (
                          element.page !==
                          'all'
                        ) {
                          setPreviewPage(
                            clamp(
                              element.page,
                              1,
                              Math.max(
                                pageCount,
                                1
                              )
                            )
                          )
                        }
                      }}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${getElementAccentClasses(
                            element
                          )}`}
                        >
                          {getElementBadge(
                            element
                          )}
                        </span>

                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-semibold text-white">
                            {getElementTitle(
                              element
                            )}
                          </strong>

                          <span className="mt-1 block text-xs text-slate-500">
                            {getPageLabel(
                              element.page
                            )}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-cyan-100">
                        {isSelected
                          ? 'A editar'
                          : 'Editar'}
                      </span>
                    </button>

                    {isSelected ? (
                      <div className="border-t border-white/10 p-4 md:p-5">
                        {renderElementEditor(
                          element
                        )}

                        <div className="mt-6 border-t border-white/10 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              removeElement(
                                element.id
                              )
                            }}
                            className="rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-2 text-xs font-semibold text-red-100 transition hover:border-red-200/30 hover:bg-red-300/10"
                          >
                            Remover este
                            elemento
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              }
            )}
          </div>
        )}

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-xs leading-5 text-emerald-50/90">
          O PDF, a
          pré-visualização e as
          imagens adicionadas são
          processados localmente
          no navegador. Nenhum
          ficheiro é enviado para
          servidores.
        </div>
      </div>
    </div>
  )
}

import {
  useEffect,
  useRef,
  useState
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

type EditPdfOptionsProps = {
  elements: PdfEditElement[]
  onElementsChange: (
    elements: PdfEditElement[]
  ) => void
}

type PageTargetFieldsProps = {
  idPrefix: string
  page: PdfEditPageSelection
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
  onChange: (value: number) => void
}

const MAX_IMAGE_SIZE_BYTES =
  20 * 1024 * 1024

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  )
}

function getNumericValue(
  value: string,
  fallback: number
) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback
}

function createElementId(
  prefix: string
) {
  return `${prefix}-${crypto.randomUUID()}`
}

function isPngFile(file: File) {
  return (
    file.type === 'image/png' ||
    file.name
      .toLowerCase()
      .endsWith('.png')
  )
}

function isSupportedImage(file: File) {
  return (
    isPngFile(file) ||
    isJpgFile(file)
  )
}

function getElementTitle(
  element: PdfEditElement
) {
  if (element.type === 'text') {
    const text =
      element.text.trim()

    return text
      ? `Texto: ${text.slice(0, 36)}${
          text.length > 36 ? '…' : ''
        }`
      : 'Elemento de texto'
  }

  if (element.type === 'image') {
    return `Imagem: ${element.file.name}`
  }

  if (element.type === 'rectangle') {
    return 'Retângulo'
  }

  return 'Linha'
}

function getElementBadge(
  element: PdfEditElement
) {
  if (element.type === 'text') {
    return 'TXT'
  }

  if (element.type === 'image') {
    return 'IMG'
  }

  if (element.type === 'rectangle') {
    return '▭'
  }

  return '—'
}

function getElementAccentClasses(
  element: PdfEditElement
) {
  if (element.type === 'text') {
    return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
  }

  if (element.type === 'image') {
    return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
  }

  if (element.type === 'rectangle') {
    return 'border-violet-300/20 bg-violet-300/10 text-violet-100'
  }

  return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
}

function PageTargetFields({
  idPrefix,
  page,
  onChange
}: PageTargetFieldsProps) {
  const pageMode =
    page === 'all'
      ? 'all'
      : 'specific'

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
              event.target.value === 'all'
                ? 'all'
                : 1
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
            step={1}
            className="input-field"
            value={page}
            onChange={(event) => {
              onChange(
                Math.max(
                  1,
                  Math.trunc(
                    getNumericValue(
                      event.target.value,
                      1
                    )
                  )
                )
              )
            }}
          />
        </div>
      ) : (
        <div className="flex items-end">
          <div className="w-full rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-sm leading-6 text-cyan-50/80">
            Este elemento será repetido em todas as páginas.
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
            suffix ? 'pr-12' : ''
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
  onChange: (opacity: number) => void
}) {
  const percentage =
    Math.round(opacity * 100)

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
        <span>Discreto</span>
        <span>Total</span>
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
  const [previewUrl, setPreviewUrl] =
    useState('')

  useEffect(() => {
    const objectUrl =
      URL.createObjectURL(file)

    setPreviewUrl(objectUrl)

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
      className={className}
    />
  )
}

function TextElementEditor({
  element,
  onChange
}: {
  element: PdfEditTextElement
  onChange: (
    element: PdfEditTextElement
  ) => void
}) {
  return (
    <div className="space-y-5">
      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
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
          maxLength={10_000}
          className="input-field input-textarea min-h-28"
          value={element.text}
          placeholder="Escreva o texto que pretende adicionar ao PDF."
          onChange={(event) => {
            onChange({
              ...element,
              text: event.target.value
            })
          }}
        />

        <div className="mt-2 flex justify-end text-xs text-slate-500">
          {element.text.length}/10 000
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          id={`${element.id}-x`}
          label="Posição horizontal"
          value={element.xPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(xPercent) => {
            onChange({
              ...element,
              xPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-y`}
          label="Posição vertical"
          value={element.yPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(yPercent) => {
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
          onChange={(maxWidthPercent) => {
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
          onChange={(fontSize) => {
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
          onChange={(lineHeight) => {
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
                    event.target.value
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
                    event.target.value
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
              element.bold ?? false
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
          element.opacity ?? 1
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
  onChange
}: {
  element: PdfEditImageElement
  onChange: (
    element: PdfEditImageElement
  ) => void
}) {
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
          value={element.xPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(xPercent) => {
            onChange({
              ...element,
              xPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-y`}
          label="Posição vertical"
          value={element.yPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(yPercent) => {
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
          onChange={(widthPercent) => {
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
            Vazio mantém a proporção.
          </p>
        </div>
      </div>

      <OpacityField
        id={`${element.id}-opacity`}
        opacity={
          element.opacity ?? 1
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
  onChange
}: {
  element: PdfEditRectangleElement
  onChange: (
    element: PdfEditRectangleElement
  ) => void
}) {
  return (
    <div className="space-y-5">
      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
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
          value={element.xPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(xPercent) => {
            onChange({
              ...element,
              xPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-y`}
          label="Posição vertical"
          value={element.yPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(yPercent) => {
            onChange({
              ...element,
              yPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-width`}
          label="Largura"
          value={element.widthPercent}
          min={1}
          max={100}
          suffix="%"
          onChange={(widthPercent) => {
            onChange({
              ...element,
              widthPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-height`}
          label="Altura"
          value={element.heightPercent}
          min={1}
          max={100}
          suffix="%"
          onChange={(heightPercent) => {
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
                    event.target.value
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
                    event.target.value
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
                    event.target.value
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
                    event.target.value
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
          onChange={(borderWidth) => {
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
          element.opacity ?? 0.18
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
  onChange
}: {
  element: PdfEditLineElement
  onChange: (
    element: PdfEditLineElement
  ) => void
}) {
  return (
    <div className="space-y-5">
      <PageTargetFields
        idPrefix={element.id}
        page={element.page}
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
          value={element.startXPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(startXPercent) => {
            onChange({
              ...element,
              startXPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-start-y`}
          label="Início vertical"
          value={element.startYPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(startYPercent) => {
            onChange({
              ...element,
              startYPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-end-x`}
          label="Fim horizontal"
          value={element.endXPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(endXPercent) => {
            onChange({
              ...element,
              endXPercent
            })
          }}
        />

        <NumberField
          id={`${element.id}-end-y`}
          label="Fim vertical"
          value={element.endYPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(endYPercent) => {
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
                    event.target.value
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
                    event.target.value
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
          onChange={(thickness) => {
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
          element.opacity ?? 1
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

function PreviewPdfImage({
  element
}: {
  element: PdfEditImageElement
}) {
  return (
    <ImagePreview
      file={element.file}
      alt=""
      className="absolute object-contain"
    />
  )
}

export default function EditPdfOptions({
  elements,
  onElementsChange
}: EditPdfOptionsProps) {
  const [imageError, setImageError] =
    useState('')

  const [previewPage, setPreviewPage] =
    useState(1)

  const imageInputRef =
    useRef<HTMLInputElement>(null)

  const replaceElement = (
    nextElement: PdfEditElement
  ) => {
    onElementsChange(
      elements.map((element) =>
        element.id === nextElement.id
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
          element.id !== elementId
      )
    )
  }

  const addTextElement = () => {
    const element: PdfEditTextElement = {
      id: createElementId('text'),
      type: 'text',
      page: 1,
      text: 'Novo texto',
      xPercent: 10,
      yPercent: 10,
      maxWidthPercent: 80,
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
  }

  const addRectangleElement = () => {
    const element: PdfEditRectangleElement = {
      id: createElementId(
        'rectangle'
      ),
      type: 'rectangle',
      page: 1,
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
  }

  const addLineElement = () => {
    const element: PdfEditLineElement = {
      id: createElementId('line'),
      type: 'line',
      page: 1,
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
  }

  const openImagePicker = () => {
    setImageError('')

    if (!imageInputRef.current) {
      return
    }

    imageInputRef.current.value = ''
    imageInputRef.current.click()
  }

  const handleImageSelection = (
    file: File | null
  ) => {
    setImageError('')

    if (!file) {
      return
    }

    if (!isSupportedImage(file)) {
      setImageError(
        'A imagem deve estar no formato PNG, JPG ou JPEG.'
      )

      return
    }

    if (file.size === 0) {
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

    const element: PdfEditImageElement = {
      id: createElementId('image'),
      type: 'image',
      page: 1,
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
  }

  const visiblePreviewElements =
    elements.filter(
      (element) =>
        element.page === 'all' ||
        element.page === previewPage
    )

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-cyan-300/[0.035]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200/80">
          Editor de PDF
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Adicione elementos ao documento
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          Adicione texto, imagens, retângulos ou linhas. As posições
          são definidas em percentagem a partir do canto superior
          esquerdo da página.
        </p>

        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
          <strong className="block text-sm font-semibold text-amber-100">
            Edição por sobreposição
          </strong>

          <p className="mt-2 text-xs leading-5 text-amber-50/75">
            Esta ferramenta adiciona novos elementos sobre o PDF.
            Não altera nem elimina diretamente o texto original já
            existente no documento.
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
            Adicionar elemento
          </span>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={addTextElement}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
                TXT
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar texto
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Insira títulos, notas ou outras informações.
              </span>
            </button>

            <button
              type="button"
              onClick={openImagePicker}
              className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-amber-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-xs font-black text-amber-100">
                IMG
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar imagem
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Utilize PNG, JPG ou JPEG até 20 MB.
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
                Adicionar retângulo
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Destaque, cubra ou enquadre uma área.
              </span>
            </button>

            <button
              type="button"
              onClick={addLineElement}
              className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200/40 hover:bg-emerald-300/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-lg font-black text-emerald-100">
                —
              </span>

              <strong className="mt-3 block text-sm font-semibold text-white">
                Adicionar linha
              </strong>

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Crie separadores ou sublinhados.
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

        {elements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-slate-300">
              ✎
            </span>

            <strong className="mt-4 block text-sm font-semibold text-white">
              Ainda não adicionou alterações
            </strong>

            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-400">
              Escolha texto, imagem, retângulo ou linha. Pode adicionar
              vários elementos e aplicá-los a páginas diferentes.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="input-label mb-0">
                Alterações configuradas
              </span>

              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-100">
                {elements.length}{' '}
                elemento
                {elements.length === 1
                  ? ''
                  : 's'}
              </span>
            </div>

            {elements.map(
              (element, index) => (
                <details
                  key={element.id}
                  open={index === 0}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4">
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
                          {element.page ===
                          'all'
                            ? 'Todas as páginas'
                            : `Página ${element.page}`}
                        </span>
                      </div>
                    </div>

                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-cyan-200 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>

                  <div className="border-t border-white/10 p-4 md:p-5">
                    {element.type ===
                    'text' ? (
                      <TextElementEditor
                        element={element}
                        onChange={
                          replaceElement
                        }
                      />
                    ) : element.type ===
                      'image' ? (
                      <ImageElementEditor
                        element={element}
                        onChange={
                          replaceElement
                        }
                      />
                    ) : element.type ===
                      'rectangle' ? (
                      <RectangleElementEditor
                        element={element}
                        onChange={
                          replaceElement
                        }
                      />
                    ) : (
                      <LineElementEditor
                        element={element}
                        onChange={
                          replaceElement
                        }
                      />
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
                        Remover este elemento
                      </button>
                    </div>
                  </div>
                </details>
              )
            )}
          </div>
        )}

        {elements.length > 0 ? (
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4 md:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="block text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/75">
                  Pré-visualização aproximada
                </span>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Escolha a página que pretende visualizar.
                </p>
              </div>

              <div className="w-full sm:w-40">
                <label
                  htmlFor="edit-preview-page"
                  className="input-label"
                >
                  Página
                </label>

                <input
                  id="edit-preview-page"
                  type="number"
                  min={1}
                  step={1}
                  value={previewPage}
                  className="input-field"
                  onChange={(event) => {
                    setPreviewPage(
                      Math.max(
                        1,
                        Math.trunc(
                          getNumericValue(
                            event.target.value,
                            1
                          )
                        )
                      )
                    )
                  }}
                />
              </div>
            </div>

            <div className="mx-auto mt-5 aspect-[210/297] w-full max-w-lg overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
              <div className="relative h-full w-full overflow-hidden">
                <div className="absolute inset-0 p-[8%] opacity-35">
                  <div className="h-[2%] w-2/3 rounded-full bg-slate-400" />
                  <div className="mt-[4%] h-[1.3%] w-full rounded-full bg-slate-300" />
                  <div className="mt-[2%] h-[1.3%] w-5/6 rounded-full bg-slate-300" />
                  <div className="mt-[2%] h-[1.3%] w-full rounded-full bg-slate-300" />

                  <div className="mt-[8%] h-[1.3%] w-full rounded-full bg-slate-300" />
                  <div className="mt-[2%] h-[1.3%] w-4/5 rounded-full bg-slate-300" />
                  <div className="mt-[2%] h-[1.3%] w-full rounded-full bg-slate-300" />
                </div>

                {visiblePreviewElements.map(
                  (element) => {
                    if (
                      element.type ===
                      'text'
                    ) {
                      return (
                        <div
                          key={element.id}
                          className={`absolute whitespace-pre-wrap ${
                            element.bold
                              ? 'font-bold'
                              : 'font-normal'
                          }`}
                          style={{
                            left: `${element.xPercent}%`,
                            top: `${element.yPercent}%`,
                            maxWidth: `${
                              element.maxWidthPercent ??
                              80
                            }%`,
                            fontSize: `${clamp(
                              (
                                element.fontSize ??
                                18
                              ) * 0.42,
                              7,
                              34
                            )}px`,
                            lineHeight:
                              element.lineHeight
                                ? `${clamp(
                                    element.lineHeight *
                                      0.42,
                                    8,
                                    42
                                  )}px`
                                : 1.25,
                            color:
                              element.color ??
                              '#111827',
                            opacity:
                              element.opacity ??
                              1
                          }}
                        >
                          {element.text}
                        </div>
                      )
                    }

                    if (
                      element.type ===
                      'image'
                    ) {
                      return (
                        <div
                          key={element.id}
                          className="absolute"
                          style={{
                            left: `${element.xPercent}%`,
                            top: `${element.yPercent}%`,
                            width: `${
                              element.widthPercent ??
                              30
                            }%`,
                            height:
                              element.heightPercent !==
                              undefined
                                ? `${element.heightPercent}%`
                                : 'auto',
                            opacity:
                              element.opacity ??
                              1
                          }}
                        >
                          <PreviewPdfImage
                            element={
                              element
                            }
                          />
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
                          className="absolute"
                          style={{
                            left: `${element.xPercent}%`,
                            top: `${element.yPercent}%`,
                            width: `${element.widthPercent}%`,
                            height: `${element.heightPercent}%`,
                            backgroundColor:
                              element.fillColor ??
                              '#2563eb',
                            borderColor:
                              element.borderColor ??
                              '#1d4ed8',
                            borderStyle:
                              'solid',
                            borderWidth: `${Math.max(
                              1,
                              element.borderWidth ??
                                1
                            )}px`,
                            opacity:
                              element.opacity ??
                              0.18
                          }}
                        />
                      )
                    }

                    return (
                      <svg
                        key={element.id}
                        className="absolute inset-0 h-full w-full overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
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
                          strokeWidth={clamp(
                            (
                              element.thickness ??
                              2
                            ) * 0.2,
                            0.15,
                            4
                          )}
                          opacity={
                            element.opacity ??
                            1
                          }
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )
                  }
                )}

                {visiblePreviewElements.length ===
                0 ? (
                  <div className="absolute inset-x-5 bottom-5 rounded-xl border border-slate-200 bg-white/90 p-3 text-center text-xs text-slate-500 shadow">
                    Não existem elementos configurados para a página{' '}
                    {previewPage}.
                  </div>
                ) : null}
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-400">
              A pré-visualização serve apenas como referência. O resultado
              final adapta cada elemento às dimensões reais da página PDF.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

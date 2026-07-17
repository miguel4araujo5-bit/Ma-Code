import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

type PdfViewport = {
  width: number
  height: number
}

type PdfRenderTask = {
  promise: Promise<void>
  cancel: () => void
}

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => PdfViewport
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
  getPage: (pageNumber: number) => Promise<PdfPageProxy>
}

type PdfDocumentLoadingTask = {
  promise: Promise<PdfDocumentProxy>
  destroy: () => Promise<void>
}

import type { SignaturePosition } from '../../lib/maPdf/signPdf'

export type SignaturePageMode = 'last' | 'all' | 'custom'

type SignatureOptionsProps = {
  pdfFile: File
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

type PreviewSize = {
  width: number
  height: number
}

type DragState = {
  pointerId: number
  offsetX: number
  offsetY: number
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
    description: 'Repetir a assinatura na mesma posição relativa em todas as páginas.'
  },
  {
    value: 'custom',
    title: 'Página específica',
    description: 'Escolher manualmente a página que deve receber a assinatura.'
  }
]

const signaturePositions: Array<{
  value: Exclude<SignaturePosition, { xRatio: number; yRatio: number }>
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

const DEFAULT_PREVIEW_WIDTH = 760
const DEFAULT_SIGNATURE_MARGIN = 36

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

function isCustomPosition(
  position: SignaturePosition
): position is { xRatio: number; yRatio: number } {
  return typeof position === 'object'
}

function getPresetCoordinates(
  position: Exclude<SignaturePosition, { xRatio: number; yRatio: number }>,
  pageWidth: number,
  pageHeight: number,
  signatureWidth: number,
  signatureHeight: number,
  margin: number
) {
  const leftX = margin
  const centerX = (pageWidth - signatureWidth) / 2
  const rightX = pageWidth - signatureWidth - margin
  const topY = margin
  const centerY = (pageHeight - signatureHeight) / 2
  const bottomY = pageHeight - signatureHeight - margin

  switch (position) {
    case 'top-left':
      return {
        left: leftX,
        top: topY
      }

    case 'top-center':
      return {
        left: centerX,
        top: topY
      }

    case 'top-right':
      return {
        left: rightX,
        top: topY
      }

    case 'bottom-left':
      return {
        left: leftX,
        top: bottomY
      }

    case 'bottom-center':
      return {
        left: centerX,
        top: bottomY
      }

    case 'bottom-right':
      return {
        left: rightX,
        top: bottomY
      }

    case 'center':
    default:
      return {
        left: centerX,
        top: centerY
      }
  }
}

export default function SignatureOptions({
  pdfFile,
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
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const previewPageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<DragState | null>(null)

  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState('')
  const [signatureAspectRatio, setSignatureAspectRatio] = useState(0.35)
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [previewPageNumber, setPreviewPageNumber] = useState(1)
  const [availablePreviewWidth, setAvailablePreviewWidth] = useState(
    DEFAULT_PREVIEW_WIDTH
  )
  const [previewSize, setPreviewSize] = useState<PreviewSize>({
    width: 0,
    height: 0
  })
  const [pdfPageSize, setPdfPageSize] = useState<PreviewSize>({
    width: 0,
    height: 0
  })
  const [isPreviewLoading, setIsPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewUrl('')
      setSignatureAspectRatio(0.35)
      return
    }

    const objectUrl = URL.createObjectURL(signatureFile)
    const image = new Image()

    setSignaturePreviewUrl(objectUrl)

    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setSignatureAspectRatio(image.naturalHeight / image.naturalWidth)
      }
    }

    image.src = objectUrl

    return () => {
      image.onload = null
      URL.revokeObjectURL(objectUrl)
    }
  }, [signatureFile])

  useEffect(() => {
    const previewViewport = previewViewportRef.current

    if (!previewViewport) {
      return
    }

    const updateAvailableWidth = () => {
      const nextWidth = clampNumber(
        previewViewport.clientWidth - 32,
        260,
        920
      )

      setAvailablePreviewWidth(nextWidth)
    }

    updateAvailableWidth()

    const resizeObserver = new ResizeObserver(updateAvailableWidth)

    resizeObserver.observe(previewViewport)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let loadingTask: PdfDocumentLoadingTask | null = null

    setPdfDocument(null)
    setPageCount(0)
    setPreviewError('')
    setIsPreviewLoading(true)

    const loadPdf = async () => {
      try {
        const [pdfJs, workerModule] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        ])

        pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default

        const data = new Uint8Array(await pdfFile.arrayBuffer())

        loadingTask = pdfJs.getDocument({
          data
        }) as unknown as PdfDocumentLoadingTask

        const loadedDocument = await loadingTask.promise

        if (cancelled) {
          await loadingTask.destroy()
          return
        }

        if (loadedDocument.numPages === 0) {
          throw new Error('O documento não contém páginas.')
        }

        setPdfDocument(loadedDocument)
        setPageCount(loadedDocument.numPages)
      } catch (error) {
        if (cancelled) {
          return
        }

        setPreviewError(
          error instanceof Error
            ? error.message
            : 'Não foi possível criar a pré-visualização deste PDF.'
        )
        setIsPreviewLoading(false)
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
    if (pageCount <= 0) {
      return
    }

    if (pageMode === 'last') {
      setPreviewPageNumber(pageCount)
      return
    }

    if (pageMode === 'custom') {
      setPreviewPageNumber(clampInteger(pageNumber, 1, pageCount))
      return
    }

    setPreviewPageNumber((currentPage) =>
      clampInteger(currentPage, 1, pageCount)
    )
  }, [pageCount, pageMode, pageNumber])

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current || previewPageNumber < 1) {
      return
    }

    let cancelled = false
    let renderTask: PdfRenderTask | null = null

    const renderPreview = async () => {
      setIsPreviewLoading(true)
      setPreviewError('')

      try {
        const page = await pdfDocument.getPage(previewPageNumber)
        const baseViewport = page.getViewport({ scale: 1 })
        const cssScale = availablePreviewWidth / baseViewport.width
        const cssViewport = page.getViewport({ scale: cssScale })
        const outputScale = clampNumber(window.devicePixelRatio || 1, 1, 2)
        const renderViewport = page.getViewport({
          scale: cssScale * outputScale
        })
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d', {
          alpha: false
        })

        if (!canvas || !context) {
          throw new Error(
            'O navegador não conseguiu preparar a pré-visualização da página.'
          )
        }

        canvas.width = Math.max(1, Math.ceil(renderViewport.width))
        canvas.height = Math.max(1, Math.ceil(renderViewport.height))
        canvas.style.width = `${cssViewport.width}px`
        canvas.style.height = `${cssViewport.height}px`

        setPreviewSize({
          width: cssViewport.width,
          height: cssViewport.height
        })
        setPdfPageSize({
          width: baseViewport.width,
          height: baseViewport.height
        })

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: renderViewport,
          background: 'rgb(255, 255, 255)'
        })

        await renderTask.promise

        if (!cancelled) {
          setIsPreviewLoading(false)
        }

        page.cleanup()
      } catch (error) {
        if (
          cancelled ||
          (error instanceof Error &&
            error.name === 'RenderingCancelledException')
        ) {
          return
        }

        setPreviewError(
          error instanceof Error
            ? error.message
            : 'Não foi possível mostrar esta página.'
        )
        setIsPreviewLoading(false)
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [availablePreviewWidth, pdfDocument, previewPageNumber])

  const signaturePreview = useMemo(() => {
    if (
      previewSize.width <= 0 ||
      previewSize.height <= 0 ||
      pdfPageSize.width <= 0 ||
      pdfPageSize.height <= 0
    ) {
      return {
        width: 0,
        height: 0,
        left: 0,
        top: 0
      }
    }

    const scale = previewSize.width / pdfPageSize.width
    const margin = isCustomPosition(position)
      ? 0
      : DEFAULT_SIGNATURE_MARGIN
    const availablePdfWidth = Math.max(
      pdfPageSize.width - margin * 2,
      40
    )
    const availablePdfHeight = Math.max(
      pdfPageSize.height - margin * 2,
      40
    )
    let signaturePdfWidth = Math.min(width, availablePdfWidth)
    let signaturePdfHeight = signaturePdfWidth * signatureAspectRatio

    if (signaturePdfHeight > availablePdfHeight) {
      signaturePdfHeight = availablePdfHeight
      signaturePdfWidth = signaturePdfHeight / signatureAspectRatio
    }

    const signatureWidth = signaturePdfWidth * scale
    const signatureHeight = signaturePdfHeight * scale
    const maximumLeft = Math.max(previewSize.width - signatureWidth, 0)
    const maximumTop = Math.max(previewSize.height - signatureHeight, 0)

    if (isCustomPosition(position)) {
      return {
        width: signatureWidth,
        height: signatureHeight,
        left: clampNumber(position.xRatio, 0, 1) * maximumLeft,
        top: clampNumber(position.yRatio, 0, 1) * maximumTop
      }
    }

    const presetCoordinates = getPresetCoordinates(
      position,
      previewSize.width,
      previewSize.height,
      signatureWidth,
      signatureHeight,
      margin * scale
    )

    return {
      width: signatureWidth,
      height: signatureHeight,
      left: clampNumber(presetCoordinates.left, 0, maximumLeft),
      top: clampNumber(presetCoordinates.top, 0, maximumTop)
    }
  }, [
    pdfPageSize,
    position,
    previewSize,
    signatureAspectRatio,
    width
  ])

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
    onPageNumberChange(
      clampInteger(value, 1, pageCount > 0 ? pageCount : 99999)
    )
  }

  const handleWidthChange = (value: number) => {
    onWidthChange(clampInteger(value, 40, 400))
  }

  const handleOpacityChange = (value: number) => {
    onOpacityChange(clampNumber(value, 0.1, 1))
  }

  const handlePreviewPageChange = (nextPage: number) => {
    const safePage = clampInteger(nextPage, 1, Math.max(pageCount, 1))

    if (pageMode === 'custom') {
      onPageNumberChange(safePage)
      return
    }

    if (pageMode === 'all') {
      setPreviewPageNumber(safePage)
    }
  }

  const handleSignaturePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!previewPageRef.current || signaturePreview.width <= 0) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const pageRectangle = previewPageRef.current.getBoundingClientRect()

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - pageRectangle.left - signaturePreview.left,
      offsetY: event.clientY - pageRectangle.top - signaturePreview.top
    }
  }

  const handleSignaturePointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const dragState = dragStateRef.current
    const previewPage = previewPageRef.current

    if (
      !dragState ||
      dragState.pointerId !== event.pointerId ||
      !previewPage
    ) {
      return
    }

    event.preventDefault()

    const pageRectangle = previewPage.getBoundingClientRect()
    const maximumLeft = Math.max(
      previewSize.width - signaturePreview.width,
      0
    )
    const maximumTop = Math.max(
      previewSize.height - signaturePreview.height,
      0
    )
    const nextLeft = clampNumber(
      event.clientX - pageRectangle.left - dragState.offsetX,
      0,
      maximumLeft
    )
    const nextTop = clampNumber(
      event.clientY - pageRectangle.top - dragState.offsetY,
      0,
      maximumTop
    )

    onPositionChange({
      xRatio: maximumLeft > 0 ? nextLeft / maximumLeft : 0,
      yRatio: maximumTop > 0 ? nextTop / maximumTop : 0
    })
  }

  const finishSignatureDrag = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const positionSelectValue = isCustomPosition(position)
    ? 'custom'
    : position

  return (
    <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-violet-300/20 bg-violet-300/[0.05]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
          Configurar assinatura
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Veja a página e arraste a assinatura
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          Escolha uma imagem PNG, JPG ou JPEG, confirme a página e arraste a
          assinatura diretamente sobre a pré-visualização para a colocar no
          local exato.
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
                    {signaturePreviewUrl ? (
                      <img
                        src={signaturePreviewUrl}
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
                max={pageCount > 0 ? pageCount : undefined}
                step={1}
                value={pageNumber}
                className="input-field"
                onChange={(event) =>
                  handlePageNumberChange(Number(event.target.value))
                }
              />

              <p className="mt-2 text-xs leading-5 text-slate-400">
                {pageCount > 0
                  ? `Este documento tem ${pageCount} página${
                      pageCount === 1 ? '' : 's'
                    }.`
                  : 'A ferramenta está a analisar o número de páginas.'}
              </p>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-3xl border border-violet-200/20 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <strong className="block text-sm font-semibold text-white">
                Pré-visualização da página
              </strong>

              <span className="mt-1 block text-xs text-slate-400">
                {signatureFile
                  ? 'Agarre na assinatura e arraste-a para o local pretendido.'
                  : 'Escolha a imagem da assinatura para a posicionar sobre a página.'}
              </span>
            </div>

            {pageCount > 0 ? (
              <div className="flex items-center gap-2">
                {pageMode === 'all' && pageCount > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      handlePreviewPageChange(previewPageNumber - 1)
                    }
                    disabled={previewPageNumber <= 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white transition hover:border-violet-200/30 hover:bg-violet-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Ver página anterior"
                  >
                    ←
                  </button>
                ) : null}

                <span className="rounded-full border border-violet-200/20 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-50">
                  Página {previewPageNumber} de {pageCount}
                </span>

                {pageMode === 'all' && pageCount > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      handlePreviewPageChange(previewPageNumber + 1)
                    }
                    disabled={previewPageNumber >= pageCount}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white transition hover:border-violet-200/30 hover:bg-violet-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Ver página seguinte"
                  >
                    →
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            ref={previewViewportRef}
            className="relative flex min-h-[24rem] items-start justify-center overflow-auto bg-slate-900/80 p-4"
          >
            {previewError ? (
              <div className="my-auto max-w-lg rounded-2xl border border-red-300/20 bg-red-300/[0.07] p-4 text-center text-sm leading-6 text-red-100">
                Não foi possível apresentar a pré-visualização. {previewError}
              </div>
            ) : (
              <div
                ref={previewPageRef}
                className="relative shrink-0 overflow-hidden bg-white shadow-2xl shadow-black/50"
                style={{
                  width: previewSize.width || availablePreviewWidth,
                  height: previewSize.height || availablePreviewWidth * 1.414
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="block"
                  aria-label={`Pré-visualização da página ${previewPageNumber}`}
                />

                {isPreviewLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm font-semibold text-white backdrop-blur-sm">
                    <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-violet-200/25 border-t-violet-200" />
                    A carregar a página...
                  </div>
                ) : null}

                {!isPreviewLoading &&
                signatureFile &&
                signaturePreviewUrl &&
                signaturePreview.width > 0 ? (
                  <button
                    type="button"
                    aria-label="Arrastar assinatura para outra posição"
                    title="Arraste para posicionar a assinatura"
                    className="absolute z-10 touch-none cursor-grab select-none rounded-md border-2 border-dashed border-violet-600/75 bg-violet-100/10 p-0 shadow-lg shadow-violet-950/25 active:cursor-grabbing"
                    style={{
                      left: signaturePreview.left,
                      top: signaturePreview.top,
                      width: signaturePreview.width,
                      height: signaturePreview.height,
                      opacity
                    }}
                    onPointerDown={handleSignaturePointerDown}
                    onPointerMove={handleSignaturePointerMove}
                    onPointerUp={finishSignatureDrag}
                    onPointerCancel={finishSignatureDrag}
                  >
                    <img
                      src={signaturePreviewUrl}
                      alt="Assinatura posicionada no documento"
                      draggable={false}
                      className="h-full w-full pointer-events-none object-contain"
                    />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="signature-position" className="input-label">
              Atalho de posição
            </label>

            <select
              id="signature-position"
              className="input-field"
              value={positionSelectValue}
              onChange={(event) => {
                if (event.target.value !== 'custom') {
                  onPositionChange(event.target.value as SignaturePosition)
                }
              }}
            >
              {positionSelectValue === 'custom' ? (
                <option value="custom">Posição personalizada</option>
              ) : null}

              {signaturePositions.map((signaturePosition) => (
                <option
                  key={signaturePosition.value}
                  value={signaturePosition.value}
                >
                  {signaturePosition.label}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Pode usar um atalho e depois ajustar livremente a posição ao
              arrastar a assinatura na página.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="signature-width" className="input-label mb-0">
                Tamanho
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-violet-100">
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
          O documento, a pré-visualização e a imagem da assinatura são
          processados localmente no navegador. Nenhum dos ficheiros é enviado
          para servidores.
        </div>
      </div>
    </div>
  )
}

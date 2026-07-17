import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'

import type {
  WatermarkCoordinates,
  WatermarkPosition
} from '../../lib/maPdf/watermarkPdf'

export type WatermarkPageMode =
  | 'all'
  | 'last'
  | 'custom'

type PdfViewport = {
  width: number
  height: number
}

type PdfRenderTask = {
  promise: Promise<void>
  cancel: () => void
}

type PdfPageProxy = {
  getViewport: (
    options: {
      scale: number
    }
  ) => PdfViewport

  render: (
    options: {
      canvas:
        HTMLCanvasElement

      canvasContext:
        CanvasRenderingContext2D

      viewport:
        PdfViewport

      background:
        string
    }
  ) => PdfRenderTask

  cleanup: () => void
}

type PdfDocumentProxy = {
  numPages: number

  getPage: (
    pageNumber: number
  ) => Promise<PdfPageProxy>
}

type PdfDocumentLoadingTask = {
  promise:
    Promise<PdfDocumentProxy>

  destroy:
    () => Promise<void>
}

type WatermarkOptionsProps = {
  pdfFile: File
  text: string
  pageMode: WatermarkPageMode
  pageNumber: number
  position: WatermarkPosition
  fontSize: number
  opacity: number
  rotation: number
  color: string

  onTextChange:
    (text: string) => void

  onPageModeChange:
    (
      mode:
        WatermarkPageMode
    ) => void

  onPageNumberChange:
    (
      pageNumber:
        number
    ) => void

  onPositionChange:
    (
      position:
        WatermarkPosition
    ) => void

  onFontSizeChange:
    (
      fontSize:
        number
    ) => void

  onOpacityChange:
    (
      opacity:
        number
    ) => void

  onRotationChange:
    (
      rotation:
        number
    ) => void

  onColorChange:
    (
      color:
        string
    ) => void
}

type PreviewSize = {
  width: number
  height: number
}

type WatermarkPreview = {
  centerX: number
  centerY: number
  width: number
  height: number
  rotatedWidth: number
  rotatedHeight: number
}

type DragState = {
  pointerId: number
  offsetX: number
  offsetY: number
}

type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

type ResizeState = {
  pointerId: number
  handle: ResizeHandle
  anchorX: number
  anchorY: number
  baseWidth: number
  baseHeight: number
  baseFontSize: number
  rotation: number
}

type RotationState = {
  pointerId: number
  centerX: number
  centerY: number
  angleOffset: number
}

const DEFAULT_PREVIEW_WIDTH =
  760

const PAGE_MARGIN =
  36

const MIN_FONT_SIZE =
  12

const MAX_FONT_SIZE =
  180

const pageModes:
  Array<{
    value:
      WatermarkPageMode

    title:
      string

    description:
      string
  }> = [
    {
      value:
        'all',

      title:
        'Todas as páginas',

      description:
        'Repetir a marca de água na mesma posição relativa em todo o documento.'
    },
    {
      value:
        'last',

      title:
        'Última página',

      description:
        'Adicionar a marca de água apenas na última página.'
    },
    {
      value:
        'custom',

      title:
        'Página específica',

      description:
        'Escolher manualmente uma única página do documento.'
    }
  ]

const watermarkPositions:
  Array<{
    value:
      Exclude<
        WatermarkPosition,
        WatermarkCoordinates
      >

    title:
      string

    description:
      string
  }> = [
    {
      value:
        'top',

      title:
        'Superior',

      description:
        'Alinhar ao centro da zona superior.'
    },
    {
      value:
        'center',

      title:
        'Centro',

      description:
        'Alinhar ao centro da página.'
    },
    {
      value:
        'bottom',

      title:
        'Inferior',

      description:
        'Alinhar ao centro da zona inferior.'
    }
  ]

function clampNumber(
  value: number,
  minimum: number,
  maximum: number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return minimum
  }

  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  )
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.trunc(
    clampNumber(
      value,
      minimum,
      maximum
    )
  )
}

function isCustomPosition(
  position:
    WatermarkPosition
): position is WatermarkCoordinates {
  return (
    typeof position ===
    'object'
  )
}

function getSafeColor(
  color: string
) {
  return /^#[0-9a-f]{6}$/i.test(
    color
  )
    ? color
    : '#737373'
}

function normalizeAngle(
  angle: number
) {
  let normalized =
    angle

  while (
    normalized > 180
  ) {
    normalized -= 360
  }

  while (
    normalized < -180
  ) {
    normalized += 360
  }

  return normalized
}

function rotatePoint(
  x: number,
  y: number,
  rotation: number
) {
  const radians =
    (
      rotation *
      Math.PI
    ) / 180

  const cosine =
    Math.cos(
      radians
    )

  const sine =
    Math.sin(
      radians
    )

  return {
    x:
      x * cosine -
      y * sine,

    y:
      x * sine +
      y * cosine
  }
}

function getRotatedBounds(
  width: number,
  height: number,
  rotation: number
) {
  const radians =
    (
      rotation *
      Math.PI
    ) / 180

  const cosine =
    Math.abs(
      Math.cos(
        radians
      )
    )

  const sine =
    Math.abs(
      Math.sin(
        radians
      )
    )

  return {
    width:
      width * cosine +
      height * sine,

    height:
      width * sine +
      height * cosine
  }
}

function measureWatermarkWidth(
  text: string,
  fontSize: number
) {
  if (
    typeof document ===
    'undefined'
  ) {
    return Math.max(
      fontSize,

      text.length *
        fontSize *
        0.62
    )
  }

  const canvas =
    document.createElement(
      'canvas'
    )

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    return Math.max(
      fontSize,

      text.length *
        fontSize *
        0.62
    )
  }

  context.font =
    `700 ${fontSize}px Helvetica, Arial, sans-serif`

  return Math.max(
    fontSize,

    context
      .measureText(
        text
      )
      .width
  )
}

function getPresetCenter(
  position:
    Exclude<
      WatermarkPosition,
      WatermarkCoordinates
    >,

  previewSize:
    PreviewSize,

  fontSize:
    number,

  pageScale:
    number
) {
  const centerX =
    previewSize.width / 2

  if (
    position === 'top'
  ) {
    return {
      centerX,

      centerY:
        PAGE_MARGIN *
          pageScale +
        fontSize
    }
  }

  if (
    position === 'bottom'
  ) {
    return {
      centerX,

      centerY:
        previewSize.height -
        PAGE_MARGIN *
          pageScale -
        fontSize
    }
  }

  return {
    centerX,

    centerY:
      previewSize.height /
      2
  }
}

function getConstrainedCenter(
  centerX: number,
  centerY: number,

  previewSize:
    PreviewSize,

  rotatedWidth:
    number,

  rotatedHeight:
    number
) {
  const halfWidth =
    Math.min(
      rotatedWidth / 2,
      previewSize.width / 2
    )

  const halfHeight =
    Math.min(
      rotatedHeight / 2,
      previewSize.height / 2
    )

  return {
    centerX:
      clampNumber(
        centerX,
        halfWidth,

        Math.max(
          previewSize.width -
            halfWidth,

          halfWidth
        )
      ),

    centerY:
      clampNumber(
        centerY,
        halfHeight,

        Math.max(
          previewSize.height -
            halfHeight,

          halfHeight
        )
      )
  }
}

export default function WatermarkOptions({
  pdfFile,
  text,
  pageMode,
  pageNumber,
  position,
  fontSize,
  opacity,
  rotation,
  color,
  onTextChange,
  onPageModeChange,
  onPageNumberChange,
  onPositionChange,
  onFontSizeChange,
  onOpacityChange,
  onRotationChange,
  onColorChange
}: WatermarkOptionsProps) {
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

  const dragStateRef =
    useRef<
      DragState |
      null
    >(null)

  const resizeStateRef =
    useRef<
      ResizeState |
      null
    >(null)

  const rotationStateRef =
    useRef<
      RotationState |
      null
    >(null)

  const [
    pdfDocument,
    setPdfDocument
  ] =
    useState<
      PdfDocumentProxy |
      null
    >(null)

  const [
    pageCount,
    setPageCount
  ] =
    useState(0)

  const [
    previewPageNumber,
    setPreviewPageNumber
  ] =
    useState(1)

  const [
    availablePreviewWidth,
    setAvailablePreviewWidth
  ] =
    useState(
      DEFAULT_PREVIEW_WIDTH
    )

  const [
    previewSize,
    setPreviewSize
  ] =
    useState<PreviewSize>({
      width: 0,
      height: 0
    })

  const [
    pdfPageSize,
    setPdfPageSize
  ] =
    useState<PreviewSize>({
      width: 0,
      height: 0
    })

  const [
    isPreviewLoading,
    setIsPreviewLoading
  ] =
    useState(true)

  const [
    previewError,
    setPreviewError
  ] =
    useState('')

  useEffect(() => {
    const previewViewport =
      previewViewportRef.current

    if (
      !previewViewport
    ) {
      return
    }

    const updateAvailableWidth =
      () => {
        setAvailablePreviewWidth(
          clampNumber(
            previewViewport
              .clientWidth -
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
      resizeObserver
        .disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled =
      false

    let loadingTask:
      | PdfDocumentLoadingTask
      | null = null

    setPdfDocument(
      null
    )

    setPageCount(0)
    setPreviewError('')
    setIsPreviewLoading(
      true
    )

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

          pdfJs
            .GlobalWorkerOptions
            .workerSrc =
              workerModule.default

          const data =
            new Uint8Array(
              await pdfFile
                .arrayBuffer()
            )

          loadingTask =
            pdfJs.getDocument({
              data
            }) as unknown as PdfDocumentLoadingTask

          const loadedDocument =
            await loadingTask
              .promise

          if (cancelled) {
            await loadingTask
              .destroy()

            return
          }

          if (
            loadedDocument
              .numPages === 0
          ) {
            throw new Error(
              'O documento não contém páginas.'
            )
          }

          setPdfDocument(
            loadedDocument
          )

          setPageCount(
            loadedDocument
              .numPages
          )
        } catch (
          error
        ) {
          if (cancelled) {
            return
          }

          setPreviewError(
            error instanceof
              Error

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
        void loadingTask
          .destroy()
      }
    }
  }, [pdfFile])

  useEffect(() => {
    if (
      pageCount <= 0
    ) {
      return
    }

    if (
      pageMode ===
      'last'
    ) {
      setPreviewPageNumber(
        pageCount
      )

      return
    }

    if (
      pageMode ===
      'custom'
    ) {
      setPreviewPageNumber(
        clampInteger(
          pageNumber,
          1,
          pageCount
        )
      )

      return
    }

    setPreviewPageNumber(
      (
        currentPage
      ) =>
        clampInteger(
          currentPage,
          1,
          pageCount
        )
    )
  }, [
    pageCount,
    pageMode,
    pageNumber
  ])

  useEffect(() => {
    if (
      !pdfDocument ||
      !canvasRef.current ||
      previewPageNumber <
        1
    ) {
      return
    }

    let cancelled =
      false

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
            await pdfDocument
              .getPage(
                previewPageNumber
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
            clampNumber(
              window
                .devicePixelRatio ||
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
                renderViewport
                  .width
              )
            )

          canvas.height =
            Math.max(
              1,

              Math.ceil(
                renderViewport
                  .height
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

          const currentRenderTask =
            page.render({
              canvas,

              canvasContext:
                context,

              viewport:
                renderViewport,

              background:
                'rgb(255, 255, 255)'
            })

          renderTask =
            currentRenderTask

          await currentRenderTask
            .promise

          if (
            !cancelled
          ) {
            setIsPreviewLoading(
              false
            )
          }

          page.cleanup()
        } catch (
          error
        ) {
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
            error instanceof
              Error

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
    previewPageNumber
  ])

  const previewText =
    text.trim() ||
    'MARCA DE ÁGUA'

  const previewColor =
    getSafeColor(
      color
    )

  const pageScale =
    pdfPageSize.width >
    0
      ? previewSize.width /
        pdfPageSize.width

      : 1

  const watermarkPreview =
    useMemo<
      WatermarkPreview
    >(
      () => {
        if (
          previewSize.width <=
            0 ||

          previewSize.height <=
            0
        ) {
          return {
            centerX: 0,
            centerY: 0,
            width: 0,
            height: 0,
            rotatedWidth: 0,
            rotatedHeight: 0
          }
        }

        const previewFontSize =
          Math.max(
            fontSize *
              pageScale,

            1
          )

        const width =
          measureWatermarkWidth(
            previewText,
            previewFontSize
          )

        const height =
          previewFontSize

        const rotatedBounds =
          getRotatedBounds(
            width,
            height,
            rotation
          )

        const requestedCenter =
          isCustomPosition(
            position
          )
            ? {
                centerX:
                  clampNumber(
                    position.xRatio,
                    0,
                    1
                  ) *
                  previewSize.width,

                centerY:
                  clampNumber(
                    position.yRatio,
                    0,
                    1
                  ) *
                  previewSize.height
              }

            : getPresetCenter(
                position,
                previewSize,
                previewFontSize,
                pageScale
              )

        const center =
          getConstrainedCenter(
            requestedCenter
              .centerX,

            requestedCenter
              .centerY,

            previewSize,

            rotatedBounds
              .width,

            rotatedBounds
              .height
          )

        return {
          ...center,
          width,
          height,

          rotatedWidth:
            rotatedBounds
              .width,

          rotatedHeight:
            rotatedBounds
              .height
        }
      },
      [
        fontSize,
        pageScale,
        position,
        previewSize,
        previewText,
        rotation
      ]
    )

  const updateCustomPosition =
    (
      centerX:
        number,

      centerY:
        number,

      width =
        watermarkPreview
          .width,

      height =
        watermarkPreview
          .height,

      nextRotation =
        rotation
    ) => {
      if (
        previewSize.width <=
          0 ||

        previewSize.height <=
          0
      ) {
        return
      }

      const rotatedBounds =
        getRotatedBounds(
          width,
          height,
          nextRotation
        )

      const constrainedCenter =
        getConstrainedCenter(
          centerX,
          centerY,
          previewSize,

          rotatedBounds
            .width,

          rotatedBounds
            .height
        )

      onPositionChange({
        xRatio:
          constrainedCenter
            .centerX /
          previewSize.width,

        yRatio:
          constrainedCenter
            .centerY /
          previewSize.height
      })
    }

  const handlePageNumberChange =
    (
      value:
        number
    ) => {
      onPageNumberChange(
        clampInteger(
          value,
          1,

          pageCount > 0
            ? pageCount
            : 99999
        )
      )
    }

  const handlePreviewPageChange =
    (
      nextPage:
        number
    ) => {
      const safePage =
        clampInteger(
          nextPage,
          1,

          Math.max(
            pageCount,
            1
          )
        )

      if (
        pageMode ===
        'custom'
      ) {
        onPageNumberChange(
          safePage
        )

        return
      }

      if (
        pageMode ===
        'all'
      ) {
        setPreviewPageNumber(
          safePage
        )
      }
    }

  const handlePositionChange =
    (
      newPosition:
        Exclude<
          WatermarkPosition,
          WatermarkCoordinates
        >
    ) => {
      onPositionChange(
        newPosition
      )

      if (
        newPosition ===
          'center' &&

        rotation === 0
      ) {
        onRotationChange(
          45
        )

        return
      }

      if (
        newPosition !==
          'center' &&

        rotation === 45
      ) {
        onRotationChange(
          0
        )
      }
    }

  const handleDragPointerDown =
    (
      event:
        ReactPointerEvent<
          HTMLButtonElement
        >
    ) => {
      if (
        !previewPageRef
          .current ||

        watermarkPreview
          .width <= 0
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      event.currentTarget
        .setPointerCapture(
          event.pointerId
        )

      const pageRectangle =
        previewPageRef
          .current
          .getBoundingClientRect()

      dragStateRef.current = {
        pointerId:
          event.pointerId,

        offsetX:
          event.clientX -
          pageRectangle.left -
          watermarkPreview
            .centerX,

        offsetY:
          event.clientY -
          pageRectangle.top -
          watermarkPreview
            .centerY
      }
    }

  const handleDragPointerMove =
    (
      event:
        ReactPointerEvent<
          HTMLButtonElement
        >
    ) => {
      const dragState =
        dragStateRef.current

      const previewPage =
        previewPageRef.current

      if (
        !dragState ||

        dragState.pointerId !==
          event.pointerId ||

        !previewPage
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const pageRectangle =
        previewPage
          .getBoundingClientRect()

      updateCustomPosition(
        event.clientX -
          pageRectangle.left -
          dragState.offsetX,

        event.clientY -
          pageRectangle.top -
          dragState.offsetY
      )
    }

  const finishDrag =
    (
      event:
        ReactPointerEvent<
          HTMLButtonElement
        >
    ) => {
      if (
        dragStateRef
          .current
          ?.pointerId ===
        event.pointerId
      ) {
        dragStateRef.current =
          null
      }

      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          )
      }
    }

  const handleResizePointerDown =
    (
      event:
        ReactPointerEvent<
          HTMLSpanElement
        >,

      handle:
        ResizeHandle
    ) => {
      if (
        watermarkPreview
          .width <= 0 ||

        watermarkPreview
          .height <= 0
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      event.currentTarget
        .setPointerCapture(
          event.pointerId
        )

      const horizontalSign =
        handle.endsWith(
          'right'
        )
          ? 1
          : -1

      const verticalSign =
        handle.startsWith(
          'bottom'
        )
          ? 1
          : -1

      const oppositeCorner =
        rotatePoint(
          -horizontalSign *
            watermarkPreview
              .width /
            2,

          -verticalSign *
            watermarkPreview
              .height /
            2,

          rotation
        )

      resizeStateRef.current = {
        pointerId:
          event.pointerId,

        handle,

        anchorX:
          watermarkPreview
            .centerX +
          oppositeCorner.x,

        anchorY:
          watermarkPreview
            .centerY +
          oppositeCorner.y,

        baseWidth:
          watermarkPreview
            .width,

        baseHeight:
          watermarkPreview
            .height,

        baseFontSize:
          fontSize,

        rotation
      }
    }

  const handleResizePointerMove =
    (
      event:
        ReactPointerEvent<
          HTMLSpanElement
        >
    ) => {
      const resizeState =
        resizeStateRef.current

      const previewPage =
        previewPageRef.current

      if (
        !resizeState ||

        resizeState.pointerId !==
          event.pointerId ||

        !previewPage ||

        resizeState
          .baseWidth <= 0 ||

        resizeState
          .baseHeight <= 0
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const pageRectangle =
        previewPage
          .getBoundingClientRect()

      const pointerX =
        event.clientX -
        pageRectangle.left

      const pointerY =
        event.clientY -
        pageRectangle.top

      const vector =
        rotatePoint(
          pointerX -
            resizeState
              .anchorX,

          pointerY -
            resizeState
              .anchorY,

          -resizeState
            .rotation
        )

      const horizontalSign =
        resizeState
          .handle
          .endsWith(
            'right'
          )
          ? 1
          : -1

      const verticalSign =
        resizeState
          .handle
          .startsWith(
            'bottom'
          )
          ? 1
          : -1

      const ratio =
        resizeState.baseWidth /
        resizeState.baseHeight

      const projectedWidth =
        (
          horizontalSign *
            vector.x +

          verticalSign *
            vector.y /
            ratio
        ) /
        (
          1 +
          1 /
            (
              ratio *
              ratio
            )
        )

      let nextFontSize =
        clampNumber(
          resizeState
            .baseFontSize *
            projectedWidth /
            resizeState
              .baseWidth,

          MIN_FONT_SIZE,
          MAX_FONT_SIZE
        )

      let scale =
        nextFontSize /
        resizeState
          .baseFontSize

      let nextWidth =
        resizeState
          .baseWidth *
        scale

      let nextHeight =
        resizeState
          .baseHeight *
        scale

      const nextRotatedBounds =
        getRotatedBounds(
          nextWidth,
          nextHeight,
          resizeState.rotation
        )

      const fitScale =
        Math.min(
          1,

          previewSize.width /
            Math.max(
              nextRotatedBounds
                .width,

              1
            ),

          previewSize.height /
            Math.max(
              nextRotatedBounds
                .height,

              1
            )
        )

      if (
        fitScale < 1
      ) {
        nextFontSize *=
          fitScale

        scale =
          nextFontSize /
          resizeState
            .baseFontSize

        nextWidth =
          resizeState
            .baseWidth *
          scale

        nextHeight =
          resizeState
            .baseHeight *
          scale
      }

      nextFontSize =
        clampNumber(
          nextFontSize,
          MIN_FONT_SIZE,
          MAX_FONT_SIZE
        )

      scale =
        nextFontSize /
        resizeState
          .baseFontSize

      nextWidth =
        resizeState
          .baseWidth *
        scale

      nextHeight =
        resizeState
          .baseHeight *
        scale

      const centerOffset =
        rotatePoint(
          horizontalSign *
            nextWidth /
            2,

          verticalSign *
            nextHeight /
            2,

          resizeState.rotation
        )

      const nextCenterX =
        resizeState.anchorX +
        centerOffset.x

      const nextCenterY =
        resizeState.anchorY +
        centerOffset.y

      onFontSizeChange(
        Math.round(
          nextFontSize
        )
      )

      updateCustomPosition(
        nextCenterX,
        nextCenterY,
        nextWidth,
        nextHeight,
        resizeState.rotation
      )
    }

  const finishResize =
    (
      event:
        ReactPointerEvent<
          HTMLSpanElement
        >
    ) => {
      event.preventDefault()
      event.stopPropagation()

      if (
        resizeStateRef
          .current
          ?.pointerId ===
        event.pointerId
      ) {
        resizeStateRef.current =
          null
      }

      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          )
      }
    }

  const handleRotationPointerDown =
    (
      event:
        ReactPointerEvent<
          HTMLSpanElement
        >
    ) => {
      const previewPage =
        previewPageRef.current

      if (!previewPage) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      event.currentTarget
        .setPointerCapture(
          event.pointerId
        )

      const pageRectangle =
        previewPage
          .getBoundingClientRect()

      const pointerAngle =
        Math.atan2(
          event.clientY -
            pageRectangle.top -
            watermarkPreview
              .centerY,

          event.clientX -
            pageRectangle.left -
            watermarkPreview
              .centerX
        ) *
        180 /
        Math.PI

      rotationStateRef.current = {
        pointerId:
          event.pointerId,

        centerX:
          watermarkPreview
            .centerX,

        centerY:
          watermarkPreview
            .centerY,

        angleOffset:
          pointerAngle -
          rotation
      }
    }

  const handleRotationPointerMove =
    (
      event:
        ReactPointerEvent<
          HTMLSpanElement
        >
    ) => {
      const rotationState =
        rotationStateRef.current

      const previewPage =
        previewPageRef.current

      if (
        !rotationState ||

        rotationState.pointerId !==
          event.pointerId ||

        !previewPage
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const pageRectangle =
        previewPage
          .getBoundingClientRect()

      const pointerAngle =
        Math.atan2(
          event.clientY -
            pageRectangle.top -
            rotationState.centerY,

          event.clientX -
            pageRectangle.left -
            rotationState.centerX
        ) *
        180 /
        Math.PI

      const nextRotation =
        Math.round(
          normalizeAngle(
            pointerAngle -
            rotationState
              .angleOffset
          )
        )

      onRotationChange(
        nextRotation
      )

      updateCustomPosition(
        rotationState.centerX,
        rotationState.centerY,
        watermarkPreview.width,
        watermarkPreview.height,
        nextRotation
      )
    }

  const finishRotation =
    (
      event:
        ReactPointerEvent<
          HTMLSpanElement
        >
    ) => {
      event.preventDefault()
      event.stopPropagation()

      if (
        rotationStateRef
          .current
          ?.pointerId ===
        event.pointerId
      ) {
        rotationStateRef.current =
          null
      }

      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          )
      }
    }

  const positionIsCustom =
    isCustomPosition(
      position
    )

  return (
    <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-sky-300/20 bg-sky-300/[0.05]">
      <div className="border-b border-white/10 p-5">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
          Configurar marca de água
        </span>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Veja, mova, redimensione e rode
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          A página verdadeira do PDF aparece abaixo. Arraste a marca de água
          para a posição pretendida, puxe um dos quatro cantos para alterar o
          tamanho e utilize o controlo circular para a rodar.
        </p>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="watermark-text"
              className="input-label mb-0"
            >
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
            onChange={(event) =>
              onTextChange(
                event.target.value
              )
            }
          />

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Utilize letras, números e pontuação simples. O texto vazio impede
            o processamento do documento.
          </p>
        </div>

        <div>
          <span className="input-label">
            Páginas onde será aplicada
          </span>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {pageModes.map(
              (mode) => {
                const selected =
                  pageMode ===
                  mode.value

                return (
                  <button
                    key={
                      mode.value
                    }
                    type="button"
                    onClick={() =>
                      onPageModeChange(
                        mode.value
                      )
                    }
                    aria-pressed={
                      selected
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-sky-200/45 bg-sky-300/12 shadow-lg shadow-sky-950/20'
                        : 'border-white/10 bg-white/[0.03] hover:border-sky-200/25 hover:bg-sky-300/[0.06]'
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
              }
            )}
          </div>

          {pageMode ===
          'custom' ? (
            <div className="mt-4 max-w-xs">
              <label
                htmlFor="watermark-page-number"
                className="input-label"
              >
                Número da página
              </label>

              <input
                id="watermark-page-number"
                type="number"
                min={1}
                max={
                  pageCount > 0
                    ? pageCount
                    : undefined
                }
                step={1}
                value={pageNumber}
                className="input-field"
                onChange={(
                  event
                ) =>
                  handlePageNumberChange(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />

              <p className="mt-2 text-xs leading-5 text-slate-400">
                {pageCount > 0
                  ? `Este documento tem ${pageCount} página${
                      pageCount ===
                      1
                        ? ''
                        : 's'
                    }.`
                  : 'A ferramenta está a analisar o número de páginas.'}
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <span className="input-label">
            Atalho de posição
          </span>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {watermarkPositions.map(
              (
                watermarkPosition
              ) => {
                const selected =
                  !positionIsCustom &&
                  position ===
                    watermarkPosition
                      .value

                return (
                  <button
                    key={
                      watermarkPosition
                        .value
                    }
                    type="button"
                    onClick={() =>
                      handlePositionChange(
                        watermarkPosition
                          .value
                      )
                    }
                    aria-pressed={
                      selected
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-sky-200/45 bg-sky-300/12 shadow-lg shadow-sky-950/20'
                        : 'border-white/10 bg-white/[0.03] hover:border-sky-200/25 hover:bg-sky-300/[0.06]'
                    }`}
                  >
                    <strong className="block text-sm font-semibold text-white">
                      {
                        watermarkPosition
                          .title
                      }
                    </strong>

                    <span className="mt-2 block text-xs leading-5 text-slate-400">
                      {
                        watermarkPosition
                          .description
                      }
                    </span>
                  </button>
                )
              }
            )}
          </div>

          {positionIsCustom ? (
            <p className="mt-3 text-xs leading-5 text-sky-100/80">
              Está a utilizar uma posição personalizada definida diretamente
              na pré-visualização.
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-3xl border border-sky-200/20 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <strong className="block text-sm font-semibold text-white">
                Pré-visualização da página real
              </strong>

              <span className="mt-1 block text-xs text-slate-400">
                Arraste para mover, puxe os cantos para redimensionar e utilize
                o ponto circular superior para rodar.
              </span>
            </div>

            {pageCount > 0 ? (
              <div className="flex items-center gap-2">
                {pageMode ===
                  'all' &&
                pageCount > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      handlePreviewPageChange(
                        previewPageNumber -
                          1
                      )
                    }
                    disabled={
                      previewPageNumber <=
                      1
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white transition hover:border-sky-200/30 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Ver página anterior"
                  >
                    ←
                  </button>
                ) : null}

                <span className="rounded-full border border-sky-200/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-50">
                  Página{' '}
                  {
                    previewPageNumber
                  }{' '}
                  de{' '}
                  {pageCount}
                </span>

                {pageMode ===
                  'all' &&
                pageCount > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      handlePreviewPageChange(
                        previewPageNumber +
                          1
                      )
                    }
                    disabled={
                      previewPageNumber >=
                      pageCount
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white transition hover:border-sky-200/30 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Ver página seguinte"
                  >
                    →
                  </button>
                ) : null}
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
                Não foi possível apresentar a pré-visualização.{' '}
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
                    previewSize
                      .width ||
                    availablePreviewWidth,

                  height:
                    previewSize
                      .height ||
                    availablePreviewWidth *
                      1.414
                }}
              >
                <canvas
                  ref={
                    canvasRef
                  }
                  className="block"
                  aria-label={`Pré-visualização da página ${previewPageNumber}`}
                />

                {isPreviewLoading ? (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 text-sm font-semibold text-white backdrop-blur-sm">
                    <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-sky-200/25 border-t-sky-200" />

                    A carregar a página...
                  </div>
                ) : null}

                {!isPreviewLoading &&
                watermarkPreview
                  .width > 0 ? (
                  <button
                    type="button"
                    aria-label="Mover, redimensionar ou rodar a marca de água"
                    title="Arraste para mover"
                    className="absolute z-20 touch-none cursor-grab select-none border-2 border-dashed border-sky-600/80 bg-sky-100/10 p-0 shadow-lg shadow-sky-950/25 active:cursor-grabbing"
                    style={{
                      left:
                        watermarkPreview
                          .centerX,

                      top:
                        watermarkPreview
                          .centerY,

                      width:
                        watermarkPreview
                          .width,

                      height:
                        watermarkPreview
                          .height,

                      transform:
                        `translate(-50%, -50%) rotate(${rotation}deg)`,

                      transformOrigin:
                        'center center'
                    }}
                    onPointerDown={
                      handleDragPointerDown
                    }
                    onPointerMove={
                      handleDragPointerMove
                    }
                    onPointerUp={
                      finishDrag
                    }
                    onPointerCancel={
                      finishDrag
                    }
                  >
                    <span
                      className="pointer-events-none flex h-full w-full items-center justify-center whitespace-nowrap font-bold leading-none"
                      style={{
                        color:
                          previewColor,

                        fontFamily:
                          'Helvetica, Arial, sans-serif',

                        fontSize:
                          `${
                            fontSize *
                            pageScale
                          }px`,

                        opacity
                      }}
                    >
                      {previewText}
                    </span>

                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 top-[-2.1rem] h-7 w-px -translate-x-1/2 bg-sky-600/80"
                    />

                    <span
                      aria-hidden="true"
                      title="Rodar marca de água"
                      className="absolute left-1/2 top-[-2.8rem] z-30 h-5 w-5 -translate-x-1/2 touch-none cursor-grab rounded-full border-2 border-white bg-sky-600 shadow-md shadow-black/40 active:cursor-grabbing"
                      onPointerDown={
                        handleRotationPointerDown
                      }
                      onPointerMove={
                        handleRotationPointerMove
                      }
                      onPointerUp={
                        finishRotation
                      }
                      onPointerCancel={
                        finishRotation
                      }
                    />

                    <span
                      aria-hidden="true"
                      title="Redimensionar pelo canto superior esquerdo"
                      className="absolute -left-2 -top-2 z-30 h-4 w-4 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-sky-600 shadow-md shadow-black/40"
                      onPointerDown={(
                        event
                      ) =>
                        handleResizePointerDown(
                          event,
                          'top-left'
                        )
                      }
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

                    <span
                      aria-hidden="true"
                      title="Redimensionar pelo canto superior direito"
                      className="absolute -right-2 -top-2 z-30 h-4 w-4 touch-none cursor-nesw-resize rounded-full border-2 border-white bg-sky-600 shadow-md shadow-black/40"
                      onPointerDown={(
                        event
                      ) =>
                        handleResizePointerDown(
                          event,
                          'top-right'
                        )
                      }
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

                    <span
                      aria-hidden="true"
                      title="Redimensionar pelo canto inferior esquerdo"
                      className="absolute -bottom-2 -left-2 z-30 h-4 w-4 touch-none cursor-nesw-resize rounded-full border-2 border-white bg-sky-600 shadow-md shadow-black/40"
                      onPointerDown={(
                        event
                      ) =>
                        handleResizePointerDown(
                          event,
                          'bottom-left'
                        )
                      }
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

                    <span
                      aria-hidden="true"
                      title="Redimensionar pelo canto inferior direito"
                      className="absolute -bottom-2 -right-2 z-30 h-4 w-4 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-sky-600 shadow-md shadow-black/40"
                      onPointerDown={(
                        event
                      ) =>
                        handleResizePointerDown(
                          event,
                          'bottom-right'
                        )
                      }
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
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="watermark-size"
                className="input-label mb-0"
              >
                Tamanho
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-sky-100">
                {fontSize} pt
              </span>
            </div>

            <input
              id="watermark-size"
              type="range"
              min={
                MIN_FONT_SIZE
              }
              max={
                MAX_FONT_SIZE
              }
              step={2}
              value={
                fontSize
              }
              className="mt-4 w-full accent-sky-300"
              onChange={(
                event
              ) =>
                onFontSizeChange(
                  clampNumber(
                    Number(
                      event.target
                        .value
                    ),
                    MIN_FONT_SIZE,
                    MAX_FONT_SIZE
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>
                Pequena
              </span>

              <span>
                Grande
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="watermark-opacity"
                className="input-label mb-0"
              >
                Opacidade
              </label>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-sky-100">
                {Math.round(
                  opacity *
                    100
                )}
                %
              </span>
            </div>

            <input
              id="watermark-opacity"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={
                opacity
              }
              className="mt-4 w-full accent-sky-300"
              onChange={(
                event
              ) =>
                onOpacityChange(
                  clampNumber(
                    Number(
                      event.target
                        .value
                    ),
                    0.05,
                    1
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>
                Discreta
              </span>

              <span>
                Forte
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="watermark-rotation"
                className="input-label mb-0"
              >
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
              step={1}
              value={
                rotation
              }
              className="mt-4 w-full accent-sky-300"
              onChange={(
                event
              ) =>
                onRotationChange(
                  clampNumber(
                    Number(
                      event.target
                        .value
                    ),
                    -180,
                    180
                  )
                )
              }
            />

            <div className="mt-2 flex justify-between text-[0.68rem] text-slate-500">
              <span>
                -180°
              </span>

              <span>
                180°
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="watermark-color"
              className="input-label"
            >
              Cor
            </label>

            <div className="flex items-center gap-3">
              <input
                id="watermark-color"
                type="color"
                value={
                  previewColor
                }
                className="h-12 w-16 shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-1"
                onChange={(
                  event
                ) =>
                  onColorChange(
                    event.target
                      .value
                  )
                }
              />

              <input
                type="text"
                value={color}
                aria-label="Código da cor da marca de água"
                className="input-field"
                onChange={(
                  event
                ) =>
                  onColorChange(
                    event.target
                      .value
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-xs leading-5 text-emerald-50/90">
          O PDF e a pré-visualização são processados localmente no navegador.
          Nenhum ficheiro é enviado para servidores.
        </div>
      </div>
    </div>
  )
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  removeSimpleImageBackground
} from '../../lib/maQuadro/imageFilters'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroBackgroundRemoval.css'

type BrushMode =
  | 'erase'
  | 'restore'

type SerializedNode =
  Record<string, unknown>

type CursorState = {
  x: number
  y: number
  visible: boolean
}

const PREVIEW_MAX_SIDE = 1800
const PREVIEW_MAX_PIXELS = 3_000_000

function findSerializedObject(
  value: unknown,
  objectId: string
): SerializedNode | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found =
        findSerializedObject(
          item,
          objectId
        )

      if (found) {
        return found
      }
    }

    return null
  }

  const node =
    value as SerializedNode

  if (
    node.maId === objectId
  ) {
    return node
  }

  for (
    const child
    of Object.values(node)
  ) {
    const found =
      findSerializedObject(
        child,
        objectId
      )

    if (found) {
      return found
    }
  }

  return null
}

function serializedImageSource(
  node: SerializedNode | null
) {
  if (!node) {
    return ''
  }

  if (
    typeof node.maSourceDataUrl ===
    'string' &&
    node.maSourceDataUrl
  ) {
    return node.maSourceDataUrl
  }

  if (
    typeof node.src === 'string' &&
    node.src
  ) {
    return node.src
  }

  return ''
}

function loadImage(
  source: string
) {
  return new Promise<HTMLImageElement>(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image()

      image.decoding =
        'async'

      image.onload = () =>
        resolve(image)

      image.onerror = () =>
        reject(
          new Error(
            'Não foi possível abrir a imagem para edição.'
          )
        )

      image.src =
        source
    }
  )
}

function cloneImageData(
  imageData: ImageData
) {
  return new ImageData(
    new Uint8ClampedArray(
      imageData.data
    ),
    imageData.width,
    imageData.height
  )
}

function canvasToBlob(
  canvas:
    HTMLCanvasElement
) {
  return new Promise<Blob>(
    (
      resolve,
      reject
    ) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
            return
          }

          reject(
            new Error(
              'O navegador não conseguiu criar a imagem final.'
            )
          )
        },
        'image/png'
      )
    }
  )
}

function safePreviewScale(
  width: number,
  height: number
) {
  return Math.min(
    1,

    PREVIEW_MAX_SIDE /
      Math.max(
        width,
        height
      ),

    Math.sqrt(
      PREVIEW_MAX_PIXELS /
        Math.max(
          1,
          width * height
        )
    )
  )
}

export default function BackgroundRemovalEditor({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const editor =
    useMAQuadroEditorContext()

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    )

  const originalPreviewRef =
    useRef<ImageData | null>(
      null
    )

  const initialProcessedRef =
    useRef<ImageData | null>(
      null
    )

  const originalImageRef =
    useRef<HTMLImageElement | null>(
      null
    )

  const processedImageRef =
    useRef<HTMLImageElement | null>(
      null
    )

  const drawingRef =
    useRef(false)

  const [
    processing,
    setProcessing
  ] = useState(false)

  const [
    applying,
    setApplying
  ] = useState(false)

  const [
    ready,
    setReady
  ] = useState(false)

  const [
    mode,
    setMode
  ] = useState<BrushMode>(
    'restore'
  )

  const [
    brushSize,
    setBrushSize
  ] = useState(72)

  const [
    hardness,
    setHardness
  ] = useState(72)

  const [
    tolerance,
    setTolerance
  ] = useState(58)

  const [
    showOriginal,
    setShowOriginal
  ] = useState(false)

  const [
    message,
    setMessage
  ] = useState('')

  const [
    cursor,
    setCursor
  ] = useState<CursorState>({
    x: 0,
    y: 0,
    visible: false
  })

  const activeLayerId =
    editor.layers.find(
      (layer) =>
        layer.active
    )?.id ?? ''

  const serializedImage =
    useMemo(
      () =>
        activeLayerId &&
        editor.activePage
          ? findSerializedObject(
              editor.activePage
                .canvasJson,
              activeLayerId
            )
          : null,
      [
        activeLayerId,
        editor.activePage
      ]
    )

  const sourceDataUrl =
    serializedImageSource(
      serializedImage
    )

  const imageSelected =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'image'

  const locked =
    processing ||
    applying ||
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const preparePreview =
    async (
      source: string,
      automaticTolerance: number
    ) => {
      const canvas =
        canvasRef.current

      if (!canvas) {
        return
      }

      setProcessing(
        true
      )

      setReady(
        false
      )

      setMessage(
        'A remover o fundo localmente…'
      )

      try {
        const processedSource =
          await removeSimpleImageBackground(
            source,
            automaticTolerance
          )

        const [
          originalImage,
          processedImage
        ] =
          await Promise.all([
            loadImage(
              source
            ),

            loadImage(
              processedSource
            )
          ])

        const outputWidth =
          Math.max(
            1,
            processedImage.naturalWidth
          )

        const outputHeight =
          Math.max(
            1,
            processedImage.naturalHeight
          )

        const previewScale =
          safePreviewScale(
            outputWidth,
            outputHeight
          )

        const previewWidth =
          Math.max(
            1,

            Math.round(
              outputWidth *
                previewScale
            )
          )

        const previewHeight =
          Math.max(
            1,

            Math.round(
              outputHeight *
                previewScale
            )
          )

        canvas.width =
          previewWidth

        canvas.height =
          previewHeight

        const context =
          canvas.getContext(
            '2d',
            {
              willReadFrequently:
                true
            }
          )

        if (!context) {
          throw new Error(
            'O navegador não permitiu editar os píxeis da imagem.'
          )
        }

        context.clearRect(
          0,
          0,
          previewWidth,
          previewHeight
        )

        context.drawImage(
          processedImage,
          0,
          0,
          previewWidth,
          previewHeight
        )

        const initialProcessed =
          context.getImageData(
            0,
            0,
            previewWidth,
            previewHeight
          )

        const originalCanvas =
          document.createElement(
            'canvas'
          )

        originalCanvas.width =
          previewWidth

        originalCanvas.height =
          previewHeight

        const originalContext =
          originalCanvas.getContext(
            '2d',
            {
              willReadFrequently:
                true
            }
          )

        if (
          !originalContext
        ) {
          throw new Error(
            'O navegador não permitiu preparar a imagem original.'
          )
        }

        originalContext.drawImage(
          originalImage,
          0,
          0,
          previewWidth,
          previewHeight
        )

        originalPreviewRef.current =
          originalContext.getImageData(
            0,
            0,
            previewWidth,
            previewHeight
          )

        initialProcessedRef.current =
          cloneImageData(
            initialProcessed
          )

        originalImageRef.current =
          originalImage

        processedImageRef.current =
          processedImage

        originalCanvas.width =
          1

        originalCanvas.height =
          1

        setReady(
          true
        )

        setMessage(
          'Resultado automático pronto. Corrija apenas as zonas necessárias.'
        )
      } catch (error) {
        console.error(
          error
        )

        setMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível remover o fundo desta imagem.'
        )
      } finally {
        setProcessing(
          false
        )
      }
    }

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow =
      document.body.style
        .overflow

    document.body.style
      .overflow =
      'hidden'

    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
            'Escape' &&
          !locked
        ) {
          onClose()
        }
      }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.body.style
        .overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    locked,
    onClose,
    open
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    if (
      !imageSelected ||
      !sourceDataUrl
    ) {
      setReady(
        false
      )

      setMessage(
        'Selecione uma imagem incorporada no design para editar o fundo.'
      )

      return
    }

    setMode(
      'restore'
    )

    setShowOriginal(
      false
    )

    setCursor({
      x: 0,
      y: 0,
      visible: false
    })

    void preparePreview(
      sourceDataUrl,
      tolerance
    )

    // A tolerância só é reaplicada quando o utilizador
    // carrega explicitamente em “Recalcular automático”.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    imageSelected,
    open,
    sourceDataUrl
  ])

  const resetManualEdits =
    () => {
      const canvas =
        canvasRef.current

      const initial =
        initialProcessedRef.current

      const context =
        canvas?.getContext(
          '2d',
          {
            willReadFrequently:
              true
          }
        )

      if (
        !canvas ||
        !initial ||
        !context
      ) {
        return
      }

      context.putImageData(
        cloneImageData(
          initial
        ),
        0,
        0
      )

      setMessage(
        'As correções manuais foram repostas.'
      )
    }

  const paintAt = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    const canvas =
      canvasRef.current

    const original =
      originalPreviewRef.current

    if (
      !canvas ||
      !original ||
      !ready ||
      locked ||
      showOriginal
    ) {
      return
    }

    const rect =
      canvas.getBoundingClientRect()

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return
    }

    const sourceX =
      (
        event.clientX -
        rect.left
      ) *
      canvas.width /
      rect.width

    const sourceY =
      (
        event.clientY -
        rect.top
      ) *
      canvas.height /
      rect.height

    const radius =
      Math.max(
        1,

        brushSize *
          canvas.width /
          rect.width /
          2
      )

    const minimumX =
      Math.max(
        0,

        Math.floor(
          sourceX -
            radius
        )
      )

    const maximumX =
      Math.min(
        canvas.width - 1,

        Math.ceil(
          sourceX +
            radius
        )
      )

    const minimumY =
      Math.max(
        0,

        Math.floor(
          sourceY -
            radius
        )
      )

    const maximumY =
      Math.min(
        canvas.height - 1,

        Math.ceil(
          sourceY +
            radius
        )
      )

    const width =
      maximumX -
      minimumX +
      1

    const height =
      maximumY -
      minimumY +
      1

    const context =
      canvas.getContext(
        '2d',
        {
          willReadFrequently:
            true
        }
      )

    if (!context) {
      return
    }

    const section =
      context.getImageData(
        minimumX,
        minimumY,
        width,
        height
      )

    const hardnessRatio =
      Math.min(
        0.98,

        Math.max(
          0,
          hardness / 100
        )
      )

    for (
      let localY = 0;
      localY < height;
      localY += 1
    ) {
      const globalY =
        minimumY +
        localY

      for (
        let localX = 0;
        localX < width;
        localX += 1
      ) {
        const globalX =
          minimumX +
          localX

        const deltaX =
          globalX -
          sourceX

        const deltaY =
          globalY -
          sourceY

        const distance =
          Math.sqrt(
            deltaX *
              deltaX +
            deltaY *
              deltaY
          )

        if (
          distance >
          radius
        ) {
          continue
        }

        const normalizedDistance =
          distance /
          radius

        const strength =
          normalizedDistance <=
          hardnessRatio
            ? 1
            : 1 -
              (
                normalizedDistance -
                hardnessRatio
              ) /
              Math.max(
                0.02,
                1 -
                  hardnessRatio
              )

        const localOffset =
          (
            localY *
              width +
            localX
          ) *
          4

        const globalOffset =
          (
            globalY *
              canvas.width +
            globalX
          ) *
          4

        if (
          mode ===
          'erase'
        ) {
          section.data[
            localOffset + 3
          ] =
            Math.round(
              section.data[
                localOffset +
                  3
              ] *
              (
                1 -
                strength
              )
            )
        } else {
          for (
            let channel = 0;
            channel < 4;
            channel += 1
          ) {
            const current =
              section.data[
                localOffset +
                  channel
              ]

            const target =
              original.data[
                globalOffset +
                  channel
              ]

            section.data[
              localOffset +
                channel
            ] =
              Math.round(
                current +
                (
                  target -
                  current
                ) *
                strength
              )
          }
        }
      }
    }

    context.putImageData(
      section,
      minimumX,
      minimumY
    )
  }

  const updateCursor = (
    event:
      ReactPointerEvent<HTMLCanvasElement>,
    visible = true
  ) => {
    const rect =
      event.currentTarget
        .getBoundingClientRect()

    setCursor({
      x:
        event.clientX -
        rect.left,

      y:
        event.clientY -
        rect.top,

      visible
    })
  }

  const pointerDown = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      locked ||
      !ready ||
      showOriginal
    ) {
      return
    }

    drawingRef.current =
      true

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      )

    updateCursor(
      event
    )

    paintAt(
      event
    )
  }

  const pointerMove = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    updateCursor(
      event
    )

    if (
      drawingRef.current
    ) {
      paintAt(
        event
      )
    }
  }

  const pointerUp = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    drawingRef.current =
      false

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

  const applyResult =
    async () => {
      const canvas =
        canvasRef.current

      const originalImage =
        originalImageRef.current

      const processedImage =
        processedImageRef.current

      if (
        !canvas ||
        !originalImage ||
        !processedImage ||
        !ready ||
        locked
      ) {
        return
      }

      setApplying(
        true
      )

      setMessage(
        'A aplicar a máscara corrigida…'
      )

      try {
        const context =
          canvas.getContext(
            '2d',
            {
              willReadFrequently:
                true
            }
          )

        if (
          !context
        ) {
          throw new Error(
            'Não foi possível ler a máscara corrigida.'
          )
        }

        const working =
          context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          )

        const maskCanvas =
          document.createElement(
            'canvas'
          )

        maskCanvas.width =
          canvas.width

        maskCanvas.height =
          canvas.height

        const maskContext =
          maskCanvas.getContext(
            '2d'
          )

        if (
          !maskContext
        ) {
          throw new Error(
            'Não foi possível preparar a máscara final.'
          )
        }

        const mask =
          maskContext.createImageData(
            canvas.width,
            canvas.height
          )

        for (
          let offset = 0;
          offset <
          mask.data.length;
          offset += 4
        ) {
          mask.data[
            offset
          ] = 255

          mask.data[
            offset + 1
          ] = 255

          mask.data[
            offset + 2
          ] = 255

          mask.data[
            offset + 3
          ] =
            working.data[
              offset + 3
            ]
        }

        maskContext.putImageData(
          mask,
          0,
          0
        )

        const outputWidth =
          Math.max(
            1,
            processedImage.naturalWidth
          )

        const outputHeight =
          Math.max(
            1,
            processedImage.naturalHeight
          )

        const outputCanvas =
          document.createElement(
            'canvas'
          )

        outputCanvas.width =
          outputWidth

        outputCanvas.height =
          outputHeight

        const outputContext =
          outputCanvas.getContext(
            '2d'
          )

        if (
          !outputContext
        ) {
          throw new Error(
            'Não foi possível criar a imagem final.'
          )
        }

        outputContext
          .imageSmoothingEnabled =
          true

        outputContext
          .imageSmoothingQuality =
          'high'

        outputContext.drawImage(
          originalImage,
          0,
          0,
          outputWidth,
          outputHeight
        )

        outputContext.save()

        outputContext
          .globalCompositeOperation =
          'destination-in'

        outputContext.drawImage(
          maskCanvas,
          0,
          0,
          outputWidth,
          outputHeight
        )

        outputContext.restore()

        const blob =
          await canvasToBlob(
            outputCanvas
          )

        const file =
          new File(
            [
              blob
            ],
            'imagem-sem-fundo.png',
            {
              type:
                'image/png',

              lastModified:
                Date.now()
            }
          )

        const transfer =
          new DataTransfer()

        transfer.items.add(
          file
        )

        const input =
          document.createElement(
            'input'
          )

        input.type =
          'file'

        Object.defineProperty(
          input,
          'files',
          {
            configurable:
              true,

            value:
              transfer.files
          }
        )

        const syntheticEvent = {
          currentTarget:
            input,

          target:
            input
        } as unknown as
          ChangeEvent<HTMLInputElement>

        await editor.replaceSelectedImage(
          syntheticEvent
        )

        maskCanvas.width =
          1

        maskCanvas.height =
          1

        outputCanvas.width =
          1

        outputCanvas.height =
          1

        onClose()
      } catch (error) {
        console.error(
          error
        )

        setMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível aplicar a remoção de fundo.'
        )
      } finally {
        setApplying(
          false
        )
      }
    }

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className="mq-background-removal-backdrop"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !locked
        ) {
          onClose()
        }
      }}
    >
      <section
        className="mq-background-removal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mq-background-removal-title"
        aria-describedby="mq-background-removal-description"
      >
        <header className="mq-background-removal-dialog__header">
          <span
            className="mq-background-removal-dialog__symbol"
            aria-hidden="true"
          >
            ◒
          </span>

          <span>
            <strong id="mq-background-removal-title">
              Remover fundo
            </strong>

            <small id="mq-background-removal-description">
              Resultado automático com correção manual. Todo o processamento é feito neste dispositivo.
            </small>
          </span>

          <button
            type="button"
            className="mq-background-removal-dialog__close"
            disabled={
              locked
            }
            aria-label="Fechar"
            title="Fechar"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </header>

        <div className="mq-background-removal-dialog__body">
          <aside className="mq-background-removal-controls">
            <section>
              <strong>
                Correção manual
              </strong>

              <small>
                Restaure zonas removidas por engano ou apague restos do fundo.
              </small>

              <div className="mq-background-removal-mode">
                <button
                  type="button"
                  className={
                    mode ===
                    'restore'
                      ? 'is-active'
                      : ''
                  }
                  disabled={
                    locked ||
                    !ready
                  }
                  aria-pressed={
                    mode ===
                    'restore'
                  }
                  onClick={() =>
                    setMode(
                      'restore'
                    )
                  }
                >
                  Restaurar
                </button>

                <button
                  type="button"
                  className={
                    mode ===
                    'erase'
                      ? 'is-active'
                      : ''
                  }
                  disabled={
                    locked ||
                    !ready
                  }
                  aria-pressed={
                    mode ===
                    'erase'
                  }
                  onClick={() =>
                    setMode(
                      'erase'
                    )
                  }
                >
                  Apagar
                </button>
              </div>
            </section>

            <section>
              <label className="mq-background-removal-range">
                <span>
                  <strong>
                    Tamanho do pincel
                  </strong>

                  <b>
                    {brushSize}px
                  </b>
                </span>

                <input
                  type="range"
                  min={18}
                  max={220}
                  step={2}
                  value={
                    brushSize
                  }
                  disabled={
                    locked ||
                    !ready
                  }
                  onChange={(
                    event
                  ) =>
                    setBrushSize(
                      Number(
                        event
                          .currentTarget
                          .value
                      )
                    )
                  }
                />
              </label>

              <label className="mq-background-removal-range">
                <span>
                  <strong>
                    Dureza
                  </strong>

                  <b>
                    {hardness}%
                  </b>
                </span>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={2}
                  value={
                    hardness
                  }
                  disabled={
                    locked ||
                    !ready
                  }
                  onChange={(
                    event
                  ) =>
                    setHardness(
                      Number(
                        event
                          .currentTarget
                          .value
                      )
                    )
                  }
                />
              </label>
            </section>

            <section>
              <strong>
                Remoção automática
              </strong>

              <small>
                Ajuste a sensibilidade se o fundo estiver a desaparecer pouco ou demasiado.
              </small>

              <label className="mq-background-removal-range">
                <span>
                  <strong>
                    Sensibilidade
                  </strong>

                  <b>
                    {tolerance}
                  </b>
                </span>

                <input
                  type="range"
                  min={24}
                  max={100}
                  step={2}
                  value={
                    tolerance
                  }
                  disabled={
                    locked
                  }
                  onChange={(
                    event
                  ) =>
                    setTolerance(
                      Number(
                        event
                          .currentTarget
                          .value
                      )
                    )
                  }
                />
              </label>

              <button
                type="button"
                className="mq-background-removal-action"
                disabled={
                  locked ||
                  !sourceDataUrl
                }
                onClick={() =>
                  void preparePreview(
                    sourceDataUrl,
                    tolerance
                  )
                }
              >
                Recalcular automático
              </button>
            </section>

            <section className="mq-background-removal-secondary-actions">
              <button
                type="button"
                disabled={
                  locked ||
                  !ready
                }
                onClick={
                  resetManualEdits
                }
              >
                Repor correções
              </button>

              <button
                type="button"
                className={
                  showOriginal
                    ? 'is-active'
                    : ''
                }
                disabled={
                  locked ||
                  !ready
                }
                aria-pressed={
                  showOriginal
                }
                onClick={() =>
                  setShowOriginal(
                    (
                      current
                    ) =>
                      !current
                  )
                }
              >
                {showOriginal
                  ? 'Ver resultado'
                  : 'Ver original'}
              </button>
            </section>
          </aside>

          <div className="mq-background-removal-workspace">
            <div className="mq-background-removal-canvas-wrap">
              <canvas
                ref={
                  canvasRef
                }
                className="mq-background-removal-canvas"
                onPointerDown={
                  pointerDown
                }
                onPointerMove={
                  pointerMove
                }
                onPointerUp={
                  pointerUp
                }
                onPointerCancel={
                  pointerUp
                }
                onPointerEnter={(
                  event
                ) =>
                  updateCursor(
                    event
                  )
                }
                onPointerLeave={(
                  event
                ) =>
                  updateCursor(
                    event,
                    false
                  )
                }
              />

              {showOriginal &&
              sourceDataUrl ? (
                <img
                  className="mq-background-removal-original"
                  src={
                    sourceDataUrl
                  }
                  alt="Pré-visualização da imagem original"
                  draggable={
                    false
                  }
                />
              ) : null}

              {cursor.visible &&
              ready &&
              !showOriginal &&
              !locked ? (
                <span
                  className={`mq-background-removal-brush-cursor is-${mode}`}
                  style={{
                    width:
                      `${brushSize}px`,

                    height:
                      `${brushSize}px`,

                    left:
                      `${cursor.x}px`,

                    top:
                      `${cursor.y}px`
                  }}
                  aria-hidden="true"
                />
              ) : null}

              {processing ? (
                <div className="mq-background-removal-loading">
                  <span className="mq-background-removal-spinner" />

                  <strong>
                    A analisar a imagem…
                  </strong>

                  <small>
                    O processamento é local e pode demorar alguns instantes em imagens grandes.
                  </small>
                </div>
              ) : null}
            </div>

            <p
              className="mq-background-removal-message"
              role="status"
            >
              {message}
            </p>

            <p className="mq-background-removal-note">
              Para recuperar partes que tenham sido removidas numa edição anterior já guardada, substitua primeiro a imagem pela versão original e abra novamente esta ferramenta.
            </p>
          </div>
        </div>

        <footer className="mq-background-removal-dialog__footer">
          <span>
            Cancelar não altera o design.
          </span>

          <div>
            <button
              type="button"
              disabled={
                locked
              }
              onClick={
                onClose
              }
            >
              Cancelar
            </button>

            <button
              type="button"
              className="is-primary"
              disabled={
                locked ||
                !ready
              }
              aria-busy={
                applying
              }
              onClick={() =>
                void applyResult()
              }
            >
              {applying
                ? 'A aplicar…'
                : 'Aplicar ao design'}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  )
}

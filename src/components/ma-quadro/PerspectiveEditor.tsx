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
  getMAQuadroAnimationCanvas
} from '../../lib/maQuadro/objectAnimations'

import {
  cloneMAQuadroPerspectiveQuad,
  constrainMAQuadroPerspectivePoint,
  createMAQuadroPerspectiveFile,
  getMAQuadroPerspectivePreviewRect,
  getMAQuadroPerspectiveSource,
  loadMAQuadroPerspectiveSourceImage,
  MA_QUADRO_PERSPECTIVE_IDENTITY,
  MA_QUADRO_PERSPECTIVE_PRESETS,
  MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT,
  MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH,
  perspectivePointToPreview,
  renderMAQuadroPerspectivePreview,
  type MAQuadroPerspectiveQuad,
  type MAQuadroPerspectiveSource
} from '../../lib/maQuadro/perspectiveWarp'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroPerspective.css'

type Props = {
  open: boolean
  onClose: () => void
}

const HANDLE_LABELS = [
  'Superior esquerdo',
  'Superior direito',
  'Inferior direito',
  'Inferior esquerdo'
]

function createFileChangeEvent(
  file: File
) {
  const files = {
    0: file,
    length: 1,
    item: (
      index: number
    ) =>
      index === 0
        ? file
        : null
  } as unknown as
    FileList

  const input = {
    files,
    value: ''
  } as unknown as
    HTMLInputElement

  return {
    currentTarget: input,
    target: input
  } as unknown as
    ChangeEvent<HTMLInputElement>
}

export default function PerspectiveEditor({
  open,
  onClose
}: Props) {
  const editor =
    useMAQuadroEditorContext()

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    )

  const stageRef =
    useRef<HTMLDivElement | null>(
      null
    )

  const [
    source,
    setSource
  ] =
    useState<
      MAQuadroPerspectiveSource | null
    >(
      null
    )

  const [
    sourceImage,
    setSourceImage
  ] =
    useState<
      HTMLImageElement | null
    >(
      null
    )

  const [
    quad,
    setQuad
  ] =
    useState<MAQuadroPerspectiveQuad>(
      cloneMAQuadroPerspectiveQuad(
        MA_QUADRO_PERSPECTIVE_IDENTITY
      )
    )

  const [
    draggingIndex,
    setDraggingIndex
  ] =
    useState<number | null>(
      null
    )

  const [
    loading,
    setLoading
  ] =
    useState(
      false
    )

  const [
    applying,
    setApplying
  ] =
    useState(
      false
    )

  const [
    message,
    setMessage
  ] =
    useState(
      ''
    )

  useEffect(() => {
    if (!open) {
      setDraggingIndex(
        null
      )

      return
    }

    let cancelled =
      false

    const prepare =
      async () => {
        setLoading(
          true
        )

        setMessage(
          ''
        )

        setSource(
          null
        )

        setSourceImage(
          null
        )

        setQuad(
          cloneMAQuadroPerspectiveQuad(
            MA_QUADRO_PERSPECTIVE_IDENTITY
          )
        )

        try {
          const canvas =
            getMAQuadroAnimationCanvas()

          const nextSource =
            canvas
              ? getMAQuadroPerspectiveSource(
                  canvas
                )
              : null

          if (
            !nextSource
          ) {
            throw new Error(
              'Selecione uma imagem incorporada no projeto para aplicar perspetiva.'
            )
          }

          const image =
            await loadMAQuadroPerspectiveSourceImage(
              nextSource
            )

          if (
            cancelled
          ) {
            return
          }

          setSource(
            nextSource
          )

          setSourceImage(
            image
          )
        } catch (
          error
        ) {
          if (
            !cancelled
          ) {
            setMessage(
              error instanceof
                Error
                ? error.message
                : 'Não foi possível preparar a imagem para a perspetiva.'
            )
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            )
          }
        }
      }

    void prepare()

    return () => {
      cancelled =
        true
    }
  }, [
    open,
    editor.selection.name
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow =
      document.body
        .style
        .overflow

    document.body.style.overflow =
      'hidden'

    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
            'Escape' &&
          !applying
        ) {
          onClose()
        }
      }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    applying,
    onClose,
    open
  ])

  useEffect(() => {
    if (
      !sourceImage ||
      !canvasRef.current
    ) {
      return
    }

    const canvas =
      canvasRef.current

    const frame =
      window.requestAnimationFrame(
        () => {
          renderMAQuadroPerspectivePreview(
            canvas,
            sourceImage,
            quad
          )
        }
      )

    return () => {
      window.cancelAnimationFrame(
        frame
      )
    }
  }, [
    quad,
    sourceImage
  ])

  const previewRect =
    useMemo(
      () =>
        sourceImage
          ? getMAQuadroPerspectivePreviewRect(
              sourceImage.naturalWidth,
              sourceImage.naturalHeight
            )
          : null,
      [
        sourceImage
      ]
    )

  useEffect(() => {
    if (
      draggingIndex ===
        null ||
      !previewRect
    ) {
      return
    }

    const move =
      (
        event:
          PointerEvent
      ) => {
        const stage =
          stageRef.current

        if (!stage) {
          return
        }

        const bounds =
          stage.getBoundingClientRect()

        const intrinsicX =
          (
            (
              event.clientX -
              bounds.left
            ) /
            Math.max(
              1,
              bounds.width
            )
          ) *
          MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH

        const intrinsicY =
          (
            (
              event.clientY -
              bounds.top
            ) /
            Math.max(
              1,
              bounds.height
            )
          ) *
          MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT

        const point = {
          x:
            (
              intrinsicX -
              previewRect.x
            ) /
            previewRect.width,
          y:
            (
              intrinsicY -
              previewRect.y
            ) /
            previewRect.height
        }

        setQuad(
          (current) =>
            constrainMAQuadroPerspectivePoint(
              current,
              draggingIndex,
              point
            )
        )
      }

    const finish =
      () => {
        setDraggingIndex(
          null
        )
      }

    window.addEventListener(
      'pointermove',
      move
    )

    window.addEventListener(
      'pointerup',
      finish,
      {
        once: true
      }
    )

    window.addEventListener(
      'pointercancel',
      finish,
      {
        once: true
      }
    )

    return () => {
      window.removeEventListener(
        'pointermove',
        move
      )

      window.removeEventListener(
        'pointerup',
        finish
      )

      window.removeEventListener(
        'pointercancel',
        finish
      )
    }
  }, [
    draggingIndex,
    previewRect
  ])

  if (!open) {
    return null
  }

  const locked =
    loading ||
    applying ||
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing

  const applyPreset =
    (
      presetQuad:
        MAQuadroPerspectiveQuad
    ) => {
      if (locked) {
        return
      }

      setQuad(
        cloneMAQuadroPerspectiveQuad(
          presetQuad
        )
      )

      setMessage(
        ''
      )
    }

  const reset =
    () => {
      if (locked) {
        return
      }

      setQuad(
        cloneMAQuadroPerspectiveQuad(
          MA_QUADRO_PERSPECTIVE_IDENTITY
        )
      )

      setMessage(
        ''
      )
    }

  const beginDrag =
    (
      event:
        ReactPointerEvent<HTMLButtonElement>,
      index: number
    ) => {
      if (locked) {
        return
      }

      event.preventDefault()

      setDraggingIndex(
        index
      )
    }

  const apply =
    async () => {
      if (
        !source ||
        locked
      ) {
        return
      }

      setApplying(
        true
      )

      setMessage(
        'A aplicar a perspetiva localmente…'
      )

      try {
        const file =
          await createMAQuadroPerspectiveFile(
            source,
            quad
          )

        await editor.replaceSelectedImage(
          createFileChangeEvent(
            file
          )
        )

        onClose()
      } catch (
        error
      ) {
        console.error(
          error
        )

        setMessage(
          error instanceof
            Error
            ? error.message
            : 'Não foi possível aplicar a perspetiva.'
        )
      } finally {
        setApplying(
          false
        )
      }
    }

  return createPortal(
    <div
      className="mq-perspective-backdrop"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !applying
        ) {
          onClose()
        }
      }}
    >
      <section
        className="mq-perspective-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mq-perspective-title"
        aria-describedby="mq-perspective-description"
      >
        <header className="mq-perspective-dialog__header">
          <span
            className="mq-perspective-dialog__symbol"
            aria-hidden="true"
          >
            ◇
          </span>

          <span>
            <strong id="mq-perspective-title">
              Perspetiva livre
            </strong>

            <small id="mq-perspective-description">
              Arraste os quatro cantos para adaptar a imagem a superfícies e mockups.
            </small>
          </span>

          <button
            type="button"
            className="mq-perspective-dialog__close"
            disabled={
              applying
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

        <div className="mq-perspective-dialog__body">
          <div className="mq-perspective-workspace">
            <div
              ref={
                stageRef
              }
              className={`mq-perspective-stage${
                draggingIndex !==
                  null
                  ? ' is-dragging'
                  : ''
              }`}
            >
              <canvas
                ref={
                  canvasRef
                }
                className="mq-perspective-canvas"
                aria-label="Pré-visualização da perspetiva"
              />

              {previewRect &&
              sourceImage
                ? quad.map(
                    (
                      point,
                      index
                    ) => {
                      const preview =
                        perspectivePointToPreview(
                          point,
                          previewRect
                        )

                      return (
                        <button
                          key={
                            index
                          }
                          type="button"
                          className={`mq-perspective-handle mq-perspective-handle--${index}`}
                          disabled={
                            locked
                          }
                          aria-label={`Mover canto ${HANDLE_LABELS[index]}`}
                          title={
                            HANDLE_LABELS[index]
                          }
                          style={{
                            left:
                              `${
                                (
                                  preview.x /
                                  MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH
                                ) *
                                100
                              }%`,
                            top:
                              `${
                                (
                                  preview.y /
                                  MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT
                                ) *
                                100
                              }%`
                          }}
                          onPointerDown={(
                            event
                          ) =>
                            beginDrag(
                              event,
                              index
                            )
                          }
                        >
                          <span
                            aria-hidden="true"
                          >
                            {
                              index +
                              1
                            }
                          </span>
                        </button>
                      )
                    }
                  )
                : null}

              {loading ? (
                <div className="mq-perspective-stage__loading">
                  A preparar a imagem…
                </div>
              ) : null}
            </div>

            <p className="mq-perspective-workspace__hint">
              Arraste os pontos 1–4. O contorno permanece convexo para evitar cruzamentos ou uma perspetiva inválida.
            </p>
          </div>

          <aside className="mq-perspective-controls">
            <section>
              <div className="mq-perspective-controls__heading">
                <span>
                  <strong>
                    Perspetivas rápidas
                  </strong>

                  <small>
                    Use como ponto de partida e ajuste os cantos manualmente.
                  </small>
                </span>
              </div>

              <div className="mq-perspective-presets">
                {MA_QUADRO_PERSPECTIVE_PRESETS.map(
                  (
                    preset
                  ) => (
                    <button
                      key={
                        preset.id
                      }
                      type="button"
                      disabled={
                        locked
                      }
                      onClick={() =>
                        applyPreset(
                          preset.quad
                        )
                      }
                    >
                      <span
                        aria-hidden="true"
                      >
                        ◇
                      </span>

                      <span>
                        <strong>
                          {
                            preset.name
                          }
                        </strong>

                        <small>
                          {
                            preset.description
                          }
                        </small>
                      </span>
                    </button>
                  )
                )}
              </div>
            </section>

            <section className="mq-perspective-info">
              <div>
                <span
                  aria-hidden="true"
                >
                  ↗
                </span>

                <p>
                  <strong>
                    Transformação projectiva real
                  </strong>

                  <small>
                    A imagem é remapeada por homografia e malha local, em vez de usar apenas inclinação.
                  </small>
                </p>
              </div>

              <div>
                <span
                  aria-hidden="true"
                >
                  ▧
                </span>

                <p>
                  <strong>
                    Composição preservada
                  </strong>

                  <small>
                    O MA-Quadro reaplica o enquadramento, filtros, moldura, sombra, opacidade, rotação, posição e dimensão através do fluxo atual de substituição de imagem.
                  </small>
                </p>
              </div>
            </section>

            <div className="mq-perspective-local">
              <span
                aria-hidden="true"
              >
                ✓
              </span>

              <p>
                <strong>
                  100% local
                </strong>

                <small>
                  A transformação é calculada neste browser. A fotografia não é enviada para a MA-CODE, Cloudflare ou qualquer outro servidor.
                </small>
              </p>
            </div>

            <button
              type="button"
              className="mq-perspective-reset"
              disabled={
                locked
              }
              onClick={
                reset
              }
            >
              Repor quatro cantos
            </button>

            {message ? (
              <p
                className="mq-perspective-message"
                role="status"
              >
                {
                  message
                }
              </p>
            ) : null}
          </aside>
        </div>

        <footer className="mq-perspective-dialog__footer">
          <span>
            A aplicação rasteriza esta transformação na fonte da imagem. Pode usar Desfazer para regressar ao estado anterior.
          </span>

          <div>
            <button
              type="button"
              disabled={
                applying
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
                !source
              }
              aria-busy={
                applying
              }
              onClick={() =>
                void apply()
              }
            >
              {applying
                ? 'A aplicar…'
                : 'Aplicar perspetiva'}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  )
}

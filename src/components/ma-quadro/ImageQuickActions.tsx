import {
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import BackgroundRemovalEditor from './BackgroundRemovalEditor'
import PerspectiveEditor from './PerspectiveEditor'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroImageQuickActions.css'

type ImageFrameKind =
  | 'none'
  | 'rounded'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'star'

function revealImageFilters() {
  const target =
    document.querySelector<HTMLElement>(
      '.mq-image-presets-host'
    )

  if (!target) {
    return
  }

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest'
  })

  target.classList.add(
    'mq-image-quick-actions__target'
  )

  window.setTimeout(
    () => {
      target.classList.remove(
        'mq-image-quick-actions__target'
      )
    },
    900
  )
}

export default function ImageQuickActions() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] =
    useState<HTMLElement | null>(
      null
    )

  const [
    backgroundOpen,
    setBackgroundOpen
  ] =
    useState(false)

  const [
    backgroundPreparing,
    setBackgroundPreparing
  ] =
    useState(false)

  const [
    perspectiveOpen,
    setPerspectiveOpen
  ] =
    useState(false)

  const isImage =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'image'

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      !isImage
    ) {
      setHost(
        null
      )

      setBackgroundOpen(
        false
      )

      setPerspectiveOpen(
        false
      )

      return
    }

    const toolbar =
      document.querySelector<HTMLElement>(
        '.mq-context-toolbar'
      )

    if (!toolbar) {
      setHost(
        null
      )

      return
    }

    const globalGroup =
      toolbar.lastElementChild as
        HTMLElement | null

    const originalImageGroup =
      globalGroup
        ?.previousElementSibling as
          HTMLElement | null

    if (
      !globalGroup ||
      !originalImageGroup ||
      !originalImageGroup.classList.contains(
        'mq-context-toolbar__group'
      )
    ) {
      setHost(
        null
      )

      return
    }

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-image-quick-actions-host'

    toolbar.insertBefore(
      mount,
      originalImageGroup
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.ready,
    isImage
  ])

  if (
    !host ||
    !isImage
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    backgroundPreparing

  const cropZoom =
    editor.selection.cropZoom

  const frame =
    editor.selection
      .imageFrame as ImageFrameKind

  const openBackgroundRemoval =
    async () => {
      if (
        locked ||
        editor.imageCropEditing
      ) {
        return
      }

      setBackgroundPreparing(
        true
      )

      try {
        const saved =
          await editor.saveProject(
            true
          )

        if (saved) {
          setBackgroundOpen(
            true
          )
        }
      } finally {
        setBackgroundPreparing(
          false
        )
      }
    }

  if (
    editor.imageCropEditing
  ) {
    return createPortal(
      <div
        className="mq-image-quick-actions mq-image-quick-actions--crop"
        aria-label="Recorte rápido da imagem"
      >
        <button
          type="button"
          className="mq-image-quick-actions__primary"
          disabled={
            locked
          }
          onClick={
            editor.finishImageCrop
          }
        >
          ✓ Concluir
        </button>

        <button
          type="button"
          disabled={
            locked
          }
          onClick={
            editor.cancelImageCrop
          }
        >
          Cancelar
        </button>

        <span
          className="mq-image-quick-actions__separator"
          aria-hidden="true"
        />

        <span className="mq-image-quick-actions__label">
          Zoom
        </span>

        <button
          type="button"
          className="mq-image-quick-actions__square"
          disabled={
            locked ||
            cropZoom <= 100
          }
          title="Reduzir zoom"
          aria-label="Reduzir zoom"
          onClick={() =>
            editor.setImageCropZoom(
              cropZoom - 10
            )
          }
        >
          −
        </button>

        <input
          className="mq-image-quick-actions__range"
          type="range"
          min={100}
          max={400}
          step={5}
          value={
            cropZoom
          }
          disabled={
            locked
          }
          aria-label="Zoom da imagem"
          onChange={(
            event
          ) =>
            editor.setImageCropZoom(
              Number(
                event.currentTarget.value
              )
            )
          }
        />

        <span className="mq-image-quick-actions__value">
          {Math.round(
            cropZoom
          )}%
        </span>

        <button
          type="button"
          className="mq-image-quick-actions__square"
          disabled={
            locked ||
            cropZoom >= 400
          }
          title="Aumentar zoom"
          aria-label="Aumentar zoom"
          onClick={() =>
            editor.setImageCropZoom(
              cropZoom + 10
            )
          }
        >
          +
        </button>

        <button
          type="button"
          disabled={
            locked
          }
          onClick={() =>
            editor.setImageCropPosition(
              50,
              50
            )
          }
        >
          Centrar
        </button>

        <button
          type="button"
          disabled={
            locked
          }
          onClick={
            editor.resetImageCrop
          }
        >
          Repor
        </button>
      </div>,
      host
    )
  }

  return (
    <>
      {createPortal(
        <div
          className="mq-image-quick-actions"
          aria-label="Ações rápidas da imagem"
        >
          <button
            type="button"
            className="mq-image-quick-actions__primary"
            disabled={
              locked
            }
            onClick={
              editor.beginImageCrop
            }
          >
            Recortar
          </button>

          <button
            type="button"
            disabled={
              locked
            }
            onClick={() =>
              editor.replacementImageInputRef.current?.click()
            }
          >
            Substituir
          </button>

          <button
            type="button"
            disabled={
              locked
            }
            title="Transformar a imagem arrastando os quatro cantos"
            onClick={() =>
              setPerspectiveOpen(
                true
              )
            }
          >
            Perspetiva
          </button>

          <label
            className="mq-image-quick-actions__frame"
            title="Moldura da imagem"
          >
            <span>
              Moldura
            </span>

            <select
              value={
                frame
              }
              disabled={
                locked
              }
              aria-label="Moldura da imagem"
              onChange={(
                event
              ) =>
                editor.setImageFrame(
                  event.currentTarget
                    .value as ImageFrameKind
                )
              }
            >
              <option value="none">
                Sem moldura
              </option>

              <option value="rounded">
                Arredondada
              </option>

              <option value="circle">
                Círculo
              </option>

              <option value="ellipse">
                Elipse
              </option>

              <option value="triangle">
                Triângulo
              </option>

              <option value="star">
                Estrela
              </option>
            </select>
          </label>

          <button
            type="button"
            disabled={
              locked
            }
            onClick={
              revealImageFilters
            }
          >
            Filtros
          </button>

          <button
            type="button"
            disabled={
              locked
            }
            aria-busy={
              backgroundPreparing
            }
            onClick={() =>
              void openBackgroundRemoval()
            }
          >
            {backgroundPreparing
              ? 'A preparar…'
              : 'Remover fundo'}
          </button>

          <button
            type="button"
            disabled={
              locked
            }
            onClick={
              editor.setImageAsBackground
            }
          >
            Usar como fundo
          </button>
        </div>,
        host
      )}

      <BackgroundRemovalEditor
        open={
          backgroundOpen
        }
        onClose={() =>
          setBackgroundOpen(
            false
          )
        }
      />

      <PerspectiveEditor
        open={
          perspectiveOpen
        }
        onClose={() =>
          setPerspectiveOpen(
            false
          )
        }
      />
    </>
  )
}

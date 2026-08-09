import {
  useLayoutEffect,
  useState
} from 'react'

import {
  createPortal
} from 'react-dom'

import {
  createMAQuadroFramePlaceholderFile,
  MA_QUADRO_FRAME_PRESETS,
  type MAQuadroFrameKind
} from '../../lib/maQuadro/framePlaceholders'

import {
  useMAQuadroEditorContext
} from './editorContext'

export default function FrameBuilder() {
  const editor =
    useMAQuadroEditorContext()

  const [
    host,
    setHost
  ] = useState<
    HTMLElement |
    null
  >(
    null
  )

  const [
    addingKind,
    setAddingKind
  ] = useState<
    MAQuadroFrameKind |
    null
  >(
    null
  )

  const [
    message,
    setMessage
  ] = useState(
    ''
  )

  useLayoutEffect(() => {
    if (
      !editor.ready ||
      editor.activePanel !==
        'elements'
    ) {
      setHost(
        null
      )

      return
    }

    const elementGrid =
      document.querySelector<
        HTMLElement
      >(
        '.mq-left-panel .mq-element-grid'
      )

    if (
      !elementGrid
    ) {
      setHost(
        null
      )

      return
    }

    const anchor =
      document.querySelector<
        HTMLElement
      >(
        '.mq-curved-text-builder-host'
      ) ||
      document.querySelector<
        HTMLElement
      >(
        '.mq-qr-builder-host'
      ) ||
      document.querySelector<
        HTMLElement
      >(
        '.mq-chart-builder-host'
      ) ||
      document.querySelector<
        HTMLElement
      >(
        '.mq-table-builder-host'
      ) ||
      elementGrid

    const mount =
      document.createElement(
        'div'
      )

    mount.className =
      'mq-frame-builder-host'

    anchor.insertAdjacentElement(
      'afterend',
      mount
    )

    setHost(
      mount
    )

    return () => {
      mount.remove()
    }
  }, [
    editor.activePanel,
    editor.ready
  ])

  if (
    !host
  ) {
    return null
  }

  const locked =
    editor.busy ||
    editor.structureBusy ||
    editor.imageCropEditing ||
    addingKind !==
      null

  const addFrame =
    async (
      kind:
        MAQuadroFrameKind
    ) => {
      if (
        locked
      ) {
        return
      }

      setAddingKind(
        kind
      )

      setMessage(
        ''
      )

      try {
        await editor
          .handleDroppedFiles([
            createMAQuadroFramePlaceholderFile(
              kind
            )
          ])

        editor.setImageFrame(
          kind
        )

        editor.setSelectionAspectLocked(
          true
        )

        setMessage(
          'Moldura inserida. Selecione-a e arraste uma imagem do computador para dentro dela.'
        )
      } catch {
        setMessage(
          'Não foi possível inserir a moldura.'
        )
      } finally {
        setAddingKind(
          null
        )
      }
    }

  return createPortal(
    <section
      className="mq-frame-builder"
      aria-label="Molduras"
    >
      <div className="mq-section-title mq-frame-builder__title">
        <div>
          <h3>
            Molduras
          </h3>

          <small>
            Arraste uma imagem para preencher.
          </small>
        </div>

        <span>
          {
            MA_QUADRO_FRAME_PRESETS
              .length
          }
        </span>
      </div>

      <div className="mq-frame-builder__grid">
        {MA_QUADRO_FRAME_PRESETS.map(
          (
            preset
          ) => (
            <button
              key={
                preset.kind
              }
              type="button"
              disabled={
                locked
              }
              onClick={() =>
                void addFrame(
                  preset.kind
                )
              }
              title={`Inserir moldura ${preset.label}`}
              aria-label={`Inserir moldura ${preset.label}`}
            >
              <span className="mq-frame-builder__preview">
                <span
                  className={`mq-frame-builder__shape mq-frame-builder__shape--${preset.kind}`}
                />
              </span>

              <span className="mq-frame-builder__copy">
                <strong>
                  {
                    preset.label
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

      <p className="mq-frame-builder__note">
        Depois de preencher, pode usar o recorte para reposicionar a imagem dentro da moldura.
      </p>

      {message ? (
        <p
          className="mq-frame-builder__message"
          role="status"
        >
          {
            message
          }
        </p>
      ) : null}
    </section>,
    host
  )
}

import {
  useState,
  type DragEvent,
  type MouseEvent
} from 'react'

import type {
  MAQuadroContextMenuPosition
} from './CanvasContextMenu'

import {
  useMAQuadroEditorContext
} from './editorContext'

function ToolbarButton({
  label,
  title,
  onClick,
  disabled = false,
  active = false
}: {
  label: string
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`mq-toolbar-button${
        active
          ? ' is-active'
          : ''
      }`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {label}
    </button>
  )
}

export default function CanvasStage({
  onOpenContextMenu
}: {
  onOpenContextMenu: (
    position:
      MAQuadroContextMenuPosition
  ) => void
}) {
  const editor =
    useMAQuadroEditorContext()

  const [
    dragActive,
    setDragActive
  ] = useState(false)

  const page =
    editor.activePage

  const canvasWidth =
    page?.width ||
    1080

  const canvasHeight =
    page?.height ||
    1080

  const hasSelection =
    editor.selection.count >
    0

  const multiple =
    editor.selection.count >
    1

  const isGroup =
    editor.selection.role ===
    'group'

  const isImage =
    editor.selection.count ===
      1 &&
    editor.selection.role ===
      'image'

  const locked =
    editor.busy ||
    editor.structureBusy

  const handleDragOver = (
    event:
      DragEvent<HTMLDivElement>
  ) => {
    if (
      locked ||
      editor.imageCropEditing
    ) {
      return
    }

    if (
      event.dataTransfer.types
        .includes(
          'Files'
        )
    ) {
      event.preventDefault()

      event.dataTransfer
        .dropEffect =
        'copy'

      setDragActive(
        true
      )
    }
  }

  const handleDrop = (
    event:
      DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    setDragActive(
      false
    )

    if (
      locked ||
      editor.imageCropEditing
    ) {
      return
    }

    if (
      event.dataTransfer.files
        .length
    ) {
      void editor.handleDroppedFiles(
        Array.from(
          event.dataTransfer.files
        )
      )
    }
  }

  const handleContextMenu = (
    event:
      MouseEvent<HTMLDivElement>
  ) => {
    if (
      !hasSelection ||
      locked ||
      editor.imageCropEditing
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    onOpenContextMenu({
      x:
        event.clientX,
      y:
        event.clientY
    })
  }

  const verticalGuidePosition =
    editor.guides.vertical ===
    null
      ? null
      : `${(
          editor.guides.vertical /
          Math.max(
            1,
            canvasWidth
          )
        ) * 100}%`

  const horizontalGuidePosition =
    editor.guides.horizontal ===
    null
      ? null
      : `${(
          editor.guides.horizontal /
          Math.max(
            1,
            canvasHeight
          )
        ) * 100}%`

  return (
    <section className="mq-stage-section">
      <div
        className="mq-context-toolbar"
        aria-label="Ferramentas do quadro"
      >
        <div className="mq-context-toolbar__group">
          <ToolbarButton
            label="↶"
            title="Desfazer (Ctrl/Cmd + Z)"
            onClick={() =>
              void editor.undo()
            }
            disabled={
              !editor.canUndo ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="↷"
            title="Refazer (Ctrl/Cmd + Y)"
            onClick={() =>
              void editor.redo()
            }
            disabled={
              !editor.canRedo ||
              locked ||
              editor.imageCropEditing
            }
          />

          <span className="mq-toolbar-separator" />

          <ToolbarButton
            label="⧉"
            title="Duplicar seleção"
            onClick={() =>
              void editor.duplicateSelection()
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="⌫"
            title="Eliminar seleção"
            onClick={
              editor.deleteSelection
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="Agrupar"
            title="Agrupar elementos selecionados"
            onClick={
              editor.groupSelection
            }
            disabled={
              !multiple ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="Desagrupar"
            title="Desagrupar grupo"
            onClick={
              editor.ungroupSelection
            }
            disabled={
              !isGroup ||
              locked ||
              editor.imageCropEditing
            }
          />
        </div>

        <div className="mq-context-toolbar__group mq-context-toolbar__group--center">
          <ToolbarButton
            label="←"
            title="Alinhar à esquerda"
            onClick={() =>
              editor.alignSelection(
                'left'
              )
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="↔"
            title="Centrar horizontalmente"
            onClick={() =>
              editor.alignSelection(
                'center-x'
              )
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="→"
            title="Alinhar à direita"
            onClick={() =>
              editor.alignSelection(
                'right'
              )
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="↑"
            title="Alinhar acima"
            onClick={() =>
              editor.alignSelection(
                'top'
              )
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="↕"
            title="Centrar verticalmente"
            onClick={() =>
              editor.alignSelection(
                'center-y'
              )
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />

          <ToolbarButton
            label="↓"
            title="Alinhar abaixo"
            onClick={() =>
              editor.alignSelection(
                'bottom'
              )
            }
            disabled={
              !hasSelection ||
              locked ||
              editor.imageCropEditing
            }
          />
        </div>

        {isImage ? (
          <div className="mq-context-toolbar__group">
            <ToolbarButton
              label={
                editor.imageCropEditing
                  ? 'Concluir recorte'
                  : 'Recortar'
              }
              title={
                editor.imageCropEditing
                  ? 'Concluir edição do recorte'
                  : 'Editar o enquadramento da imagem'
              }
              active={
                editor.imageCropEditing
              }
              disabled={locked}
              onClick={() => {
                if (
                  editor.imageCropEditing
                ) {
                  editor.finishImageCrop()
                } else {
                  editor.beginImageCrop()
                }
              }}
            />

            {editor.imageCropEditing ? (
              <ToolbarButton
                label="Cancelar"
                title="Cancelar alterações do recorte"
                onClick={
                  editor.cancelImageCrop
                }
                disabled={locked}
              />
            ) : (
              <label
                className="mq-field"
                title="Aplicar uma moldura à imagem"
              >
                <span className="sr-only">
                  Moldura
                </span>

                <select
                  value={
                    editor.selection
                      .imageFrame
                  }
                  disabled={locked}
                  onChange={(event) =>
                    editor.setImageFrame(
                      event.target.value as
                        | 'none'
                        | 'rounded'
                        | 'circle'
                        | 'ellipse'
                        | 'triangle'
                        | 'star'
                    )
                  }
                  aria-label="Moldura da imagem"
                >
                  <option value="none">
                    Sem moldura
                  </option>

                  <option value="rounded">
                    Cantos arredondados
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
            )}
          </div>
        ) : null}

        <div className="mq-context-toolbar__group">
          <ToolbarButton
            label="Grelha"
            title="Mostrar ou ocultar grelha"
            onClick={
              editor.toggleGrid
            }
            active={
              editor.showGrid
            }
          />

          <ToolbarButton
            label="Margens"
            title="Mostrar ou ocultar área segura"
            onClick={
              editor.toggleSafeArea
            }
            active={
              editor.showSafeArea
            }
          />

          <ToolbarButton
            label="Ajustar"
            title="Ajustar quadro ao ecrã"
            onClick={
              editor.fitCanvas
            }
          />
        </div>
      </div>

      {isImage &&
      editor.imageCropEditing ? (
        <div
          className="mq-context-toolbar"
          aria-label="Controlos do recorte"
        >
          <div className="mq-context-toolbar__group">
            <label className="mq-field">
              <span>
                Zoom{' '}
                {editor.selection.cropZoom}%
              </span>

              <input
                type="range"
                min="100"
                max="400"
                value={
                  editor.selection.cropZoom
                }
                disabled={locked}
                onChange={(event) =>
                  editor.setImageCropZoom(
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </label>

            <label className="mq-field">
              <span>
                Horizontal
              </span>

              <input
                type="range"
                min="0"
                max="100"
                value={
                  editor.selection
                    .cropPositionX
                }
                disabled={locked}
                onChange={(event) =>
                  editor.setImageCropPosition(
                    Number(
                      event.target.value
                    ),
                    editor.selection
                      .cropPositionY
                  )
                }
              />
            </label>

            <label className="mq-field">
              <span>
                Vertical
              </span>

              <input
                type="range"
                min="0"
                max="100"
                value={
                  editor.selection
                    .cropPositionY
                }
                disabled={locked}
                onChange={(event) =>
                  editor.setImageCropPosition(
                    editor.selection
                      .cropPositionX,
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </label>

            <span className="mq-control-note">
              Também pode arrastar a
              imagem no quadro para
              reposicionar o recorte.
            </span>
          </div>
        </div>
      ) : null}

      <div
        ref={
          editor.workspaceRef
        }
        className={`mq-workspace${
          editor.isSpacePressed
            ? ' is-panning'
            : ''
        }${
          dragActive
            ? ' is-dragging'
            : ''
        }${
          editor.imageCropEditing
            ? ' is-cropping'
            : ''
        }`}
        onWheel={
          editor.onWorkspaceWheel
        }
        onPointerDown={
          editor.onWorkspacePointerDown
        }
        onContextMenu={
          handleContextMenu
        }
        onDragEnter={
          handleDragOver
        }
        onDragOver={
          handleDragOver
        }
        onDragLeave={(event) => {
          if (
            event.currentTarget ===
            event.target
          ) {
            setDragActive(
              false
            )
          }
        }}
        onDrop={
          handleDrop
        }
      >
        <div
          className={`mq-canvas-shell${
            page
              ? ''
              : ' is-initialising'
          }`}
          style={{
            width:
              canvasWidth *
              editor.zoom /
              100,

            height:
              canvasHeight *
              editor.zoom /
              100
          }}
          aria-busy={!page}
        >
          <canvas
            ref={
              editor.canvasElementRef
            }
          />

          {editor.showGrid ? (
            <div className="mq-canvas-grid" />
          ) : null}

          {editor.showSafeArea ? (
            <div className="mq-safe-area" />
          ) : null}

          {verticalGuidePosition !==
          null ? (
            <div
              className={`mq-guide mq-guide--vertical${
                editor.guides.source ===
                'object'
                  ? ' is-object-guide'
                  : ''
              }`}
              style={{
                left:
                  verticalGuidePosition
              }}
            />
          ) : null}

          {horizontalGuidePosition !==
          null ? (
            <div
              className={`mq-guide mq-guide--horizontal${
                editor.guides.source ===
                'object'
                  ? ' is-object-guide'
                  : ''
              }`}
              style={{
                top:
                  horizontalGuidePosition
              }}
            />
          ) : null}

          {!page ? (
            <div
              className="mq-stage-empty mq-stage-empty--overlay"
              role="status"
            >
              A preparar o editor…
            </div>
          ) : null}
        </div>

        {dragActive ? (
          <div className="mq-drop-overlay">
            <strong>
              Largue as imagens aqui
            </strong>

            <span>
              Serão adicionadas à
              página atual.
            </span>
          </div>
        ) : null}
      </div>

      <footer
        className="mq-stage-status"
        aria-live="polite"
      >
        <span>
          {editor.busy ? (
            <strong>
              A processar…{' '}
            </strong>
          ) : null}

          {editor.imageCropEditing ? (
            <strong>
              Recorte ativo — arraste
              a imagem ou use os
              controlos acima.{' '}
            </strong>
          ) : null}

          {editor.statusMessage}
        </span>

        <div className="mq-zoom-control">
          <button
            type="button"
            onClick={() =>
              editor.setZoom(
                editor.zoom - 10
              )
            }
            aria-label="Diminuir zoom"
          >
            −
          </button>

          <input
            type="range"
            min="5"
            max="220"
            value={
              editor.zoom
            }
            onChange={(event) =>
              editor.setZoom(
                Number(
                  event.target.value
                )
              )
            }
            aria-label="Zoom do quadro"
          />

          <button
            type="button"
            onClick={() =>
              editor.setZoom(
                editor.zoom + 10
              )
            }
            aria-label="Aumentar zoom"
          >
            +
          </button>

          <output>
            {editor.zoom}%
          </output>
        </div>
      </footer>
    </section>
  )
}

import {
  useState,
  type DragEvent
} from 'react'

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

export default function CanvasStage() {
  const editor =
    useMAQuadroEditorContext()

  const [
    dragActive,
    setDragActive
  ] = useState(false)

  const page =
    editor.activePage

  const canvasWidth =
    page?.width || 1080

  const canvasHeight =
    page?.height || 1080

  const hasSelection =
    editor.selection.count > 0

  const multiple =
    editor.selection.count > 1

  const isGroup =
    editor.selection.role ===
    'group'

  const handleDragOver = (
    event:
      DragEvent<HTMLDivElement>
  ) => {
    if (
      event.dataTransfer.types
        .includes('Files')
    ) {
      event.preventDefault()

      event.dataTransfer.dropEffect =
        'copy'

      setDragActive(true)
    }
  }

  const handleDrop = (
    event:
      DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    setDragActive(false)

    if (
      event.dataTransfer.files
        .length
    ) {
      void editor.handleDroppedFiles(
        event.dataTransfer.files
      )
    }
  }

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
            disabled={!editor.canUndo}
          />

          <ToolbarButton
            label="↷"
            title="Refazer (Ctrl/Cmd + Y)"
            onClick={() =>
              void editor.redo()
            }
            disabled={!editor.canRedo}
          />

          <span className="mq-toolbar-separator" />

          <ToolbarButton
            label="⧉"
            title="Duplicar seleção"
            onClick={() =>
              void editor.duplicateSelection()
            }
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="⌫"
            title="Eliminar seleção"
            onClick={
              editor.deleteSelection
            }
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="Agrupar"
            title="Agrupar elementos selecionados"
            onClick={
              editor.groupSelection
            }
            disabled={!multiple}
          />

          <ToolbarButton
            label="Desagrupar"
            title="Desagrupar grupo"
            onClick={
              editor.ungroupSelection
            }
            disabled={!isGroup}
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
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="↔"
            title="Centrar horizontalmente"
            onClick={() =>
              editor.alignSelection(
                'center-x'
              )
            }
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="→"
            title="Alinhar à direita"
            onClick={() =>
              editor.alignSelection(
                'right'
              )
            }
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="↑"
            title="Alinhar acima"
            onClick={() =>
              editor.alignSelection(
                'top'
              )
            }
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="↕"
            title="Centrar verticalmente"
            onClick={() =>
              editor.alignSelection(
                'center-y'
              )
            }
            disabled={!hasSelection}
          />

          <ToolbarButton
            label="↓"
            title="Alinhar abaixo"
            onClick={() =>
              editor.alignSelection(
                'bottom'
              )
            }
            disabled={!hasSelection}
          />
        </div>

        <div className="mq-context-toolbar__group">
          <ToolbarButton
            label="Grelha"
            title="Mostrar ou ocultar grelha"
            onClick={
              editor.toggleGrid
            }
            active={editor.showGrid}
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
            onClick={editor.fitCanvas}
          />
        </div>
      </div>

      <div
        ref={editor.workspaceRef}
        className={`mq-workspace${
          editor.isSpacePressed
            ? ' is-panning'
            : ''
        }${
          dragActive
            ? ' is-dragging'
            : ''
        }`}
        onWheel={
          editor.onWorkspaceWheel
        }
        onPointerDown={
          editor.onWorkspacePointerDown
        }
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={(event) => {
          if (
            event.currentTarget ===
            event.target
          ) {
            setDragActive(false)
          }
        }}
        onDrop={handleDrop}
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

          {editor.guides.vertical ? (
            <div className="mq-guide mq-guide--vertical" />
          ) : null}

          {editor.guides.horizontal ? (
            <div className="mq-guide mq-guide--horizontal" />
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
              Serão adicionadas à página
              atual.
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
            value={editor.zoom}
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

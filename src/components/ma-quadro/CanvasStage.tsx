import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

import {
  clearMAQuadroManualGuides,
  setMAQuadroManualGuides,
  type MAQuadroManualGuides
} from '../../lib/maQuadro/editorEnhancements'

import type {
  MAQuadroContextMenuPosition
} from './CanvasContextMenu'

import {
  useMAQuadroEditorContext
} from './editorContext'

import './maQuadroRulers.css'

type RulerMark = {
  value: number
  position: number
  major: boolean
}

type ManualGuideAxis =
  | 'vertical'
  | 'horizontal'

type ManualGuideDragState = {
  axis: ManualGuideAxis
  index: number
  created: boolean
  originalValue: number
  outside: boolean
}

const RULER_MAJOR_STEPS = [
  5,
  10,
  20,
  25,
  50,
  100,
  200,
  250,
  500,
  1000,
  2000,
  2500,
  5000,
  10000,
  20000,
  50000
]

const RULER_MIN_MAJOR_SPACING = 64
const RULER_MAX_MARKS = 500
const GUIDE_REMOVE_MARGIN = 24

const EMPTY_MANUAL_GUIDES:
  MAQuadroManualGuides = {
    vertical: [],
    horizontal: []
  }

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(value)
        ? value
        : minimum
    )
  )
}

function getRulerMajorStep(
  length: number,
  zoom: number
) {
  const scale = Math.max(
    0.05,
    zoom / 100
  )

  const requestedStep =
    RULER_MIN_MAJOR_SPACING /
    scale

  let majorStep =
    RULER_MAJOR_STEPS.find(
      (step) =>
        step >= requestedStep
    ) ||
    RULER_MAJOR_STEPS[
      RULER_MAJOR_STEPS.length - 1
    ]

  while (
    length /
      Math.max(
        1,
        majorStep / 5
      ) >
    RULER_MAX_MARKS
  ) {
    majorStep *= 2
  }

  return majorStep
}

function buildRulerMarks(
  length: number,
  zoom: number
): RulerMark[] {
  const safeLength = Math.max(
    1,
    length
  )

  const scale = Math.max(
    0.05,
    zoom / 100
  )

  const majorStep =
    getRulerMajorStep(
      safeLength,
      zoom
    )

  const minorStep =
    majorStep / 5

  const count = Math.min(
    RULER_MAX_MARKS,
    Math.floor(
      safeLength /
        minorStep
    )
  )

  return Array.from(
    {
      length:
        count + 1
    },
    (_, index) => {
      const value =
        index *
        minorStep

      return {
        value,
        position:
          value *
          scale,
        major:
          index % 5 === 0
      }
    }
  )
}

function formatRulerValue(
  value: number
) {
  if (
    value >= 10000 &&
    value % 1000 === 0
  ) {
    return `${
      value / 1000
    }k`
  }

  return String(
    Math.round(
      value
    )
  )
}

function CanvasRulers({
  width,
  height,
  zoom,
  disabled,
  onCreateHorizontalGuide,
  onCreateVerticalGuide
}: {
  width: number
  height: number
  zoom: number
  disabled: boolean
  onCreateHorizontalGuide: (
    event:
      ReactPointerEvent<HTMLDivElement>
  ) => void
  onCreateVerticalGuide: (
    event:
      ReactPointerEvent<HTMLDivElement>
  ) => void
}) {
  const horizontalMarks =
    useMemo(
      () =>
        buildRulerMarks(
          width,
          zoom
        ),
      [
        width,
        zoom
      ]
    )

  const verticalMarks =
    useMemo(
      () =>
        buildRulerMarks(
          height,
          zoom
        ),
      [
        height,
        zoom
      ]
    )

  return (
    <>
      <div
        className="mq-ruler-corner"
        aria-hidden="true"
        title="Unidades em píxeis"
      >
        px
      </div>

      <div
        className={`mq-ruler mq-ruler--horizontal${
          disabled
            ? ' is-disabled'
            : ''
        }`}
        title={
          disabled
            ? undefined
            : 'Arraste desta régua para criar uma guia horizontal'
        }
        onPointerDown={
          disabled
            ? undefined
            : onCreateHorizontalGuide
        }
      >
        {horizontalMarks.map(
          (mark) => (
            <span
              key={`x-${mark.value}`}
              className={`mq-ruler-mark${
                mark.major
                  ? ' is-major'
                  : ''
              }`}
              style={{
                left:
                  mark.position
              }}
              aria-hidden="true"
            >
              {mark.major ? (
                <span className="mq-ruler-label">
                  {formatRulerValue(
                    mark.value
                  )}
                </span>
              ) : null}
            </span>
          )
        )}
      </div>

      <div
        className={`mq-ruler mq-ruler--vertical${
          disabled
            ? ' is-disabled'
            : ''
        }`}
        title={
          disabled
            ? undefined
            : 'Arraste desta régua para criar uma guia vertical'
        }
        onPointerDown={
          disabled
            ? undefined
            : onCreateVerticalGuide
        }
      >
        {verticalMarks.map(
          (mark) => (
            <span
              key={`y-${mark.value}`}
              className={`mq-ruler-mark${
                mark.major
                  ? ' is-major'
                  : ''
              }`}
              style={{
                top:
                  mark.position
              }}
              aria-hidden="true"
            >
              {mark.major ? (
                <span className="mq-ruler-label">
                  {formatRulerValue(
                    mark.value
                  )}
                </span>
              ) : null}
            </span>
          )
        )}
      </div>
    </>
  )
}

function ManualGuideButton({
  axis,
  index,
  value,
  maximum,
  dragging,
  removing,
  disabled,
  onPointerDown,
  onRemove
}: {
  axis: ManualGuideAxis
  index: number
  value: number
  maximum: number
  dragging: boolean
  removing: boolean
  disabled: boolean
  onPointerDown: (
    axis: ManualGuideAxis,
    index: number,
    event:
      ReactPointerEvent<HTMLButtonElement>
  ) => void
  onRemove: (
    axis: ManualGuideAxis,
    index: number
  ) => void
}) {
  const position = `${(
    value /
    Math.max(
      1,
      maximum
    )
  ) * 100}%`

  const roundedValue =
    Math.round(value)

  const handleKeyDown = (
    event:
      KeyboardEvent<HTMLButtonElement>
  ) => {
    if (
      event.key === 'Delete' ||
      event.key === 'Backspace'
    ) {
      event.preventDefault()
      event.stopPropagation()

      onRemove(
        axis,
        index
      )
    }
  }

  return (
    <button
      type="button"
      className={`mq-manual-guide mq-manual-guide--${axis}${
        dragging
          ? ' is-dragging'
          : ''
      }${
        removing
          ? ' is-removing'
          : ''
      }`}
      style={
        axis === 'vertical'
          ? {
              left:
                position
            }
          : {
              top:
                position
            }
      }
      disabled={disabled}
      title={`${
        axis === 'vertical'
          ? 'Guia vertical'
          : 'Guia horizontal'
      }: ${roundedValue} px. Arraste para mover, arraste para fora para eliminar ou prima Delete.`}
      aria-label={`${
        axis === 'vertical'
          ? 'Guia vertical'
          : 'Guia horizontal'
      } a ${roundedValue} píxeis`}
      onPointerDown={(
        event
      ) =>
        onPointerDown(
          axis,
          index,
          event
        )
      }
      onDoubleClick={(
        event
      ) => {
        event.preventDefault()
        event.stopPropagation()

        onRemove(
          axis,
          index
        )
      }}
      onKeyDown={
        handleKeyDown
      }
    >
      {dragging ? (
        <span className="mq-manual-guide__label">
          {roundedValue} px
        </span>
      ) : null}
    </button>
  )
}

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
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      title={
        title
      }
      aria-label={
        title
      }
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

  const rulerFrameRef =
    useRef<HTMLDivElement | null>(
      null
    )

  const [
    dragActive,
    setDragActive
  ] = useState(
    false
  )

  const [
    manualGuidesByPage,
    setManualGuidesByPage
  ] = useState<
    Record<
      string,
      MAQuadroManualGuides
    >
  >({})

  const [
    manualGuideDrag,
    setManualGuideDrag
  ] = useState<
    ManualGuideDragState | null
  >(null)

  const page =
    editor.activePage

  const canvasWidth =
    page?.width ||
    1080

  const canvasHeight =
    page?.height ||
    1080

  const displayWidth =
    canvasWidth *
    editor.zoom /
    100

  const displayHeight =
    canvasHeight *
    editor.zoom /
    100

  const manualGuides =
    page
      ? manualGuidesByPage[
          page.id
        ] ||
        EMPTY_MANUAL_GUIDES
      : EMPTY_MANUAL_GUIDES

  const manualGuideCount =
    manualGuides.vertical.length +
    manualGuides.horizontal.length

  const hasSelection =
    editor.selection
      .count >
    0

  const multiple =
    editor.selection
      .count >
    1

  const isGroup =
    editor.selection
      .role ===
    'group'

  const isImage =
    editor.selection
      .count ===
      1 &&
    editor.selection
      .role ===
      'image'

  const locked =
    editor.busy ||
    editor.structureBusy

  const guidesLocked =
    locked ||
    editor.imageCropEditing ||
    !page

  const setGuidesForCurrentPage =
    useCallback(
      (
        updater: (
          current:
            MAQuadroManualGuides
        ) =>
          MAQuadroManualGuides
      ) => {
        if (!page) {
          return
        }

        setManualGuidesByPage(
          (currentByPage) => {
            const current =
              currentByPage[
                page.id
              ] ||
              EMPTY_MANUAL_GUIDES

            return {
              ...currentByPage,
              [page.id]:
                updater(
                  current
                )
            }
          }
        )
      },
      [
        page
      ]
    )

  const removeManualGuide =
    useCallback(
      (
        axis:
          ManualGuideAxis,
        index: number
      ) => {
        setGuidesForCurrentPage(
          (current) => ({
            ...current,
            [axis]:
              current[axis]
                .filter(
                  (_, itemIndex) =>
                    itemIndex !==
                    index
                )
          })
        )
      },
      [
        setGuidesForCurrentPage
      ]
    )

  const clearManualGuides =
    useCallback(() => {
      if (
        guidesLocked ||
        manualGuideCount === 0
      ) {
        return
      }

      setGuidesForCurrentPage(
        () => ({
          vertical: [],
          horizontal: []
        })
      )

      setManualGuideDrag(
        null
      )
    }, [
      guidesLocked,
      manualGuideCount,
      setGuidesForCurrentPage
    ])

  const guideValueFromPointer =
    useCallback(
      (
        axis:
          ManualGuideAxis,
        clientX: number,
        clientY: number
      ) => {
        const frame =
          rulerFrameRef.current

        if (!frame) {
          return 0
        }

        const bounds =
          frame.getBoundingClientRect()

        if (
          axis ===
          'vertical'
        ) {
          const scale =
            bounds.width /
            Math.max(
              1,
              canvasWidth
            )

          return clamp(
            (
              clientX -
              bounds.left
            ) /
              Math.max(
                scale,
                0.0001
              ),
            0,
            canvasWidth
          )
        }

        const scale =
          bounds.height /
          Math.max(
            1,
            canvasHeight
          )

        return clamp(
          (
            clientY -
            bounds.top
          ) /
            Math.max(
              scale,
              0.0001
            ),
          0,
          canvasHeight
        )
      },
      [
        canvasHeight,
        canvasWidth
      ]
    )

  const pointerOutsideGuideArea =
    useCallback(
      (
        axis:
          ManualGuideAxis,
        clientX: number,
        clientY: number
      ) => {
        const frame =
          rulerFrameRef.current

        if (!frame) {
          return false
        }

        const bounds =
          frame.getBoundingClientRect()

        if (
          axis ===
          'vertical'
        ) {
          return (
            clientX <
              bounds.left -
                GUIDE_REMOVE_MARGIN ||
            clientX >
              bounds.right +
                GUIDE_REMOVE_MARGIN
          )
        }

        return (
          clientY <
            bounds.top -
              GUIDE_REMOVE_MARGIN ||
          clientY >
            bounds.bottom +
              GUIDE_REMOVE_MARGIN
        )
      },
      []
    )

  const beginExistingGuideDrag =
    useCallback(
      (
        axis:
          ManualGuideAxis,
        index: number,
        event:
          ReactPointerEvent<HTMLButtonElement>
      ) => {
        if (
          guidesLocked
        ) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        const value =
          manualGuides[
            axis
          ][index]

        if (
          typeof value !==
          'number'
        ) {
          return
        }

        setManualGuideDrag({
          axis,
          index,
          created: false,
          originalValue:
            value,
          outside: false
        })
      },
      [
        guidesLocked,
        manualGuides
      ]
    )

  const beginNewGuideDrag =
    useCallback(
      (
        axis:
          ManualGuideAxis,
        event:
          ReactPointerEvent<HTMLDivElement>
      ) => {
        if (
          guidesLocked ||
          !page
        ) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        const value =
          guideValueFromPointer(
            axis,
            event.clientX,
            event.clientY
          )

        const index =
          manualGuides[
            axis
          ].length

        setGuidesForCurrentPage(
          (current) => ({
            ...current,
            [axis]: [
              ...current[axis],
              value
            ]
          })
        )

        setManualGuideDrag({
          axis,
          index,
          created: true,
          originalValue:
            value,
          outside: false
        })
      },
      [
        guideValueFromPointer,
        guidesLocked,
        manualGuides,
        page,
        setGuidesForCurrentPage
      ]
    )

  const updateDraggedGuide =
    useCallback(
      (
        drag:
          ManualGuideDragState,
        clientX: number,
        clientY: number
      ) => {
        const value =
          guideValueFromPointer(
            drag.axis,
            clientX,
            clientY
          )

        const outside =
          pointerOutsideGuideArea(
            drag.axis,
            clientX,
            clientY
          )

        setGuidesForCurrentPage(
          (current) => ({
            ...current,
            [drag.axis]:
              current[
                drag.axis
              ].map(
                (
                  currentValue,
                  index
                ) =>
                  index ===
                  drag.index
                    ? value
                    : currentValue
              )
          })
        )

        setManualGuideDrag(
          (current) => {
            if (
              !current ||
              current.outside ===
                outside
            ) {
              return current
            }

            return {
              ...current,
              outside
            }
          }
        )
      },
      [
        guideValueFromPointer,
        pointerOutsideGuideArea,
        setGuidesForCurrentPage
      ]
    )

  useEffect(() => {
    if (
      !manualGuideDrag
    ) {
      return
    }

    const handlePointerMove = (
      event:
        PointerEvent
    ) => {
      event.preventDefault()

      updateDraggedGuide(
        manualGuideDrag,
        event.clientX,
        event.clientY
      )
    }

    const finishDrag = (
      event:
        PointerEvent,
      cancelled = false
    ) => {
      const outside =
        cancelled ||
        pointerOutsideGuideArea(
          manualGuideDrag.axis,
          event.clientX,
          event.clientY
        )

      if (outside) {
        if (
          manualGuideDrag.created
        ) {
          removeManualGuide(
            manualGuideDrag.axis,
            manualGuideDrag.index
          )
        } else {
          setGuidesForCurrentPage(
            (current) => ({
              ...current,
              [manualGuideDrag.axis]:
                current[
                  manualGuideDrag.axis
                ].map(
                  (
                    value,
                    index
                  ) =>
                    index ===
                    manualGuideDrag.index
                      ? manualGuideDrag
                          .originalValue
                      : value
                )
            })
          )

          if (!cancelled) {
            removeManualGuide(
              manualGuideDrag.axis,
              manualGuideDrag.index
            )
          }
        }
      }

      setManualGuideDrag(
        null
      )
    }

    const handlePointerUp = (
      event:
        PointerEvent
    ) => {
      finishDrag(
        event,
        false
      )
    }

    const handlePointerCancel = (
      event:
        PointerEvent
    ) => {
      finishDrag(
        event,
        true
      )
    }

    window.addEventListener(
      'pointermove',
      handlePointerMove,
      {
        passive: false
      }
    )

    window.addEventListener(
      'pointerup',
      handlePointerUp
    )

    window.addEventListener(
      'pointercancel',
      handlePointerCancel
    )

    return () => {
      window.removeEventListener(
        'pointermove',
        handlePointerMove
      )

      window.removeEventListener(
        'pointerup',
        handlePointerUp
      )

      window.removeEventListener(
        'pointercancel',
        handlePointerCancel
      )
    }
  }, [
    manualGuideDrag,
    pointerOutsideGuideArea,
    removeManualGuide,
    setGuidesForCurrentPage,
    updateDraggedGuide
  ])

  useEffect(() => {
    if (!page) {
      return
    }

    setManualGuidesByPage(
      (currentByPage) => {
        const current =
          currentByPage[
            page.id
          ]

        if (!current) {
          return currentByPage
        }

        const vertical =
          current.vertical.map(
            (value) =>
              clamp(
                value,
                0,
                canvasWidth
              )
          )

        const horizontal =
          current.horizontal.map(
            (value) =>
              clamp(
                value,
                0,
                canvasHeight
              )
          )

        const unchanged =
          vertical.every(
            (value, index) =>
              value ===
              current.vertical[
                index
              ]
          ) &&
          horizontal.every(
            (value, index) =>
              value ===
              current.horizontal[
                index
              ]
          )

        if (unchanged) {
          return currentByPage
        }

        return {
          ...currentByPage,
          [page.id]: {
            vertical,
            horizontal
          }
        }
      }
    )
  }, [
    canvasHeight,
    canvasWidth,
    page
  ])

  useEffect(() => {
    const canvasElement =
      editor.canvasElementRef
        .current

    setMAQuadroManualGuides(
      canvasElement,
      manualGuides
    )

    return () => {
      clearMAQuadroManualGuides(
        canvasElement
      )
    }
  }, [
    editor.canvasElementRef,
    manualGuides,
    page?.id
  ])

  useEffect(() => {
    setManualGuideDrag(
      null
    )
  }, [
    page?.id
  ])

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
      event
        .dataTransfer
        .types
        .includes(
          'Files'
        )
    ) {
      event.preventDefault()

      event
        .dataTransfer
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
      event
        .dataTransfer
        .files
        .length
    ) {
      void editor
        .handleDroppedFiles(
          Array.from(
            event
              .dataTransfer
              .files
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
    editor.guides
      .vertical ===
    null
      ? null
      : `${(
          editor
            .guides
            .vertical /
          Math.max(
            1,
            canvasWidth
          )
        ) * 100}%`

  const horizontalGuidePosition =
    editor.guides
      .horizontal ===
    null
      ? null
      : `${(
          editor
            .guides
            .horizontal /
          Math.max(
            1,
            canvasHeight
          )
        ) * 100}%`

  const activeManualGuideValue =
    manualGuideDrag
      ? manualGuides[
          manualGuideDrag.axis
        ][
          manualGuideDrag.index
        ]
      : null

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
              void editor
                .duplicateSelection()
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
              editor
                .deleteSelection
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
              editor
                .groupSelection
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
              editor
                .ungroupSelection
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
              editor
                .alignSelection(
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
              editor
                .alignSelection(
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
              editor
                .alignSelection(
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
              editor
                .alignSelection(
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
              editor
                .alignSelection(
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
              editor
                .alignSelection(
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
                editor
                  .imageCropEditing
                  ? 'Concluir recorte'
                  : 'Recortar'
              }
              title={
                editor
                  .imageCropEditing
                  ? 'Concluir edição do recorte'
                  : 'Editar o enquadramento da imagem'
              }
              active={
                editor
                  .imageCropEditing
              }
              disabled={
                locked
              }
              onClick={() => {
                if (
                  editor
                    .imageCropEditing
                ) {
                  editor
                    .finishImageCrop()
                } else {
                  editor
                    .beginImageCrop()
                }
              }}
            />

            {editor
              .imageCropEditing ? (
              <ToolbarButton
                label="Cancelar"
                title="Cancelar alterações do recorte"
                onClick={
                  editor
                    .cancelImageCrop
                }
                disabled={
                  locked
                }
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
                    editor
                      .selection
                      .imageFrame
                  }
                  disabled={
                    locked
                  }
                  onChange={(
                    event
                  ) =>
                    editor
                      .setImageFrame(
                        event
                          .target
                          .value as
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
              editor
                .toggleGrid
            }
            active={
              editor
                .showGrid
            }
          />

          <ToolbarButton
            label="Margens"
            title="Mostrar ou ocultar área segura"
            onClick={
              editor
                .toggleSafeArea
            }
            active={
              editor
                .showSafeArea
            }
          />

          {manualGuideCount > 0 ? (
            <ToolbarButton
              label={`Guias × (${manualGuideCount})`}
              title="Remover todas as guias manuais desta página"
              onClick={
                clearManualGuides
              }
              disabled={
                guidesLocked
              }
            />
          ) : null}

          <ToolbarButton
            label="Ajustar"
            title="Ajustar quadro ao ecrã"
            onClick={
              editor
                .fitCanvas
            }
          />
        </div>
      </div>

      {isImage &&
      editor
        .imageCropEditing ? (
        <div
          className="mq-context-toolbar"
          aria-label="Controlos do recorte"
        >
          <div className="mq-context-toolbar__group">
            <label className="mq-field">
              <span>
                Zoom{' '}
                {
                  editor
                    .selection
                    .cropZoom
                }
                %
              </span>

              <input
                type="range"
                min="100"
                max="400"
                value={
                  editor
                    .selection
                    .cropZoom
                }
                disabled={
                  locked
                }
                onChange={(
                  event
                ) =>
                  editor
                    .setImageCropZoom(
                      Number(
                        event
                          .target
                          .value
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
                  editor
                    .selection
                    .cropPositionX
                }
                disabled={
                  locked
                }
                onChange={(
                  event
                ) =>
                  editor
                    .setImageCropPosition(
                      Number(
                        event
                          .target
                          .value
                      ),
                      editor
                        .selection
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
                  editor
                    .selection
                    .cropPositionY
                }
                disabled={
                  locked
                }
                onChange={(
                  event
                ) =>
                  editor
                    .setImageCropPosition(
                      editor
                        .selection
                        .cropPositionX,
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                }
              />
            </label>

            <span className="mq-control-note">
              Também pode
              arrastar a imagem
              no quadro para
              reposicionar o
              recorte.
            </span>
          </div>
        </div>
      ) : null}

      <div
        ref={
          editor
            .workspaceRef
        }
        className={`mq-workspace${
          editor
            .isSpacePressed
            ? ' is-panning'
            : ''
        }${
          dragActive
            ? ' is-dragging'
            : ''
        }${
          editor
            .imageCropEditing
            ? ' is-cropping'
            : ''
        }${
          manualGuideDrag
            ? ' is-guide-dragging'
            : ''
        }`}
        onWheel={
          editor
            .onWorkspaceWheel
        }
        onPointerDown={
          editor
            .onWorkspacePointerDown
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
        onDragLeave={(
          event
        ) => {
          if (
            event
              .currentTarget ===
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
          ref={
            rulerFrameRef
          }
          className="mq-canvas-ruler-frame"
          style={{
            width:
              displayWidth,
            height:
              displayHeight
          }}
        >
          {page ? (
            <CanvasRulers
              width={
                canvasWidth
              }
              height={
                canvasHeight
              }
              zoom={
                editor.zoom
              }
              disabled={
                guidesLocked
              }
              onCreateHorizontalGuide={(
                event
              ) =>
                beginNewGuideDrag(
                  'horizontal',
                  event
                )
              }
              onCreateVerticalGuide={(
                event
              ) =>
                beginNewGuideDrag(
                  'vertical',
                  event
                )
              }
            />
          ) : null}

          <div
            className={`mq-canvas-shell${
              page
                ? ''
                : ' is-initialising'
            }`}
            style={{
              width:
                displayWidth,
              height:
                displayHeight
            }}
            aria-busy={
              !page
            }
          >
            <canvas
              ref={
                editor
                  .canvasElementRef
              }
            />

            {editor
              .showGrid ? (
              <div className="mq-canvas-grid" />
            ) : null}

            {editor
              .showSafeArea ? (
              <div className="mq-safe-area" />
            ) : null}

            {page
              ? manualGuides.vertical.map(
                  (
                    value,
                    index
                  ) => (
                    <ManualGuideButton
                      key={`manual-v-${index}`}
                      axis="vertical"
                      index={
                        index
                      }
                      value={
                        value
                      }
                      maximum={
                        canvasWidth
                      }
                      dragging={
                        manualGuideDrag
                          ?.axis ===
                          'vertical' &&
                        manualGuideDrag
                          .index ===
                          index
                      }
                      removing={
                        manualGuideDrag
                          ?.axis ===
                          'vertical' &&
                        manualGuideDrag
                          .index ===
                          index &&
                        manualGuideDrag
                          .outside
                      }
                      disabled={
                        guidesLocked
                      }
                      onPointerDown={
                        beginExistingGuideDrag
                      }
                      onRemove={
                        removeManualGuide
                      }
                    />
                  )
                )
              : null}

            {page
              ? manualGuides.horizontal.map(
                  (
                    value,
                    index
                  ) => (
                    <ManualGuideButton
                      key={`manual-h-${index}`}
                      axis="horizontal"
                      index={
                        index
                      }
                      value={
                        value
                      }
                      maximum={
                        canvasHeight
                      }
                      dragging={
                        manualGuideDrag
                          ?.axis ===
                          'horizontal' &&
                        manualGuideDrag
                          .index ===
                          index
                      }
                      removing={
                        manualGuideDrag
                          ?.axis ===
                          'horizontal' &&
                        manualGuideDrag
                          .index ===
                          index &&
                        manualGuideDrag
                          .outside
                      }
                      disabled={
                        guidesLocked
                      }
                      onPointerDown={
                        beginExistingGuideDrag
                      }
                      onRemove={
                        removeManualGuide
                      }
                    />
                  )
                )
              : null}

            {verticalGuidePosition !==
            null ? (
              <div
                className={`mq-guide mq-guide--vertical${
                  editor
                    .guides
                    .source ===
                  'object'
                    ? ' is-object-guide'
                    : editor
                        .guides
                        .source ===
                      'manual'
                      ? ' is-manual-guide'
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
                  editor
                    .guides
                    .source ===
                  'object'
                    ? ' is-object-guide'
                    : editor
                        .guides
                        .source ===
                      'manual'
                      ? ' is-manual-guide'
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
                A preparar o
                editor…
              </div>
            ) : null}
          </div>
        </div>

        {dragActive ? (
          <div className="mq-drop-overlay">
            <strong>
              Largue as
              imagens aqui
            </strong>

            <span>
              Serão adicionadas
              à página atual.
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

          {editor
            .imageCropEditing ? (
            <strong>
              Recorte ativo —
              arraste a imagem
              ou use os
              controlos acima.{' '}
            </strong>
          ) : null}

          {manualGuideDrag &&
          typeof activeManualGuideValue ===
            'number' ? (
            <strong>
              {manualGuideDrag.axis ===
              'vertical'
                ? 'Guia vertical'
                : 'Guia horizontal'}
              :{' '}
              {Math.round(
                activeManualGuideValue
              )}{' '}
              px — arraste para fora do quadro para eliminar.{' '}
            </strong>
          ) : null}

          {
            editor
              .statusMessage
          }
        </span>

        <div className="mq-zoom-control">
          <button
            type="button"
            onClick={() =>
              editor
                .setZoom(
                  editor.zoom -
                    10
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
            onChange={(
              event
            ) =>
              editor
                .setZoom(
                  Number(
                    event
                      .target
                      .value
                  )
                )
            }
            aria-label="Zoom do quadro"
          />

          <button
            type="button"
            onClick={() =>
              editor
                .setZoom(
                  editor.zoom +
                    10
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

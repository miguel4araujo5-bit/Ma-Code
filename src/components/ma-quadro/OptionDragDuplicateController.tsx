import {
  useEffect
} from 'react'

import {
  ActiveSelection,
  Group,
  Textbox
} from 'fabric'

import {
  getMAQuadroObjectLabel,
  getMAQuadroObjectRole,
  MA_QUADRO_SERIALIZED_PROPERTIES,
  prepareMAQuadroObject,
  type MAQuadroFabricObject
} from '../../lib/maQuadro/canvasObjects'

import {
  getMAQuadroAnimationCanvas
} from '../../lib/maQuadro/objectAnimations'

import {
  createMAQuadroId
} from '../../lib/maQuadro/project'

import {
  useMAQuadroEditorContext
} from './editorContext'

function renewObjectTreeIdentifiers(
  object:
    MAQuadroFabricObject
) {
  object.maId =
    createMAQuadroId(
      'object'
    )

  if (
    object instanceof
    Group
  ) {
    for (
      const child
      of object.getObjects()
    ) {
      renewObjectTreeIdentifiers(
        child as
          MAQuadroFabricObject
      )
    }
  }
}

type DragSession = {
  pointerId: number
  source: MAQuadroFabricObject
  startX: number
  startY: number
  originalLeft: number
  originalTop: number
  moved: boolean
}

function fireCanvasEvent(
  canvas:
    ReturnType<
      typeof getMAQuadroAnimationCanvas
    >,
  eventName:
    string,
  payload:
    unknown
) {
  if (!canvas) {
    return
  }

  ;(
    canvas as unknown as {
      fire: (
        eventName: string,
        payload?: unknown
      ) => unknown
    }
  ).fire(
    eventName,
    payload
  )
}

export default function OptionDragDuplicateController() {
  const editor =
    useMAQuadroEditorContext()

  useEffect(() => {
    if (
      !editor.ready ||
      editor.busy ||
      editor.structureBusy ||
      editor.imageCropEditing
    ) {
      return
    }

    const canvas =
      getMAQuadroAnimationCanvas()

    if (!canvas) {
      return
    }

    const interactionCanvas =
      canvas.getSelectionElement()

    let session:
      DragSession |
      null =
      null

    let cloning =
      false

    const restoreSource = () => {
      if (!session) {
        return
      }

      session.source.set({
        left:
          session.originalLeft,

        top:
          session.originalTop
      })

      session.source.setCoords()

      canvas.requestRenderAll()
    }

    const clearGuides = (
      event:
        PointerEvent,
      target?:
        MAQuadroFabricObject
    ) => {
      fireCanvasEvent(
        canvas,
        'mouse:up',
        {
          e:
            event,

          target,

          scenePoint:
            canvas.getScenePoint(
              event
            ),

          viewportPoint:
            canvas.getViewportPoint(
              event
            )
        }
      )
    }

    const handlePointerDown = (
      event:
        PointerEvent
    ) => {
      if (
        cloning ||
        !event.altKey ||
        event.button !== 0 ||
        editor.busy ||
        editor.structureBusy ||
        editor.imageCropEditing
      ) {
        return
      }

      const targetInfo =
        canvas.findTarget(
          event
        )

      const target =
        targetInfo?.target as
          | MAQuadroFabricObject
          | undefined

      if (
        !target ||
        target.maLocked ||
        target.selectable ===
          false ||
        target.evented ===
          false ||
        (
          target instanceof
            Textbox &&
          target.isEditing
        )
      ) {
        return
      }

      if (
        canvas.getActiveObject() ===
          target &&
        target.findControl(
          canvas.getScenePoint(
            event
          )
        )
      ) {
        return
      }

      const active =
        canvas.getActiveObject()

      if (
        active instanceof
        ActiveSelection
      ) {
        return
      }

      if (
        active !== target
      ) {
        canvas.setActiveObject(
          target
        )

        canvas.requestRenderAll()
      }

      const source =
        canvas.getActiveObject() as
          | MAQuadroFabricObject
          | undefined

      if (
        !source ||
        source instanceof
          ActiveSelection ||
        source.maLocked
      ) {
        return
      }

      const point =
        canvas.getScenePoint(
          event
        )

      session = {
        pointerId:
          event.pointerId,

        source,

        startX:
          point.x,

        startY:
          point.y,

        originalLeft:
          Number(
            source.left ||
            0
          ),

        originalTop:
          Number(
            source.top ||
            0
          ),

        moved:
          false
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      try {
        interactionCanvas
          .setPointerCapture(
            event.pointerId
          )
      } catch {}
    }

    const handlePointerMove = (
      event:
        PointerEvent
    ) => {
      if (
        !session ||
        session.pointerId !==
          event.pointerId
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const point =
        canvas.getScenePoint(
          event
        )

      const deltaX =
        point.x -
        session.startX

      const deltaY =
        point.y -
        session.startY

      session.moved =
        session.moved ||
        Math.hypot(
          deltaX,
          deltaY
        ) >= 2

      session.source.set({
        left:
          session.originalLeft +
          deltaX,

        top:
          session.originalTop +
          deltaY
      })

      session.source.setCoords()

      fireCanvasEvent(
        canvas,
        'object:moving',
        {
          e:
            event,

          target:
            session.source,

          scenePoint:
            point,

          viewportPoint:
            canvas.getViewportPoint(
              event
            )
        }
      )

      canvas.requestRenderAll()
    }

    const finishDrag =
      async (
        event:
          PointerEvent,
        cancelled:
          boolean
      ) => {
        if (
          !session ||
          session.pointerId !==
            event.pointerId
        ) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        const completed =
          session

        const finalLeft =
          Number(
            completed.source.left ||
            completed.originalLeft
          )

        const finalTop =
          Number(
            completed.source.top ||
            completed.originalTop
          )

        restoreSource()

        clearGuides(
          event,
          completed.source
        )

        session =
          null

        try {
          interactionCanvas
            .releasePointerCapture(
              event.pointerId
            )
        } catch {}

        if (
          cancelled ||
          !completed.moved
        ) {
          return
        }

        cloning =
          true

        try {
          const clone =
            await completed.source
              .clone(
                MA_QUADRO_SERIALIZED_PROPERTIES
              ) as
                MAQuadroFabricObject

          clone.set({
            left:
              finalLeft,

            top:
              finalTop,

            evented:
              true,

            selectable:
              true
          })

          renewObjectTreeIdentifiers(
            clone
          )

          clone.maName =
            `${getMAQuadroObjectLabel(
              completed.source
            )} — cópia`

          prepareMAQuadroObject(
            clone,
            getMAQuadroObjectRole(
              clone
            ),
            clone.maName
          )

          clone.setCoords()

          canvas.add(
            clone
          )

          canvas.setActiveObject(
            clone
          )

          canvas.requestRenderAll()
        } catch (
          error
        ) {
          console.error(
            error
          )
        } finally {
          cloning =
            false
        }
      }

    const handlePointerUp = (
      event:
        PointerEvent
    ) => {
      void finishDrag(
        event,
        false
      )
    }

    const handlePointerCancel = (
      event:
        PointerEvent
    ) => {
      void finishDrag(
        event,
        true
      )
    }

    interactionCanvas.addEventListener(
      'pointerdown',
      handlePointerDown,
      true
    )

    window.addEventListener(
      'pointermove',
      handlePointerMove,
      true
    )

    window.addEventListener(
      'pointerup',
      handlePointerUp,
      true
    )

    window.addEventListener(
      'pointercancel',
      handlePointerCancel,
      true
    )

    return () => {
      restoreSource()

      interactionCanvas.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true
      )

      window.removeEventListener(
        'pointermove',
        handlePointerMove,
        true
      )

      window.removeEventListener(
        'pointerup',
        handlePointerUp,
        true
      )

      window.removeEventListener(
        'pointercancel',
        handlePointerCancel,
        true
      )
    }
  }, [
    editor.activePage?.id,
    editor.busy,
    editor.imageCropEditing,
    editor.project?.id,
    editor.ready,
    editor.structureBusy
  ])

  return null
}

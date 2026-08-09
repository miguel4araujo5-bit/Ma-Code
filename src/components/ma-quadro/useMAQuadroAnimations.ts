import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  getMAQuadroAnimationCanvas,
  getMAQuadroObjectAnimation,
  MA_QUADRO_DEFAULT_ANIMATION,
  previewMAQuadroSelectedObjectAnimation,
  setMAQuadroSelectedObjectAnimation,
  type MAQuadroObjectAnimation
} from '../../lib/maQuadro/objectAnimations'

import {
  type MAQuadroFabricObject
} from '../../lib/maQuadro/canvasObjects'

import {
  useMAQuadroEditorContext
} from './editorContext'

type CanvasObservable = {
  on: (
    eventName:
      string,

    handler:
      () => void
  ) => unknown

  off: (
    eventName:
      string,

    handler:
      () => void
  ) => unknown
}

export function
useMAQuadroAnimations() {
  const editor =
    useMAQuadroEditorContext()

  const [
    animation,
    setAnimationState
  ] = useState<
    MAQuadroObjectAnimation
  >({
    ...MA_QUADRO_DEFAULT_ANIMATION
  })

  const [
    available,
    setAvailable
  ] = useState(
    false
  )

  const [
    previewing,
    setPreviewing
  ] = useState(
    false
  )

  const sync =
    useCallback(
      () => {
        const canvas =
          getMAQuadroAnimationCanvas()

        const selected =
          canvas
            ?.getActiveObjects() as
              | MAQuadroFabricObject[]
              | undefined

        if (
          editor
            .selection
            .count !==
              1 ||
          !selected ||
          selected.length !==
            1
        ) {
          setAvailable(
            false
          )

          setAnimationState({
            ...MA_QUADRO_DEFAULT_ANIMATION
          })

          return
        }

        setAvailable(
          true
        )

        setAnimationState(
          getMAQuadroObjectAnimation(
            selected[
              0
            ]
          )
        )
      },
      [
        editor.selection.count
      ]
    )

  useEffect(() => {
    sync()
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.selection.count,
    editor.selection.name,
    sync
  ])

  useEffect(() => {
    const canvas =
      getMAQuadroAnimationCanvas()

    if (
      !canvas
    ) {
      return
    }

    const observable =
      canvas as unknown as
        CanvasObservable

    const eventNames = [
      'selection:created',
      'selection:updated',
      'selection:cleared',
      'object:modified',
      'object:added',
      'object:removed'
    ]

    for (
      const eventName
      of eventNames
    ) {
      observable.on(
        eventName,
        sync
      )
    }

    return () => {
      for (
        const eventName
        of eventNames
      ) {
        observable.off(
          eventName,
          sync
        )
      }
    }
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.selection.count,
    sync
  ])

  const setAnimation =
    useCallback(
      (
        values:
          Partial<
            MAQuadroObjectAnimation
          >
      ) => {
        if (
          editor.busy ||
          editor.structureBusy ||
          editor.imageCropEditing ||
          previewing
        ) {
          return
        }

        const next =
          setMAQuadroSelectedObjectAnimation(
            values
          )

        if (
          next
        ) {
          setAnimationState(
            next
          )
        }
      },
      [
        editor.busy,
        editor.imageCropEditing,
        editor.structureBusy,
        previewing
      ]
    )

  const preview =
    useCallback(
      async () => {
        if (
          !available ||
          editor.busy ||
          editor.structureBusy ||
          editor.imageCropEditing ||
          previewing ||
          animation.kind ===
            'none'
        ) {
          return false
        }

        setPreviewing(
          true
        )

        try {
          return await
            previewMAQuadroSelectedObjectAnimation()
        } finally {
          setPreviewing(
            false
          )

          sync()
        }
      },
      [
        animation.kind,
        available,
        editor.busy,
        editor.imageCropEditing,
        editor.structureBusy,
        previewing,
        sync
      ]
    )

  return {
    animation,

    available,

    previewing,

    selectedName:
      editor
        .selection
        .name,

    disabled:
      editor.busy ||
      editor.structureBusy ||
      editor.imageCropEditing,

    setAnimation,

    preview
  }
}

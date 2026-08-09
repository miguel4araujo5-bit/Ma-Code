import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  getMAQuadroAnimationCanvas
} from '../../lib/maQuadro/objectAnimations'

import {
  countMAQuadroPageAnimations,
  MA_QUADRO_PAGE_ANIMATION_DEFAULT_GAP_MS,
  MA_QUADRO_PAGE_ANIMATION_MAX_GAP_MS,
  previewMAQuadroPageAnimations,
  type MAQuadroPageAnimationMode
} from '../../lib/maQuadro/pageAnimations'

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

function clamp(
  value:
    number,
  minimum:
    number,
  maximum:
    number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(
        value
      )
        ? value
        : minimum
    )
  )
}

export function
useMAQuadroPageAnimations() {
  const editor =
    useMAQuadroEditorContext()

  const abortControllerRef =
    useRef<
      AbortController |
      null
    >(
      null
    )

  const [
    mode,
    setModeState
  ] = useState<
    MAQuadroPageAnimationMode
  >(
    'sequence'
  )

  const [
    gapMs,
    setGapMsState
  ] = useState(
    MA_QUADRO_PAGE_ANIMATION_DEFAULT_GAP_MS
  )

  const [
    animationCount,
    setAnimationCount
  ] = useState(
    0
  )

  const [
    playing,
    setPlaying
  ] = useState(
    false
  )

  const syncCount =
    useCallback(
      () => {
        const canvas =
          getMAQuadroAnimationCanvas()

        if (
          !canvas
        ) {
          setAnimationCount(
            0
          )

          return
        }

        setAnimationCount(
          countMAQuadroPageAnimations(
            canvas
          )
        )
      },
      []
    )

  const stop =
    useCallback(
      () => {
        abortControllerRef
          .current
          ?.abort()

        abortControllerRef.current =
          null

        setPlaying(
          false
        )
      },
      []
    )

  useEffect(() => {
    const frame =
      window
        .requestAnimationFrame(
          syncCount
        )

    const timeout =
      window
        .setTimeout(
          syncCount,
          250
        )

    return () => {
      window
        .cancelAnimationFrame(
          frame
        )

      window
        .clearTimeout(
          timeout
        )
    }
  }, [
    editor.activePage?.id,
    editor.project?.id,
    editor.ready,
    syncCount
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
      'object:added',
      'object:removed',
      'object:modified'
    ]

    for (
      const eventName
      of eventNames
    ) {
      observable.on(
        eventName,
        syncCount
      )
    }

    return () => {
      for (
        const eventName
        of eventNames
      ) {
        observable.off(
          eventName,
          syncCount
        )
      }
    }
  }, [
    editor.activePage?.id,
    editor.project?.id,
    syncCount
  ])

  useEffect(() => {
    stop()
  }, [
    editor.activePage?.id,
    editor.project?.id,
    stop
  ])

  useEffect(
    () => {
      return () => {
        abortControllerRef
          .current
          ?.abort()
      }
    },
    []
  )

  const setMode =
    useCallback(
      (
        value:
          MAQuadroPageAnimationMode
      ) => {
        if (
          playing
        ) {
          return
        }

        setModeState(
          value
        )
      },
      [
        playing
      ]
    )

  const setGapMs =
    useCallback(
      (
        value:
          number
      ) => {
        if (
          playing
        ) {
          return
        }

        setGapMsState(
          Math.round(
            clamp(
              value,
              0,
              MA_QUADRO_PAGE_ANIMATION_MAX_GAP_MS
            )
          )
        )
      },
      [
        playing
      ]
    )

  const play =
    useCallback(
      async () => {
        const canvas =
          getMAQuadroAnimationCanvas()

        if (
          !canvas ||
          playing ||
          animationCount ===
            0 ||
          editor.busy ||
          editor.structureBusy ||
          editor.imageCropEditing
        ) {
          return false
        }

        const controller =
          new AbortController()

        abortControllerRef.current =
          controller

        setPlaying(
          true
        )

        try {
          return await
            previewMAQuadroPageAnimations(
              canvas,
              {
                mode,

                gapMs,

                holdMs:
                  300,

                signal:
                  controller.signal
              }
            )
        } finally {
          if (
            abortControllerRef
              .current ===
            controller
          ) {
            abortControllerRef.current =
              null
          }

          setPlaying(
            false
          )

          syncCount()
        }
      },
      [
        animationCount,
        editor.busy,
        editor.imageCropEditing,
        editor.structureBusy,
        gapMs,
        mode,
        playing,
        syncCount
      ]
    )

  return {
    mode,

    gapMs,

    animationCount,

    playing,

    disabled:
      !editor.ready ||
      editor.busy ||
      editor.structureBusy ||
      editor.imageCropEditing,

    setMode,

    setGapMs,

    play,

    stop
  }
}

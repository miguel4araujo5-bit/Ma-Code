import {
  type Canvas
} from 'fabric'

import {
  type MAQuadroFabricObject
} from './canvasObjects'

import {
  applyMAQuadroObjectAnimationProgress,
  captureMAQuadroAnimationSnapshot,
  getMAQuadroObjectAnimation,
  restoreMAQuadroAnimationSnapshot,
  setMAQuadroAnimationPreviewInteractivity,
  type MAQuadroAnimationSnapshot,
  type MAQuadroObjectAnimation
} from './objectAnimations'

export type MAQuadroPageAnimationMode =
  | 'sequence'
  | 'together'

export type MAQuadroPageAnimationOptions = {
  mode:
    MAQuadroPageAnimationMode

  gapMs:
    number

  holdMs?:
    number

  signal?:
    AbortSignal
}

type PageAnimationEntry = {
  object:
    MAQuadroFabricObject

  animation:
    MAQuadroObjectAnimation

  snapshot:
    MAQuadroAnimationSnapshot
}

export const
  MA_QUADRO_PAGE_ANIMATION_DEFAULT_GAP_MS =
    120

export const
  MA_QUADRO_PAGE_ANIMATION_MAX_GAP_MS =
    1000

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

function createAbortError() {
  return new DOMException(
    'Pré-visualização cancelada.',
    'AbortError'
  )
}

function throwIfAborted(
  signal?:
    AbortSignal
) {
  if (
    signal?.aborted
  ) {
    throw createAbortError()
  }
}

function wait(
  durationMs:
    number,
  signal?:
    AbortSignal
) {
  if (
    durationMs <=
    0
  ) {
    throwIfAborted(
      signal
    )

    return Promise.resolve()
  }

  return new Promise<void>(
    (
      resolve,
      reject
    ) => {
      let settled =
        false

      const timeout =
        window.setTimeout(
          () => {
            if (
              settled
            ) {
              return
            }

            settled =
              true

            signal
              ?.removeEventListener(
                'abort',
                handleAbort
              )

            resolve()
          },
          durationMs
        )

      const handleAbort =
        () => {
          if (
            settled
          ) {
            return
          }

          settled =
            true

          window.clearTimeout(
            timeout
          )

          signal
            ?.removeEventListener(
              'abort',
              handleAbort
            )

          reject(
            createAbortError()
          )
        }

      if (
        signal?.aborted
      ) {
        handleAbort()

        return
      }

      signal
        ?.addEventListener(
          'abort',
          handleAbort,
          {
            once:
              true
          }
        )
    }
  )
}

function animate(
  durationMs:
    number,
  callback:
    (
      progress:
        number
    ) => void,
  signal?:
    AbortSignal
) {
  return new Promise<void>(
    (
      resolve,
      reject
    ) => {
      let frameId =
        0

      let settled =
        false

      const startedAt =
        performance.now()

      const cleanup =
        () => {
          signal
            ?.removeEventListener(
              'abort',
              handleAbort
            )
        }

      const finish =
        () => {
          if (
            settled
          ) {
            return
          }

          settled =
            true

          cleanup()

          resolve()
        }

      const fail =
        () => {
          if (
            settled
          ) {
            return
          }

          settled =
            true

          if (
            frameId
          ) {
            window
              .cancelAnimationFrame(
                frameId
              )
          }

          cleanup()

          reject(
            createAbortError()
          )
        }

      const handleAbort =
        () => {
          fail()
        }

      if (
        signal?.aborted
      ) {
        fail()

        return
      }

      signal
        ?.addEventListener(
          'abort',
          handleAbort,
          {
            once:
              true
          }
        )

      const frame = (
        now:
          number
      ) => {
        if (
          signal?.aborted
        ) {
          fail()

          return
        }

        const progress =
          clamp(
            (
              now -
              startedAt
            ) /
            Math.max(
              1,
              durationMs
            ),
            0,
            1
          )

        callback(
          progress
        )

        if (
          progress >=
          1
        ) {
          finish()

          return
        }

        frameId =
          window
            .requestAnimationFrame(
              frame
            )
      }

      frameId =
        window
          .requestAnimationFrame(
            frame
          )
    }
  )
}

export function
getMAQuadroPageAnimatedObjects(
  canvas:
    Canvas
) {
  return (
    canvas
      .getObjects() as
        MAQuadroFabricObject[]
  ).filter(
    (
      object
    ) => {
      if (
        object.visible ===
        false
      ) {
        return false
      }

      return (
        getMAQuadroObjectAnimation(
          object
        ).kind !==
        'none'
      )
    }
  )
}

export function
countMAQuadroPageAnimations(
  canvas:
    Canvas
) {
  return getMAQuadroPageAnimatedObjects(
    canvas
  ).length
}

function createEntries(
  canvas:
    Canvas
): PageAnimationEntry[] {
  return getMAQuadroPageAnimatedObjects(
    canvas
  ).map(
    (
      object
    ) => ({
      object,

      animation:
        getMAQuadroObjectAnimation(
          object
        ),

      snapshot:
        captureMAQuadroAnimationSnapshot(
          canvas,
          object
        )
    })
  )
}

function prepareEntries(
  canvas:
    Canvas,
  entries:
    PageAnimationEntry[]
) {
  for (
    const entry
    of entries
  ) {
    setMAQuadroAnimationPreviewInteractivity(
      entry.object,
      false
    )

    applyMAQuadroObjectAnimationProgress(
      canvas,
      entry.object,
      entry.animation,
      entry.snapshot,
      0
    )
  }

  canvas
    .requestRenderAll()
}

function restoreEntries(
  canvas:
    Canvas,
  entries:
    PageAnimationEntry[]
) {
  for (
    const entry
    of entries
  ) {
    restoreMAQuadroAnimationSnapshot(
      canvas,
      entry.object,
      entry.snapshot
    )
  }

  canvas
    .requestRenderAll()
}

async function playSequential(
  canvas:
    Canvas,
  entries:
    PageAnimationEntry[],
  gapMs:
    number,
  signal?:
    AbortSignal
) {
  for (
    let index =
      0;
    index <
      entries.length;
    index +=
      1
  ) {
    throwIfAborted(
      signal
    )

    const entry =
      entries[
        index
      ]

    await animate(
      entry
        .animation
        .durationMs,

      (
        progress
      ) => {
        applyMAQuadroObjectAnimationProgress(
          canvas,
          entry.object,
          entry.animation,
          entry.snapshot,
          progress
        )
      },

      signal
    )

    if (
      index <
      entries.length -
        1 &&
      gapMs >
        0
    ) {
      await wait(
        gapMs,
        signal
      )
    }
  }
}

async function playTogether(
  canvas:
    Canvas,
  entries:
    PageAnimationEntry[],
  signal?:
    AbortSignal
) {
  const maximumDuration =
    Math.max(
      ...entries.map(
        (
          entry
        ) =>
          entry
            .animation
            .durationMs
      )
    )

  await animate(
    maximumDuration,

    (
      overallProgress
    ) => {
      const elapsed =
        maximumDuration *
        overallProgress

      for (
        const entry
        of entries
      ) {
        const progress =
          clamp(
            elapsed /
            Math.max(
              1,
              entry
                .animation
                .durationMs
            ),
            0,
            1
          )

        applyMAQuadroObjectAnimationProgress(
          canvas,
          entry.object,
          entry.animation,
          entry.snapshot,
          progress
        )
      }
    },

    signal
  )
}

export async function
previewMAQuadroPageAnimations(
  canvas:
    Canvas,
  options:
    MAQuadroPageAnimationOptions
) {
  const entries =
    createEntries(
      canvas
    )

  if (
    entries.length ===
    0
  ) {
    return false
  }

  const gapMs =
    Math.round(
      clamp(
        options.gapMs,
        0,
        MA_QUADRO_PAGE_ANIMATION_MAX_GAP_MS
      )
    )

  const holdMs =
    Math.round(
      clamp(
        options.holdMs ??
          300,
        0,
        1500
      )
    )

  try {
    throwIfAborted(
      options.signal
    )

    prepareEntries(
      canvas,
      entries
    )

    await wait(
      60,
      options.signal
    )

    if (
      options.mode ===
      'together'
    ) {
      await playTogether(
        canvas,
        entries,
        options.signal
      )
    } else {
      await playSequential(
        canvas,
        entries,
        gapMs,
        options.signal
      )
    }

    if (
      holdMs >
      0
    ) {
      await wait(
        holdMs,
        options.signal
      )
    }

    return true
  } catch (
    error
  ) {
    if (
      options
        .signal
        ?.aborted ||
      (
        error instanceof
          DOMException &&
        error.name ===
          'AbortError'
      )
    ) {
      return false
    }

    throw error
  } finally {
    restoreEntries(
      canvas,
      entries
    )
  }
}

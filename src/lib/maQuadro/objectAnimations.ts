import {
  Canvas,
  FabricObject
} from 'fabric'

import {
  MA_QUADRO_SERIALIZED_PROPERTIES,
  type MAQuadroFabricObject
} from './canvasObjects'

export type MAQuadroAnimationKind =
  | 'none'
  | 'fade'
  | 'slide'
  | 'scale'
  | 'pop'

export type MAQuadroAnimationPhase =
  | 'in'
  | 'out'

export type MAQuadroObjectAnimation = {
  kind: MAQuadroAnimationKind
  phase: MAQuadroAnimationPhase
  durationMs: number
  order: number
  delayMs: number
}

export type MAQuadroAnimationSnapshot = {
  left: number
  top: number
  scaleX: number
  scaleY: number
  opacity: number
  selectable: boolean
  evented: boolean
  hasControls: boolean
  hasBorders: boolean
  slideDistance: number
}

type MAQuadroAnimatedFabricObject =
  MAQuadroFabricObject & {
    maAnimationKind?:
      MAQuadroAnimationKind

    maAnimationPhase?:
      MAQuadroAnimationPhase

    maAnimationDurationMs?:
      number

    maAnimationOrder?:
      number

    maAnimationDelayMs?:
      number
  }

type MAQuadroCanvasPrototype = {
  getActiveObject:
    Canvas['getActiveObject']

  requestRenderAll:
    Canvas['requestRenderAll']

  maQuadroAnimationRegistryPatched?:
    boolean
}

export const
  MA_QUADRO_ANIMATION_MIN_DURATION_MS =
    200

export const
  MA_QUADRO_ANIMATION_MAX_DURATION_MS =
    3000

export const
  MA_QUADRO_ANIMATION_MIN_ORDER =
    0

export const
  MA_QUADRO_ANIMATION_MAX_ORDER =
    99

export const
  MA_QUADRO_ANIMATION_MIN_DELAY_MS =
    0

export const
  MA_QUADRO_ANIMATION_MAX_DELAY_MS =
    3000

export const
  MA_QUADRO_DEFAULT_ANIMATION:
    MAQuadroObjectAnimation = {
      kind:
        'none',

      phase:
        'in',

      durationMs:
        700,

      order:
        0,

      delayMs:
        0
    }

const animationCustomProperties = [
  'maAnimationKind',
  'maAnimationPhase',
  'maAnimationDurationMs',
  'maAnimationOrder',
  'maAnimationDelayMs'
]

const fabricObjectClass =
  FabricObject as unknown as {
    customProperties:
      string[]
  }

fabricObjectClass.customProperties =
  Array.from(
    new Set([
      ...(
        fabricObjectClass
          .customProperties ||
        []
      ),

      ...animationCustomProperties
    ])
  )

for (
  const property
  of animationCustomProperties
) {
  if (
    !MA_QUADRO_SERIALIZED_PROPERTIES
      .includes(
        property
      )
  ) {
    MA_QUADRO_SERIALIZED_PROPERTIES
      .push(
        property
      )
  }
}

let animationCanvas:
  Canvas |
  null =
    null

const canvasPrototype =
  Canvas.prototype as unknown as
    MAQuadroCanvasPrototype

if (
  !canvasPrototype
    .maQuadroAnimationRegistryPatched
) {
  const originalGetActiveObject =
    canvasPrototype
      .getActiveObject

  const originalRequestRenderAll =
    canvasPrototype
      .requestRenderAll

  canvasPrototype.getActiveObject =
    function getActiveObjectWithMAQuadroAnimationRegistry(
      this:
        Canvas
    ) {
      animationCanvas =
        this

      return originalGetActiveObject
        .call(
          this
        )
    } as Canvas['getActiveObject']

  canvasPrototype.requestRenderAll =
    function requestRenderAllWithMAQuadroAnimationRegistry(
      this:
        Canvas
    ) {
      animationCanvas =
        this

      return originalRequestRenderAll
        .call(
          this
        )
    } as Canvas['requestRenderAll']

  canvasPrototype
    .maQuadroAnimationRegistryPatched =
      true
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

function clampDuration(
  value:
    number
) {
  return Math.round(
    clamp(
      value,
      MA_QUADRO_ANIMATION_MIN_DURATION_MS,
      MA_QUADRO_ANIMATION_MAX_DURATION_MS
    )
  )
}

function clampOrder(
  value:
    number
) {
  return Math.round(
    clamp(
      value,
      MA_QUADRO_ANIMATION_MIN_ORDER,
      MA_QUADRO_ANIMATION_MAX_ORDER
    )
  )
}

function clampDelay(
  value:
    number
) {
  return Math.round(
    clamp(
      value,
      MA_QUADRO_ANIMATION_MIN_DELAY_MS,
      MA_QUADRO_ANIMATION_MAX_DELAY_MS
    )
  )
}

function isAnimationKind(
  value:
    unknown
): value is
  MAQuadroAnimationKind {
  return (
    value ===
      'none' ||
    value ===
      'fade' ||
    value ===
      'slide' ||
    value ===
      'scale' ||
    value ===
      'pop'
  )
}

function isAnimationPhase(
  value:
    unknown
): value is
  MAQuadroAnimationPhase {
  return (
    value ===
      'in' ||
    value ===
      'out'
  )
}

function easeOutCubic(
  value:
    number
) {
  return (
    1 -
    Math.pow(
      1 -
        value,
      3
    )
  )
}

function easeInCubic(
  value:
    number
) {
  return (
    value *
    value *
    value
  )
}

function easeInOutCubic(
  value:
    number
) {
  return value <
    0.5
    ? (
        4 *
        value *
        value *
        value
      )
    : (
        1 -
        Math.pow(
          -2 *
            value +
            2,
          3
        ) /
        2
      )
}

function lerp(
  from:
    number,
  to:
    number,
  progress:
    number
) {
  return (
    from +
    (
      to -
      from
    ) *
    progress
  )
}

function visibleProgress(
  progress:
    number,

  phase:
    MAQuadroAnimationPhase
) {
  const safe =
    clamp(
      progress,
      0,
      1
    )

  return phase ===
    'in'
    ? easeOutCubic(
        safe
      )
    : (
        1 -
        easeInCubic(
          safe
        )
      )
}

function getSingleSelectedObject(
  canvas:
    Canvas |
    null =
      animationCanvas
) {
  if (
    !canvas
  ) {
    return null
  }

  const selected =
    canvas
      .getActiveObjects() as
        MAQuadroFabricObject[]

  if (
    selected.length !==
    1
  ) {
    return null
  }

  return selected[
    0
  ]
}

function emitObjectModified(
  canvas:
    Canvas,
  object:
    MAQuadroFabricObject
) {
  const observable =
    canvas as unknown as {
      fire: (
        eventName:
          string,
        payload?:
          unknown
      ) => unknown
    }

  observable.fire(
    'object:modified',
    {
      target:
        object
    }
  )
}

function createAbortError() {
  return new DOMException(
    'Pré-visualização cancelada.',
    'AbortError'
  )
}

function waitForDelay(
  durationMs:
    number,
  signal?:
    AbortSignal
) {
  if (
    durationMs <=
    0
  ) {
    if (
      signal?.aborted
    ) {
      return Promise.reject(
        createAbortError()
      )
    }

    return Promise.resolve()
  }

  return new Promise<void>(
    (
      resolve,
      reject
    ) => {
      let settled =
        false

      const finish =
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
        }

      const timeout =
        window.setTimeout(
          finish,
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

export function
getMAQuadroAnimationCanvas() {
  return animationCanvas
}

export function
getMAQuadroSelectedObjectAnimation() {
  const object =
    getSingleSelectedObject()

  return object
    ? getMAQuadroObjectAnimation(
        object
      )
    : null
}

export function
getMAQuadroObjectAnimation(
  object:
    MAQuadroFabricObject
): MAQuadroObjectAnimation {
  const animated =
    object as
      MAQuadroAnimatedFabricObject

  return {
    kind:
      isAnimationKind(
        animated
          .maAnimationKind
      )
        ? animated
            .maAnimationKind
        : MA_QUADRO_DEFAULT_ANIMATION
            .kind,

    phase:
      isAnimationPhase(
        animated
          .maAnimationPhase
      )
        ? animated
            .maAnimationPhase
        : MA_QUADRO_DEFAULT_ANIMATION
            .phase,

    durationMs:
      clampDuration(
        Number(
          animated
            .maAnimationDurationMs ??
          MA_QUADRO_DEFAULT_ANIMATION
            .durationMs
        )
      ),

    order:
      clampOrder(
        Number(
          animated
            .maAnimationOrder ??
          MA_QUADRO_DEFAULT_ANIMATION
            .order
        )
      ),

    delayMs:
      clampDelay(
        Number(
          animated
            .maAnimationDelayMs ??
          MA_QUADRO_DEFAULT_ANIMATION
            .delayMs
        )
      )
  }
}

export function
setMAQuadroObjectAnimation(
  object:
    MAQuadroFabricObject,

  values:
    Partial<
      MAQuadroObjectAnimation
    >
) {
  const current =
    getMAQuadroObjectAnimation(
      object
    )

  const next:
    MAQuadroObjectAnimation = {
      kind:
        values.kind !==
          undefined &&
        isAnimationKind(
          values.kind
        )
          ? values.kind
          : current.kind,

      phase:
        values.phase !==
          undefined &&
        isAnimationPhase(
          values.phase
        )
          ? values.phase
          : current.phase,

      durationMs:
        values.durationMs !==
          undefined
          ? clampDuration(
              values
                .durationMs
            )
          : current
              .durationMs,

      order:
        values.order !==
          undefined
          ? clampOrder(
              values.order
            )
          : current.order,

      delayMs:
        values.delayMs !==
          undefined
          ? clampDelay(
              values.delayMs
            )
          : current.delayMs
    }

  if (
    current.kind ===
      next.kind &&
    current.phase ===
      next.phase &&
    current.durationMs ===
      next.durationMs &&
    current.order ===
      next.order &&
    current.delayMs ===
      next.delayMs
  ) {
    return false
  }

  const animated =
    object as
      MAQuadroAnimatedFabricObject

  animated.maAnimationKind =
    next.kind

  animated.maAnimationPhase =
    next.phase

  animated.maAnimationDurationMs =
    next.durationMs

  animated.maAnimationOrder =
    next.order

  animated.maAnimationDelayMs =
    next.delayMs

  object.dirty =
    true

  return true
}

export function
setMAQuadroSelectedObjectAnimation(
  values:
    Partial<
      MAQuadroObjectAnimation
    >
) {
  const canvas =
    animationCanvas

  const object =
    getSingleSelectedObject(
      canvas
    )

  if (
    !canvas ||
    !object ||
    object.maLocked
  ) {
    return null
  }

  const changed =
    setMAQuadroObjectAnimation(
      object,
      values
    )

  if (
    changed
  ) {
    object
      .setCoords()

    canvas
      .requestRenderAll()

    emitObjectModified(
      canvas,
      object
    )
  }

  return getMAQuadroObjectAnimation(
    object
  )
}

export function
captureMAQuadroAnimationSnapshot(
  canvas:
    Canvas,

  object:
    MAQuadroFabricObject
): MAQuadroAnimationSnapshot {
  const bounds =
    object
      .getBoundingRect()

  const slideDistance =
    Math.max(
      32,

      Math.min(
        Math.max(
          bounds.height *
            0.35,

          canvas
            .getHeight() *
            0.08
        ),

        180
      )
    )

  return {
    left:
      Number(
        object.left ||
        0
      ),

    top:
      Number(
        object.top ||
        0
      ),

    scaleX:
      Number(
        object.scaleX ??
        1
      ),

    scaleY:
      Number(
        object.scaleY ??
        1
      ),

    opacity:
      Number(
        object.opacity ??
        1
      ),

    selectable:
      object.selectable,

    evented:
      object.evented,

    hasControls:
      object.hasControls,

    hasBorders:
      object.hasBorders,

    slideDistance
  }
}

export function
setMAQuadroAnimationPreviewInteractivity(
  object:
    MAQuadroFabricObject,
  enabled:
    boolean,
  snapshot?:
    MAQuadroAnimationSnapshot
) {
  if (
    enabled &&
    snapshot
  ) {
    object.set({
      selectable:
        snapshot.selectable,

      evented:
        snapshot.evented,

      hasControls:
        snapshot.hasControls,

      hasBorders:
        snapshot.hasBorders
    })

    return
  }

  object.set({
    selectable:
      false,

    evented:
      false,

    hasControls:
      false,

    hasBorders:
      false
  })
}

export function
applyMAQuadroObjectAnimationProgress(
  canvas:
    Canvas,

  object:
    MAQuadroFabricObject,

  animation:
    MAQuadroObjectAnimation,

  snapshot:
    MAQuadroAnimationSnapshot,

  rawProgress:
    number
) {
  const progress =
    clamp(
      rawProgress,
      0,
      1
    )

  const visible =
    visibleProgress(
      progress,
      animation.phase
    )

  if (
    animation.kind ===
    'none'
  ) {
    object.set({
      left:
        snapshot.left,

      top:
        snapshot.top,

      scaleX:
        snapshot.scaleX,

      scaleY:
        snapshot.scaleY,

      opacity:
        snapshot.opacity
    })
  } else if (
    animation.kind ===
    'fade'
  ) {
    object.set({
      left:
        snapshot.left,

      top:
        snapshot.top,

      scaleX:
        snapshot.scaleX,

      scaleY:
        snapshot.scaleY,

      opacity:
        snapshot.opacity *
        visible
    })
  } else if (
    animation.kind ===
    'slide'
  ) {
    object.set({
      left:
        snapshot.left,

      top:
        snapshot.top +
        snapshot.slideDistance *
        (
          1 -
          visible
        ),

      scaleX:
        snapshot.scaleX,

      scaleY:
        snapshot.scaleY,

      opacity:
        snapshot.opacity *
        visible
    })
  } else if (
    animation.kind ===
    'scale'
  ) {
    const factor =
      0.72 +
      0.28 *
      visible

    object.set({
      left:
        snapshot.left,

      top:
        snapshot.top,

      scaleX:
        snapshot.scaleX *
        factor,

      scaleY:
        snapshot.scaleY *
        factor,

      opacity:
        snapshot.opacity *
        visible
    })
  } else {
    const entranceProgress =
      animation.phase ===
        'in'
        ? progress
        : (
            1 -
            progress
          )

    let factor:
      number

    if (
      entranceProgress <
      0.7
    ) {
      factor =
        lerp(
          0.68,
          1.08,

          easeOutCubic(
            entranceProgress /
            0.7
          )
        )
    } else {
      factor =
        lerp(
          1.08,
          1,

          easeInOutCubic(
            (
              entranceProgress -
              0.7
            ) /
            0.3
          )
        )
    }

    const opacityProgress =
      clamp(
        entranceProgress /
        0.42,
        0,
        1
      )

    object.set({
      left:
        snapshot.left,

      top:
        snapshot.top,

      scaleX:
        snapshot.scaleX *
        factor,

      scaleY:
        snapshot.scaleY *
        factor,

      opacity:
        snapshot.opacity *
        opacityProgress
    })
  }

  object
    .setCoords()

  object.dirty =
    true

  canvas
    .requestRenderAll()
}

export function
restoreMAQuadroAnimationSnapshot(
  canvas:
    Canvas,

  object:
    MAQuadroFabricObject,

  snapshot:
    MAQuadroAnimationSnapshot
) {
  object.set({
    left:
      snapshot.left,

    top:
      snapshot.top,

    scaleX:
      snapshot.scaleX,

    scaleY:
      snapshot.scaleY,

    opacity:
      snapshot.opacity,

    selectable:
      snapshot.selectable,

    evented:
      snapshot.evented,

    hasControls:
      snapshot.hasControls,

    hasBorders:
      snapshot.hasBorders
  })

  object
    .setCoords()

  object.dirty =
    true

  canvas
    .requestRenderAll()
}

function animateProgress(
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
          if (
            signal
          ) {
            signal
              .removeEventListener(
                'abort',
                handleAbort
              )
          }
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

const previewingObjects =
  new WeakSet<
    FabricObject
  >()

export async function
previewMAQuadroObjectAnimation(
  canvas:
    Canvas,

  object:
    MAQuadroFabricObject,

  animation =
    getMAQuadroObjectAnimation(
      object
    ),

  signal?:
    AbortSignal
) {
  if (
    animation.kind ===
      'none' ||
    previewingObjects.has(
      object
    )
  ) {
    return false
  }

  const snapshot =
    captureMAQuadroAnimationSnapshot(
      canvas,
      object
    )

  previewingObjects.add(
    object
  )

  setMAQuadroAnimationPreviewInteractivity(
    object,
    false
  )

  try {
    applyMAQuadroObjectAnimationProgress(
      canvas,
      object,
      animation,
      snapshot,
      0
    )

    await waitForDelay(
      animation.delayMs,
      signal
    )

    await animateProgress(
      animation.durationMs,

      (
        progress
      ) => {
        applyMAQuadroObjectAnimationProgress(
          canvas,
          object,
          animation,
          snapshot,
          progress
        )
      },

      signal
    )

    return true
  } catch (
    error
  ) {
    if (
      signal?.aborted ||
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
    restoreMAQuadroAnimationSnapshot(
      canvas,
      object,
      snapshot
    )

    previewingObjects.delete(
      object
    )
  }
}

export async function
previewMAQuadroSelectedObjectAnimation() {
  const canvas =
    animationCanvas

  const object =
    getSingleSelectedObject(
      canvas
    )

  if (
    !canvas ||
    !object
  ) {
    return false
  }

  return previewMAQuadroObjectAnimation(
    canvas,
    object,
    getMAQuadroObjectAnimation(
      object
    )
  )
}

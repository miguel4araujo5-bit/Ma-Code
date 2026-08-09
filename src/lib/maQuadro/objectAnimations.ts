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
}

type MAQuadroAnimatedFabricObject =
  MAQuadroFabricObject & {
    maAnimationKind?:
      MAQuadroAnimationKind

    maAnimationPhase?:
      MAQuadroAnimationPhase

    maAnimationDurationMs?:
      number
  }

type MAQuadroCanvasPrototype = {
  getActiveObject:
    Canvas['getActiveObject']

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
  MA_QUADRO_DEFAULT_ANIMATION:
    MAQuadroObjectAnimation = {
      kind:
        'none',

      phase:
        'in',

      durationMs:
        700
    }

const animationCustomProperties = [
  'maAnimationKind',
  'maAnimationPhase',
  'maAnimationDurationMs'
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
              .durationMs
    }

  if (
    current.kind ===
      next.kind &&
    current.phase ===
      next.phase &&
    current.durationMs ===
      next.durationMs
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
    )
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

  const original = {
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
      object.hasControls
  }

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

  const duration =
    clampDuration(
      animation
        .durationMs
    )

  previewingObjects.add(
    object
  )

  object.set({
    selectable:
      false,

    evented:
      false,

    hasControls:
      false
  })

  const renderFrame = (
    rawProgress:
      number
  ) => {
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
      'fade'
    ) {
      object.set({
        opacity:
          original.opacity *
          visible
      })
    } else if (
      animation.kind ===
      'slide'
    ) {
      object.set({
        top:
          original.top +
          slideDistance *
          (
            1 -
            visible
          ),

        opacity:
          original.opacity *
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
        scaleX:
          original.scaleX *
          factor,

        scaleY:
          original.scaleY *
          factor,

        opacity:
          original.opacity *
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
        scaleX:
          original.scaleX *
          factor,

        scaleY:
          original.scaleY *
          factor,

        opacity:
          original.opacity *
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

  try {
    await new Promise<
      void
    >(
      (
        resolve
      ) => {
        const startedAt =
          performance.now()

        const frame = (
          now:
            number
        ) => {
          const progress =
            clamp(
              (
                now -
                startedAt
              ) /
              duration,
              0,
              1
            )

          renderFrame(
            progress
          )

          if (
            progress >=
            1
          ) {
            resolve()

            return
          }

          window
            .requestAnimationFrame(
              frame
            )
        }

        window
          .requestAnimationFrame(
            frame
          )
      }
    )
  } finally {
    object.set({
      left:
        original.left,

      top:
        original.top,

      scaleX:
        original.scaleX,

      scaleY:
        original.scaleY,

      opacity:
        original.opacity,

      selectable:
        original.selectable,

      evented:
        original.evented,

      hasControls:
        original.hasControls
    })

    object
      .setCoords()

    object.dirty =
      true

    canvas
      .requestRenderAll()

    previewingObjects.delete(
      object
    )
  }

  return true
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

import { FabricObject, type Canvas } from 'fabric'

import type {
  MAQuadroBackground,
  MAQuadroPage
} from '../../types/maQuadro'

import {
  applyMAQuadroPageBackground,
  createMAQuadroBackgroundFill,
  MA_QUADRO_SERIALIZED_PROPERTIES,
  type MAQuadroFabricObject
} from './canvasObjects'

import {
  renderMAQuadroPageDataUrl
} from './export'

export type MAQuadroMatchMoveMode =
  | 'move'
  | 'enter'
  | 'anchor'

export type MAQuadroMatchMoveSnapshot = {
  mode: MAQuadroMatchMoveMode
  fromLeft: number
  fromTop: number
  fromScaleX: number
  fromScaleY: number
  fromAngle: number
  fromOpacity: number
  toLeft: number
  toTop: number
  toScaleX: number
  toScaleY: number
  toAngle: number
  toOpacity: number
  durationMs: number
}

type MAQuadroMatchMoveObject =
  MAQuadroFabricObject & {
    maMatchMoveEnabled?: boolean
    maMatchMoveMode?: MAQuadroMatchMoveMode
    maMatchMoveFromLeft?: number
    maMatchMoveFromTop?: number
    maMatchMoveFromScaleX?: number
    maMatchMoveFromScaleY?: number
    maMatchMoveFromAngle?: number
    maMatchMoveFromOpacity?: number
    maMatchMoveDurationMs?: number
    maMatchMoveSourcePageId?: string
    maMatchMoveTargetPageId?: string
  }

type SerializedObject =
  Record<string, unknown>

type ObjectMatch = {
  current: MAQuadroFabricObject
  source: SerializedObject
  mode:
    | 'id'
    | 'name'
}

type Rgba = {
  red: number
  green: number
  blue: number
  alpha: number
}

type BackgroundStops = {
  from: Rgba
  to: Rgba
  angle: number
}

type CanvasObservable = {
  on: (
    eventName: string,
    handler: () => void
  ) => unknown

  off: (
    eventName: string,
    handler: () => void
  ) => unknown
}

type CanvasWithContext =
  Canvas & {
    getContext?: () =>
      CanvasRenderingContext2D

    contextContainer?:
      CanvasRenderingContext2D
  }

export type MAQuadroMatchMoveApplyResult = {
  matched: number
  animated: number
  matchedById: number
  matchedByName: number
  entering: number
  exiting: number
  backgroundChanged: boolean
}

export type MAQuadroMatchMoveTransitionVisuals = {
  durationMs: number

  setProgress: (
    progress: number
  ) => void

  dispose: () => void
}

export const
  MA_QUADRO_MATCH_MOVE_MIN_DURATION_MS =
    300

export const
  MA_QUADRO_MATCH_MOVE_MAX_DURATION_MS =
    2500

export const
  MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS =
    800

const MATCH_MOVE_PROPERTIES = [
  'maMatchMoveEnabled',
  'maMatchMoveMode',
  'maMatchMoveFromLeft',
  'maMatchMoveFromTop',
  'maMatchMoveFromScaleX',
  'maMatchMoveFromScaleY',
  'maMatchMoveFromAngle',
  'maMatchMoveFromOpacity',
  'maMatchMoveDurationMs',
  'maMatchMoveSourcePageId',
  'maMatchMoveTargetPageId'
]

const fabricObjectClass =
  FabricObject as unknown as {
    customProperties: string[]
  }

fabricObjectClass.customProperties =
  Array.from(
    new Set([
      ...(
        fabricObjectClass
          .customProperties ||
        []
      ),
      ...MATCH_MOVE_PROPERTIES
    ])
  )

for (
  const property
  of MATCH_MOVE_PROPERTIES
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

let pageResolver:
  | (
      (
        pageId: string
      ) =>
        MAQuadroPage |
        undefined
    )
  | null =
    null

export function
setMAQuadroMatchMovePageResolver(
  resolver:
    | (
        (
          pageId: string
        ) =>
          MAQuadroPage |
          undefined
      )
    | null
) {
  pageResolver =
    resolver
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
      Number.isFinite(
        value
      )
        ? value
        : minimum
    )
  )
}

function clampDuration(
  value: number
) {
  return Math.round(
    clamp(
      value,
      MA_QUADRO_MATCH_MOVE_MIN_DURATION_MS,
      MA_QUADRO_MATCH_MOVE_MAX_DURATION_MS
    )
  )
}

function numberValue(
  value: unknown,
  fallback: number
) {
  const numeric =
    Number(
      value
    )

  return Number.isFinite(
    numeric
  )
    ? numeric
    : fallback
}

function stringValue(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
    : ''
}

function normalizeName(
  value: unknown
) {
  return stringValue(
    value
  )
    .trim()
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLocaleLowerCase(
      'pt-PT'
    )
}

function objectRoleKey(
  name: unknown,
  role: unknown
) {
  const normalizedName =
    normalizeName(
      name
    )

  const normalizedRole =
    normalizeName(
      role
    )

  if (
    !normalizedName ||
    !normalizedRole
  ) {
    return ''
  }

  return `${normalizedRole}::${normalizedName}`
}

function serializedObjects(
  page:
    MAQuadroPage
) {
  return Array.isArray(
    page.canvasJson
      .objects
  )
    ? page.canvasJson
        .objects
        .filter(
          (
            value
          ):
            value is
              SerializedObject =>
            Boolean(
              value
            ) &&
            typeof value ===
              'object'
        )
    : []
}

function currentObjectKey(
  object:
    MAQuadroFabricObject
) {
  return objectRoleKey(
    object.maName,
    object.maRole
  )
}

function serializedObjectKey(
  object:
    SerializedObject
) {
  return objectRoleKey(
    object.maName,
    object.maRole
  )
}

function createObjectMatches(
  currentObjects:
    MAQuadroFabricObject[],
  sourceObjects:
    SerializedObject[]
) {
  const sourceById =
    new Map<
      string,
      SerializedObject
    >()

  const sourceByKey =
    new Map<
      string,
      SerializedObject[]
    >()

  const currentKeyCounts =
    new Map<
      string,
      number
    >()

  for (
    const source
    of sourceObjects
  ) {
    const sourceId =
      stringValue(
        source.maId
      )

    if (
      sourceId
    ) {
      sourceById.set(
        sourceId,
        source
      )
    }

    const key =
      serializedObjectKey(
        source
      )

    if (
      key
    ) {
      const items =
        sourceByKey.get(
          key
        ) ||
        []

      items.push(
        source
      )

      sourceByKey.set(
        key,
        items
      )
    }
  }

  for (
    const object
    of currentObjects
  ) {
    const key =
      currentObjectKey(
        object
      )

    if (
      key
    ) {
      currentKeyCounts.set(
        key,
        (
          currentKeyCounts.get(
            key
          ) ||
          0
        ) +
        1
      )
    }
  }

  const usedSources =
    new Set<
      SerializedObject
    >()

  const matches:
    ObjectMatch[] =
    []

  for (
    const current
    of currentObjects
  ) {
    let source:
      SerializedObject |
      undefined

    let mode:
      | 'id'
      | 'name'
      | null =
      null

    const currentId =
      stringValue(
        current.maId
      )

    if (
      currentId
    ) {
      const byId =
        sourceById.get(
          currentId
        )

      if (
        byId &&
        !usedSources.has(
          byId
        )
      ) {
        source =
          byId

        mode =
          'id'
      }
    }

    if (
      !source
    ) {
      const key =
        currentObjectKey(
          current
        )

      const candidates =
        key
          ? sourceByKey.get(
              key
            ) ||
            []
          : []

      if (
        key &&
        currentKeyCounts.get(
          key
        ) ===
          1 &&
        candidates.length ===
          1 &&
        !usedSources.has(
          candidates[0]
        )
      ) {
        source =
          candidates[0]

        mode =
          'name'
      }
    }

    if (
      !source ||
      !mode
    ) {
      continue
    }

    usedSources.add(
      source
    )

    matches.push({
      current,
      source,
      mode
    })
  }

  return {
    matches,
    usedSources
  }
}

function shortestAngleDelta(
  from: number,
  to: number
) {
  let delta =
    (
      to -
      from
    ) %
    360

  if (
    delta >
    180
  ) {
    delta -=
      360
  } else if (
    delta <
    -180
  ) {
    delta +=
      360
  }

  return delta
}

function easeInOutCubic(
  value: number
) {
  const safe =
    clamp(
      value,
      0,
      1
    )

  return safe <
    0.5
    ? 4 *
        safe *
        safe *
        safe
    : 1 -
        Math.pow(
          -2 *
            safe +
            2,
          3
        ) /
        2
}

function lerp(
  from: number,
  to: number,
  progress: number
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

function hasVisibleDifference(
  fromLeft: number,
  fromTop: number,
  fromScaleX: number,
  fromScaleY: number,
  fromAngle: number,
  fromOpacity: number,
  object:
    MAQuadroFabricObject
) {
  const toLeft =
    numberValue(
      object.left,
      0
    )

  const toTop =
    numberValue(
      object.top,
      0
    )

  const toScaleX =
    numberValue(
      object.scaleX,
      1
    )

  const toScaleY =
    numberValue(
      object.scaleY,
      1
    )

  const toAngle =
    numberValue(
      object.angle,
      0
    )

  const toOpacity =
    numberValue(
      object.opacity,
      1
    )

  return (
    Math.abs(
      fromLeft -
      toLeft
    ) >
      0.5 ||
    Math.abs(
      fromTop -
      toTop
    ) >
      0.5 ||
    Math.abs(
      fromScaleX -
      toScaleX
    ) >
      0.005 ||
    Math.abs(
      fromScaleY -
      toScaleY
    ) >
      0.005 ||
    Math.abs(
      shortestAngleDelta(
        fromAngle,
        toAngle
      )
    ) >
      0.5 ||
    Math.abs(
      fromOpacity -
      toOpacity
    ) >
      0.01
  )
}

function backgroundChanged(
  sourcePage:
    MAQuadroPage,
  targetPage?:
    MAQuadroPage
) {
  if (
    !targetPage
  ) {
    return false
  }

  return (
    JSON.stringify(
      sourcePage.background
    ) !==
    JSON.stringify(
      targetPage.background
    )
  )
}

function clearObjectMatchMove(
  object:
    MAQuadroMatchMoveObject
) {
  const hadMatch =
    Boolean(
      object
        .maMatchMoveEnabled
    )

  object.maMatchMoveEnabled =
    false

  object.maMatchMoveMode =
    undefined

  object.maMatchMoveFromLeft =
    undefined

  object.maMatchMoveFromTop =
    undefined

  object.maMatchMoveFromScaleX =
    undefined

  object.maMatchMoveFromScaleY =
    undefined

  object.maMatchMoveFromAngle =
    undefined

  object.maMatchMoveFromOpacity =
    undefined

  object.maMatchMoveDurationMs =
    undefined

  object.maMatchMoveSourcePageId =
    undefined

  object.maMatchMoveTargetPageId =
    undefined

  if (
    hadMatch
  ) {
    object.dirty =
      true
  }

  return hadMatch
}

function fireCanvasModified(
  canvas:
    Canvas,
  object:
    | MAQuadroFabricObject
    | undefined
) {
  if (
    !object
  ) {
    return
  }

  const observable =
    canvas as unknown as {
      fire: (
        eventName: string,
        payload?: unknown
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

function setObjectTransition(
  object:
    MAQuadroFabricObject,
  values: {
    mode:
      MAQuadroMatchMoveMode

    fromLeft:
      number

    fromTop:
      number

    fromScaleX:
      number

    fromScaleY:
      number

    fromAngle:
      number

    fromOpacity:
      number

    durationMs:
      number

    sourcePageId:
      string

    targetPageId?:
      string
  }
) {
  const matchObject =
    object as
      MAQuadroMatchMoveObject

  matchObject.maMatchMoveEnabled =
    true

  matchObject.maMatchMoveMode =
    values.mode

  matchObject.maMatchMoveFromLeft =
    values.fromLeft

  matchObject.maMatchMoveFromTop =
    values.fromTop

  matchObject.maMatchMoveFromScaleX =
    values.fromScaleX

  matchObject.maMatchMoveFromScaleY =
    values.fromScaleY

  matchObject.maMatchMoveFromAngle =
    values.fromAngle

  matchObject.maMatchMoveFromOpacity =
    values.fromOpacity

  matchObject.maMatchMoveDurationMs =
    values.durationMs

  matchObject.maMatchMoveSourcePageId =
    values.sourcePageId

  matchObject.maMatchMoveTargetPageId =
    values.targetPageId

  object.dirty =
    true
}

function firstTransitionObject(
  canvas:
    Canvas
) {
  return (
    canvas
      .getObjects() as
      MAQuadroFabricObject[]
  ).find(
    (
      object
    ) =>
      Boolean(
        (
          object as
            MAQuadroMatchMoveObject
        )
          .maMatchMoveEnabled
      )
  ) as
    | MAQuadroMatchMoveObject
    | undefined
}

export function
getMAQuadroMatchMoveSourcePageId(
  canvas:
    Canvas
) {
  return (
    firstTransitionObject(
      canvas
    )
      ?.maMatchMoveSourcePageId ||
    ''
  )
}

export function
getMAQuadroMatchMoveTargetPageId(
  canvas:
    Canvas
) {
  return (
    firstTransitionObject(
      canvas
    )
      ?.maMatchMoveTargetPageId ||
    ''
  )
}

export function
getMAQuadroMatchMoveSnapshot(
  object:
    MAQuadroFabricObject
):
  MAQuadroMatchMoveSnapshot |
  null {
  const matchObject =
    object as
      MAQuadroMatchMoveObject

  if (
    !matchObject
      .maMatchMoveEnabled
  ) {
    return null
  }

  const fromLeft =
    Number(
      matchObject
        .maMatchMoveFromLeft
    )

  const fromTop =
    Number(
      matchObject
        .maMatchMoveFromTop
    )

  const fromScaleX =
    Number(
      matchObject
        .maMatchMoveFromScaleX
    )

  const fromScaleY =
    Number(
      matchObject
        .maMatchMoveFromScaleY
    )

  const fromAngle =
    Number(
      matchObject
        .maMatchMoveFromAngle
    )

  const fromOpacity =
    Number(
      matchObject
        .maMatchMoveFromOpacity
    )

  if (
    ![
      fromLeft,
      fromTop,
      fromScaleX,
      fromScaleY,
      fromAngle,
      fromOpacity
    ].every(
      Number.isFinite
    )
  ) {
    return null
  }

  return {
    mode:
      matchObject
        .maMatchMoveMode ===
        'enter' ||
      matchObject
        .maMatchMoveMode ===
        'anchor'
        ? matchObject
            .maMatchMoveMode
        : 'move',

    fromLeft,
    fromTop,
    fromScaleX,
    fromScaleY,
    fromAngle,
    fromOpacity,

    toLeft:
      numberValue(
        object.left,
        0
      ),

    toTop:
      numberValue(
        object.top,
        0
      ),

    toScaleX:
      numberValue(
        object.scaleX,
        1
      ),

    toScaleY:
      numberValue(
        object.scaleY,
        1
      ),

    toAngle:
      numberValue(
        object.angle,
        0
      ),

    toOpacity:
      numberValue(
        object.opacity,
        1
      ),

    durationMs:
      clampDuration(
        numberValue(
          matchObject
            .maMatchMoveDurationMs,
          MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS
        )
      )
  }
}

export function
countMAQuadroMatchMoveObjects(
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
    ) =>
      Boolean(
        getMAQuadroMatchMoveSnapshot(
          object
        )
      )
  ).length
}

export function
applyMAQuadroMatchMoveProgress(
  canvas:
    Canvas,
  object:
    MAQuadroFabricObject,
  snapshot:
    MAQuadroMatchMoveSnapshot,
  rawProgress:
    number
) {
  const progress =
    easeInOutCubic(
      rawProgress
    )

  const angleDelta =
    shortestAngleDelta(
      snapshot.fromAngle,
      snapshot.toAngle
    )

  object.set({
    left:
      lerp(
        snapshot.fromLeft,
        snapshot.toLeft,
        progress
      ),

    top:
      lerp(
        snapshot.fromTop,
        snapshot.toTop,
        progress
      ),

    scaleX:
      lerp(
        snapshot.fromScaleX,
        snapshot.toScaleX,
        progress
      ),

    scaleY:
      lerp(
        snapshot.fromScaleY,
        snapshot.toScaleY,
        progress
      ),

    angle:
      snapshot.fromAngle +
      angleDelta *
        progress,

    opacity:
      lerp(
        snapshot.fromOpacity,
        snapshot.toOpacity,
        progress
      )
  })

  object.setCoords()
  object.dirty =
    true

  canvas.requestRenderAll()
}

export function
restoreMAQuadroMatchMoveSnapshot(
  canvas:
    Canvas,
  object:
    MAQuadroFabricObject,
  snapshot:
    MAQuadroMatchMoveSnapshot
) {
  object.set({
    left:
      snapshot.toLeft,

    top:
      snapshot.toTop,

    scaleX:
      snapshot.toScaleX,

    scaleY:
      snapshot.toScaleY,

    angle:
      snapshot.toAngle,

    opacity:
      snapshot.toOpacity
  })

  object.setCoords()
  object.dirty =
    true

  canvas.requestRenderAll()
}

export function
clearMAQuadroMatchMove(
  canvas:
    Canvas,
  emitChange =
    true
) {
  const objects =
    canvas
      .getObjects() as
      MAQuadroFabricObject[]

  let changedObject:
    | MAQuadroFabricObject
    | undefined

  let cleared =
    0

  for (
    const object
    of objects
  ) {
    if (
      clearObjectMatchMove(
        object as
          MAQuadroMatchMoveObject
      )
    ) {
      cleared +=
        1

      changedObject ||=
        object
    }
  }

  if (
    cleared >
    0
  ) {
    canvas.requestRenderAll()

    if (
      emitChange
    ) {
      fireCanvasModified(
        canvas,
        changedObject
      )
    }
  }

  return cleared
}

export function
applyMAQuadroMatchMoveFromPage(
  canvas:
    Canvas,
  sourcePage:
    MAQuadroPage,
  durationMs =
    MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS,
  targetPage?:
    MAQuadroPage
):
  MAQuadroMatchMoveApplyResult {
  const currentObjects =
    canvas
      .getObjects() as
      MAQuadroFabricObject[]

  const sourceObjects =
    serializedObjects(
      sourcePage
    )

  const duration =
    clampDuration(
      durationMs
    )

  const {
    matches,
    usedSources
  } =
    createObjectMatches(
      currentObjects,
      sourceObjects
    )

  const matchedCurrent =
    new Set(
      matches.map(
        (
          match
        ) =>
          match.current
      )
    )

  const ratioX =
    canvas.getWidth() /
    Math.max(
      1,
      sourcePage.width
    )

  const ratioY =
    canvas.getHeight() /
    Math.max(
      1,
      sourcePage.height
    )

  const targetPageId =
    targetPage?.id

  const didBackgroundChange =
    backgroundChanged(
      sourcePage,
      targetPage
    )

  const exiting =
    sourceObjects.length -
    usedSources.size

  const clearedBeforeApply =
    clearMAQuadroMatchMove(
      canvas,
      false
    )

  let animated =
    0

  let matchedById =
    0

  let matchedByName =
    0

  let entering =
    0

  let changedObject:
    | MAQuadroFabricObject
    | undefined

  for (
    const match
    of matches
  ) {
    if (
      match.mode ===
      'id'
    ) {
      matchedById +=
        1
    } else {
      matchedByName +=
        1
    }

    const fromLeft =
      numberValue(
        match.source.left,
        0
      ) *
      ratioX

    const fromTop =
      numberValue(
        match.source.top,
        0
      ) *
      ratioY

    const fromScaleX =
      numberValue(
        match.source.scaleX,
        1
      ) *
      ratioX

    const fromScaleY =
      numberValue(
        match.source.scaleY,
        1
      ) *
      ratioY

    const fromAngle =
      numberValue(
        match.source.angle,
        0
      )

    const fromOpacity =
      clamp(
        numberValue(
          match.source.opacity,
          1
        ),
        0,
        1
      )

    if (
      !hasVisibleDifference(
        fromLeft,
        fromTop,
        fromScaleX,
        fromScaleY,
        fromAngle,
        fromOpacity,
        match.current
      )
    ) {
      continue
    }

    setObjectTransition(
      match.current,
      {
        mode:
          'move',

        fromLeft,
        fromTop,
        fromScaleX,
        fromScaleY,
        fromAngle,
        fromOpacity,

        durationMs:
          duration,

        sourcePageId:
          sourcePage.id,

        targetPageId
      }
    )

    animated +=
      1

    changedObject ||=
      match.current
  }

  for (
    const object
    of currentObjects
  ) {
    if (
      matchedCurrent.has(
        object
      )
    ) {
      continue
    }

    const toScaleX =
      numberValue(
        object.scaleX,
        1
      )

    const toScaleY =
      numberValue(
        object.scaleY,
        1
      )

    const toTop =
      numberValue(
        object.top,
        0
      )

    setObjectTransition(
      object,
      {
        mode:
          'enter',

        fromLeft:
          numberValue(
            object.left,
            0
          ),

        fromTop:
          toTop +
          canvas.getHeight() *
            0.018,

        fromScaleX:
          toScaleX *
          0.94,

        fromScaleY:
          toScaleY *
          0.94,

        fromAngle:
          numberValue(
            object.angle,
            0
          ),

        fromOpacity:
          0,

        durationMs:
          duration,

        sourcePageId:
          sourcePage.id,

        targetPageId
      }
    )

    entering +=
      1

    animated +=
      1

    changedObject ||=
      object
  }

  if (
    animated ===
      0 &&
    (
      exiting >
        0 ||
      didBackgroundChange
    ) &&
    currentObjects.length >
      0
  ) {
    const anchor =
      currentObjects[0]

    setObjectTransition(
      anchor,
      {
        mode:
          'anchor',

        fromLeft:
          numberValue(
            anchor.left,
            0
          ),

        fromTop:
          numberValue(
            anchor.top,
            0
          ),

        fromScaleX:
          numberValue(
            anchor.scaleX,
            1
          ),

        fromScaleY:
          numberValue(
            anchor.scaleY,
            1
          ),

        fromAngle:
          numberValue(
            anchor.angle,
            0
          ),

        fromOpacity:
          numberValue(
            anchor.opacity,
            1
          ),

        durationMs:
          duration,

        sourcePageId:
          sourcePage.id,

        targetPageId
      }
    )

    changedObject ||=
      anchor
  }

  canvas.requestRenderAll()

  if (
    !changedObject &&
    clearedBeforeApply >
      0
  ) {
    changedObject =
      currentObjects[0]
  }

  if (
    changedObject
  ) {
    fireCanvasModified(
      canvas,
      changedObject
    )
  }

  return {
    matched:
      matches.length,

    animated,

    matchedById,

    matchedByName,

    entering,

    exiting,

    backgroundChanged:
      didBackgroundChange
  }
}

function parseColor(
  value: string,
  transparent =
    false
):
  Rgba {
  const trimmed =
    value.trim()

  if (
    transparent ||
    trimmed ===
      'transparent' ||
    trimmed ===
      ''
  ) {
    return {
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0
    }
  }

  const hex =
    trimmed.match(
      /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
    )

  if (
    hex
  ) {
    const raw =
      hex[1].length ===
        3
        ? hex[1]
            .split(
              ''
            )
            .map(
              (
                character
              ) =>
                character +
                character
            )
            .join(
              ''
            )
        : hex[1]

    return {
      red:
        Number.parseInt(
          raw.slice(
            0,
            2
          ),
          16
        ),

      green:
        Number.parseInt(
          raw.slice(
            2,
            4
          ),
          16
        ),

      blue:
        Number.parseInt(
          raw.slice(
            4,
            6
          ),
          16
        ),

      alpha:
        1
    }
  }

  const rgb =
    trimmed.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
    )

  if (
    rgb
  ) {
    return {
      red:
        clamp(
          Number(
            rgb[1]
          ),
          0,
          255
        ),

      green:
        clamp(
          Number(
            rgb[2]
          ),
          0,
          255
        ),

      blue:
        clamp(
          Number(
            rgb[3]
          ),
          0,
          255
        ),

      alpha:
        clamp(
          rgb[4] ===
            undefined
            ? 1
            : Number(
                rgb[4]
              ),
          0,
          1
        )
    }
  }

  return {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1
  }
}

function backgroundStops(
  background:
    MAQuadroBackground
):
  BackgroundStops {
  if (
    background.type ===
    'transparent'
  ) {
    const transparent =
      parseColor(
        '',
        true
      )

    return {
      from:
        transparent,

      to:
        transparent,

      angle:
        0
    }
  }

  if (
    background.type ===
    'solid'
  ) {
    const color =
      parseColor(
        background.color
      )

    return {
      from:
        color,

      to:
        color,

      angle:
        0
    }
  }

  return {
    from:
      parseColor(
        background
          .gradientFrom
      ),

    to:
      parseColor(
        background
          .gradientTo
      ),

    angle:
      numberValue(
        background
          .gradientAngle,
        0
      )
  }
}

function mixColor(
  from:
    Rgba,
  to:
    Rgba,
  progress:
    number
) {
  const safe =
    clamp(
      progress,
      0,
      1
    )

  const red =
    Math.round(
      lerp(
        from.red,
        to.red,
        safe
      )
    )

  const green =
    Math.round(
      lerp(
        from.green,
        to.green,
        safe
      )
    )

  const blue =
    Math.round(
      lerp(
        from.blue,
        to.blue,
        safe
      )
    )

  const alpha =
    clamp(
      lerp(
        from.alpha,
        to.alpha,
        safe
      ),
      0,
      1
    )

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(4)})`
}

function mixAngle(
  from: number,
  to: number,
  progress: number
) {
  return (
    from +
    shortestAngleDelta(
      from,
      to
    ) *
      clamp(
        progress,
        0,
        1
      )
  )
}

function interpolatedBackground(
  source:
    MAQuadroBackground,
  target:
    MAQuadroBackground,
  progress:
    number
):
  MAQuadroBackground {
  const from =
    backgroundStops(
      source
    )

  const to =
    backgroundStops(
      target
    )

  const safe =
    clamp(
      progress,
      0,
      1
    )

  return {
    type:
      'gradient',

    color:
      mixColor(
        from.from,
        to.from,
        safe
      ),

    gradientFrom:
      mixColor(
        from.from,
        to.from,
        safe
      ),

    gradientTo:
      mixColor(
        from.to,
        to.to,
        safe
      ),

    gradientAngle:
      mixAngle(
        from.angle,
        to.angle,
        safe
      )
  }
}

function createOutgoingPage(
  canvas:
    Canvas,
  sourcePage:
    MAQuadroPage
) {
  const currentObjects =
    canvas
      .getObjects() as
      MAQuadroFabricObject[]

  const sourceObjects =
    serializedObjects(
      sourcePage
    )

  const {
    usedSources
  } =
    createObjectMatches(
      currentObjects,
      sourceObjects
    )

  const outgoingObjects =
    sourceObjects.filter(
      (
        source
      ) =>
        !usedSources.has(
          source
        )
    )

  if (
    outgoingObjects.length ===
    0
  ) {
    return null
  }

  return {
    ...sourcePage,

    background: {
      ...sourcePage.background,
      type:
        'transparent'
    },

    canvasJson: {
      ...sourcePage.canvasJson,
      objects:
        outgoingObjects
    },

    thumbnail:
      undefined
  } satisfies
    MAQuadroPage
}

function loadHtmlImage(
  source:
    string
) {
  return new Promise<
    HTMLImageElement
  >(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image()

      image.decoding =
        'async'

      image.onload =
        () =>
          resolve(
            image
          )

      image.onerror =
        () =>
          reject(
            new Error(
              'Não foi possível preparar os elementos de saída do Match & Move.'
            )
          )

      image.src =
        source
    }
  )
}

function canvasContext(
  canvas:
    Canvas
) {
  const candidate =
    canvas as
      CanvasWithContext

  return (
    candidate
      .getContext?.() ||
    candidate
      .contextContainer ||
    null
  )
}

export async function
prepareMAQuadroMatchMoveTransitionVisuals(
  canvas:
    Canvas
):
  Promise<
    | MAQuadroMatchMoveTransitionVisuals
    | null
  > {
  const sourcePageId =
    getMAQuadroMatchMoveSourcePageId(
      canvas
    )

  const targetPageId =
    getMAQuadroMatchMoveTargetPageId(
      canvas
    )

  if (
    !sourcePageId ||
    !targetPageId ||
    !pageResolver
  ) {
    return null
  }

  const sourcePage =
    pageResolver(
      sourcePageId
    )

  const targetPage =
    pageResolver(
      targetPageId
    )

  if (
    !sourcePage ||
    !targetPage ||
    sourcePage.id ===
      targetPage.id
  ) {
    return null
  }

  const outgoingPage =
    createOutgoingPage(
      canvas,
      sourcePage
    )

  const didBackgroundChange =
    backgroundChanged(
      sourcePage,
      targetPage
    )

  if (
    !outgoingPage &&
    !didBackgroundChange
  ) {
    return null
  }

  let outgoingImage:
    | HTMLImageElement
    | null =
    null

  if (
    outgoingPage
  ) {
    const dataUrl =
      await renderMAQuadroPageDataUrl(
        outgoingPage,
        'png',
        1
      )

    outgoingImage =
      await loadHtmlImage(
        dataUrl
      )
  }

  const observable =
    canvas as unknown as
      CanvasObservable

  const context =
    canvasContext(
      canvas
    )

  let progress =
    0

  const renderOutgoing =
    () => {
      if (
        !outgoingImage ||
        !context
      ) {
        return
      }

      const alpha =
        clamp(
          1 -
            easeInOutCubic(
              progress
            ),
          0,
          1
        )

      if (
        alpha <=
        0.001
      ) {
        return
      }

      context.save()

      context.globalAlpha =
        alpha

      context.imageSmoothingEnabled =
        true

      context.imageSmoothingQuality =
        'high'

      context.drawImage(
        outgoingImage,
        0,
        0,
        canvas.getWidth(),
        canvas.getHeight()
      )

      context.restore()
    }

  observable.on(
    'after:render',
    renderOutgoing
  )

  const durationMs =
    Math.max(
      MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS,

      ...(
        canvas
          .getObjects() as
          MAQuadroFabricObject[]
      ).map(
        (
          object
        ) =>
          getMAQuadroMatchMoveSnapshot(
            object
          )
            ?.durationMs ||
          0
      )
    )

  const setProgress =
    (
      nextProgress:
        number
    ) => {
      progress =
        clamp(
          nextProgress,
          0,
          1
        )

      if (
        didBackgroundChange
      ) {
        canvas.backgroundColor =
          createMAQuadroBackgroundFill(
            interpolatedBackground(
              sourcePage.background,
              targetPage.background,
              easeInOutCubic(
                progress
              )
            ),
            canvas.getWidth(),
            canvas.getHeight()
          )
      }

      canvas.requestRenderAll()
    }

  setProgress(
    0
  )

  return {
    durationMs,

    setProgress,

    dispose:
      () => {
        observable.off(
          'after:render',
          renderOutgoing
        )

        applyMAQuadroPageBackground(
          canvas,
          targetPage
        )

        canvas.requestRenderAll()

        outgoingImage =
          null
      }
  }
}

import { FabricObject, type Canvas } from 'fabric'

import type { MAQuadroPage } from '../../types/maQuadro'

import {
  MA_QUADRO_SERIALIZED_PROPERTIES,
  type MAQuadroFabricObject
} from './canvasObjects'

export type MAQuadroMatchMoveSnapshot = {
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

type MAQuadroMatchMoveObject = MAQuadroFabricObject & {
  maMatchMoveEnabled?: boolean
  maMatchMoveFromLeft?: number
  maMatchMoveFromTop?: number
  maMatchMoveFromScaleX?: number
  maMatchMoveFromScaleY?: number
  maMatchMoveFromAngle?: number
  maMatchMoveFromOpacity?: number
  maMatchMoveDurationMs?: number
  maMatchMoveSourcePageId?: string
}

type SerializedObject = Record<string, unknown>

export type MAQuadroMatchMoveApplyResult = {
  matched: number
  animated: number
  matchedById: number
  matchedByName: number
}

export const MA_QUADRO_MATCH_MOVE_MIN_DURATION_MS = 300
export const MA_QUADRO_MATCH_MOVE_MAX_DURATION_MS = 2500
export const MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS = 800

const MATCH_MOVE_PROPERTIES = [
  'maMatchMoveEnabled',
  'maMatchMoveFromLeft',
  'maMatchMoveFromTop',
  'maMatchMoveFromScaleX',
  'maMatchMoveFromScaleY',
  'maMatchMoveFromAngle',
  'maMatchMoveFromOpacity',
  'maMatchMoveDurationMs',
  'maMatchMoveSourcePageId'
]

const fabricObjectClass = FabricObject as unknown as {
  customProperties: string[]
}

fabricObjectClass.customProperties = Array.from(
  new Set([
    ...(fabricObjectClass.customProperties || []),
    ...MATCH_MOVE_PROPERTIES
  ])
)

for (const property of MATCH_MOVE_PROPERTIES) {
  if (!MA_QUADRO_SERIALIZED_PROPERTIES.includes(property)) {
    MA_QUADRO_SERIALIZED_PROPERTIES.push(property)
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? value : minimum)
  )
}

function clampDuration(value: number) {
  return Math.round(
    clamp(
      value,
      MA_QUADRO_MATCH_MOVE_MIN_DURATION_MS,
      MA_QUADRO_MATCH_MOVE_MAX_DURATION_MS
    )
  )
}

function numberValue(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeName(value: unknown) {
  return stringValue(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function objectRoleKey(name: unknown, role: unknown) {
  const normalizedName = normalizeName(name)
  const normalizedRole = normalizeName(role)

  if (!normalizedName || !normalizedRole) {
    return ''
  }

  return `${normalizedRole}::${normalizedName}`
}

function serializedObjects(page: MAQuadroPage) {
  return Array.isArray(page.canvasJson.objects)
    ? page.canvasJson.objects.filter(
        (value): value is SerializedObject =>
          Boolean(value) && typeof value === 'object'
      )
    : []
}

function currentObjectKey(object: MAQuadroFabricObject) {
  return objectRoleKey(object.maName, object.maRole)
}

function serializedObjectKey(object: SerializedObject) {
  return objectRoleKey(object.maName, object.maRole)
}

function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % 360

  if (delta > 180) {
    delta -= 360
  } else if (delta < -180) {
    delta += 360
  }

  return delta
}

function easeInOutCubic(value: number) {
  const safe = clamp(value, 0, 1)

  return safe < 0.5
    ? 4 * safe * safe * safe
    : 1 - Math.pow(-2 * safe + 2, 3) / 2
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

function hasVisibleDifference(
  fromLeft: number,
  fromTop: number,
  fromScaleX: number,
  fromScaleY: number,
  fromAngle: number,
  fromOpacity: number,
  object: MAQuadroFabricObject
) {
  const toLeft = numberValue(object.left, 0)
  const toTop = numberValue(object.top, 0)
  const toScaleX = numberValue(object.scaleX, 1)
  const toScaleY = numberValue(object.scaleY, 1)
  const toAngle = numberValue(object.angle, 0)
  const toOpacity = numberValue(object.opacity, 1)

  return (
    Math.abs(fromLeft - toLeft) > 0.5 ||
    Math.abs(fromTop - toTop) > 0.5 ||
    Math.abs(fromScaleX - toScaleX) > 0.005 ||
    Math.abs(fromScaleY - toScaleY) > 0.005 ||
    Math.abs(shortestAngleDelta(fromAngle, toAngle)) > 0.5 ||
    Math.abs(fromOpacity - toOpacity) > 0.01
  )
}

function clearObjectMatchMove(object: MAQuadroMatchMoveObject) {
  const hadMatch = Boolean(object.maMatchMoveEnabled)

  object.maMatchMoveEnabled = false
  object.maMatchMoveFromLeft = undefined
  object.maMatchMoveFromTop = undefined
  object.maMatchMoveFromScaleX = undefined
  object.maMatchMoveFromScaleY = undefined
  object.maMatchMoveFromAngle = undefined
  object.maMatchMoveFromOpacity = undefined
  object.maMatchMoveDurationMs = undefined
  object.maMatchMoveSourcePageId = undefined

  if (hadMatch) {
    object.dirty = true
  }

  return hadMatch
}

function fireCanvasModified(
  canvas: Canvas,
  object: MAQuadroFabricObject | undefined
) {
  if (!object) {
    return
  }

  const observable = canvas as unknown as {
    fire: (eventName: string, payload?: unknown) => unknown
  }

  observable.fire('object:modified', { target: object })
}

export function getMAQuadroMatchMoveSnapshot(
  object: MAQuadroFabricObject
): MAQuadroMatchMoveSnapshot | null {
  const matchObject = object as MAQuadroMatchMoveObject

  if (!matchObject.maMatchMoveEnabled) {
    return null
  }

  const fromLeft = Number(matchObject.maMatchMoveFromLeft)
  const fromTop = Number(matchObject.maMatchMoveFromTop)
  const fromScaleX = Number(matchObject.maMatchMoveFromScaleX)
  const fromScaleY = Number(matchObject.maMatchMoveFromScaleY)
  const fromAngle = Number(matchObject.maMatchMoveFromAngle)
  const fromOpacity = Number(matchObject.maMatchMoveFromOpacity)

  if (
    ![
      fromLeft,
      fromTop,
      fromScaleX,
      fromScaleY,
      fromAngle,
      fromOpacity
    ].every(Number.isFinite)
  ) {
    return null
  }

  return {
    fromLeft,
    fromTop,
    fromScaleX,
    fromScaleY,
    fromAngle,
    fromOpacity,
    toLeft: numberValue(object.left, 0),
    toTop: numberValue(object.top, 0),
    toScaleX: numberValue(object.scaleX, 1),
    toScaleY: numberValue(object.scaleY, 1),
    toAngle: numberValue(object.angle, 0),
    toOpacity: numberValue(object.opacity, 1),
    durationMs: clampDuration(
      numberValue(
        matchObject.maMatchMoveDurationMs,
        MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS
      )
    )
  }
}

export function countMAQuadroMatchMoveObjects(canvas: Canvas) {
  return (canvas.getObjects() as MAQuadroFabricObject[]).filter((object) =>
    Boolean(getMAQuadroMatchMoveSnapshot(object))
  ).length
}

export function applyMAQuadroMatchMoveProgress(
  canvas: Canvas,
  object: MAQuadroFabricObject,
  snapshot: MAQuadroMatchMoveSnapshot,
  rawProgress: number
) {
  const progress = easeInOutCubic(rawProgress)
  const angleDelta = shortestAngleDelta(
    snapshot.fromAngle,
    snapshot.toAngle
  )

  object.set({
    left: lerp(snapshot.fromLeft, snapshot.toLeft, progress),
    top: lerp(snapshot.fromTop, snapshot.toTop, progress),
    scaleX: lerp(snapshot.fromScaleX, snapshot.toScaleX, progress),
    scaleY: lerp(snapshot.fromScaleY, snapshot.toScaleY, progress),
    angle: snapshot.fromAngle + angleDelta * progress,
    opacity: lerp(snapshot.fromOpacity, snapshot.toOpacity, progress)
  })

  object.setCoords()
  object.dirty = true
  canvas.requestRenderAll()
}

export function restoreMAQuadroMatchMoveSnapshot(
  canvas: Canvas,
  object: MAQuadroFabricObject,
  snapshot: MAQuadroMatchMoveSnapshot
) {
  object.set({
    left: snapshot.toLeft,
    top: snapshot.toTop,
    scaleX: snapshot.toScaleX,
    scaleY: snapshot.toScaleY,
    angle: snapshot.toAngle,
    opacity: snapshot.toOpacity
  })

  object.setCoords()
  object.dirty = true
  canvas.requestRenderAll()
}

export function clearMAQuadroMatchMove(
  canvas: Canvas,
  emitChange = true
) {
  const objects = canvas.getObjects() as MAQuadroFabricObject[]
  let changedObject: MAQuadroFabricObject | undefined
  let cleared = 0

  for (const object of objects) {
    if (clearObjectMatchMove(object as MAQuadroMatchMoveObject)) {
      cleared += 1
      changedObject ||= object
    }
  }

  if (cleared > 0) {
    canvas.requestRenderAll()

    if (emitChange) {
      fireCanvasModified(canvas, changedObject)
    }
  }

  return cleared
}

export function applyMAQuadroMatchMoveFromPage(
  canvas: Canvas,
  sourcePage: MAQuadroPage,
  durationMs = MA_QUADRO_MATCH_MOVE_DEFAULT_DURATION_MS
): MAQuadroMatchMoveApplyResult {
  const currentObjects = canvas.getObjects() as MAQuadroFabricObject[]
  const sourceObjects = serializedObjects(sourcePage)
  const duration = clampDuration(durationMs)
  const sourceById = new Map<string, SerializedObject>()
  const sourceByKey = new Map<string, SerializedObject[]>()

  for (const source of sourceObjects) {
    const sourceId = stringValue(source.maId)

    if (sourceId) {
      sourceById.set(sourceId, source)
    }

    const key = serializedObjectKey(source)

    if (key) {
      const items = sourceByKey.get(key) || []
      items.push(source)
      sourceByKey.set(key, items)
    }
  }

  const currentKeyCounts = new Map<string, number>()

  for (const object of currentObjects) {
    const key = currentObjectKey(object)

    if (key) {
      currentKeyCounts.set(key, (currentKeyCounts.get(key) || 0) + 1)
    }
  }

  const clearedBeforeApply = clearMAQuadroMatchMove(canvas, false)
  const usedSources = new Set<SerializedObject>()
  const ratioX = canvas.getWidth() / Math.max(1, sourcePage.width)
  const ratioY = canvas.getHeight() / Math.max(1, sourcePage.height)

  let matched = 0
  let animated = 0
  let matchedById = 0
  let matchedByName = 0
  let changedObject: MAQuadroFabricObject | undefined

  for (const object of currentObjects) {
    let source: SerializedObject | undefined
    let matchMode: 'id' | 'name' | null = null
    const objectId = stringValue(object.maId)

    if (objectId) {
      const byId = sourceById.get(objectId)

      if (byId && !usedSources.has(byId)) {
        source = byId
        matchMode = 'id'
      }
    }

    if (!source) {
      const key = currentObjectKey(object)
      const candidates = key ? sourceByKey.get(key) || [] : []

      if (
        key &&
        currentKeyCounts.get(key) === 1 &&
        candidates.length === 1 &&
        !usedSources.has(candidates[0])
      ) {
        source = candidates[0]
        matchMode = 'name'
      }
    }

    if (!source || !matchMode) {
      continue
    }

    usedSources.add(source)
    matched += 1

    if (matchMode === 'id') {
      matchedById += 1
    } else {
      matchedByName += 1
    }

    const fromLeft = numberValue(source.left, 0) * ratioX
    const fromTop = numberValue(source.top, 0) * ratioY
    const fromScaleX = numberValue(source.scaleX, 1) * ratioX
    const fromScaleY = numberValue(source.scaleY, 1) * ratioY
    const fromAngle = numberValue(source.angle, 0)
    const fromOpacity = clamp(numberValue(source.opacity, 1), 0, 1)

    if (
      !hasVisibleDifference(
        fromLeft,
        fromTop,
        fromScaleX,
        fromScaleY,
        fromAngle,
        fromOpacity,
        object
      )
    ) {
      continue
    }

    const matchObject = object as MAQuadroMatchMoveObject

    matchObject.maMatchMoveEnabled = true
    matchObject.maMatchMoveFromLeft = fromLeft
    matchObject.maMatchMoveFromTop = fromTop
    matchObject.maMatchMoveFromScaleX = fromScaleX
    matchObject.maMatchMoveFromScaleY = fromScaleY
    matchObject.maMatchMoveFromAngle = fromAngle
    matchObject.maMatchMoveFromOpacity = fromOpacity
    matchObject.maMatchMoveDurationMs = duration
    matchObject.maMatchMoveSourcePageId = sourcePage.id
    object.dirty = true

    animated += 1
    changedObject ||= object
  }

  canvas.requestRenderAll()

  if (!changedObject && clearedBeforeApply > 0) {
    changedObject = currentObjects[0]
  }

  if (changedObject) {
    fireCanvasModified(canvas, changedObject)
  }

  return {
    matched,
    animated,
    matchedById,
    matchedByName
  }
}

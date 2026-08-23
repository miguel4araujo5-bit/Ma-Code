import { StaticCanvas } from 'fabric'

import type {
  MAQuadroCanvasJson,
  MAQuadroProject,
  MAQuadroProjectCategory
} from '../../types/maQuadro'

import {
  loadMAQuadroCanvasJson,
  resizeMAQuadroCanvasJson,
  serializeMAQuadroCanvas,
  type MAQuadroFabricObject
} from './canvasObjects'

import { duplicateProject } from './project'

export type MAQuadroSmartResizeMode = 'smart' | 'proportional'

export type MAQuadroSmartResizeOrientation =
  | 'portrait'
  | 'square'
  | 'landscape'

export type MAQuadroSmartResizeReport = {
  pages: number
  adjustedObjects: number
  semanticObjects: number
  fullBleedObjects: number
  sourceOrientations: MAQuadroSmartResizeOrientation[]
  targetOrientation: MAQuadroSmartResizeOrientation
}

type SemanticKind =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'cta'
  | 'footer'
  | 'label'
  | 'media'
  | 'decorative'
  | 'other'
  | 'full-bleed'

type ObjectMetric = {
  object: MAQuadroFabricObject
  kind: SemanticKind
  originalLeft: number
  originalTop: number
  originalScaleX: number
  originalScaleY: number
  normalizedCenterX: number
  normalizedCenterY: number
  areaRatio: number
  isPrimaryMedia: boolean
}

type SemanticAverage = {
  x: number
  y: number
  count: number
}

const TITLE_KEYWORDS = ['titulo', 'headline', 'heading', 'cabecalho']
const SUBTITLE_KEYWORDS = ['subtitulo', 'subheading']
const BODY_KEYWORDS = ['descricao', 'texto', 'body', 'paragrafo', 'conteudo']
const CTA_KEYWORDS = [
  'botao',
  'button',
  'cta',
  'acao',
  'call to action',
  'saiba mais',
  'comprar',
  'reservar',
  'inscrever'
]
const FOOTER_KEYWORDS = ['rodape', 'footer', 'website', 'site', 'url']
const LABEL_KEYWORDS = ['etiqueta', 'label', 'badge', 'numero', 'tag']
const MEDIA_KEYWORDS = [
  'imagem',
  'image',
  'foto',
  'photo',
  'moldura de imagem',
  'media'
]
const DECORATIVE_KEYWORDS = [
  'decorativo',
  'decorativa',
  'circulo',
  'forma',
  'ornamento',
  'decoracao',
  'linha',
  'faixa'
]

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? value : minimum)
  )
}

function normalizedText(value: unknown) {
  return typeof value === 'string'
    ? value
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-PT')
    : ''
}

function containsKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword))
}

function orientation(
  width: number,
  height: number
): MAQuadroSmartResizeOrientation {
  const ratio = width / Math.max(1, height)

  if (ratio < 0.82) return 'portrait'
  if (ratio > 1.22) return 'landscape'
  return 'square'
}

function remapPageReferences(value: unknown, pageIdMap: Map<string, string>) {
  if (!value || typeof value !== 'object') return

  if (Array.isArray(value)) {
    value.forEach((item) => remapPageReferences(item, pageIdMap))
    return
  }

  const node = value as Record<string, unknown>

  for (const key of [
    'maMatchMoveSourcePageId',
    'maMatchMoveTargetPageId'
  ]) {
    const current = node[key]

    if (typeof current === 'string') {
      const mapped = pageIdMap.get(current)
      if (mapped) node[key] = mapped
    }
  }

  Object.values(node).forEach((child) => remapPageReferences(child, pageIdMap))
}

function remapCanvasPageReferences(
  canvasJson: MAQuadroCanvasJson,
  pageIdMap: Map<string, string>
) {
  remapPageReferences(canvasJson, pageIdMap)
  return canvasJson
}

function createSemanticAverages(metrics: ObjectMetric[]) {
  const averages = new Map<string, SemanticAverage>()

  for (const metric of metrics) {
    if (metric.kind === 'full-bleed') continue

    const current = averages.get(metric.kind) || { x: 0, y: 0, count: 0 }
    current.x += metric.normalizedCenterX
    current.y += metric.normalizedCenterY
    current.count += 1
    averages.set(metric.kind, current)
  }

  for (const average of averages.values()) {
    average.x /= Math.max(1, average.count)
    average.y /= Math.max(1, average.count)
  }

  return averages
}

function inferKind(
  object: MAQuadroFabricObject,
  oldWidth: number,
  oldHeight: number,
  maxTextFontSize: number
): SemanticKind {
  const name = normalizedText(object.maName)
  const role = normalizedText(object.maRole)
  const type = normalizedText(object.type)
  const bounds = object.getBoundingRect()
  const widthRatio = bounds.width / Math.max(1, oldWidth)
  const heightRatio = bounds.height / Math.max(1, oldHeight)
  const areaRatio = widthRatio * heightRatio
  const isShapeLike =
    role !== 'text' &&
    role !== 'image' &&
    type !== 'fabricimage' &&
    type !== 'image'

  if (
    isShapeLike &&
    (areaRatio >= 0.54 || (widthRatio >= 0.88 && heightRatio >= 0.11))
  ) {
    return 'full-bleed'
  }

  if (containsKeyword(name, CTA_KEYWORDS)) return 'cta'
  if (containsKeyword(name, FOOTER_KEYWORDS)) return 'footer'
  if (containsKeyword(name, LABEL_KEYWORDS)) return 'label'

  if (
    role === 'image' ||
    type === 'fabricimage' ||
    type === 'image' ||
    containsKeyword(name, MEDIA_KEYWORDS)
  ) {
    return 'media'
  }

  if (role === 'text') {
    if (containsKeyword(name, TITLE_KEYWORDS)) return 'title'
    if (containsKeyword(name, SUBTITLE_KEYWORDS)) return 'subtitle'
    if (containsKeyword(name, BODY_KEYWORDS)) return 'body'

    const fontSize = Number(object.fontSize || 0)

    if (maxTextFontSize > 0 && fontSize >= maxTextFontSize * 0.82) {
      return 'title'
    }

    if (maxTextFontSize > 0 && fontSize >= maxTextFontSize * 0.54) {
      return 'subtitle'
    }

    return 'body'
  }

  if (containsKeyword(name, DECORATIVE_KEYWORDS)) return 'decorative'
  return 'other'
}

function targetSemanticCenter(
  metric: ObjectMetric,
  averages: Map<string, SemanticAverage>,
  targetOrientation: MAQuadroSmartResizeOrientation,
  hasPrimaryMedia: boolean,
  newWidth: number,
  newHeight: number
) {
  const average = averages.get(metric.kind) || {
    x: metric.normalizedCenterX,
    y: metric.normalizedCenterY,
    count: 1
  }

  const relativeX = metric.isPrimaryMedia
    ? 0
    : metric.normalizedCenterX - average.x

  const relativeY = metric.isPrimaryMedia
    ? 0
    : metric.normalizedCenterY - average.y

  let baseX = metric.normalizedCenterX
  let baseY = metric.normalizedCenterY

  if (targetOrientation === 'portrait') {
    switch (metric.kind) {
      case 'title':
        baseX = 0.5
        baseY = 0.17
        break

      case 'subtitle':
        baseX = 0.5
        baseY = 0.29
        break

      case 'body':
        baseX = 0.5
        baseY = hasPrimaryMedia ? 0.39 : 0.48
        break

      case 'media':
        if (metric.isPrimaryMedia) {
          baseX = 0.5
          baseY = 0.61
        } else {
          baseX = 0.16 + metric.normalizedCenterX * 0.68
          baseY = 0.1 + metric.normalizedCenterY * 0.8
        }
        break

      case 'cta':
        baseX = 0.5
        baseY = 0.83
        break

      case 'footer':
        baseX = 0.5
        baseY = 0.94
        break

      case 'label':
        baseX = 0.18 + metric.normalizedCenterX * 0.64
        baseY = 0.09
        break

      default:
        baseX = 0.1 + metric.normalizedCenterX * 0.8
        baseY = 0.08 + metric.normalizedCenterY * 0.84
        break
    }
  } else if (targetOrientation === 'landscape') {
    if (hasPrimaryMedia) {
      switch (metric.kind) {
        case 'title':
          baseX = 0.29
          baseY = 0.27
          break

        case 'subtitle':
          baseX = 0.29
          baseY = 0.39
          break

        case 'body':
          baseX = 0.29
          baseY = 0.52
          break

        case 'media':
          if (metric.isPrimaryMedia) {
            baseX = 0.73
            baseY = 0.5
          } else {
            baseX = 0.12 + metric.normalizedCenterX * 0.76
            baseY = 0.11 + metric.normalizedCenterY * 0.78
          }
          break

        case 'cta':
          baseX = 0.29
          baseY = 0.73
          break

        case 'footer':
          baseX = 0.5
          baseY = 0.93
          break

        case 'label':
          baseX = 0.22
          baseY = 0.11
          break

        default:
          baseX = 0.08 + metric.normalizedCenterX * 0.84
          baseY = 0.1 + metric.normalizedCenterY * 0.8
          break
      }
    } else {
      baseX = 0.08 + metric.normalizedCenterX * 0.84
      baseY = 0.1 + metric.normalizedCenterY * 0.8

      if (metric.kind === 'title') baseY = 0.24
      else if (metric.kind === 'body') baseY = 0.49
      else if (metric.kind === 'cta') baseY = 0.75
      else if (metric.kind === 'footer') baseY = 0.93
    }
  } else {
    switch (metric.kind) {
      case 'title':
        baseX = 0.5
        baseY = 0.23
        break

      case 'subtitle':
        baseX = 0.5
        baseY = 0.34
        break

      case 'body':
        baseX = 0.5
        baseY = hasPrimaryMedia ? 0.43 : 0.5
        break

      case 'media':
        if (metric.isPrimaryMedia) {
          baseX = 0.5
          baseY = 0.61
        }
        break

      case 'cta':
        baseX = 0.5
        baseY = 0.81
        break

      case 'footer':
        baseX = 0.5
        baseY = 0.93
        break

      case 'label':
        baseY = 0.11
        break

      default:
        baseX = 0.08 + metric.normalizedCenterX * 0.84
        baseY = 0.08 + metric.normalizedCenterY * 0.84
        break
    }
  }

  const relativeStrength =
    metric.kind === 'cta'
      ? 0.46
      : metric.kind === 'media'
        ? 0.34
        : 0.52

  return {
    x:
      clamp(baseX + relativeX * relativeStrength, 0.03, 0.97) *
      newWidth,

    y:
      clamp(baseY + relativeY * relativeStrength, 0.03, 0.97) *
      newHeight
  }
}

function fitObjectWithinArea(
  metric: ObjectMetric,
  newWidth: number,
  newHeight: number,
  desiredCenter: {
    x: number
    y: number
  }
) {
  const object = metric.object

  const roleMaxWidth =
    metric.kind === 'title'
      ? 0.86
      : metric.kind === 'body' ||
          metric.kind === 'subtitle'
        ? 0.82
        : metric.kind === 'media' &&
            metric.isPrimaryMedia
          ? 0.82
          : 0.92

  const roleMaxHeight =
    metric.kind === 'title'
      ? 0.28
      : metric.kind === 'body'
        ? 0.34
        : metric.kind === 'media' &&
            metric.isPrimaryMedia
          ? 0.56
          : 0.84

  let bounds = object.getBoundingRect()

  const fit = Math.min(
    1,

    newWidth *
      roleMaxWidth /
      Math.max(1, bounds.width),

    newHeight *
      roleMaxHeight /
      Math.max(1, bounds.height)
  )

  if (fit < 0.999) {
    object.set({
      scaleX:
        Number(object.scaleX || 1) *
        fit,

      scaleY:
        Number(object.scaleY || 1) *
        fit
    })

    object.setCoords()
    bounds = object.getBoundingRect()
  }

  object.set({
    left:
      Number(object.left || 0) +
      desiredCenter.x -
      (
        bounds.left +
        bounds.width / 2
      ),

    top:
      Number(object.top || 0) +
      desiredCenter.y -
      (
        bounds.top +
        bounds.height / 2
      )
  })

  object.setCoords()
  bounds = object.getBoundingRect()

  const marginX = newWidth * 0.035
  const marginY = newHeight * 0.03

  let shiftX = 0
  let shiftY = 0

  if (bounds.left < marginX) {
    shiftX =
      marginX -
      bounds.left
  } else if (
    bounds.left +
      bounds.width >
    newWidth -
      marginX
  ) {
    shiftX =
      newWidth -
      marginX -
      (
        bounds.left +
        bounds.width
      )
  }

  if (bounds.top < marginY) {
    shiftY =
      marginY -
      bounds.top
  } else if (
    bounds.top +
      bounds.height >
    newHeight -
      marginY
  ) {
    shiftY =
      newHeight -
      marginY -
      (
        bounds.top +
        bounds.height
      )
  }

  if (
    Math.abs(shiftX) > 0.01 ||
    Math.abs(shiftY) > 0.01
  ) {
    object.set({
      left:
        Number(object.left || 0) +
        shiftX,

      top:
        Number(object.top || 0) +
        shiftY
    })

    object.setCoords()
  }
}

function metricScaleMultiplier(
  metric: ObjectMetric,
  baseScale: number,
  readableScale: number,
  majorShift: boolean
) {
  if (!majorShift) {
    return baseScale
  }

  const semanticBase =
    Math.max(
      baseScale,
      readableScale
    )

  switch (metric.kind) {
    case 'title':
      return semanticBase * 1.04

    case 'subtitle':
      return semanticBase * 0.98

    case 'body':
      return semanticBase * 0.94

    case 'cta':
      return semanticBase * 0.96

    case 'media':
      return metric.isPrimaryMedia
        ? semanticBase * 1.02
        : baseScale

    case 'footer':
    case 'label':
      return Math.max(
        baseScale,
        semanticBase * 0.84
      )

    default:
      return baseScale
  }
}

export async function smartResizeMAQuadroCanvasJson(
  canvasJson: MAQuadroCanvasJson,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
) {
  const element =
    document.createElement(
      'canvas'
    )

  const canvas =
    new StaticCanvas(
      element,
      {
        width:
          Math.max(
            1,
            oldWidth
          ),

        height:
          Math.max(
            1,
            oldHeight
          ),

        renderOnAddRemove:
          false
      }
    )

  try {
    await loadMAQuadroCanvasJson(
      canvas,
      canvasJson
    )

    const objects =
      canvas.getObjects() as
        MAQuadroFabricObject[]

    const sourceOrientation =
      orientation(
        oldWidth,
        oldHeight
      )

    if (objects.length === 0) {
      canvas.setDimensions({
        width: newWidth,
        height: newHeight
      })

      return {
        canvasJson:
          serializeMAQuadroCanvas(
            canvas
          ),

        adjustedObjects:
          0,

        semanticObjects:
          0,

        fullBleedObjects:
          0,

        sourceOrientation
      }
    }

    const targetOrientation =
      orientation(
        newWidth,
        newHeight
      )

    const oldAspect =
      oldWidth /
      Math.max(
        1,
        oldHeight
      )

    const newAspect =
      newWidth /
      Math.max(
        1,
        newHeight
      )

    const aspectShift =
      Math.max(
        oldAspect /
          Math.max(
            0.001,
            newAspect
          ),

        newAspect /
          Math.max(
            0.001,
            oldAspect
          )
      )

    const majorShift =
      sourceOrientation !==
        targetOrientation ||
      aspectShift >=
        1.34

    const maxTextFontSize =
      Math.max(
        0,

        ...objects
          .filter(
            (object) =>
              normalizedText(
                object.maRole
              ) ===
              'text'
          )
          .map(
            (object) =>
              Number(
                object.fontSize ||
                0
              )
          )
      )

    const metrics =
      objects.map(
        (
          object
        ): ObjectMetric => {
          const bounds =
            object.getBoundingRect()

          return {
            object,

            kind:
              inferKind(
                object,
                oldWidth,
                oldHeight,
                maxTextFontSize
              ),

            originalLeft:
              Number(
                object.left ||
                0
              ),

            originalTop:
              Number(
                object.top ||
                0
              ),

            originalScaleX:
              Number(
                object.scaleX ||
                1
              ),

            originalScaleY:
              Number(
                object.scaleY ||
                1
              ),

            normalizedCenterX:
              clamp(
                (
                  bounds.left +
                  bounds.width / 2
                ) /
                  Math.max(
                    1,
                    oldWidth
                  ),
                -0.5,
                1.5
              ),

            normalizedCenterY:
              clamp(
                (
                  bounds.top +
                  bounds.height / 2
                ) /
                  Math.max(
                    1,
                    oldHeight
                  ),
                -0.5,
                1.5
              ),

            areaRatio:
              bounds.width *
              bounds.height /
              Math.max(
                1,
                oldWidth *
                oldHeight
              ),

            isPrimaryMedia:
              false
          }
        }
      )

    const mediaCandidates =
      metrics
        .filter(
          (metric) =>
            metric.kind ===
              'media' &&
            metric.areaRatio >=
              0.055
        )
        .sort(
          (
            first,
            second
          ) =>
            second.areaRatio -
            first.areaRatio
        )

    if (mediaCandidates[0]) {
      mediaCandidates[0].isPrimaryMedia =
        true
    }

    const hasPrimaryMedia =
      Boolean(
        mediaCandidates[0]
      )

    const averages =
      createSemanticAverages(
        metrics
      )

    const scaleX =
      newWidth /
      Math.max(
        1,
        oldWidth
      )

    const scaleY =
      newHeight /
      Math.max(
        1,
        oldHeight
      )

    const baseScale =
      Math.min(
        scaleX,
        scaleY
      )

    const shortSideScale =
      Math.min(
        newWidth,
        newHeight
      ) /
      Math.max(
        1,
        Math.min(
          oldWidth,
          oldHeight
        )
      )

    const readableScale =
      Math.sqrt(
        Math.max(
          0.0001,
          baseScale *
          shortSideScale
        )
      )

    let adjustedObjects = 0
    let semanticObjects = 0
    let fullBleedObjects = 0

    for (
      const metric
      of metrics
    ) {
      const object =
        metric.object

      if (
        metric.kind ===
        'full-bleed'
      ) {
        object.set({
          left:
            metric.originalLeft *
            scaleX,

          top:
            metric.originalTop *
            scaleY,

          scaleX:
            metric.originalScaleX *
            scaleX,

          scaleY:
            metric.originalScaleY *
            scaleY
        })

        object.setCoords()

        adjustedObjects += 1
        fullBleedObjects += 1

        continue
      }

      const objectScale =
        metricScaleMultiplier(
          metric,
          baseScale,
          readableScale,
          majorShift
        )

      object.set({
        scaleX:
          metric.originalScaleX *
          objectScale,

        scaleY:
          metric.originalScaleY *
          objectScale
      })

      object.setCoords()

      const desiredCenter =
        majorShift
          ? targetSemanticCenter(
              metric,
              averages,
              targetOrientation,
              hasPrimaryMedia,
              newWidth,
              newHeight
            )
          : {
              x:
                metric.normalizedCenterX *
                newWidth,

              y:
                metric.normalizedCenterY *
                newHeight
            }

      fitObjectWithinArea(
        metric,
        newWidth,
        newHeight,
        desiredCenter
      )

      adjustedObjects += 1

      if (
        metric.kind !==
          'decorative' &&
        metric.kind !==
          'other'
      ) {
        semanticObjects += 1
      }
    }

    canvas.setDimensions({
      width:
        newWidth,

      height:
        newHeight
    })

    canvas.requestRenderAll()

    return {
      canvasJson:
        serializeMAQuadroCanvas(
          canvas
        ),

      adjustedObjects,
      semanticObjects,
      fullBleedObjects,
      sourceOrientation
    }
  } finally {
    await canvas.dispose()
  }
}

export async function createMAQuadroResizedProject(
  sourceProject:
    MAQuadroProject,

  name:
    string,

  width:
    number,

  height:
    number,

  mode:
    MAQuadroSmartResizeMode,

  category?:
    MAQuadroProjectCategory
) {
  const project =
    duplicateProject(
      sourceProject,
      name
    )

  const pageIdMap =
    new Map<
      string,
      string
    >()

  sourceProject.pages.forEach(
    (
      sourcePage,
      index
    ) => {
      const duplicatedPage =
        project.pages[
          index
        ]

      if (
        duplicatedPage
      ) {
        pageIdMap.set(
          sourcePage.id,
          duplicatedPage.id
        )
      }
    }
  )

  let adjustedObjects = 0
  let semanticObjects = 0
  let fullBleedObjects = 0

  const sourceOrientations:
    MAQuadroSmartResizeOrientation[] =
    []

  const pages:
    MAQuadroProject['pages'] =
    []

  for (
    let index = 0;
    index <
      sourceProject.pages.length;
    index += 1
  ) {
    const sourcePage =
      sourceProject.pages[
        index
      ]

    const duplicatedPage =
      project.pages[
        index
      ]

    if (
      !sourcePage ||
      !duplicatedPage
    ) {
      continue
    }

    if (
      mode ===
      'proportional'
    ) {
      pages.push({
        ...duplicatedPage,

        width,
        height,

        canvasJson:
          remapCanvasPageReferences(
            await resizeMAQuadroCanvasJson(
              sourcePage.canvasJson,
              sourcePage.width,
              sourcePage.height,
              width,
              height,
              'scale'
            ),
            pageIdMap
          ),

        thumbnail:
          undefined
      })

      sourceOrientations.push(
        orientation(
          sourcePage.width,
          sourcePage.height
        )
      )

      continue
    }

    const result =
      await smartResizeMAQuadroCanvasJson(
        sourcePage.canvasJson,
        sourcePage.width,
        sourcePage.height,
        width,
        height
      )

    adjustedObjects +=
      result.adjustedObjects

    semanticObjects +=
      result.semanticObjects

    fullBleedObjects +=
      result.fullBleedObjects

    sourceOrientations.push(
      result.sourceOrientation
    )

    pages.push({
      ...duplicatedPage,

      width,
      height,

      canvasJson:
        remapCanvasPageReferences(
          result.canvasJson,
          pageIdMap
        ),

      thumbnail:
        undefined
    })
  }

  const next = {
    ...project,

    pages,

    category:
      category ||
      project.category,

    updatedAt:
      new Date()
        .toISOString()
  } satisfies
    MAQuadroProject

  return {
    project:
      next,

    report: {
      pages:
        pages.length,

      adjustedObjects,
      semanticObjects,
      fullBleedObjects,
      sourceOrientations,

      targetOrientation:
        orientation(
          width,
          height
        )
    } satisfies
      MAQuadroSmartResizeReport
  }
}

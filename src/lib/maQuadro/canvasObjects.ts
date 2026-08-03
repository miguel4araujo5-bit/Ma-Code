import {
  ActiveSelection,
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  FabricObject,
  Gradient,
  config,
  Group,
  Line,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Shadow,
  StaticCanvas,
  Textbox,
  Triangle
} from 'fabric'

import type {
  MAQuadroBackground,
  MAQuadroCanvasJson,
  MAQuadroObjectRole,
  MAQuadroPage,
  MAQuadroShapeKind,
  MAQuadroTextPreset
} from '../../types/maQuadro'
import {
  createMAQuadroId,
  normalizeCanvasJson
} from './project'

export type MAQuadroFabricObject =
  FabricObject & {
    maId?: string
    maName?: string
    maRole?: MAQuadroObjectRole
    maLocked?: boolean

    maSourceDataUrl?: string
    maOriginalWidth?: number
    maOriginalHeight?: number

    maFilterBrightness?: number
    maFilterContrast?: number
    maFilterSaturation?: number
    maFilterBlur?: number
    maFilterGrayscale?: boolean

    isEditing?: boolean
    text?: string
    fontFamily?: string
    fontSize?: number
    fontWeight?: string | number
    fontStyle?: string
    textAlign?: string
    lineHeight?: number
    charSpacing?: number
    underline?: boolean
    linethrough?: boolean

    rx?: number
    ry?: number
    cropX?: number
    cropY?: number
  }

const customProperties = [
  'maId',
  'maName',
  'maRole',
  'maLocked',
  'maSourceDataUrl',
  'maOriginalWidth',
  'maOriginalHeight',
  'maFilterBrightness',
  'maFilterContrast',
  'maFilterSaturation',
  'maFilterBlur',
  'maFilterGrayscale'
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
      ...customProperties
    ])
  )

config.NUM_FRACTION_DIGITS = 6

export const
  MA_QUADRO_SERIALIZED_PROPERTIES =
    customProperties

export function objectOrigin() {
  return {
    originX:
      'left' as const,
    originY:
      'top' as const
  }
}

export function prepareMAQuadroObject<
  T extends MAQuadroFabricObject
>(
  object: T,
  role: MAQuadroObjectRole,
  name: string
): T {
  object.maId ||=
    createMAQuadroId(
      'object'
    )
  object.maRole = role
  object.maName ||= name
  object.maLocked =
    Boolean(object.maLocked)

  object.set({
    transparentCorners: false,
    cornerColor: '#22D3EE',
    cornerStrokeColor:
      '#082F49',
    borderColor: '#22D3EE',
    cornerStyle: 'circle',
    cornerSize: 12,
    padding: 4,
    strokeUniform: true,
    snapAngle: 15,
    snapThreshold: 4
  })

  applyMAQuadroLock(
    object,
    object.maLocked
  )

  return object
}

export function applyMAQuadroLock(
  object: MAQuadroFabricObject,
  locked: boolean
) {
  object.maLocked = locked

  object.set({
    selectable: !locked,
    evented: !locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockRotation: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockSkewingX: locked,
    lockSkewingY: locked
  })

  object.setCoords()
}

export function getMAQuadroObjectLabel(
  object: MAQuadroFabricObject,
  index = 0
) {
  if (object.maName) {
    return object.maName
  }

  if (
    object instanceof Textbox
  ) {
    const value =
      object.text?.trim() ||
      ''

    if (value) {
      return value.length > 28
        ? `${value.slice(0, 28)}…`
        : value
    }
  }

  const names:
    Record<string, string> = {
      Textbox: 'Texto',
      IText: 'Texto',
      Text: 'Texto',
      FabricImage: 'Imagem',
      Image: 'Imagem',
      Rect: 'Retângulo',
      Circle: 'Círculo',
      Ellipse: 'Elipse',
      Triangle: 'Triângulo',
      Polygon: 'Polígono',
      Line: 'Linha',
      Group: 'Grupo',
      Path: 'Desenho'
    }

  return `${
    names[object.type] ||
    'Elemento'
  } ${index + 1}`
}

export function getMAQuadroObjectRole(
  object: MAQuadroFabricObject
): MAQuadroObjectRole {
  if (object.maRole) {
    return object.maRole
  }

  if (
    object instanceof Textbox
  ) {
    return 'text'
  }

  if (
    object instanceof FabricImage
  ) {
    return 'image'
  }

  if (
    object instanceof Line
  ) {
    return 'line'
  }

  if (
    object instanceof Group
  ) {
    return 'group'
  }

  if (
    object.type === 'Path'
  ) {
    return 'drawing'
  }

  return 'shape'
}

export function serializeMAQuadroCanvas(
  canvas: Canvas
): MAQuadroCanvasJson {
  return canvas.toObject(
    MA_QUADRO_SERIALIZED_PROPERTIES
  ) as MAQuadroCanvasJson
}

export async function loadMAQuadroCanvasJson(
  canvas:
    | Canvas
    | StaticCanvas,
  json: MAQuadroCanvasJson
) {
  await canvas.loadFromJSON(
    normalizeCanvasJson(json)
  )

  for (
    const object
    of canvas.getObjects()
  ) {
    const editorObject =
      object as MAQuadroFabricObject

    prepareMAQuadroObject(
      editorObject,
      getMAQuadroObjectRole(
        editorObject
      ),
      getMAQuadroObjectLabel(
        editorObject
      )
    )
  }

  canvas.requestRenderAll()
}

export function
createMAQuadroBackgroundFill(
  background:
    MAQuadroBackground,
  width: number,
  height: number
) {
  if (
    background.type ===
    'transparent'
  ) {
    return ''
  }

  if (
    background.type ===
    'solid'
  ) {
    return background.color
  }

  const angle =
    background.gradientAngle *
    Math.PI /
    180
  const centerX =
    width / 2
  const centerY =
    height / 2
  const distance =
    Math.abs(
      width *
      Math.cos(angle)
    ) +
    Math.abs(
      height *
      Math.sin(angle)
    )
  const offsetX =
    Math.cos(angle) *
    distance /
    2
  const offsetY =
    Math.sin(angle) *
    distance /
    2

  return new Gradient({
    type: 'linear',
    gradientUnits:
      'pixels',
    coords: {
      x1:
        centerX -
        offsetX,
      y1:
        centerY -
        offsetY,
      x2:
        centerX +
        offsetX,
      y2:
        centerY +
        offsetY
    },
    colorStops: [
      {
        offset: 0,
        color:
          background
            .gradientFrom
      },
      {
        offset: 1,
        color:
          background
            .gradientTo
      }
    ]
  })
}

export function
applyMAQuadroPageBackground(
  canvas:
    | Canvas
    | StaticCanvas,
  page: MAQuadroPage
) {
  canvas.backgroundColor =
    createMAQuadroBackgroundFill(
      page.background,
      page.width,
      page.height
    )

  canvas.requestRenderAll()
}

function defaultTextSize(
  canvas: Canvas,
  preset: MAQuadroTextPreset
) {
  const base =
    Math.min(
      canvas.getWidth(),
      canvas.getHeight()
    )

  const ratios:
    Record<
      MAQuadroTextPreset,
      number
    > = {
      heading: 0.095,
      subheading: 0.06,
      body: 0.038,
      caption: 0.026
    }

  return Math.max(
    18,
    Math.round(
      base *
      ratios[preset]
    )
  )
}

export function createMAQuadroText(
  canvas: Canvas,
  preset: MAQuadroTextPreset,
  fontFamily = 'Arial'
) {
  const configurations:
    Record<
      MAQuadroTextPreset,
      {
        text: string
        name: string
        weight: number
        color: string
      }
    > = {
      heading: {
        text:
          'Adicione um título',
        name: 'Título',
        weight: 700,
        color: '#0F172A'
      },
      subheading: {
        text:
          'Adicione um subtítulo',
        name: 'Subtítulo',
        weight: 600,
        color: '#334155'
      },
      body: {
        text:
          'Escreva aqui o seu texto.',
        name: 'Texto',
        weight: 400,
        color: '#334155'
      },
      caption: {
        text:
          'Legenda ou informação adicional',
        name: 'Legenda',
        weight: 400,
        color: '#64748B'
      }
    }

  const configuration =
    configurations[preset]

  const object =
    new Textbox(
      configuration.text,
      {
        ...objectOrigin(),
        left:
          canvas.getWidth() *
          0.15,
        top:
          canvas.getHeight() *
          0.18,
        width:
          canvas.getWidth() *
          0.7,
        fontFamily,
        fontSize:
          defaultTextSize(
            canvas,
            preset
          ),
        fontWeight:
          configuration.weight,
        fill:
          configuration.color,
        lineHeight: 1.08,
        textAlign: 'center'
      }
    ) as MAQuadroFabricObject

  return prepareMAQuadroObject(
    object,
    'text',
    configuration.name
  )
}

function starPoints(
  outerRadius: number,
  innerRadius: number,
  points = 5
) {
  const result:
    Point[] = []

  for (
    let index = 0;
    index < points * 2;
    index += 1
  ) {
    const radius =
      index % 2 === 0
        ? outerRadius
        : innerRadius

    const angle =
      -Math.PI / 2 +
      index *
      Math.PI /
      points

    result.push(
      new Point(
        Math.cos(angle) *
          radius,
        Math.sin(angle) *
          radius
      )
    )
  }

  return result
}

function centerShape(
  canvas: Canvas,
  object:
    MAQuadroFabricObject
) {
  const bounds =
    object.getBoundingRect()

  object.set({
    left:
      (
        canvas.getWidth() -
        bounds.width
      ) /
      2,
    top:
      (
        canvas.getHeight() -
        bounds.height
      ) /
      2
  })

  object.setCoords()

  return object
}

export function createMAQuadroShape(
  canvas: Canvas,
  kind: MAQuadroShapeKind,
  fill = '#22D3EE'
): MAQuadroFabricObject {
  const shortest =
    Math.min(
      canvas.getWidth(),
      canvas.getHeight()
    )

  const width =
    shortest * 0.34
  const height =
    shortest * 0.24

  let object:
    MAQuadroFabricObject

  if (
    kind === 'rectangle'
  ) {
    object =
      new Rect({
        ...objectOrigin(),
        width,
        height,
        fill,
        strokeWidth: 0,
        rx:
          shortest *
          0.025,
        ry:
          shortest *
          0.025
      }) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'shape',
      'Retângulo'
    )
  } else if (
    kind === 'circle'
  ) {
    object =
      new Circle({
        ...objectOrigin(),
        radius:
          shortest *
          0.16,
        fill,
        strokeWidth: 0
      }) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'shape',
      'Círculo'
    )
  } else if (
    kind === 'ellipse'
  ) {
    object =
      new Ellipse({
        ...objectOrigin(),
        rx:
          shortest *
          0.2,
        ry:
          shortest *
          0.125,
        fill,
        strokeWidth: 0
      }) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'shape',
      'Elipse'
    )
  } else if (
    kind === 'triangle'
  ) {
    object =
      new Triangle({
        ...objectOrigin(),
        width:
          shortest *
          0.34,
        height:
          shortest *
          0.3,
        fill,
        strokeWidth: 0
      }) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'shape',
      'Triângulo'
    )
  } else if (
    kind === 'star'
  ) {
    object =
      new Polygon(
        starPoints(
          shortest *
            0.18,
          shortest *
            0.08
        ),
        {
          ...objectOrigin(),
          fill,
          strokeWidth: 0
        }
      ) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'shape',
      'Estrela'
    )
  } else if (
    kind === 'line'
  ) {
    object =
      new Line(
        [
          0,
          0,
          shortest *
            0.48,
          0
        ],
        {
          ...objectOrigin(),
          stroke: fill,
          strokeWidth:
            Math.max(
              4,
              shortest *
                0.008
            ),
          fill
        }
      ) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'line',
      'Linha'
    )
  } else {
    const length =
      shortest * 0.5
    const thickness =
      Math.max(
        6,
        shortest *
          0.012
      )

    const shaft =
      new Line(
        [
          0,
          thickness *
            2.5,
          length -
            thickness *
            3,
          thickness *
            2.5
        ],
        {
          ...objectOrigin(),
          stroke: fill,
          strokeWidth:
            thickness
        }
      )

    const head =
      new Triangle({
        ...objectOrigin(),
        left:
          length -
          thickness *
          5,
        top: 0,
        width:
          thickness *
          5,
        height:
          thickness *
          5,
        fill,
        angle: 90
      })

    object =
      new Group(
        [
          shaft,
          head
        ],
        {
          ...objectOrigin()
        }
      ) as
        MAQuadroFabricObject

    prepareMAQuadroObject(
      object,
      'arrow',
      'Seta'
    )
  }

  return centerShape(
    canvas,
    object
  )
}

export function readFileAsDataUrl(
  file: File
) {
  return new Promise<string>(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader()

      reader.onload = () => {
        if (
          typeof reader.result ===
          'string'
        ) {
          resolve(
            reader.result
          )
        } else {
          reject(
            new Error(
              'Ficheiro inválido.'
            )
          )
        }
      }

      reader.onerror = () => {
        reject(
          reader.error ||
          new Error(
            'Não foi possível ler o ficheiro.'
          )
        )
      }

      reader.readAsDataURL(
        file
      )
    }
  )
}

export async function createMAQuadroImage(
  canvas: Canvas,
  file: File
) {
  const dataUrl =
    await readFileAsDataUrl(
      file
    )

  const image =
    await FabricImage.fromURL(
      dataUrl
    ) as
      MAQuadroFabricObject

  const originalWidth =
    image.width || 1
  const originalHeight =
    image.height || 1

  const scale =
    Math.min(
      canvas.getWidth() *
        0.72 /
        originalWidth,
      canvas.getHeight() *
        0.72 /
        originalHeight,
      1
    )

  image.set({
    ...objectOrigin(),
    left:
      (
        canvas.getWidth() -
        originalWidth *
          scale
      ) /
      2,
    top:
      (
        canvas.getHeight() -
        originalHeight *
          scale
      ) /
      2,
    scaleX: scale,
    scaleY: scale
  })

  image.maSourceDataUrl =
    dataUrl
  image.maOriginalWidth =
    originalWidth
  image.maOriginalHeight =
    originalHeight

  image.maFilterBrightness =
    0
  image.maFilterContrast =
    0
  image.maFilterSaturation =
    0
  image.maFilterBlur =
    0
  image.maFilterGrayscale =
    false

  return prepareMAQuadroObject(
    image,
    'image',
    file.name
  )
}

export function
setMAQuadroObjectShadow(
  object:
    MAQuadroFabricObject,
  enabled: boolean,
  color =
    'rgba(15, 23, 42, 0.32)',
  blur = 24,
  offsetX = 0,
  offsetY = 12
) {
  object.set({
    shadow: enabled
      ? new Shadow({
          color,
          blur,
          offsetX,
          offsetY
        })
      : undefined
  })

  object.setCoords()
}

export function
setMAQuadroObjectGradient(
  object:
    MAQuadroFabricObject,
  from: string,
  to: string,
  angle: number
) {
  const width =
    Math.max(
      1,
      object.width || 1
    )
  const height =
    Math.max(
      1,
      object.height || 1
    )

  const radians =
    angle *
    Math.PI /
    180
  const centerX =
    width / 2
  const centerY =
    height / 2
  const distance =
    Math.abs(
      width *
      Math.cos(radians)
    ) +
    Math.abs(
      height *
      Math.sin(radians)
    )
  const offsetX =
    Math.cos(radians) *
    distance /
    2
  const offsetY =
    Math.sin(radians) *
    distance /
    2

  object.set({
    fill:
      new Gradient({
        type: 'linear',
        gradientUnits:
          'pixels',
        coords: {
          x1:
            centerX -
            offsetX,
          y1:
            centerY -
            offsetY,
          x2:
            centerX +
            offsetX,
          y2:
            centerY +
            offsetY
        },
        colorStops: [
          {
            offset: 0,
            color: from
          },
          {
            offset: 1,
            color: to
          }
        ]
      })
  })

  object.setCoords()
}

export function
configureMAQuadroBrush(
  canvas: Canvas,
  color: string,
  width: number
) {
  const brush =
    new PencilBrush(
      canvas
    )

  brush.color = color
  brush.width = width
  brush.decimate = 2

  canvas.freeDrawingBrush =
    brush
}

export function
groupMAQuadroSelection(
  canvas: Canvas
) {
  const active =
    canvas.getActiveObject()

  if (
    !(
      active instanceof
      ActiveSelection
    )
  ) {
    return null
  }

  const objects =
    active.removeAll() as
      MAQuadroFabricObject[]

  canvas.discardActiveObject()
  canvas.remove(
    ...objects
  )

  const group =
    new Group(
      objects,
      {
        ...objectOrigin()
      }
    ) as
      MAQuadroFabricObject

  prepareMAQuadroObject(
    group,
    'group',
    'Grupo'
  )

  canvas.add(group)
  canvas.setActiveObject(
    group
  )
  canvas.requestRenderAll()

  return group
}

export function
ungroupMAQuadroSelection(
  canvas: Canvas
) {
  const active =
    canvas.getActiveObject()

  if (
    !(
      active instanceof
      Group
    ) ||
    active instanceof
      ActiveSelection
  ) {
    return null
  }

  const group =
    active as
      MAQuadroFabricObject

  const objects =
    active.removeAll() as
      MAQuadroFabricObject[]

  canvas.discardActiveObject()
  canvas.remove(group)

  for (
    const object
    of objects
  ) {
    prepareMAQuadroObject(
      object,
      getMAQuadroObjectRole(
        object
      ),
      getMAQuadroObjectLabel(
        object
      )
    )

    object.setCoords()
  }

  canvas.add(
    ...objects
  )

  const selection =
    new ActiveSelection(
      objects,
      {
        canvas
      }
    )

  canvas.setActiveObject(
    selection
  )
  canvas.requestRenderAll()

  return selection
}

export function
selectAllMAQuadroObjects(
  canvas: Canvas
) {
  const objects =
    canvas
      .getObjects()
      .filter(
        (object) =>
          object.visible !==
          false
      )
      .filter(
        (object) =>
          !(
            object as
              MAQuadroFabricObject
          ).maLocked
      )

  if (
    objects.length === 0
  ) {
    return
  }

  canvas.setActiveObject(
    new ActiveSelection(
      objects,
      {
        canvas
      }
    )
  )

  canvas.requestRenderAll()
}

export type MAQuadroArrangeAction =
  | 'front'
  | 'forward'
  | 'backward'
  | 'back'

export function
arrangeMAQuadroObject(
  canvas: Canvas,
  object:
    MAQuadroFabricObject,
  action:
    MAQuadroArrangeAction
) {
  const objects =
    canvas.getObjects()
  const index =
    objects.indexOf(object)

  if (index < 0) {
    return
  }

  if (
    action === 'front'
  ) {
    canvas.moveObjectTo(
      object,
      objects.length - 1
    )
  } else if (
    action === 'forward'
  ) {
    canvas.moveObjectTo(
      object,
      Math.min(
        objects.length - 1,
        index + 1
      )
    )
  } else if (
    action === 'backward'
  ) {
    canvas.moveObjectTo(
      object,
      Math.max(
        0,
        index - 1
      )
    )
  } else {
    canvas.moveObjectTo(
      object,
      0
    )
  }

  canvas.requestRenderAll()
}

export type MAQuadroAlignAction =
  | 'left'
  | 'center-x'
  | 'right'
  | 'top'
  | 'center-y'
  | 'bottom'

export function
alignMAQuadroSelection(
  canvas: Canvas,
  object:
    MAQuadroFabricObject,
  alignment:
    MAQuadroAlignAction
) {
  const bounds =
    object.getBoundingRect()

  if (
    alignment === 'left'
  ) {
    object.left +=
      -bounds.left
  } else if (
    alignment ===
    'center-x'
  ) {
    object.left +=
      canvas.getWidth() /
        2 -
      (
        bounds.left +
        bounds.width /
          2
      )
  } else if (
    alignment === 'right'
  ) {
    object.left +=
      canvas.getWidth() -
      (
        bounds.left +
        bounds.width
      )
  } else if (
    alignment === 'top'
  ) {
    object.top +=
      -bounds.top
  } else if (
    alignment ===
    'center-y'
  ) {
    object.top +=
      canvas.getHeight() /
        2 -
      (
        bounds.top +
        bounds.height /
          2
      )
  } else {
    object.top +=
      canvas.getHeight() -
      (
        bounds.top +
        bounds.height
      )
  }

  object.setCoords()
  canvas.requestRenderAll()
}

export function
distributeMAQuadroSelection(
  canvas: Canvas,
  direction:
    | 'horizontal'
    | 'vertical'
) {
  const objects =
  canvas.getActiveObjects() as MAQuadroFabricObject[]

  if (
    objects.length < 3
  ) {
    return false
  }

  const sorted =
    [...objects].sort(
      (
        first,
        second
      ) => {
        const firstBounds =
          first
            .getBoundingRect()

        const secondBounds =
          second
            .getBoundingRect()

        return direction ===
          'horizontal'
          ? firstBounds.left -
              secondBounds.left
          : firstBounds.top -
              secondBounds.top
      }
    )

  const firstBounds =
    sorted[0]
      .getBoundingRect()

  const lastBounds =
    sorted[
      sorted.length - 1
    ].getBoundingRect()

  const totalObjectSize =
    sorted.reduce(
      (
        sum,
        object
      ) => {
        const bounds =
          object
            .getBoundingRect()

        return sum +
          (
            direction ===
              'horizontal'
              ? bounds.width
              : bounds.height
          )
      },
      0
    )

  const available =
    direction ===
      'horizontal'
      ? (
          lastBounds.left +
          lastBounds.width -
          firstBounds.left
        )
      : (
          lastBounds.top +
          lastBounds.height -
          firstBounds.top
        )

  const gap =
    (
      available -
      totalObjectSize
    ) /
    (
      sorted.length -
      1
    )

  let cursor =
    direction ===
      'horizontal'
      ? (
          firstBounds.left +
          firstBounds.width +
          gap
        )
      : (
          firstBounds.top +
          firstBounds.height +
          gap
        )

  for (
    let index = 1;
    index <
      sorted.length - 1;
    index += 1
  ) {
    const object =
      sorted[index]

    const bounds =
      object
        .getBoundingRect()

    if (
      direction ===
      'horizontal'
    ) {
      object.left +=
        cursor -
        bounds.left

      cursor +=
        bounds.width +
        gap
    } else {
      object.top +=
        cursor -
        bounds.top

      cursor +=
        bounds.height +
        gap
    }

    object.setCoords()
  }

  canvas.requestRenderAll()

  return true
}

export function
getMAQuadroObjectGeometry(
  object:
    MAQuadroFabricObject
) {
  const bounds =
    object.getBoundingRect()

  return {
    x:
      Math.round(
        bounds.left
      ),
    y:
      Math.round(
        bounds.top
      ),
    width:
      Math.round(
        bounds.width
      ),
    height:
      Math.round(
        bounds.height
      ),
    angle:
      Math.round(
        object.angle || 0
      )
  }
}

export function
setMAQuadroObjectGeometry(
  object:
    MAQuadroFabricObject,
  values:
    Partial<{
      x: number
      y: number
      width: number
      height: number
      angle: number
    }>
) {
  const bounds =
    object.getBoundingRect()

  if (
    typeof values.x ===
    'number'
  ) {
    object.left +=
      values.x -
      bounds.left
  }

  if (
    typeof values.y ===
    'number'
  ) {
    object.top +=
      values.y -
      bounds.top
  }

  if (
    typeof values.width ===
      'number' &&
    values.width > 0 &&
    bounds.width > 0
  ) {
    object.scaleX *=
      values.width /
      bounds.width
  }

  if (
    typeof values.height ===
      'number' &&
    values.height > 0 &&
    bounds.height > 0
  ) {
    object.scaleY *=
      values.height /
      bounds.height
  }

  if (
    typeof values.angle ===
    'number'
  ) {
    object.angle =
      values.angle
  }

  object.setCoords()
}

import {
  FabricImage,
  type Canvas
} from 'fabric'

import type {
  MAQuadroFabricObject
} from './canvasObjects'

import {
  getMAQuadroImageSourceDataUrl
} from './imageFilters'

export type MAQuadroPerspectivePoint = {
  x: number
  y: number
}

export type MAQuadroPerspectiveQuad = readonly [
  MAQuadroPerspectivePoint,
  MAQuadroPerspectivePoint,
  MAQuadroPerspectivePoint,
  MAQuadroPerspectivePoint
]

export type MAQuadroPerspectivePreset = {
  id: string
  name: string
  description: string
  quad: MAQuadroPerspectiveQuad
}

export type MAQuadroPerspectiveSource = {
  dataUrl: string
  width: number
  height: number
  name: string
}

export type MAQuadroPerspectivePreviewRect = {
  x: number
  y: number
  width: number
  height: number
}

export const MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH = 720
export const MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT = 480

const HANDLE_MIN = -0.32
const HANDLE_MAX = 1.32
const MIN_EDGE = 0.055
const MIN_AREA = 0.045
const OUTPUT_MAX_SIDE = 4096
const OUTPUT_MAX_PIXELS = 12_000_000
const SOURCE_MAX_PIXELS = 50_000_000

export const MA_QUADRO_PERSPECTIVE_IDENTITY:
  MAQuadroPerspectiveQuad = [
    {
      x: 0,
      y: 0
    },
    {
      x: 1,
      y: 0
    },
    {
      x: 1,
      y: 1
    },
    {
      x: 0,
      y: 1
    }
  ]

export const MA_QUADRO_PERSPECTIVE_PRESETS:
  MAQuadroPerspectivePreset[] = [
    {
      id: 'front',
      name: 'Frontal',
      description: 'Sem inclinação',
      quad:
        MA_QUADRO_PERSPECTIVE_IDENTITY
    },
    {
      id: 'left',
      name: 'Esquerda',
      description: 'Fuga para a esquerda',
      quad: [
        {
          x: 0.14,
          y: 0.12
        },
        {
          x: 1,
          y: 0
        },
        {
          x: 1,
          y: 1
        },
        {
          x: 0.14,
          y: 0.88
        }
      ]
    },
    {
      id: 'right',
      name: 'Direita',
      description: 'Fuga para a direita',
      quad: [
        {
          x: 0,
          y: 0
        },
        {
          x: 0.86,
          y: 0.12
        },
        {
          x: 0.86,
          y: 0.88
        },
        {
          x: 0,
          y: 1
        }
      ]
    },
    {
      id: 'top',
      name: 'Topo',
      description: 'Fuga para cima',
      quad: [
        {
          x: 0.11,
          y: 0.12
        },
        {
          x: 0.89,
          y: 0.12
        },
        {
          x: 1,
          y: 1
        },
        {
          x: 0,
          y: 1
        }
      ]
    },
    {
      id: 'bottom',
      name: 'Base',
      description: 'Fuga para baixo',
      quad: [
        {
          x: 0,
          y: 0
        },
        {
          x: 1,
          y: 0
        },
        {
          x: 0.89,
          y: 0.88
        },
        {
          x: 0.11,
          y: 0.88
        }
      ]
    }
  ]

export function cloneMAQuadroPerspectiveQuad(
  quad: MAQuadroPerspectiveQuad
): MAQuadroPerspectiveQuad {
  return quad.map(
    (point) => ({
      ...point
    })
  ) as unknown as MAQuadroPerspectiveQuad
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
      Number.isFinite(value)
        ? value
        : minimum
    )
  )
}

function distance(
  first: MAQuadroPerspectivePoint,
  second: MAQuadroPerspectivePoint
) {
  return Math.hypot(
    second.x - first.x,
    second.y - first.y
  )
}

function polygonArea(
  quad: MAQuadroPerspectiveQuad
) {
  let sum = 0

  for (
    let index = 0;
    index < quad.length;
    index += 1
  ) {
    const current = quad[index]

    const next =
      quad[
        (index + 1) %
        quad.length
      ]

    sum +=
      current.x * next.y -
      next.x * current.y
  }

  return Math.abs(sum) / 2
}

function cross(
  first: MAQuadroPerspectivePoint,
  second: MAQuadroPerspectivePoint,
  third: MAQuadroPerspectivePoint
) {
  return (
    (second.x - first.x) *
      (third.y - second.y) -
    (second.y - first.y) *
      (third.x - second.x)
  )
}

export function isValidMAQuadroPerspectiveQuad(
  quad: MAQuadroPerspectiveQuad
) {
  if (
    polygonArea(quad) <
    MIN_AREA
  ) {
    return false
  }

  for (
    let index = 0;
    index < quad.length;
    index += 1
  ) {
    if (
      distance(
        quad[index],
        quad[
          (index + 1) %
          quad.length
        ]
      ) <
      MIN_EDGE
    ) {
      return false
    }
  }

  const crosses =
    quad.map(
      (_, index) =>
        cross(
          quad[index],
          quad[
            (index + 1) %
            quad.length
          ],
          quad[
            (index + 2) %
            quad.length
          ]
        )
    )

  const positive =
    crosses.every(
      (value) =>
        value > 0.0001
    )

  const negative =
    crosses.every(
      (value) =>
        value < -0.0001
    )

  return positive || negative
}

export function constrainMAQuadroPerspectivePoint(
  quad: MAQuadroPerspectiveQuad,
  index: number,
  point: MAQuadroPerspectivePoint
) {
  const candidate = [
    ...cloneMAQuadroPerspectiveQuad(
      quad
    )
  ]

  candidate[index] = {
    x: clamp(
      point.x,
      HANDLE_MIN,
      HANDLE_MAX
    ),
    y: clamp(
      point.y,
      HANDLE_MIN,
      HANDLE_MAX
    )
  }

  const next =
    candidate as unknown as
      MAQuadroPerspectiveQuad

  return isValidMAQuadroPerspectiveQuad(
    next
  )
    ? next
    : cloneMAQuadroPerspectiveQuad(
        quad
      )
}

export function getMAQuadroPerspectivePreviewRect(
  sourceWidth: number,
  sourceHeight: number
): MAQuadroPerspectivePreviewRect {
  const extendedRange =
    HANDLE_MAX -
    HANDLE_MIN

  const availableWidth =
    (
      MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH -
      40
    ) /
    extendedRange

  const availableHeight =
    (
      MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT -
      40
    ) /
    extendedRange

  const sourceRatio =
    Math.max(
      0.0001,
      sourceWidth /
        Math.max(
          1,
          sourceHeight
        )
    )

  let width =
    availableWidth

  let height =
    width /
    sourceRatio

  if (
    height >
    availableHeight
  ) {
    height =
      availableHeight

    width =
      height *
      sourceRatio
  }

  return {
    x:
      (
        MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH -
        width
      ) /
      2,
    y:
      (
        MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT -
        height
      ) /
      2,
    width,
    height
  }
}

export function perspectivePointToPreview(
  point: MAQuadroPerspectivePoint,
  rect: MAQuadroPerspectivePreviewRect
) {
  return {
    x:
      rect.x +
      point.x *
        rect.width,
    y:
      rect.y +
      point.y *
        rect.height
  }
}

function solveLinearSystem(
  matrix: number[][],
  vector: number[]
) {
  const size =
    vector.length

  const augmented =
    matrix.map(
      (row, index) => [
        ...row,
        vector[index]
      ]
    )

  for (
    let column = 0;
    column < size;
    column += 1
  ) {
    let pivot =
      column

    for (
      let row =
        column + 1;
      row < size;
      row += 1
    ) {
      if (
        Math.abs(
          augmented[row][column]
        ) >
        Math.abs(
          augmented[pivot][column]
        )
      ) {
        pivot =
          row
      }
    }

    if (
      Math.abs(
        augmented[pivot][column]
      ) <
      1e-10
    ) {
      throw new Error(
        'A perspetiva selecionada é demasiado extrema.'
      )
    }

    if (
      pivot !==
      column
    ) {
      const temporary =
        augmented[column]

      augmented[column] =
        augmented[pivot]

      augmented[pivot] =
        temporary
    }

    const divisor =
      augmented[column][column]

    for (
      let cursor =
        column;
      cursor <= size;
      cursor += 1
    ) {
      augmented[column][cursor] /=
        divisor
    }

    for (
      let row = 0;
      row < size;
      row += 1
    ) {
      if (
        row ===
        column
      ) {
        continue
      }

      const factor =
        augmented[row][column]

      if (
        Math.abs(factor) <
        1e-14
      ) {
        continue
      }

      for (
        let cursor =
          column;
        cursor <= size;
        cursor += 1
      ) {
        augmented[row][cursor] -=
          factor *
          augmented[column][cursor]
      }
    }
  }

  return augmented.map(
    (row) =>
      row[size]
  )
}

type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
]

function createHomography(
  destination:
    MAQuadroPerspectiveQuad
): Homography {
  const source:
    MAQuadroPerspectiveQuad = [
      {
        x: 0,
        y: 0
      },
      {
        x: 1,
        y: 0
      },
      {
        x: 1,
        y: 1
      },
      {
        x: 0,
        y: 1
      }
    ]

  const matrix: number[][] =
    []

  const vector: number[] =
    []

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    const {
      x,
      y
    } =
      source[index]

    const target =
      destination[index]

    matrix.push([
      x,
      y,
      1,
      0,
      0,
      0,
      -x * target.x,
      -y * target.x
    ])

    vector.push(
      target.x
    )

    matrix.push([
      0,
      0,
      0,
      x,
      y,
      1,
      -x * target.y,
      -y * target.y
    ])

    vector.push(
      target.y
    )
  }

  return solveLinearSystem(
    matrix,
    vector
  ) as unknown as Homography
}

function transformPoint(
  homography: Homography,
  x: number,
  y: number
) {
  const denominator =
    homography[6] *
      x +
    homography[7] *
      y +
    1

  if (
    Math.abs(denominator) <
    1e-9
  ) {
    return {
      x: 0,
      y: 0
    }
  }

  return {
    x:
      (
        homography[0] *
          x +
        homography[1] *
          y +
        homography[2]
      ) /
      denominator,
    y:
      (
        homography[3] *
          x +
        homography[4] *
          y +
        homography[5]
      ) /
      denominator
  }
}

type Triangle = readonly [
  MAQuadroPerspectivePoint,
  MAQuadroPerspectivePoint,
  MAQuadroPerspectivePoint
]

function affineFromTriangles(
  source: Triangle,
  destination: Triangle
) {
  const [
    s0,
    s1,
    s2
  ] =
    source

  const [
    d0,
    d1,
    d2
  ] =
    destination

  const denominator =
    s0.x *
      (
        s1.y -
        s2.y
      ) +
    s1.x *
      (
        s2.y -
        s0.y
      ) +
    s2.x *
      (
        s0.y -
        s1.y
      )

  if (
    Math.abs(denominator) <
    1e-8
  ) {
    return null
  }

  const a =
    (
      d0.x *
        (
          s1.y -
          s2.y
        ) +
      d1.x *
        (
          s2.y -
          s0.y
        ) +
      d2.x *
        (
          s0.y -
          s1.y
        )
    ) /
    denominator

  const c =
    (
      d0.x *
        (
          s2.x -
          s1.x
        ) +
      d1.x *
        (
          s0.x -
          s2.x
        ) +
      d2.x *
        (
          s1.x -
          s0.x
        )
    ) /
    denominator

  const e =
    (
      d0.x *
        (
          s1.x * s2.y -
          s2.x * s1.y
        ) +
      d1.x *
        (
          s2.x * s0.y -
          s0.x * s2.y
        ) +
      d2.x *
        (
          s0.x * s1.y -
          s1.x * s0.y
        )
    ) /
    denominator

  const b =
    (
      d0.y *
        (
          s1.y -
          s2.y
        ) +
      d1.y *
        (
          s2.y -
          s0.y
        ) +
      d2.y *
        (
          s0.y -
          s1.y
        )
    ) /
    denominator

  const d =
    (
      d0.y *
        (
          s2.x -
          s1.x
        ) +
      d1.y *
        (
          s0.x -
          s2.x
        ) +
      d2.y *
        (
          s1.x -
          s0.x
        )
    ) /
    denominator

  const f =
    (
      d0.y *
        (
          s1.x * s2.y -
          s2.x * s1.y
        ) +
      d1.y *
        (
          s2.x * s0.y -
          s0.x * s2.y
        ) +
      d2.y *
        (
          s0.x * s1.y -
          s1.x * s0.y
        )
    ) /
    denominator

  return {
    a,
    b,
    c,
    d,
    e,
    f
  }
}

function expandTriangle(
  triangle: Triangle,
  amount: number
): Triangle {
  const center = {
    x:
      (
        triangle[0].x +
        triangle[1].x +
        triangle[2].x
      ) /
      3,
    y:
      (
        triangle[0].y +
        triangle[1].y +
        triangle[2].y
      ) /
      3
  }

  return triangle.map(
    (point) => {
      const dx =
        point.x -
        center.x

      const dy =
        point.y -
        center.y

      const length =
        Math.hypot(
          dx,
          dy
        ) ||
        1

      return {
        x:
          point.x +
          (
            dx /
            length
          ) *
            amount,
        y:
          point.y +
          (
            dy /
            length
          ) *
            amount
      }
    }
  ) as unknown as Triangle
}

function drawTexturedTriangle(
  context:
    CanvasRenderingContext2D,
  image:
    CanvasImageSource,
  source:
    Triangle,
  destination:
    Triangle,
  seamExpansion = 0.7
) {
  const affine =
    affineFromTriangles(
      source,
      destination
    )

  if (!affine) {
    return
  }

  const clipTriangle =
    expandTriangle(
      destination,
      seamExpansion
    )

  context.save()

  context.beginPath()

  context.moveTo(
    clipTriangle[0].x,
    clipTriangle[0].y
  )

  context.lineTo(
    clipTriangle[1].x,
    clipTriangle[1].y
  )

  context.lineTo(
    clipTriangle[2].x,
    clipTriangle[2].y
  )

  context.closePath()
  context.clip()

  context.setTransform(
    affine.a,
    affine.b,
    affine.c,
    affine.d,
    affine.e,
    affine.f
  )

  context.drawImage(
    image,
    0,
    0
  )

  context.restore()
}

function renderProjectiveMesh(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  destination:
    MAQuadroPerspectiveQuad,
  divisions:
    number
) {
  const homography =
    createHomography(
      destination
    )

  const sourceWidth =
    image.naturalWidth

  const sourceHeight =
    image.naturalHeight

  context.imageSmoothingEnabled =
    true

  context.imageSmoothingQuality =
    'high'

  for (
    let row = 0;
    row < divisions;
    row += 1
  ) {
    const y0 =
      row /
      divisions

    const y1 =
      (row + 1) /
      divisions

    for (
      let column = 0;
      column < divisions;
      column += 1
    ) {
      const x0 =
        column /
        divisions

      const x1 =
        (column + 1) /
        divisions

      const p00 =
        transformPoint(
          homography,
          x0,
          y0
        )

      const p10 =
        transformPoint(
          homography,
          x1,
          y0
        )

      const p11 =
        transformPoint(
          homography,
          x1,
          y1
        )

      const p01 =
        transformPoint(
          homography,
          x0,
          y1
        )

      const s00 = {
        x:
          x0 *
          sourceWidth,
        y:
          y0 *
          sourceHeight
      }

      const s10 = {
        x:
          x1 *
          sourceWidth,
        y:
          y0 *
          sourceHeight
      }

      const s11 = {
        x:
          x1 *
          sourceWidth,
        y:
          y1 *
          sourceHeight
      }

      const s01 = {
        x:
          x0 *
          sourceWidth,
        y:
          y1 *
          sourceHeight
      }

      drawTexturedTriangle(
        context,
        image,
        [
          s00,
          s10,
          s11
        ],
        [
          p00,
          p10,
          p11
        ]
      )

      drawTexturedTriangle(
        context,
        image,
        [
          s00,
          s11,
          s01
        ],
        [
          p00,
          p11,
          p01
        ]
      )
    }
  }
}

function drawCheckerboard(
  context:
    CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const size = 18

  context.fillStyle =
    '#E2E8F0'

  context.fillRect(
    0,
    0,
    width,
    height
  )

  context.fillStyle =
    '#CBD5E1'

  for (
    let y = 0;
    y < height;
    y += size
  ) {
    for (
      let x = 0;
      x < width;
      x += size
    ) {
      if (
        (
          x / size +
          y / size
        ) %
          2 ===
        0
      ) {
        context.fillRect(
          x,
          y,
          size,
          size
        )
      }
    }
  }
}

export function renderMAQuadroPerspectivePreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  quad: MAQuadroPerspectiveQuad
) {
  canvas.width =
    MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH

  canvas.height =
    MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    return
  }

  drawCheckerboard(
    context,
    MA_QUADRO_PERSPECTIVE_PREVIEW_WIDTH,
    MA_QUADRO_PERSPECTIVE_PREVIEW_HEIGHT
  )

  const rect =
    getMAQuadroPerspectivePreviewRect(
      image.naturalWidth,
      image.naturalHeight
    )

  const destination =
    quad.map(
      (point) =>
        perspectivePointToPreview(
          point,
          rect
        )
    ) as unknown as
      MAQuadroPerspectiveQuad

  renderProjectiveMesh(
    context,
    image,
    destination,
    16
  )

  const homography =
    createHomography(
      destination
    )

  context.save()

  context.strokeStyle =
    'rgba(103, 232, 249, 0.42)'

  context.lineWidth = 1

  for (
    let index = 1;
    index < 4;
    index += 1
  ) {
    const progress =
      index / 4

    const verticalStart =
      transformPoint(
        homography,
        progress,
        0
      )

    const verticalEnd =
      transformPoint(
        homography,
        progress,
        1
      )

    const horizontalStart =
      transformPoint(
        homography,
        0,
        progress
      )

    const horizontalEnd =
      transformPoint(
        homography,
        1,
        progress
      )

    context.beginPath()

    context.moveTo(
      verticalStart.x,
      verticalStart.y
    )

    context.lineTo(
      verticalEnd.x,
      verticalEnd.y
    )

    context.stroke()

    context.beginPath()

    context.moveTo(
      horizontalStart.x,
      horizontalStart.y
    )

    context.lineTo(
      horizontalEnd.x,
      horizontalEnd.y
    )

    context.stroke()
  }

  context.strokeStyle =
    'rgba(248, 250, 252, 0.9)'

  context.lineWidth = 2

  context.beginPath()

  context.moveTo(
    destination[0].x,
    destination[0].y
  )

  for (
    let index = 1;
    index < 4;
    index += 1
  ) {
    context.lineTo(
      destination[index].x,
      destination[index].y
    )
  }

  context.closePath()
  context.stroke()
  context.restore()
}

export function getMAQuadroPerspectiveSource(
  canvas: Canvas
): MAQuadroPerspectiveSource | null {
  const active =
    canvas.getActiveObject()

  if (
    !(
      active instanceof
      FabricImage
    )
  ) {
    return null
  }

  const image =
    active as
      FabricImage &
      MAQuadroFabricObject

  const dataUrl =
    getMAQuadroImageSourceDataUrl(
      image
    )

  if (!dataUrl) {
    return null
  }

  const width =
    Math.max(
      1,
      Number(
        image.maOriginalWidth ||
        image.width ||
        1
      )
    )

  const height =
    Math.max(
      1,
      Number(
        image.maOriginalHeight ||
        image.height ||
        1
      )
    )

  return {
    dataUrl,
    width,
    height,
    name:
      image.maName ||
      'imagem'
  }
}

export function loadMAQuadroPerspectiveSourceImage(
  source: MAQuadroPerspectiveSource
) {
  return new Promise<HTMLImageElement>(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image()

      image.decoding =
        'async'

      image.onload =
        () => {
          if (
            image.naturalWidth *
              image.naturalHeight >
            SOURCE_MAX_PIXELS
          ) {
            reject(
              new Error(
                'Esta imagem tem demasiados píxeis para a transformação de perspetiva.'
              )
            )

            return
          }

          resolve(
            image
          )
        }

      image.onerror =
        () => {
          reject(
            new Error(
              'Não foi possível abrir a origem desta imagem para aplicar perspetiva.'
            )
          )
        }

      image.src =
        source.dataUrl
    }
  )
}

function safeOutputScale(
  width: number,
  height: number
) {
  return Math.min(
    1,
    OUTPUT_MAX_SIDE /
      Math.max(
        width,
        height
      ),
    Math.sqrt(
      OUTPUT_MAX_PIXELS /
        Math.max(
          1,
          width *
            height
        )
    )
  )
}

function canvasToBlob(
  canvas: HTMLCanvasElement
) {
  return new Promise<Blob>(
    (
      resolve,
      reject
    ) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(
              blob
            )

            return
          }

          reject(
            new Error(
              'O browser não conseguiu criar a imagem em perspetiva.'
            )
          )
        },
        'image/png'
      )
    }
  )
}

function safeName(
  value: string
) {
  const base =
    value
      .replace(
        /\.[^.]+$/,
        ''
      )
      .trim()
      .replace(
        /[^\p{L}\p{N}._-]+/gu,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )

  return base || 'imagem'
}

export async function createMAQuadroPerspectiveFile(
  source: MAQuadroPerspectiveSource,
  quad: MAQuadroPerspectiveQuad
) {
  if (
    !isValidMAQuadroPerspectiveQuad(
      quad
    )
  ) {
    throw new Error(
      'A posição dos quatro cantos não forma uma perspetiva válida.'
    )
  }

  const image =
    await loadMAQuadroPerspectiveSourceImage(
      source
    )

  const rawDestination =
    quad.map(
      (point) => ({
        x:
          point.x *
          image.naturalWidth,
        y:
          point.y *
          image.naturalHeight
      })
    ) as unknown as
      MAQuadroPerspectiveQuad

  const xs =
    rawDestination.map(
      (point) =>
        point.x
    )

  const ys =
    rawDestination.map(
      (point) =>
        point.y
    )

  const minimumX =
    Math.min(...xs)

  const maximumX =
    Math.max(...xs)

  const minimumY =
    Math.min(...ys)

  const maximumY =
    Math.max(...ys)

  const rawWidth =
    Math.max(
      1,
      maximumX -
        minimumX
    )

  const rawHeight =
    Math.max(
      1,
      maximumY -
        minimumY
    )

  const scale =
    safeOutputScale(
      rawWidth,
      rawHeight
    )

  const outputWidth =
    Math.max(
      1,
      Math.ceil(
        rawWidth *
        scale
      )
    )

  const outputHeight =
    Math.max(
      1,
      Math.ceil(
        rawHeight *
        scale
      )
    )

  const destination =
    rawDestination.map(
      (point) => ({
        x:
          (
            point.x -
            minimumX
          ) *
          scale,
        y:
          (
            point.y -
            minimumY
          ) *
          scale
      })
    ) as unknown as
      MAQuadroPerspectiveQuad

  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width =
    outputWidth

  canvas.height =
    outputHeight

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    throw new Error(
      'O browser não permitiu criar a transformação de perspetiva.'
    )
  }

  context.clearRect(
    0,
    0,
    outputWidth,
    outputHeight
  )

  const divisions =
    Math.round(
      clamp(
        Math.max(
          outputWidth,
          outputHeight
        ) /
          150,
        8,
        32
      )
    )

  renderProjectiveMesh(
    context,
    image,
    destination,
    divisions
  )

  const blob =
    await canvasToBlob(
      canvas
    )

  canvas.width = 0
  canvas.height = 0

  return new File(
    [blob],
    `${safeName(
      source.name
    )}-perspetiva.png`,
    {
      type:
        'image/png',
      lastModified:
        Date.now()
    }
  )
}

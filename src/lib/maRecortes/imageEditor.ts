export type PixelMask =
  Uint8ClampedArray<ArrayBufferLike>

export type EditorPoint = {
  x: number
  y: number
}

export type EditorImage = {
  image: HTMLImageElement
  width: number
  height: number
  mask: PixelMask
}

export type BrushMode =
  | 'remove'
  | 'restore'

const MAX_EDITOR_SIDE = 1400

function loadHtmlImage(
  url: string
) {
  return new Promise<HTMLImageElement>(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image()

      image.onload = () =>
        resolve(image)

      image.onerror =
        () =>
          reject(
            new Error(
              'Não foi possível abrir esta imagem.'
            )
          )

      image.src = url
    }
  )
}

export async function loadEditorImage(
  file: File
): Promise<EditorImage> {
  const url =
    URL.createObjectURL(
      file
    )

  try {
    const image =
      await loadHtmlImage(
        url
      )

    const scale =
      Math.min(
        1,
        MAX_EDITOR_SIDE /
          Math.max(
            image.naturalWidth,
            image.naturalHeight
          )
      )

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
            scale
        )
      )

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
            scale
        )
      )

    return {
      image,
      width,
      height,
      mask:
        new Uint8ClampedArray(
          width * height
        ).fill(255)
    }
  } finally {
    URL.revokeObjectURL(
      url
    )
  }
}

function getImagePixels(
  editor: EditorImage
) {
  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width =
    editor.width

  canvas.height =
    editor.height

  const context =
    canvas.getContext(
      '2d',
      {
        willReadFrequently:
          true
      }
    )

  if (!context) {
    throw new Error(
      'O navegador não permitiu preparar a imagem.'
    )
  }

  context.drawImage(
    editor.image,
    0,
    0,
    editor.width,
    editor.height
  )

  return context.getImageData(
    0,
    0,
    editor.width,
    editor.height
  ).data
}

function colourDistance(
  pixels:
    Uint8ClampedArray<ArrayBufferLike>,
  firstPixelIndex: number,
  secondPixelIndex: number
) {
  const firstOffset =
    firstPixelIndex * 4

  const secondOffset =
    secondPixelIndex * 4

  const red =
    pixels[firstOffset] -
    pixels[secondOffset]

  const green =
    pixels[
      firstOffset + 1
    ] -
    pixels[
      secondOffset + 1
    ]

  const blue =
    pixels[
      firstOffset + 2
    ] -
    pixels[
      secondOffset + 2
    ]

  return Math.sqrt(
    red * red +
      green * green +
      blue * blue
  )
}

function colourDistanceFromSample(
  pixels:
    Uint8ClampedArray<ArrayBufferLike>,
  pixelIndex: number,
  sample:
    readonly [
      number,
      number,
      number
    ]
) {
  const offset =
    pixelIndex * 4

  const red =
    pixels[offset] -
    sample[0]

  const green =
    pixels[
      offset + 1
    ] -
    sample[1]

  const blue =
    pixels[
      offset + 2
    ] -
    sample[2]

  return Math.sqrt(
    red * red +
      green * green +
      blue * blue
  )
}

function getPixelColour(
  pixels:
    Uint8ClampedArray<ArrayBufferLike>,
  pixelIndex: number
): [
  number,
  number,
  number
] {
  const offset =
    pixelIndex * 4

  return [
    pixels[offset],
    pixels[
      offset + 1
    ],
    pixels[
      offset + 2
    ]
  ]
}

function getBackgroundSamples(
  pixels:
    Uint8ClampedArray<ArrayBufferLike>,
  width: number,
  height: number
) {
  const positions = [
    {
      x: 0,
      y: 0
    },
    {
      x:
        Math.floor(
          width / 2
        ),
      y: 0
    },
    {
      x:
        width - 1,
      y: 0
    },
    {
      x:
        width - 1,
      y:
        Math.floor(
          height / 2
        )
    },
    {
      x:
        width - 1,
      y:
        height - 1
    },
    {
      x:
        Math.floor(
          width / 2
        ),
      y:
        height - 1
    },
    {
      x: 0,
      y:
        height - 1
    },
    {
      x: 0,
      y:
        Math.floor(
          height / 2
        )
    }
  ]

  return positions.map(
    ({
      x,
      y
    }) =>
      getPixelColour(
        pixels,
        y * width + x
      )
  )
}

function getBackgroundDistance(
  pixels:
    Uint8ClampedArray<ArrayBufferLike>,
  pixelIndex: number,
  samples:
    ReadonlyArray<
      readonly [
        number,
        number,
        number
      ]
    >
) {
  let minimumDistance =
    Number.POSITIVE_INFINITY

  for (
    const sample of samples
  ) {
    minimumDistance =
      Math.min(
        minimumDistance,
        colourDistanceFromSample(
          pixels,
          pixelIndex,
          sample
        )
      )
  }

  return minimumDistance
}

export function createAutomaticMask(
  editor: EditorImage,
  tolerance: number
): PixelMask {
  const {
    width,
    height
  } = editor

  const pixels =
    getImagePixels(
      editor
    )

  const samples =
    getBackgroundSamples(
      pixels,
      width,
      height
    )

  const mask:
    PixelMask =
      new Uint8ClampedArray(
        width * height
      ).fill(255)

  const visited =
    new Uint8Array(
      width * height
    )

  const queue =
    new Int32Array(
      width * height
    )

  let queueStart = 0
  let queueEnd = 0

  const localTolerance =
    Math.max(
      24,
      tolerance * 0.6
    )

  const extendedTolerance =
    tolerance * 1.3

  const canRemove =
    (
      pixelIndex: number,
      previousPixelIndex:
        number | null
    ) => {
      const backgroundDistance =
        getBackgroundDistance(
          pixels,
          pixelIndex,
          samples
        )

      if (
        backgroundDistance <=
        tolerance
      ) {
        return true
      }

      if (
        previousPixelIndex ===
        null
      ) {
        return false
      }

      const localDistance =
        colourDistance(
          pixels,
          pixelIndex,
          previousPixelIndex
        )

      return (
        backgroundDistance <=
          extendedTolerance &&
        localDistance <=
          localTolerance
      )
    }

  const enqueue =
    (
      pixelIndex: number,
      previousPixelIndex:
        number | null
    ) => {
      if (
        visited[
          pixelIndex
        ]
      ) {
        return
      }

      if (
        !canRemove(
          pixelIndex,
          previousPixelIndex
        )
      ) {
        return
      }

      visited[
        pixelIndex
      ] = 1

      queue[
        queueEnd
      ] = pixelIndex

      queueEnd += 1
    }

  for (
    let x = 0;
    x < width;
    x += 1
  ) {
    enqueue(
      x,
      null
    )

    enqueue(
      (
        height - 1
      ) *
        width +
        x,
      null
    )
  }

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    enqueue(
      y * width,
      null
    )

    enqueue(
      y * width +
        width -
        1,
      null
    )
  }

  while (
    queueStart <
    queueEnd
  ) {
    const pixelIndex =
      queue[
        queueStart
      ]

    queueStart += 1

    mask[
      pixelIndex
    ] = 0

    const x =
      pixelIndex %
      width

    const y =
      Math.floor(
        pixelIndex /
          width
      )

    if (x > 0) {
      enqueue(
        pixelIndex - 1,
        pixelIndex
      )
    }

    if (
      x <
      width - 1
    ) {
      enqueue(
        pixelIndex + 1,
        pixelIndex
      )
    }

    if (y > 0) {
      enqueue(
        pixelIndex -
          width,
        pixelIndex
      )
    }

    if (
      y <
      height - 1
    ) {
      enqueue(
        pixelIndex +
          width,
        pixelIndex
      )
    }
  }

  return softenMask(
    mask,
    width,
    height,
    1
  )
}

export function createEmptyMask(
  width: number,
  height: number
): PixelMask {
  return new Uint8ClampedArray(
    width * height
  )
}

export function createPolygonMask(
  width: number,
  height: number,
  points:
    EditorPoint[]
): PixelMask {
  if (
    points.length < 3
  ) {
    throw new Error(
      'Marque pelo menos três pontos para criar o recorte.'
    )
  }

  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width = width
  canvas.height = height

  const context =
    canvas.getContext(
      '2d',
      {
        willReadFrequently:
          true
      }
    )

  if (!context) {
    throw new Error(
      'Não foi possível criar a seleção manual.'
    )
  }

  context.clearRect(
    0,
    0,
    width,
    height
  )

  context.fillStyle =
    '#ffffff'

  context.beginPath()

  context.moveTo(
    points[0].x,
    points[0].y
  )

  for (
    let index = 1;
    index <
    points.length;
    index += 1
  ) {
    context.lineTo(
      points[index].x,
      points[index].y
    )
  }

  context.closePath()
  context.fill()

  const imageData =
    context.getImageData(
      0,
      0,
      width,
      height
    )

  const mask:
    PixelMask =
      new Uint8ClampedArray(
        width * height
      )

  for (
    let index = 0;
    index <
    mask.length;
    index += 1
  ) {
    mask[index] =
      imageData.data[
        index * 4 + 3
      ]
  }

  return mask
}

export function paintMask(
  mask: PixelMask,
  width: number,
  height: number,
  centreX: number,
  centreY: number,
  radius: number,
  mode: BrushMode
) {
  const minX =
    Math.max(
      0,
      Math.floor(
        centreX -
          radius
      )
    )

  const maxX =
    Math.min(
      width - 1,
      Math.ceil(
        centreX +
          radius
      )
    )

  const minY =
    Math.max(
      0,
      Math.floor(
        centreY -
          radius
      )
    )

  const maxY =
    Math.min(
      height - 1,
      Math.ceil(
        centreY +
          radius
      )
    )

  const radiusSquared =
    radius * radius

  const value =
    mode ===
    'restore'
      ? 255
      : 0

  for (
    let y = minY;
    y <= maxY;
    y += 1
  ) {
    for (
      let x = minX;
      x <= maxX;
      x += 1
    ) {
      const deltaX =
        x - centreX

      const deltaY =
        y - centreY

      if (
        deltaX *
          deltaX +
        deltaY *
          deltaY <=
        radiusSquared
      ) {
        mask[
          y *
            width +
            x
        ] = value
      }
    }
  }
}

export function softenMask(
  mask: PixelMask,
  width: number,
  height: number,
  radius: number
): PixelMask {
  if (
    radius <= 0
  ) {
    return mask.slice()
  }

  const safeRadius =
    Math.min(
      4,
      Math.max(
        1,
        Math.round(
          radius
        )
      )
    )

  const horizontal =
    new Float32Array(
      mask.length
    )

  const nextMask:
    PixelMask =
      new Uint8ClampedArray(
        mask.length
      )

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    let total = 0

    for (
      let offset =
        -safeRadius;
      offset <=
      safeRadius;
      offset += 1
    ) {
      const sampleX =
        Math.min(
          width - 1,
          Math.max(
            0,
            offset
          )
        )

      total +=
        mask[
          y *
            width +
            sampleX
        ]
    }

    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      horizontal[
        y *
          width +
          x
      ] =
        total /
        (
          safeRadius *
            2 +
          1
        )

      const removeX =
        Math.min(
          width - 1,
          Math.max(
            0,
            x -
              safeRadius
          )
        )

      const addX =
        Math.min(
          width - 1,
          Math.max(
            0,
            x +
              safeRadius +
              1
          )
        )

      total +=
        mask[
          y *
            width +
            addX
        ] -
        mask[
          y *
            width +
            removeX
        ]
    }
  }

  for (
    let x = 0;
    x < width;
    x += 1
  ) {
    let total = 0

    for (
      let offset =
        -safeRadius;
      offset <=
      safeRadius;
      offset += 1
    ) {
      const sampleY =
        Math.min(
          height - 1,
          Math.max(
            0,
            offset
          )
        )

      total +=
        horizontal[
          sampleY *
            width +
            x
        ]
    }

    for (
      let y = 0;
      y < height;
      y += 1
    ) {
      nextMask[
        y *
          width +
          x
      ] =
        Math.round(
          total /
            (
              safeRadius *
                2 +
              1
            )
        )

      const removeY =
        Math.min(
          height - 1,
          Math.max(
            0,
            y -
              safeRadius
          )
        )

      const addY =
        Math.min(
          height - 1,
          Math.max(
            0,
            y +
              safeRadius +
              1
          )
        )

      total +=
        horizontal[
          addY *
            width +
            x
        ] -
        horizontal[
          removeY *
            width +
            x
        ]
    }
  }

  return nextMask
}

export function renderPolygonSelectionCanvas(
  canvas:
    HTMLCanvasElement,
  editor: EditorImage,
  points:
    EditorPoint[]
) {
  canvas.width =
    editor.width

  canvas.height =
    editor.height

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    return
  }

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  )

  context.drawImage(
    editor.image,
    0,
    0,
    editor.width,
    editor.height
  )

  context.fillStyle =
    'rgba(2, 6, 23, 0.38)'

  context.fillRect(
    0,
    0,
    editor.width,
    editor.height
  )

  if (
    points.length >= 3
  ) {
    context.save()

    context.beginPath()

    context.moveTo(
      points[0].x,
      points[0].y
    )

    for (
      let index = 1;
      index <
      points.length;
      index += 1
    ) {
      context.lineTo(
        points[index].x,
        points[index].y
      )
    }

    context.closePath()
    context.clip()

    context.drawImage(
      editor.image,
      0,
      0,
      editor.width,
      editor.height
    )

    context.restore()
  }

  if (
    points.length === 0
  ) {
    return
  }

  const lineWidth =
    Math.max(
      3,
      Math.min(
        editor.width,
        editor.height
      ) * 0.004
    )

  const pointRadius =
    Math.max(
      6,
      Math.min(
        editor.width,
        editor.height
      ) * 0.009
    )

  context.lineCap =
    'round'

  context.lineJoin =
    'round'

  context.strokeStyle =
    '#67e8f9'

  context.lineWidth =
    lineWidth

  context.beginPath()

  context.moveTo(
    points[0].x,
    points[0].y
  )

  for (
    let index = 1;
    index <
    points.length;
    index += 1
  ) {
    context.lineTo(
      points[index].x,
      points[index].y
    )
  }

  context.stroke()

  if (
    points.length >= 3
  ) {
    const lastPoint =
      points[
        points.length - 1
      ]

    context.save()

    context.setLineDash([
      lineWidth * 2,
      lineWidth * 2
    ])

    context.strokeStyle =
      'rgba(255, 255, 255, 0.8)'

    context.beginPath()

    context.moveTo(
      lastPoint.x,
      lastPoint.y
    )

    context.lineTo(
      points[0].x,
      points[0].y
    )

    context.stroke()
    context.restore()
  }

  points.forEach(
    (
      point,
      index
    ) => {
      context.beginPath()

      context.arc(
        point.x,
        point.y,
        index === 0
          ? pointRadius * 1.3
          : pointRadius,
        0,
        Math.PI * 2
      )

      context.fillStyle =
        index === 0
          ? '#facc15'
          : '#67e8f9'

      context.fill()

      context.lineWidth =
        Math.max(
          2,
          lineWidth * 0.6
        )

      context.strokeStyle =
        '#082f49'

      context.stroke()

      if (index === 0) {
        context.beginPath()

        context.arc(
          point.x,
          point.y,
          pointRadius * 2,
          0,
          Math.PI * 2
        )

        context.strokeStyle =
          'rgba(250, 204, 21, 0.75)'

        context.lineWidth =
          lineWidth

        context.stroke()
      }
    }
  )
}

export function renderEditorCanvas(
  canvas:
    HTMLCanvasElement,
  editor: EditorImage,
  mask: PixelMask,
  outlineSize: number
) {
  canvas.width =
    editor.width

  canvas.height =
    editor.height

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    return
  }

  const cutout =
    createCutoutCanvas(
      editor,
      mask
    )

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  )

  if (
    outlineSize > 0
  ) {
    drawOutline(
      context,
      cutout,
      outlineSize,
      '#ffffff'
    )
  }

  context.drawImage(
    cutout,
    0,
    0
  )
}

function createCutoutCanvas(
  editor: EditorImage,
  mask: PixelMask
) {
  const imageCanvas =
    document.createElement(
      'canvas'
    )

  imageCanvas.width =
    editor.width

  imageCanvas.height =
    editor.height

  const context =
    imageCanvas.getContext(
      '2d',
      {
        willReadFrequently:
          true
      }
    )

  if (!context) {
    throw new Error(
      'Não foi possível preparar o recorte.'
    )
  }

  context.drawImage(
    editor.image,
    0,
    0,
    editor.width,
    editor.height
  )

  const imageData =
    context.getImageData(
      0,
      0,
      editor.width,
      editor.height
    )

  for (
    let index = 0;
    index <
    mask.length;
    index += 1
  ) {
    imageData.data[
      index * 4 + 3
    ] =
      mask[index]
  }

  context.putImageData(
    imageData,
    0,
    0
  )

  return imageCanvas
}

function drawOutline(
  context:
    CanvasRenderingContext2D,
  cutout:
    HTMLCanvasElement,
  size: number,
  colour: string
) {
  const outlineCanvas =
    document.createElement(
      'canvas'
    )

  outlineCanvas.width =
    cutout.width

  outlineCanvas.height =
    cutout.height

  const outlineContext =
    outlineCanvas.getContext(
      '2d'
    )

  if (!outlineContext) {
    return
  }

  outlineContext.drawImage(
    cutout,
    0,
    0
  )

  outlineContext.globalCompositeOperation =
    'source-in'

  outlineContext.fillStyle =
    colour

  outlineContext.fillRect(
    0,
    0,
    outlineCanvas.width,
    outlineCanvas.height
  )

  outlineContext.globalCompositeOperation =
    'source-over'

  const safeSize =
    Math.max(
      1,
      Math.round(
        size
      )
    )

  for (
    let angle = 0;
    angle < 360;
    angle += 12
  ) {
    const radians =
      (
        angle *
        Math.PI
      ) / 180

    context.drawImage(
      outlineCanvas,
      Math.cos(
        radians
      ) * safeSize,
      Math.sin(
        radians
      ) * safeSize
    )
  }
}

function findMaskBounds(
  mask: PixelMask,
  width: number,
  height: number
) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      if (
        mask[
          y *
            width +
            x
        ] < 8
      ) {
        continue
      }

      minX =
        Math.min(
          minX,
          x
        )

      minY =
        Math.min(
          minY,
          y
        )

      maxX =
        Math.max(
          maxX,
          x
        )

      maxY =
        Math.max(
          maxY,
          y
        )
    }
  }

  if (
    maxX < minX ||
    maxY < minY
  ) {
    return null
  }

  return {
    x: minX,
    y: minY,
    width:
      maxX -
      minX +
      1,
    height:
      maxY -
      minY +
      1
  }
}

export async function createExportBlob(
  editor: EditorImage,
  mask: PixelMask,
  options: {
    whatsapp: boolean
    outlineSize: number
  }
) {
  const bounds =
    findMaskBounds(
      mask,
      editor.width,
      editor.height
    )

  if (!bounds) {
    throw new Error(
      'O recorte está vazio. Restaure uma parte da imagem antes de exportar.'
    )
  }

  const source =
    createCutoutCanvas(
      editor,
      mask
    )

  const marginRatio =
    options.whatsapp
      ? 0.1
      : 0.04

  const longestSide =
    Math.max(
      bounds.width,
      bounds.height
    )

  const margin =
    Math.max(
      options.outlineSize +
        4,
      Math.round(
        longestSide *
          marginRatio
      )
    )

  const contentWidth =
    bounds.width +
    margin * 2

  const contentHeight =
    bounds.height +
    margin * 2

  const outputSize =
    options.whatsapp
      ? 512
      : Math.max(
          contentWidth,
          contentHeight
        )

  const output =
    document.createElement(
      'canvas'
    )

  output.width =
    outputSize

  output.height =
    outputSize

  const context =
    output.getContext(
      '2d'
    )

  if (!context) {
    throw new Error(
      'Não foi possível criar o ficheiro final.'
    )
  }

  const scale =
    Math.min(
      outputSize /
        contentWidth,
      outputSize /
        contentHeight
    )

  const drawWidth =
    bounds.width *
    scale

  const drawHeight =
    bounds.height *
    scale

  const drawX =
    (
      outputSize -
      drawWidth
    ) / 2

  const drawY =
    (
      outputSize -
      drawHeight
    ) / 2

  const cropped =
    document.createElement(
      'canvas'
    )

  cropped.width =
    bounds.width

  cropped.height =
    bounds.height

  const croppedContext =
    cropped.getContext(
      '2d'
    )

  if (!croppedContext) {
    throw new Error(
      'Não foi possível preparar o ficheiro final.'
    )
  }

  croppedContext.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  )

  if (
    options.outlineSize >
    0
  ) {
    const scaledOutline =
      Math.max(
        1,
        options.outlineSize *
          scale
      )

    const scaledCutout =
      document.createElement(
        'canvas'
      )

    scaledCutout.width =
      outputSize

    scaledCutout.height =
      outputSize

    const scaledContext =
      scaledCutout.getContext(
        '2d'
      )

    if (scaledContext) {
      scaledContext.drawImage(
        cropped,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      )

      drawOutline(
        context,
        scaledCutout,
        scaledOutline,
        '#ffffff'
      )
    }
  }

  context.drawImage(
    cropped,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  )

  return new Promise<Blob>(
    (
      resolve,
      reject
    ) => {
      output.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(
              new Error(
                'Não foi possível criar o PNG final.'
              )
            )
          }
        },
        'image/png'
      )
    }
  )
}

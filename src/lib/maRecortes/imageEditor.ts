export type EditorImage = {
  image: HTMLImageElement
  width: number
  height: number
  mask: Uint8ClampedArray
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
    Uint8ClampedArray,
  pixelIndex: number,
  colour:
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
    colour[0]

  const green =
    pixels[offset + 1] -
    colour[1]

  const blue =
    pixels[offset + 2] -
    colour[2]

  return Math.sqrt(
    red * red +
      green * green +
      blue * blue
  )
}

function averageCornerColour(
  pixels:
    Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  size: number
): [
  number,
  number,
  number
] {
  let red = 0
  let green = 0
  let blue = 0
  let count = 0

  const endX =
    Math.min(
      width,
      startX + size
    )

  const endY =
    Math.min(
      height,
      startY + size
    )

  for (
    let y =
      Math.max(
        0,
        startY
      );
    y < endY;
    y += 1
  ) {
    for (
      let x =
        Math.max(
          0,
          startX
        );
      x < endX;
      x += 1
    ) {
      const offset =
        (
          y * width +
          x
        ) * 4

      red +=
        pixels[offset]

      green +=
        pixels[
          offset + 1
        ]

      blue +=
        pixels[
          offset + 2
        ]

      count += 1
    }
  }

  return [
    Math.round(
      red /
        Math.max(
          1,
          count
        )
    ),
    Math.round(
      green /
        Math.max(
          1,
          count
        )
    ),
    Math.round(
      blue /
        Math.max(
          1,
          count
        )
    )
  ]
}

export function createAutomaticMask(
  editor: EditorImage,
  tolerance: number
) {
  const {
    width,
    height
  } = editor

  const pixels =
    getImagePixels(
      editor
    )

  const cornerSize =
    Math.max(
      2,
      Math.round(
        Math.min(
          width,
          height
        ) * 0.025
      )
    )

  const colours = [
    averageCornerColour(
      pixels,
      width,
      height,
      0,
      0,
      cornerSize
    ),
    averageCornerColour(
      pixels,
      width,
      height,
      width -
        cornerSize,
      0,
      cornerSize
    ),
    averageCornerColour(
      pixels,
      width,
      height,
      0,
      height -
        cornerSize,
      cornerSize
    ),
    averageCornerColour(
      pixels,
      width,
      height,
      width -
        cornerSize,
      height -
        cornerSize,
      cornerSize
    )
  ] as const

  const mask =
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

  const matchesBackground =
    (
      pixelIndex: number
    ) =>
      colours.some(
        (colour) =>
          colourDistance(
            pixels,
            pixelIndex,
            colour
          ) <=
          tolerance
      )

  const enqueue =
    (
      pixelIndex: number
    ) => {
      if (
        visited[
          pixelIndex
        ] ||
        !matchesBackground(
          pixelIndex
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
    enqueue(x)

    enqueue(
      (
        height - 1
      ) *
        width +
        x
    )
  }

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    enqueue(
      y * width
    )

    enqueue(
      y * width +
        width -
        1
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
        pixelIndex - 1
      )
    }

    if (
      x <
      width - 1
    ) {
      enqueue(
        pixelIndex + 1
      )
    }

    if (y > 0) {
      enqueue(
        pixelIndex -
          width
      )
    }

    if (
      y <
      height - 1
    ) {
      enqueue(
        pixelIndex +
          width
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
) {
  return new Uint8ClampedArray(
    width * height
  )
}

export function paintMask(
  mask:
    Uint8ClampedArray,
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

  return mask
}

export function softenMask(
  mask:
    Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
) {
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

  const nextMask =
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
      let x =
        -safeRadius;
      x <=
      safeRadius;
      x += 1
    ) {
      const sampleX =
        Math.min(
          width - 1,
          Math.max(
            0,
            x
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
      let y =
        -safeRadius;
      y <=
      safeRadius;
      y += 1
    ) {
      const sampleY =
        Math.min(
          height - 1,
          Math.max(
            0,
            y
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

export function renderEditorCanvas(
  canvas:
    HTMLCanvasElement,
  editor: EditorImage,
  mask:
    Uint8ClampedArray,
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
  mask:
    Uint8ClampedArray
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

  if (
    !outlineContext
  ) {
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

    const offsetX =
      Math.cos(
        radians
      ) * safeSize

    const offsetY =
      Math.sin(
        radians
      ) * safeSize

    context.drawImage(
      outlineCanvas,
      offsetX,
      offsetY
    )
  }
}

function findMaskBounds(
  mask:
    Uint8ClampedArray,
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
  mask:
    Uint8ClampedArray,
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

  if (
    !croppedContext
  ) {
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

    if (
      scaledContext
    ) {
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

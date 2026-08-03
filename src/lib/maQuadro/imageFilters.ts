import {
  FabricImage,
  filters
} from 'fabric'

import type {
  MAQuadroImageFilterState
} from '../../types/maQuadro'
import type {
  MAQuadroFabricObject
} from './canvasObjects'

export const
  DEFAULT_IMAGE_FILTERS:
    MAQuadroImageFilterState = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      grayscale: false
    }

type MAQuadroFilteredImage =
  FabricImage &
  MAQuadroFabricObject

export function
getMAQuadroImageFilters(
  image:
    MAQuadroFabricObject
): MAQuadroImageFilterState {
  return {
    brightness:
      Number(
        image
          .maFilterBrightness ||
        0
      ),
    contrast:
      Number(
        image
          .maFilterContrast ||
        0
      ),
    saturation:
      Number(
        image
          .maFilterSaturation ||
        0
      ),
    blur:
      Number(
        image
          .maFilterBlur ||
        0
      ),
    grayscale:
      Boolean(
        image
          .maFilterGrayscale
      )
  }
}

export function
applyMAQuadroImageFilters(
  image:
    MAQuadroFilteredImage,
  state:
    MAQuadroImageFilterState
) {
  image.maFilterBrightness =
    state.brightness
  image.maFilterContrast =
    state.contrast
  image.maFilterSaturation =
    state.saturation
  image.maFilterBlur =
    state.blur
  image.maFilterGrayscale =
    state.grayscale

  const nextFilters:
    FabricImage['filters'] = []

  if (
    state.brightness !== 0
  ) {
    nextFilters.push(
      new filters.Brightness({
        brightness:
          state.brightness /
          100
      })
    )
  }

  if (
    state.contrast !== 0
  ) {
    nextFilters.push(
      new filters.Contrast({
        contrast:
          state.contrast /
          100
      })
    )
  }

  if (
    state.saturation !== 0
  ) {
    nextFilters.push(
      new filters.Saturation({
        saturation:
          state.saturation /
          100
      })
    )
  }

  if (
    state.blur !== 0
  ) {
    nextFilters.push(
      new filters.Blur({
        blur:
          state.blur /
          100
      })
    )
  }

  if (
    state.grayscale
  ) {
    nextFilters.push(
      new filters.Grayscale()
    )
  }

  image.filters =
    nextFilters

  image.applyFilters()
  image.setCoords()
}

export function
resetMAQuadroImageFilters(
  image:
    MAQuadroFilteredImage
) {
  applyMAQuadroImageFilters(
    image,
    DEFAULT_IMAGE_FILTERS
  )
}

export function
cropMAQuadroImageSymmetrically(
  image:
    MAQuadroFilteredImage,
  horizontalPercent:
    number,
  verticalPercent:
    number
) {
  const sourceWidth =
    image.maOriginalWidth ||
    image.width ||
    1

  const sourceHeight =
    image.maOriginalHeight ||
    image.height ||
    1

  const safeHorizontal =
    Math.min(
      45,
      Math.max(
        0,
        horizontalPercent
      )
    )

  const safeVertical =
    Math.min(
      45,
      Math.max(
        0,
        verticalPercent
      )
    )

  const nextCropX =
    sourceWidth *
    safeHorizontal /
    100

  const nextCropY =
    sourceHeight *
    safeVertical /
    100

  const nextWidth =
    Math.max(
      1,
      sourceWidth -
      nextCropX *
      2
    )

  const nextHeight =
    Math.max(
      1,
      sourceHeight -
      nextCropY *
      2
    )

  const currentDisplayWidth =
    image.getScaledWidth()

  const currentDisplayHeight =
    image.getScaledHeight()

  image.set({
    cropX: nextCropX,
    cropY: nextCropY,
    width: nextWidth,
    height: nextHeight,
    scaleX:
      currentDisplayWidth /
      nextWidth,
    scaleY:
      currentDisplayHeight /
      nextHeight
  })

  image.setCoords()
}

export function
resetMAQuadroImageCrop(
  image:
    MAQuadroFilteredImage
) {
  const sourceWidth =
    image.maOriginalWidth ||
    image.width ||
    1

  const sourceHeight =
    image.maOriginalHeight ||
    image.height ||
    1

  const currentDisplayWidth =
    image.getScaledWidth()

  const currentDisplayHeight =
    image.getScaledHeight()

  image.set({
    cropX: 0,
    cropY: 0,
    width: sourceWidth,
    height: sourceHeight,
    scaleX:
      currentDisplayWidth /
      sourceWidth,
    scaleY:
      currentDisplayHeight /
      sourceHeight
  })

  image.setCoords()
}

function loadHtmlImage(
  dataUrl: string
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

      image.onload = () =>
        resolve(image)

      image.onerror = () =>
        reject(
          new Error(
            'Não foi possível processar a imagem.'
          )
        )

      image.src = dataUrl
    }
  )
}

function colourDistance(
  first:
    readonly [
      number,
      number,
      number
    ],
  second:
    readonly [
      number,
      number,
      number
    ]
) {
  const red =
    first[0] -
    second[0]

  const green =
    first[1] -
    second[1]

  const blue =
    first[2] -
    second[2]

  return Math.sqrt(
    red * red +
    green * green +
    blue * blue
  )
}

export async function
removeSimpleImageBackground(
  dataUrl: string,
  tolerance = 58
) {
  const image =
    await loadHtmlImage(
      dataUrl
    )

  const maxSide = 1800

  const scale =
    Math.min(
      1,
      maxSide /
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
      'O navegador não permitiu processar a imagem.'
    )
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  )

  const imageData =
    context.getImageData(
      0,
      0,
      width,
      height
    )

  const pixels =
    imageData.data

  const pixelColour = (
    index: number
  ): [
    number,
    number,
    number
  ] => {
    const offset =
      index * 4

    return [
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2]
    ]
  }

  const cornerIndexes = [
    0,
    width - 1,
    (
      height - 1
    ) * width,
    height * width - 1
  ]

  const corners =
    cornerIndexes.map(
      pixelColour
    )

  const sample: [
    number,
    number,
    number
  ] = [
    Math.round(
      corners.reduce(
        (
          sum,
          colour
        ) =>
          sum +
          colour[0],
        0
      ) /
      corners.length
    ),
    Math.round(
      corners.reduce(
        (
          sum,
          colour
        ) =>
          sum +
          colour[1],
        0
      ) /
      corners.length
    ),
    Math.round(
      corners.reduce(
        (
          sum,
          colour
        ) =>
          sum +
          colour[2],
        0
      ) /
      corners.length
    )
  ]

  const visited =
    new Uint8Array(
      width * height
    )

  const queue =
    new Int32Array(
      width * height
    )

  let head = 0
  let tail = 0

  const enqueue = (
    index: number
  ) => {
    if (
      index < 0 ||
      index >=
        visited.length ||
      visited[index]
    ) {
      return
    }

    visited[index] = 1
    queue[tail] = index
    tail += 1
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
      ) * width +
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
      width - 1
    )
  }

  while (
    head < tail
  ) {
    const index =
      queue[head]

    head += 1

    const colour =
      pixelColour(index)

    const distance =
      colourDistance(
        colour,
        sample
      )

    if (
      distance >
      tolerance + 28
    ) {
      continue
    }

    const alpha =
      distance <=
      tolerance
        ? 0
        : Math.round(
            255 *
            (
              distance -
              tolerance
            ) /
            28
          )

    pixels[
      index * 4 + 3
    ] = Math.min(
      pixels[
        index * 4 + 3
      ],
      alpha
    )

    const x =
      index % width

    const y =
      Math.floor(
        index / width
      )

    if (x > 0) {
      enqueue(
        index - 1
      )
    }

    if (
      x <
      width - 1
    ) {
      enqueue(
        index + 1
      )
    }

    if (y > 0) {
      enqueue(
        index - width
      )
    }

    if (
      y <
      height - 1
    ) {
      enqueue(
        index + width
      )
    }
  }

  context.putImageData(
    imageData,
    0,
    0
  )

  return canvas.toDataURL(
    'image/png'
  )
}

import type {
  MAQuadroPage
} from '../../types/maQuadro'

import {
  renderMAQuadroPageDataUrl
} from './export'

export type MAQuadroSmartMockupKind =
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'monitor'
  | 'poster'
  | 'card'

export type MAQuadroSmartMockupFit =
  | 'contain'
  | 'cover'

export type MAQuadroSmartMockupTheme =
  | 'light'
  | 'dark'
  | 'brand'

export type MAQuadroSmartMockupDefinition = {
  id: MAQuadroSmartMockupKind
  name: string
  description: string
  width: number
  height: number
}

export type MAQuadroSmartMockupOptions = {
  fit: MAQuadroSmartMockupFit
  theme: MAQuadroSmartMockupTheme
  brandColor?: string
}

type DrawBox = {
  x: number
  y: number
  width: number
  height: number
  radius?: number
}

export const MA_QUADRO_SMART_MOCKUPS:
  MAQuadroSmartMockupDefinition[] = [
    {
      id: 'phone',
      name: 'Telemóvel',
      description:
        'Ecrã vertical com moldura premium',
      width: 1400,
      height: 1200
    },
    {
      id: 'tablet',
      name: 'Tablet',
      description:
        'Apresentação limpa em tablet',
      width: 1500,
      height: 1200
    },
    {
      id: 'laptop',
      name: 'Portátil',
      description:
        'Design apresentado num portátil',
      width: 1600,
      height: 1100
    },
    {
      id: 'monitor',
      name: 'Monitor',
      description:
        'Mockup de ecrã desktop',
      width: 1600,
      height: 1200
    },
    {
      id: 'poster',
      name: 'Poster na parede',
      description:
        'Cartaz com profundidade e sombra',
      width: 1400,
      height: 1200
    },
    {
      id: 'card',
      name: 'Cartão',
      description:
        'Cartão inclinado com sombra realista',
      width: 1400,
      height: 1000
    }
  ]

function normalizeHex(
  value: string | undefined,
  fallback: string
) {
  const candidate =
    value?.trim() || ''

  return /^#[0-9A-F]{6}$/i.test(
    candidate
  )
    ? candidate
    : fallback
}

function loadImage(
  source: string
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
        () =>
          resolve(
            image
          )

      image.onerror =
        () =>
          reject(
            new Error(
              'Não foi possível preparar a pré-visualização do design.'
            )
          )

      image.src =
        source
    }
  )
}

function canvasToBlob(
  canvas:
    HTMLCanvasElement
) {
  return new Promise<Blob>(
    (
      resolve,
      reject
    ) => {
      canvas.toBlob(
        (
          blob
        ) => {
          if (
            blob
          ) {
            resolve(
              blob
            )

            return
          }

          reject(
            new Error(
              'O browser não conseguiu criar o mockup.'
            )
          )
        },
        'image/png'
      )
    }
  )
}

function roundedRectPath(
  context:
    CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius =
    Math.min(
      Math.max(
        0,
        radius
      ),
      width / 2,
      height / 2
    )

  context.beginPath()

  context.moveTo(
    x + safeRadius,
    y
  )

  context.lineTo(
    x +
      width -
      safeRadius,
    y
  )

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius
  )

  context.lineTo(
    x + width,
    y +
      height -
      safeRadius
  )

  context.quadraticCurveTo(
    x + width,
    y + height,
    x +
      width -
      safeRadius,
    y + height
  )

  context.lineTo(
    x + safeRadius,
    y + height
  )

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y +
      height -
      safeRadius
  )

  context.lineTo(
    x,
    y + safeRadius
  )

  context.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y
  )

  context.closePath()
}

function fillRoundedRect(
  context:
    CanvasRenderingContext2D,
  box:
    DrawBox,
  fill:
    string
) {
  context.save()

  roundedRectPath(
    context,
    box.x,
    box.y,
    box.width,
    box.height,
    box.radius || 0
  )

  context.fillStyle =
    fill

  context.fill()
  context.restore()
}

function drawImageInBox(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  box:
    DrawBox,
  fit:
    MAQuadroSmartMockupFit,
  background =
    '#FFFFFF'
) {
  const imageWidth =
    Math.max(
      1,
      image.naturalWidth
    )

  const imageHeight =
    Math.max(
      1,
      image.naturalHeight
    )

  const scale =
    fit ===
      'cover'
      ? Math.max(
          box.width /
            imageWidth,
          box.height /
            imageHeight
        )
      : Math.min(
          box.width /
            imageWidth,
          box.height /
            imageHeight
        )

  const width =
    imageWidth *
    scale

  const height =
    imageHeight *
    scale

  const x =
    box.x +
    (
      box.width -
      width
    ) /
    2

  const y =
    box.y +
    (
      box.height -
      height
    ) /
    2

  context.save()

  roundedRectPath(
    context,
    box.x,
    box.y,
    box.width,
    box.height,
    box.radius || 0
  )

  context.clip()

  context.fillStyle =
    background

  context.fillRect(
    box.x,
    box.y,
    box.width,
    box.height
  )

  context.imageSmoothingEnabled =
    true

  context.imageSmoothingQuality =
    'high'

  context.drawImage(
    image,
    x,
    y,
    width,
    height
  )

  context.restore()
}

function sceneColors(
  options:
    MAQuadroSmartMockupOptions
) {
  if (
    options.theme ===
    'dark'
  ) {
    return {
      background:
        '#0B1020',

      surface:
        '#111827',

      surfaceSoft:
        '#1F2937',

      foreground:
        '#E5E7EB',

      shadow:
        'rgba(0, 0, 0, 0.52)'
    }
  }

  if (
    options.theme ===
    'brand'
  ) {
    const brand =
      normalizeHex(
        options.brandColor,
        '#7C3AED'
      )

    return {
      background:
        brand,

      surface:
        '#FFFFFF',

      surfaceSoft:
        'rgba(255, 255, 255, 0.86)',

      foreground:
        '#0F172A',

      shadow:
        'rgba(15, 23, 42, 0.30)'
    }
  }

  return {
    background:
      '#EEF2F7',

    surface:
      '#FFFFFF',

    surfaceSoft:
      '#E2E8F0',

    foreground:
      '#0F172A',

    shadow:
      'rgba(15, 23, 42, 0.28)'
  }
}

function paintSceneBackground(
  context:
    CanvasRenderingContext2D,
  width:
    number,
  height:
    number,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  const gradient =
    context.createLinearGradient(
      0,
      0,
      width,
      height
    )

  gradient.addColorStop(
    0,
    colors.background
  )

  gradient.addColorStop(
    1,
    options.theme ===
      'dark'
      ? '#020617'
      : options.theme ===
          'brand'
        ? '#0F172A'
        : '#DDE6F2'
  )

  context.fillStyle =
    gradient

  context.fillRect(
    0,
    0,
    width,
    height
  )

  context.save()

  context.globalAlpha =
    0.16

  context.fillStyle =
    '#FFFFFF'

  context.beginPath()

  context.arc(
    width *
      0.82,
    height *
      0.18,
    Math.min(
      width,
      height
    ) *
      0.22,
    0,
    Math.PI *
      2
  )

  context.fill()
  context.restore()
}

function drawPhone(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  const device = {
    x: 454,
    y: 92,
    width: 492,
    height: 1016,
    radius: 82
  }

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    54

  context.shadowOffsetY =
    30

  fillRoundedRect(
    context,
    device,
    '#0A0A0C'
  )

  context.restore()

  fillRoundedRect(
    context,
    {
      x:
        device.x +
        16,

      y:
        device.y +
        16,

      width:
        device.width -
        32,

      height:
        device.height -
        32,

      radius:
        68
    },
    '#17171B'
  )

  drawImageInBox(
    context,
    image,
    {
      x:
        device.x +
        29,

      y:
        device.y +
        37,

      width:
        device.width -
        58,

      height:
        device.height -
        74,

      radius:
        54
    },
    options.fit,
    '#FFFFFF'
  )

  fillRoundedRect(
    context,
    {
      x: 610,
      y: 112,
      width: 180,
      height: 34,
      radius: 17
    },
    '#050506'
  )
}

function drawTablet(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  const device = {
    x: 230,
    y: 155,
    width: 1040,
    height: 890,
    radius: 62
  }

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    48

  context.shadowOffsetY =
    28

  fillRoundedRect(
    context,
    device,
    '#17191F'
  )

  context.restore()

  drawImageInBox(
    context,
    image,
    {
      x:
        device.x +
        36,

      y:
        device.y +
        34,

      width:
        device.width -
        72,

      height:
        device.height -
        68,

      radius:
        35
    },
    options.fit,
    '#FFFFFF'
  )

  context.fillStyle =
    '#41444D'

  context.beginPath()

  context.arc(
    750,
    172,
    7,
    0,
    Math.PI *
      2
  )

  context.fill()
}

function drawLaptop(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  const lid = {
    x: 270,
    y: 120,
    width: 1060,
    height: 690,
    radius: 30
  }

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    46

  context.shadowOffsetY =
    26

  fillRoundedRect(
    context,
    lid,
    '#15181E'
  )

  context.restore()

  drawImageInBox(
    context,
    image,
    {
      x:
        lid.x +
        38,

      y:
        lid.y +
        38,

      width:
        lid.width -
        76,

      height:
        lid.height -
        82,

      radius:
        10
    },
    options.fit,
    '#FFFFFF'
  )

  const baseGradient =
    context.createLinearGradient(
      240,
      820,
      1360,
      980
    )

  baseGradient.addColorStop(
    0,
    '#B9C0CA'
  )

  baseGradient.addColorStop(
    0.5,
    '#F3F4F6'
  )

  baseGradient.addColorStop(
    1,
    '#9CA3AF'
  )

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    34

  context.shadowOffsetY =
    22

  context.beginPath()

  context.moveTo(
    190,
    820
  )

  context.lineTo(
    1410,
    820
  )

  context.lineTo(
    1320,
    955
  )

  context.lineTo(
    280,
    955
  )

  context.closePath()

  context.fillStyle =
    baseGradient

  context.fill()
  context.restore()

  fillRoundedRect(
    context,
    {
      x: 690,
      y: 826,
      width: 220,
      height: 18,
      radius: 9
    },
    '#8B929D'
  )
}

function drawMonitor(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  const screen = {
    x: 215,
    y: 105,
    width: 1170,
    height: 760,
    radius: 34
  }

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    52

  context.shadowOffsetY =
    28

  fillRoundedRect(
    context,
    screen,
    '#111318'
  )

  context.restore()

  drawImageInBox(
    context,
    image,
    {
      x:
        screen.x +
        34,

      y:
        screen.y +
        34,

      width:
        screen.width -
        68,

      height:
        screen.height -
        100,

      radius:
        12
    },
    options.fit,
    '#FFFFFF'
  )

  context.fillStyle =
    '#2A2D34'

  context.fillRect(
    754,
    865,
    92,
    170
  )

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    24

  context.shadowOffsetY =
    12

  fillRoundedRect(
    context,
    {
      x: 590,
      y: 1012,
      width: 420,
      height: 52,
      radius: 26
    },
    '#2A2D34'
  )

  context.restore()
}

function drawPoster(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  context.save()

  context.fillStyle =
    options.theme ===
      'dark'
      ? '#111827'
      : '#D9D6CF'

  context.fillRect(
    0,
    0,
    1400,
    1200
  )

  const wallGradient =
    context.createLinearGradient(
      0,
      0,
      1400,
      0
    )

  wallGradient.addColorStop(
    0,
    'rgba(255,255,255,0.16)'
  )

  wallGradient.addColorStop(
    0.5,
    'rgba(255,255,255,0)'
  )

  wallGradient.addColorStop(
    1,
    'rgba(0,0,0,0.09)'
  )

  context.fillStyle =
    wallGradient

  context.fillRect(
    0,
    0,
    1400,
    1200
  )

  context.restore()

  context.save()

  context.translate(
    700,
    560
  )

  context.rotate(
    -0.035
  )

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    44

  context.shadowOffsetX =
    18

  context.shadowOffsetY =
    24

  fillRoundedRect(
    context,
    {
      x: -350,
      y: -430,
      width: 700,
      height: 860,
      radius: 4
    },
    '#FFFFFF'
  )

  context.restore()

  context.save()

  context.translate(
    700,
    560
  )

  context.rotate(
    -0.035
  )

  drawImageInBox(
    context,
    image,
    {
      x: -324,
      y: -404,
      width: 648,
      height: 808
    },
    options.fit,
    '#FFFFFF'
  )

  context.restore()

  context.fillStyle =
    options.theme ===
      'dark'
      ? '#020617'
      : '#C7BCA7'

  context.fillRect(
    0,
    1050,
    1400,
    150
  )
}

function drawCard(
  context:
    CanvasRenderingContext2D,
  image:
    HTMLImageElement,
  options:
    MAQuadroSmartMockupOptions
) {
  const colors =
    sceneColors(
      options
    )

  context.save()

  context.translate(
    700,
    500
  )

  context.rotate(
    -0.12
  )

  const card = {
    x: -470,
    y: -285,
    width: 940,
    height: 570,
    radius: 38
  }

  context.save()

  context.shadowColor =
    colors.shadow

  context.shadowBlur =
    52

  context.shadowOffsetX =
    20

  context.shadowOffsetY =
    30

  fillRoundedRect(
    context,
    card,
    '#FFFFFF'
  )

  context.restore()

  drawImageInBox(
    context,
    image,
    {
      x:
        card.x +
        24,

      y:
        card.y +
        24,

      width:
        card.width -
        48,

      height:
        card.height -
        48,

      radius:
        22
    },
    options.fit,
    '#FFFFFF'
  )

  context.restore()
}

export async function createMAQuadroSmartMockup(
  page:
    MAQuadroPage,
  kind:
    MAQuadroSmartMockupKind,
  options:
    MAQuadroSmartMockupOptions
) {
  const definition =
    MA_QUADRO_SMART_MOCKUPS.find(
      (
        item
      ) =>
        item.id ===
        kind
    )

  if (
    !definition
  ) {
    throw new Error(
      'Mockup desconhecido.'
    )
  }

  const source =
    await renderMAQuadroPageDataUrl(
      page,
      'png',
      1
    )

  const image =
    await loadImage(
      source
    )

  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width =
    definition.width

  canvas.height =
    definition.height

  const context =
    canvas.getContext(
      '2d'
    )

  if (
    !context
  ) {
    throw new Error(
      'O browser não permitiu criar o mockup.'
    )
  }

  context.imageSmoothingEnabled =
    true

  context.imageSmoothingQuality =
    'high'

  paintSceneBackground(
    context,
    definition.width,
    definition.height,
    options
  )

  switch (
    kind
  ) {
    case 'phone':
      drawPhone(
        context,
        image,
        options
      )
      break

    case 'tablet':
      drawTablet(
        context,
        image,
        options
      )
      break

    case 'laptop':
      drawLaptop(
        context,
        image,
        options
      )
      break

    case 'monitor':
      drawMonitor(
        context,
        image,
        options
      )
      break

    case 'poster':
      drawPoster(
        context,
        image,
        options
      )
      break

    case 'card':
      drawCard(
        context,
        image,
        options
      )
      break
  }

  const blob =
    await canvasToBlob(
      canvas
    )

  canvas.width =
    1

  canvas.height =
    1

  return blob
}

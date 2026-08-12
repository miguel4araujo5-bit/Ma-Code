import type {
  MAQuadroStoredVideo
} from '../../types/maQuadro'

import {
  createMAQuadroId
} from './project'

export type MAQuadroVideoDocument = {
  version: 1
  assetId: string
  name: string
}

export const MA_QUADRO_VIDEO_MAX_BYTES =
  100 * 1024 * 1024

const VIDEO_METADATA_START =
  '\u{E0001}'

const VIDEO_METADATA_END =
  '\u{E007F}'

const VIDEO_TAG_BASE =
  0xE0000

const SUPPORTED_VIDEO_MIME_TYPES =
  new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v'
  ])

const SUPPORTED_VIDEO_EXTENSIONS =
  new Set([
    'mp4',
    'webm',
    'mov',
    'm4v'
  ])

function utf8ToBase64(
  value: string
) {
  const bytes =
    new TextEncoder()
      .encode(
        value
      )

  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(
    binary
  )
}

function base64ToUtf8(
  value: string
) {
  const binary =
    atob(
      value
    )

  const bytes =
    Uint8Array.from(
      binary,
      (character) =>
        character.charCodeAt(
          0
        )
    )

  return new TextDecoder()
    .decode(
      bytes
    )
}

function encodeMetadata(
  document:
    MAQuadroVideoDocument
) {
  const base64 =
    utf8ToBase64(
      JSON.stringify(
        document
      )
    )

  let encoded =
    VIDEO_METADATA_START

  for (
    const character of
    base64
  ) {
    encoded +=
      String.fromCodePoint(
        VIDEO_TAG_BASE +
        character.charCodeAt(
          0
        )
      )
  }

  return (
    encoded +
    VIDEO_METADATA_END
  )
}

function decodeMetadata(
  value: string
) {
  let base64 = ''

  for (
    const character of
    value
  ) {
    const codePoint =
      character.codePointAt(
        0
      )

    if (
      codePoint ===
      undefined
    ) {
      continue
    }

    const ascii =
      codePoint -
      VIDEO_TAG_BASE

    if (
      ascii < 0 ||
      ascii > 127
    ) {
      throw new Error(
        'Metadados de vídeo inválidos.'
      )
    }

    base64 +=
      String.fromCharCode(
        ascii
      )
  }

  return base64ToUtf8(
    base64
  )
}

function getVideoExtension(
  fileName: string
) {
  const match =
    fileName
      .toLocaleLowerCase(
        'pt-PT'
      )
      .match(
        /\.([a-z0-9]+)$/
      )

  return match?.[1] || ''
}

function getVideoDisplayName(
  fileName: string
) {
  const withoutExtension =
    fileName.replace(
      /\.[^.]+$/,
      ''
    )

  return (
    withoutExtension
      .trim()
      .slice(
        0,
        100
      ) ||
    'Vídeo'
  )
}

function validateVideoFile(
  file: File
) {
  const extension =
    getVideoExtension(
      file.name
    )

  const supported =
    SUPPORTED_VIDEO_MIME_TYPES.has(
      file.type
    ) ||
    SUPPORTED_VIDEO_EXTENSIONS.has(
      extension
    )

  if (!supported) {
    throw new Error(
      'Use um vídeo MP4, WebM, MOV ou M4V.'
    )
  }

  if (
    file.size <= 0
  ) {
    throw new Error(
      'O ficheiro de vídeo está vazio.'
    )
  }

  if (
    file.size >
    MA_QUADRO_VIDEO_MAX_BYTES
  ) {
    throw new Error(
      'O vídeo não pode ultrapassar 100 MB.'
    )
  }
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName:
    'loadedmetadata' |
    'loadeddata' |
    'seeked',
  timeoutMs = 12000
) {
  return new Promise<void>(
    (
      resolve,
      reject
    ) => {
      let timeout = 0

      const cleanup = () => {
        video.removeEventListener(
          eventName,
          handleSuccess
        )
        video.removeEventListener(
          'error',
          handleError
        )
        window.clearTimeout(
          timeout
        )
      }

      const handleSuccess = () => {
        cleanup()
        resolve()
      }

      const handleError = () => {
        cleanup()
        reject(
          new Error(
            'Não foi possível ler este vídeo no browser.'
          )
        )
      }

      timeout =
        window.setTimeout(
          () => {
            cleanup()
            reject(
              new Error(
                'O vídeo demorou demasiado tempo a carregar.'
              )
            )
          },
          timeoutMs
        )

      video.addEventListener(
        eventName,
        handleSuccess,
        {
          once: true
        }
      )
      video.addEventListener(
        'error',
        handleError,
        {
          once: true
        }
      )
    }
  )
}

function dataUrlToBlob(
  dataUrl: string
) {
  const separator =
    dataUrl.indexOf(
      ','
    )

  if (
    separator < 0
  ) {
    throw new Error(
      'A pré-visualização do vídeo é inválida.'
    )
  }

  const header =
    dataUrl.slice(
      0,
      separator
    )
  const payload =
    dataUrl.slice(
      separator + 1
    )
  const mimeType =
    header.match(
      /^data:([^;]+);base64$/
    )?.[1]

  if (!mimeType) {
    throw new Error(
      'A pré-visualização do vídeo é inválida.'
    )
  }

  const binary =
    atob(
      payload
    )
  const bytes =
    new Uint8Array(
      binary.length
    )

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      )
  }

  return new Blob(
    [
      bytes
    ],
    {
      type:
        mimeType
    }
  )
}

async function createVideoPoster(
  file: File
) {
  const objectUrl =
    URL.createObjectURL(
      file
    )
  const video =
    document.createElement(
      'video'
    )

  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  try {
    const metadataPromise =
      waitForVideoEvent(
        video,
        'loadedmetadata'
      )

    video.src =
      objectUrl
    video.load()

    await metadataPromise

    const duration =
      video.duration
    const width =
      video.videoWidth
    const height =
      video.videoHeight

    if (
      !Number.isFinite(
        duration
      ) ||
      duration <= 0 ||
      width <= 0 ||
      height <= 0
    ) {
      throw new Error(
        'Não foi possível obter os dados deste vídeo.'
      )
    }

    if (
      video.readyState < 2
    ) {
      await waitForVideoEvent(
        video,
        'loadeddata'
      )
    }

    const seekTarget =
      Math.min(
        0.25,
        duration / 2
      )

    if (
      seekTarget > 0.001
    ) {
      const seekPromise =
        waitForVideoEvent(
          video,
          'seeked'
        )

      video.currentTime =
        seekTarget

      await seekPromise
    }

    await new Promise<void>(
      (resolve) => {
        window.requestAnimationFrame(
          () => resolve()
        )
      }
    )

    const maxSide =
      1280
    const scale =
      Math.min(
        1,
        maxSide /
        Math.max(
          width,
          height
        )
      )

    const canvas =
      document.createElement(
        'canvas'
      )

    canvas.width =
      Math.max(
        1,
        Math.round(
          width * scale
        )
      )
    canvas.height =
      Math.max(
        1,
        Math.round(
          height * scale
        )
      )

    const context =
      canvas.getContext(
        '2d'
      )

    if (!context) {
      throw new Error(
        'Não foi possível criar a pré-visualização do vídeo.'
      )
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    )

    const posterDataUrl =
      canvas.toDataURL(
        'image/jpeg',
        0.88
      )

    return {
      durationMs:
        Math.round(
          duration * 1000
        ),
      width,
      height,
      posterDataUrl
    }
  } finally {
    video.removeAttribute(
      'src'
    )
    video.load()
    URL.revokeObjectURL(
      objectUrl
    )
  }
}

export function createMAQuadroVideoObjectName(
  document:
    MAQuadroVideoDocument
) {
  const name =
    String(
      document.name ||
      'Vídeo'
    )
      .trim()
      .slice(
        0,
        100
      ) ||
    'Vídeo'

  return (
    `Vídeo · ${name}` +
    encodeMetadata({
      version: 1,
      assetId:
        document.assetId,
      name
    })
  )
}

export function readMAQuadroVideoDocumentFromName(
  name: string
):
  MAQuadroVideoDocument |
  null {
  const start =
    name.indexOf(
      VIDEO_METADATA_START
    )

  if (
    start < 0
  ) {
    return null
  }

  const payloadStart =
    start +
    VIDEO_METADATA_START.length
  const end =
    name.indexOf(
      VIDEO_METADATA_END,
      payloadStart
    )

  if (
    end < 0
  ) {
    return null
  }

  try {
    const parsed =
      JSON.parse(
        decodeMetadata(
          name.slice(
            payloadStart,
            end
          )
        )
      ) as
        Partial<
          MAQuadroVideoDocument
        >

    if (
      parsed.version !== 1 ||
      typeof parsed.assetId !==
        'string' ||
      !parsed.assetId ||
      typeof parsed.name !==
        'string'
    ) {
      return null
    }

    return {
      version: 1,
      assetId:
        parsed.assetId,
      name:
        parsed.name
          .trim()
          .slice(
            0,
            100
          ) ||
        'Vídeo'
    }
  } catch {
    return null
  }
}

export function createMAQuadroVideoPosterFile(
  video:
    MAQuadroStoredVideo
) {
  const posterBlob =
    dataUrlToBlob(
      video.posterDataUrl
    )

  return new File(
    [
      posterBlob
    ],
    createMAQuadroVideoObjectName({
      version: 1,
      assetId:
        video.id,
      name:
        video.name
    }),
    {
      type:
        posterBlob.type ||
        'image/jpeg',
      lastModified:
        Date.now()
    }
  )
}

export async function prepareMAQuadroVideo(
  file: File
) {
  validateVideoFile(
    file
  )

  const preview =
    await createVideoPoster(
      file
    )
  const id =
    createMAQuadroId(
      'video'
    )
  const now =
    new Date()
      .toISOString()
  const name =
    getVideoDisplayName(
      file.name
    )

  const video:
    MAQuadroStoredVideo = {
    id,
    name,
    fileName:
      file.name,
    mimeType:
      file.type ||
      'application/octet-stream',
    data:
      await file.arrayBuffer(),
    size:
      file.size,
    durationMs:
      preview.durationMs,
    width:
      preview.width,
    height:
      preview.height,
    posterDataUrl:
      preview.posterDataUrl,
    createdAt:
      now
  }

  return {
    video,
    posterFile:
      createMAQuadroVideoPosterFile(
        video
      )
  }
}

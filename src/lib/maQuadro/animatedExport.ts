import type {
  MAQuadroPage
} from '../../types/maQuadro'
import {
  downloadMAQuadroBlob
} from './export'
import {
  getMAQuadroAnimationCanvas
} from './objectAnimations'
import {
  countMAQuadroPageAnimations,
  previewMAQuadroPageAnimations,
  type MAQuadroPageAnimationMode
} from './pageAnimations'
import {
  safeMAQuadroFileName
} from './project'

const VIDEO_FPS = 30
const VIDEO_MAX_SIDE = 1920
const VIDEO_MAX_PIXELS =
  2_073_600
const VIDEO_BITRATE =
  6_000_000

const VIDEO_MIME_CANDIDATES = [
  {
    mimeType:
      'video/webm;codecs=vp9',
    extension: 'webm'
  },
  {
    mimeType:
      'video/webm;codecs=vp8',
    extension: 'webm'
  },
  {
    mimeType:
      'video/webm',
    extension: 'webm'
  },
  {
    mimeType:
      'video/mp4',
    extension: 'mp4'
  }
] as const

export type MAQuadroVideoContainer =
  | 'webm'
  | 'mp4'

export type MAQuadroVideoCapability = {
  supported: boolean
  mimeType: string
  extension:
    MAQuadroVideoContainer
}

export type MAQuadroVideoExportPlan = {
  width: number
  height: number
  scale: number
  reduced: boolean
  fps: number
}

export type MAQuadroVideoExportOptions = {
  page: MAQuadroPage
  projectName: string
  mode:
    MAQuadroPageAnimationMode
  gapMs: number
}

function evenDimension(
  value: number
) {
  const rounded =
    Math.max(
      2,
      Math.floor(
        value
      )
    )

  return rounded % 2 === 0
    ? rounded
    : rounded - 1
}

export function
getMAQuadroVideoExportPlan(
  page: MAQuadroPage
): MAQuadroVideoExportPlan {
  const sourceWidth =
    Math.max(
      1,
      Number(
        page.width
      ) || 1
    )

  const sourceHeight =
    Math.max(
      1,
      Number(
        page.height
      ) || 1
    )

  const sideScale =
    VIDEO_MAX_SIDE /
    Math.max(
      sourceWidth,
      sourceHeight
    )

  const pixelScale =
    Math.sqrt(
      VIDEO_MAX_PIXELS /
      Math.max(
        1,
        sourceWidth *
        sourceHeight
      )
    )

  const scale =
    Math.min(
      1,
      sideScale,
      pixelScale
    )

  return {
    width:
      evenDimension(
        sourceWidth *
        scale
      ),

    height:
      evenDimension(
        sourceHeight *
        scale
      ),

    scale,

    reduced:
      scale < 0.999,

    fps:
      VIDEO_FPS
  }
}

export function
getMAQuadroVideoCapability(): MAQuadroVideoCapability {
  if (
    typeof window ===
      'undefined' ||
    typeof MediaRecorder ===
      'undefined'
  ) {
    return {
      supported: false,
      mimeType: '',
      extension: 'webm'
    }
  }

  const hasCaptureStream =
    typeof (
      HTMLCanvasElement
        .prototype as
        HTMLCanvasElement & {
          captureStream?: (
            frameRate?: number
          ) => MediaStream
        }
    ).captureStream ===
    'function'

  if (
    !hasCaptureStream
  ) {
    return {
      supported: false,
      mimeType: '',
      extension: 'webm'
    }
  }

  for (
    const candidate of
    VIDEO_MIME_CANDIDATES
  ) {
    if (
      MediaRecorder
        .isTypeSupported(
          candidate.mimeType
        )
    ) {
      return {
        supported: true,
        mimeType:
          candidate.mimeType,
        extension:
          candidate.extension
      }
    }
  }

  return {
    supported: false,
    mimeType: '',
    extension: 'webm'
  }
}

function getSourceCanvasElement() {
  const canvas =
    getMAQuadroAnimationCanvas()

  if (
    !canvas
  ) {
    throw new Error(
      'O quadro ainda não está pronto para exportar vídeo.'
    )
  }

  const sourceCanvas =
    (
      canvas as unknown as {
        lowerCanvasEl?:
          HTMLCanvasElement
      }
    ).lowerCanvasEl

  if (
    !sourceCanvas
  ) {
    throw new Error(
      'Não foi possível aceder ao quadro para gravar o vídeo.'
    )
  }

  return {
    canvas,
    sourceCanvas
  }
}

function createVideoRecorder(
  stream: MediaStream,
  mimeType: string
) {
  return new MediaRecorder(
    stream,
    {
      mimeType,
      videoBitsPerSecond:
        VIDEO_BITRATE
    }
  )
}

function stopRecorder(
  recorder: MediaRecorder,
  chunks: BlobPart[],
  mimeType: string
) {
  return new Promise<Blob>(
    (
      resolve,
      reject
    ) => {
      recorder.addEventListener(
        'stop',
        () => {
          resolve(
            new Blob(
              chunks,
              {
                type:
                  mimeType
              }
            )
          )
        },
        {
          once: true
        }
      )

      recorder.addEventListener(
        'error',
        () => {
          reject(
            new Error(
              'O browser interrompeu a gravação do vídeo.'
            )
          )
        },
        {
          once: true
        }
      )

      if (
        recorder.state ===
        'inactive'
      ) {
        resolve(
          new Blob(
            chunks,
            {
              type:
                mimeType
            }
          )
        )
        return
      }

      recorder.stop()
    }
  )
}

export async function
exportMAQuadroCurrentPageVideo(
  options:
    MAQuadroVideoExportOptions
) {
  const capability =
    getMAQuadroVideoCapability()

  if (
    !capability.supported
  ) {
    throw new Error(
      'Este browser não suporta a exportação de vídeo do MA-Quadro.'
    )
  }

  const {
    canvas,
    sourceCanvas
  } =
    getSourceCanvasElement()

  if (
    countMAQuadroPageAnimations(
      canvas
    ) === 0
  ) {
    throw new Error(
      'A página atual não tem elementos animados para exportar.'
    )
  }

  const plan =
    getMAQuadroVideoExportPlan(
      options.page
    )

  const outputCanvas =
    document.createElement(
      'canvas'
    )

  outputCanvas.width =
    plan.width
  outputCanvas.height =
    plan.height

  const context =
    outputCanvas.getContext(
      '2d',
      {
        alpha: false
      }
    )

  if (
    !context
  ) {
    throw new Error(
      'Não foi possível preparar a imagem do vídeo.'
    )
  }

  const captureStream =
    (
      outputCanvas as
        HTMLCanvasElement & {
          captureStream: (
            frameRate?: number
          ) => MediaStream
        }
    ).captureStream

  const stream =
    captureStream.call(
      outputCanvas,
      VIDEO_FPS
    )

  const chunks:
    BlobPart[] = []

  let recorder:
    MediaRecorder | null =
      null

  let frameHandle:
    number | null =
      null

  let keepDrawing =
    true

  const drawFrame =
    () => {
      context.fillStyle =
        '#ffffff'

      context.fillRect(
        0,
        0,
        plan.width,
        plan.height
      )

      context.drawImage(
        sourceCanvas,
        0,
        0,
        plan.width,
        plan.height
      )
    }

  const pumpFrames =
    () => {
      if (
        !keepDrawing
      ) {
        return
      }

      drawFrame()

      frameHandle =
        window
          .requestAnimationFrame(
            pumpFrames
          )
    }

  try {
    recorder =
      createVideoRecorder(
        stream,
        capability.mimeType
      )

    recorder.addEventListener(
      'dataavailable',
      (
        event:
          BlobEvent
      ) => {
        if (
          event.data.size >
          0
        ) {
          chunks.push(
            event.data
          )
        }
      }
    )

    const previewPromise =
      previewMAQuadroPageAnimations(
        canvas,
        {
          mode:
            options.mode,
          gapMs:
            options.gapMs,
          holdMs: 300
        }
      )

    drawFrame()

    recorder.start(
      100
    )

    pumpFrames()

    const played =
      await previewPromise

    if (
      !played
    ) {
      throw new Error(
        'Não foi possível reproduzir as animações desta página.'
      )
    }

    keepDrawing =
      false

    if (
      frameHandle !==
      null
    ) {
      window
        .cancelAnimationFrame(
          frameHandle
        )
    }

    const blob =
      await stopRecorder(
        recorder,
        chunks,
        capability.mimeType
      )

    if (
      blob.size === 0
    ) {
      throw new Error(
        'O browser criou um vídeo vazio. Tente novamente.'
      )
    }

    const baseName =
      safeMAQuadroFileName(
        `${options.projectName}-${options.page.name}`
      )

    downloadMAQuadroBlob(
      blob,
      `${baseName}.${capability.extension}`
    )

    return {
      blob,
      plan,
      capability
    }
  } finally {
    keepDrawing =
      false

    if (
      frameHandle !==
      null
    ) {
      window
        .cancelAnimationFrame(
          frameHandle
        )
    }

    if (
      recorder &&
      recorder.state !==
        'inactive'
    ) {
      try {
        recorder.stop()
      } catch {
        // O gravador pode já estar a terminar.
      }
    }

    stream
      .getTracks()
      .forEach(
        (
          track
        ) =>
          track.stop()
      )
  }
}

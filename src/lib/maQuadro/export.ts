import {
  StaticCanvas
} from 'fabric'
import {
  Zip,
  ZipPassThrough
} from 'fflate'
import {
  PDFDocument
} from 'pdf-lib'

import type {
  MAQuadroExportScale,
  MAQuadroPage,
  MAQuadroProject
} from '../../types/maQuadro'
import {
  applyMAQuadroPageBackground,
  loadMAQuadroCanvasJson
} from './canvasObjects'
import {
  safeMAQuadroFileName
} from './project'

const MAX_RASTER_SIDE = 16384
const MAX_RASTER_PIXELS =
  40_000_000

const PRINT_DPI = 300
const SCREEN_DPI = 96

const PDF_MAX_SIDE_POINTS =
  1440

export type MAQuadroExportPlan = {
  requestedScale: number
  scale: number
  width: number
  height: number
  megapixels: number
  reduced: boolean
}

function roundScale(
  value: number
) {
  return Math.max(
    0.1,
    Math.floor(
      value * 1000
    ) / 1000
  )
}

export function
getMAQuadroExportPlan(
  page: MAQuadroPage,
  requestedScale:
    MAQuadroExportScale
): MAQuadroExportPlan {
  const safeRequested =
    Math.max(
      0.1,
      Number(
        requestedScale
      ) || 1
    )

  const width =
    Math.max(
      1,
      page.width
    )

  const height =
    Math.max(
      1,
      page.height
    )

  const sideLimit =
    MAX_RASTER_SIDE /
    Math.max(
      width,
      height
    )

  const pixelLimit =
    Math.sqrt(
      MAX_RASTER_PIXELS /
      Math.max(
        1,
        width * height
      )
    )

  const scale =
    roundScale(
      Math.min(
        safeRequested,
        sideLimit,
        pixelLimit
      )
    )

  const outputWidth =
    Math.max(
      1,
      Math.floor(
        width * scale
      )
    )

  const outputHeight =
    Math.max(
      1,
      Math.floor(
        height * scale
      )
    )

  return {
    requestedScale:
      safeRequested,

    scale,

    width:
      outputWidth,

    height:
      outputHeight,

    megapixels:
      outputWidth *
      outputHeight /
      1_000_000,

    reduced:
      scale <
      safeRequested -
      0.001
  }
}

export function
formatMAQuadroExportScale(
  scale: number
) {
  return Number.isInteger(
    scale
  )
    ? String(scale)
    : scale
        .toFixed(2)
        .replace(
          /0+$/u,
          ''
        )
        .replace(
          /\.$/u,
          ''
        )
}

export function
downloadMAQuadroBlob(
  blob: Blob,
  fileName: string
) {
  const url =
    URL.createObjectURL(
      blob
    )

  const anchor =
    document.createElement(
      'a'
    )

  anchor.href = url
  anchor.download =
    fileName
  anchor.rel =
    'noopener'

  document.body.appendChild(
    anchor
  )

  anchor.click()
  anchor.remove()

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      )
    },
    60_000
  )
}

function blobToDataUrl(
  blob: Blob
) {
  return new Promise<string>(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader()

      reader.onload =
        () => {
          if (
            typeof reader.result ===
            'string'
          ) {
            resolve(
              reader.result
            )
            return
          }

          reject(
            new Error(
              'Não foi possível preparar a imagem exportada.'
            )
          )
        }

      reader.onerror =
        () => {
          reject(
            reader.error ||
            new Error(
              'Não foi possível ler a imagem exportada.'
            )
          )
        }

      reader.readAsDataURL(
        blob
      )
    }
  )
}

function yieldToBrowser() {
  return new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        0
      )
    }
  )
}

async function
withStaticPageCanvas<T>(
  page: MAQuadroPage,
  operation: (
    canvas:
      StaticCanvas
  ) =>
    T |
    Promise<T>
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
          page.width,

        height:
          page.height,

        renderOnAddRemove:
          false
      }
    )

  try {
    await loadMAQuadroCanvasJson(
      canvas,
      page.canvasJson
    )

    applyMAQuadroPageBackground(
      canvas,
      page
    )

    canvas.requestRenderAll()

    return await operation(
      canvas
    )
  } finally {
    await canvas.dispose()
  }
}

async function
renderMAQuadroPageBlobAtScale(
  page:
    MAQuadroPage,

  format:
    | 'png'
    | 'jpeg',

  scale: number,

  quality = 0.92
) {
  return withStaticPageCanvas(
    page,
    async (
      canvas
    ) => {
      if (
        format ===
          'jpeg' &&
        page.background
          .type ===
          'transparent'
      ) {
        canvas.backgroundColor =
          '#FFFFFF'

        canvas.requestRenderAll()
      }

      const blob =
        await canvas.toBlob({
          format,

          multiplier:
            scale,

          quality:
            Math.min(
              1,
              Math.max(
                0.1,
                quality
              )
            ),

          enableRetinaScaling:
            false
        })

      if (!blob) {
        throw new Error(
          'O browser não conseguiu criar a imagem exportada.'
        )
      }

      return blob
    }
  )
}

export function
exportMAQuadroProjectFile(
  project:
    MAQuadroProject
) {
  downloadMAQuadroBlob(
    new Blob(
      [
        JSON.stringify(
          project,
          null,
          2
        )
      ],
      {
        type:
          'application/json;charset=utf-8'
      }
    ),
    `${
      safeMAQuadroFileName(
        project.name
      )
    }.ma-quadro.json`
  )
}

export async function
renderMAQuadroPageDataUrl(
  page:
    MAQuadroPage,

  format:
    | 'png'
    | 'jpeg',

  scale:
    MAQuadroExportScale,

  quality = 0.92
) {
  const plan =
    getMAQuadroExportPlan(
      page,
      scale
    )

  const blob =
    await renderMAQuadroPageBlobAtScale(
      page,
      format,
      plan.scale,
      quality
    )

  return blobToDataUrl(
    blob
  )
}

export async function
renderMAQuadroPageSvg(
  page:
    MAQuadroPage
) {
  return withStaticPageCanvas(
    page,
    (
      canvas
    ) =>
      canvas.toSVG({
        suppressPreamble:
          false
      })
  )
}

export async function
exportMAQuadroPageImage(
  project:
    MAQuadroProject,

  page:
    MAQuadroPage,

  format:
    | 'png'
    | 'jpg',

  scale:
    MAQuadroExportScale,

  quality = 0.92
) {
  const plan =
    getMAQuadroExportPlan(
      page,
      scale
    )

  const blob =
    await renderMAQuadroPageBlobAtScale(
      page,

      format ===
        'jpg'
        ? 'jpeg'
        : 'png',

      plan.scale,
      quality
    )

  const suffix =
    project.pages
      .length > 1
      ? `-${
          safeMAQuadroFileName(
            page.name
          )
        }`
      : ''

  const scaleLabel =
    formatMAQuadroExportScale(
      plan.scale
    )

  downloadMAQuadroBlob(
    blob,
    `${
      safeMAQuadroFileName(
        project.name
      )
    }${suffix}-${scaleLabel}x.${format}`
  )
}

export async function
exportMAQuadroPageSvg(
  project:
    MAQuadroProject,

  page:
    MAQuadroPage
) {
  const svg =
    await renderMAQuadroPageSvg(
      page
    )

  const suffix =
    project.pages
      .length > 1
      ? `-${
          safeMAQuadroFileName(
            page.name
          )
        }`
      : ''

  downloadMAQuadroBlob(
    new Blob(
      [
        svg
      ],
      {
        type:
          'image/svg+xml;charset=utf-8'
      }
    ),
    `${
      safeMAQuadroFileName(
        project.name
      )
    }${suffix}.svg`
  )
}

function getPdfPageSize(
  project:
    MAQuadroProject,

  page:
    MAQuadroPage
): [
  number,
  number
] {
  const dpi =
    project.category ===
      'print'
      ? PRINT_DPI
      : SCREEN_DPI

  let width =
    page.width *
    72 /
    dpi

  let height =
    page.height *
    72 /
    dpi

  const longestSide =
    Math.max(
      width,
      height
    )

  if (
    project.category !==
      'print' &&
    longestSide >
      PDF_MAX_SIDE_POINTS
  ) {
    const scale =
      PDF_MAX_SIDE_POINTS /
      longestSide

    width *= scale
    height *= scale
  }

  return [
    Math.max(
      1,
      width
    ),
    Math.max(
      1,
      height
    )
  ]
}

export async function
exportMAQuadroPdf(
  project:
    MAQuadroProject,

  pageIds?:
    string[]
) {
  const selectedPages =
    pageIds?.length
      ? project.pages.filter(
          (
            page
          ) =>
            pageIds.includes(
              page.id
            )
        )
      : project.pages

  if (
    selectedPages
      .length === 0
  ) {
    throw new Error(
      'Não existem páginas para exportar.'
    )
  }

  const pdf =
    await PDFDocument.create()

  for (
    const pageRecord
    of selectedPages
  ) {
    const plan =
      getMAQuadroExportPlan(
        pageRecord,
        1
      )

    const blob =
      await renderMAQuadroPageBlobAtScale(
        pageRecord,
        'png',
        plan.scale
      )

    const image =
      await pdf.embedPng(
        new Uint8Array(
          await blob.arrayBuffer()
        )
      )

    const [
      width,
      height
    ] = getPdfPageSize(
      project,
      pageRecord
    )

    const pdfPage =
      pdf.addPage([
        width,
        height
      ])

    pdfPage.drawImage(
      image,
      {
        x: 0,
        y: 0,
        width,
        height
      }
    )

    await yieldToBrowser()
  }

  const bytes =
    await pdf.save()

  downloadMAQuadroBlob(
    new Blob(
      [
        bytes as
          BlobPart
      ],
      {
        type:
          'application/pdf'
      }
    ),
    `${
      safeMAQuadroFileName(
        project.name
      )
    }.pdf`
  )
}

function createZipCollector() {
  const chunks:
    Uint8Array[] = []

  let resolveArchive:
    (
      blob:
        Blob
    ) => void =
      () =>
        undefined

  let rejectArchive:
    (
      reason?:
        unknown
    ) => void =
      () =>
        undefined

  const result =
    new Promise<Blob>(
      (
        resolve,
        reject
      ) => {
        resolveArchive =
          resolve

        rejectArchive =
          reject
      }
    )

  const archive =
    new Zip(
      (
        error,
        data,
        final
      ) => {
        if (error) {
          rejectArchive(
            error
          )
          return
        }

        chunks.push(
          new Uint8Array(
            data
          )
        )

        if (final) {
          resolveArchive(
            new Blob(
              chunks as
                unknown as
                BlobPart[],
              {
                type:
                  'application/zip'
              }
            )
          )
        }
      }
    )

  return {
    archive,
    result
  }
}

export async function
exportMAQuadroPagesZip(
  project:
    MAQuadroProject,

  format:
    | 'png'
    | 'jpg',

  scale:
    MAQuadroExportScale,

  quality = 0.92
) {
  if (
    project.pages
      .length === 0
  ) {
    throw new Error(
      'Não existem páginas para exportar.'
    )
  }

  const collector =
    createZipCollector()

  for (
    let index = 0;
    index <
      project.pages.length;
    index += 1
  ) {
    const page =
      project.pages[
        index
      ]

    const plan =
      getMAQuadroExportPlan(
        page,
        scale
      )

    const blob =
      await renderMAQuadroPageBlobAtScale(
        page,

        format ===
          'jpg'
          ? 'jpeg'
          : 'png',

        plan.scale,
        quality
      )

    const number =
      String(
        index + 1
      ).padStart(
        2,
        '0'
      )

    const entry =
      new ZipPassThrough(
        `${number}-${
          safeMAQuadroFileName(
            page.name
          )
        }.${format}`
      )

    collector.archive.add(
      entry
    )

    entry.push(
      new Uint8Array(
        await blob.arrayBuffer()
      ),
      true
    )

    await yieldToBrowser()
  }

  collector.archive.end()

  const zipped =
    await collector.result

  downloadMAQuadroBlob(
    zipped,
    `${
      safeMAQuadroFileName(
        project.name
      )
    }-${format}.zip`
  )
}

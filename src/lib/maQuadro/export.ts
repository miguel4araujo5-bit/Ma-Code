import {
  StaticCanvas
} from 'fabric'
import {
  zipSync
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
    1500
  )
}

function dataUrlToBytes(
  dataUrl: string
) {
  const base64 =
    dataUrl.split(',')[1] ||
    ''

  const binary =
    window.atob(base64)

  const bytes =
    new Uint8Array(
      binary.length
    )

  for (
    let index = 0;
    index <
      binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      )
  }

  return bytes
}

async function
withStaticPageCanvas<T>(
  page: MAQuadroPage,
  operation: (
    canvas: StaticCanvas
  ) => T | Promise<T>
) {
  const element =
    document.createElement(
      'canvas'
    )

  const canvas =
    new StaticCanvas(
      element,
      {
        width: page.width,
        height: page.height,
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
  page: MAQuadroPage,
  format:
    | 'png'
    | 'jpeg',
  scale:
    MAQuadroExportScale,
  quality = 0.92
) {
  return withStaticPageCanvas(
    page,
    (canvas) => {
      if (
        format === 'jpeg' &&
        page.background.type ===
          'transparent'
      ) {
        canvas.backgroundColor =
          '#FFFFFF'

        canvas.requestRenderAll()
      }

      return canvas.toDataURL({
        format,
        multiplier: scale,
        quality,
        enableRetinaScaling:
          false
      })
    }
  )
}

export async function
renderMAQuadroPageSvg(
  page: MAQuadroPage
) {
  return withStaticPageCanvas(
    page,
    (canvas) =>
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
  const dataUrl =
    await renderMAQuadroPageDataUrl(
      page,
      format === 'jpg'
        ? 'jpeg'
        : 'png',
      scale,
      quality
    )

  const anchor =
    document.createElement(
      'a'
    )

  const suffix =
    project.pages.length > 1
      ? `-${
          safeMAQuadroFileName(
            page.name
          )
        }`
      : ''

  anchor.href = dataUrl

  anchor.download =
    `${
      safeMAQuadroFileName(
        project.name
      )
    }${suffix}-${scale}x.${format}`

  document.body.appendChild(
    anchor
  )

  anchor.click()
  anchor.remove()
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
    project.pages.length > 1
      ? `-${
          safeMAQuadroFileName(
            page.name
          )
        }`
      : ''

  downloadMAQuadroBlob(
    new Blob(
      [svg],
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

export async function
exportMAQuadroPdf(
  project:
    MAQuadroProject,
  pageIds?: string[]
) {
  const selectedPages =
    pageIds?.length
      ? project.pages.filter(
          (page) =>
            pageIds.includes(
              page.id
            )
        )
      : project.pages

  if (
    selectedPages.length ===
    0
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
    const dataUrl =
      await renderMAQuadroPageDataUrl(
        pageRecord,
        'png',
        1
      )

    const image =
      await pdf.embedPng(
        dataUrlToBytes(
          dataUrl
        )
      )

    const maxPoints =
      1440

    const scale =
      Math.min(
        1,
        maxPoints /
        Math.max(
          pageRecord.width,
          pageRecord.height
        )
      )

    const width =
      pageRecord.width *
      scale

    const height =
      pageRecord.height *
      scale

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
  }

  const bytes =
    await pdf.save()

  downloadMAQuadroBlob(
    new Blob(
      [
        bytes as BlobPart
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
  const files:
    Record<
      string,
      Uint8Array
    > = {}

  for (
    let index = 0;
    index <
      project.pages.length;
    index += 1
  ) {
    const page =
      project.pages[index]

    const dataUrl =
      await renderMAQuadroPageDataUrl(
        page,
        format === 'jpg'
          ? 'jpeg'
          : 'png',
        scale,
        quality
      )

    const number =
      String(
        index + 1
      ).padStart(
        2,
        '0'
      )

    files[
      `${number}-${
        safeMAQuadroFileName(
          page.name
        )
      }.${format}`
    ] = dataUrlToBytes(
      dataUrl
    )
  }

  const zipped =
    zipSync(
      files,
      {
        level: 6
      }
    )

  downloadMAQuadroBlob(
    new Blob(
      [
        zipped as BlobPart
      ],
      {
        type:
          'application/zip'
      }
    ),
    `${
      safeMAQuadroFileName(
        project.name
      )
    }-${format}.zip`
  )
}

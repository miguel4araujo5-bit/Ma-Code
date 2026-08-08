import type {
  MAQuadroStoredLogo
} from '../../types/maQuadro'

import {
  createMAQuadroId
} from './project'

export const MA_QUADRO_BRAND_LOGO_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml'

export const MA_QUADRO_MAX_BRAND_LOGOS =
  20

export const MA_QUADRO_MAX_BRAND_LOGO_BYTES =
  10 * 1024 * 1024

const SUPPORTED_MIME_TYPES =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ])

function fileExtension(
  fileName: string
) {
  const match =
    fileName
      .toLowerCase()
      .match(
        /\.([a-z0-9]+)$/
      )

  return match?.[1] || ''
}

function inferMimeType(
  file: File
) {
  if (
    SUPPORTED_MIME_TYPES.has(
      file.type
    )
  ) {
    return file.type
  }

  const extension =
    fileExtension(
      file.name
    )

  if (
    extension ===
    'png'
  ) {
    return 'image/png'
  }

  if (
    extension ===
      'jpg' ||
    extension ===
      'jpeg'
  ) {
    return 'image/jpeg'
  }

  if (
    extension ===
    'webp'
  ) {
    return 'image/webp'
  }

  if (
    extension ===
    'svg'
  ) {
    return 'image/svg+xml'
  }

  return ''
}

function logoDisplayName(
  fileName: string
) {
  const withoutExtension =
    fileName.replace(
      /\.[^.]+$/,
      ''
    )

  const trimmed =
    withoutExtension.trim()

  return (
    trimmed ||
    'Logótipo'
  ).slice(
    0,
    120
  )
}

export async function createMAQuadroStoredLogo(
  file: File
): Promise<MAQuadroStoredLogo> {
  if (
    file.size <= 0
  ) {
    throw new Error(
      'O ficheiro do logótipo está vazio.'
    )
  }

  if (
    file.size >
    MA_QUADRO_MAX_BRAND_LOGO_BYTES
  ) {
    throw new Error(
      'Cada logótipo pode ter no máximo 10 MB.'
    )
  }

  const mimeType =
    inferMimeType(
      file
    )

  if (!mimeType) {
    throw new Error(
      'Use PNG, JPEG, WebP ou SVG para os logótipos.'
    )
  }

  return {
    id:
      createMAQuadroId(
        'logo'
      ),

    name:
      logoDisplayName(
        file.name
      ),

    fileName:
      file.name.slice(
        0,
        220
      ),

    mimeType,

    data:
      await file.arrayBuffer(),

    size:
      file.size,

    createdAt:
      new Date()
        .toISOString()
  }
}

export function maQuadroStoredLogoToFile(
  logo:
    MAQuadroStoredLogo
) {
  return new File(
    [
      logo.data
    ],
    logo.fileName,
    {
      type:
        logo.mimeType,

      lastModified:
        Date.parse(
          logo.createdAt
        ) ||
        Date.now()
    }
  )
}

export function createMAQuadroStoredLogoPreviewUrl(
  logo:
    MAQuadroStoredLogo
) {
  return URL.createObjectURL(
    new Blob(
      [
        logo.data
      ],
      {
        type:
          logo.mimeType
      }
    )
  )
}

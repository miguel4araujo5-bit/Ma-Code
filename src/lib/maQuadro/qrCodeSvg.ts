import * as QRCode from 'qrcode'

export type MAQuadroQRCodeErrorCorrection =
  | 'L'
  | 'M'
  | 'Q'
  | 'H'

export type MAQuadroQRCodeDocument = {
  version: 1
  value: string
  errorCorrectionLevel:
    MAQuadroQRCodeErrorCorrection
  margin: number
  darkColor: string
  lightColor: string
  transparentBackground: boolean
}

export const MA_QUADRO_QR_MAX_LENGTH =
  1000

export const MA_QUADRO_QR_MIN_MARGIN =
  0

export const MA_QUADRO_QR_MAX_MARGIN =
  8

export const DEFAULT_MA_QUADRO_QR_DOCUMENT:
  MAQuadroQRCodeDocument = {
    version: 1,
    value:
      'https://ma-code.pt',
    errorCorrectionLevel:
      'M',
    margin: 4,
    darkColor:
      '#0F172A',
    lightColor:
      '#FFFFFF',
    transparentBackground:
      false
  }

const QR_METADATA_START =
  '\u{E0001}'

const QR_METADATA_END =
  '\u{E007F}'

const QR_TAG_BASE =
  0xE0000

function clampInteger(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.round(
        Number.isFinite(
          value
        )
          ? value
          : minimum
      )
    )
  )
}

function normalizeColor(
  value: string,
  fallback: string
) {
  return /^#[0-9A-F]{6}$/i.test(
    value
  )
    ? value.toUpperCase()
    : fallback
}

function normalizeErrorCorrection(
  value:
    MAQuadroQRCodeErrorCorrection
):
  MAQuadroQRCodeErrorCorrection {
  if (
    value === 'L' ||
    value === 'Q' ||
    value === 'H'
  ) {
    return value
  }

  return 'M'
}

function toRgbaHex(
  value: string,
  alpha = 'FF'
) {
  return `${value}${alpha}`
}

function utf8ToBase64(
  value: string
) {
  const bytes =
    new TextEncoder()
      .encode(
        value
      )

  let binary =
    ''

  for (
    const byte of
    bytes
  ) {
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
      (
        character
      ) =>
        character
          .charCodeAt(
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
    MAQuadroQRCodeDocument
) {
  const base64 =
    utf8ToBase64(
      JSON.stringify(
        document
      )
    )

  let encoded =
    QR_METADATA_START

  for (
    const character of
    base64
  ) {
    encoded +=
      String.fromCodePoint(
        QR_TAG_BASE +
        character.charCodeAt(
          0
        )
      )
  }

  return (
    encoded +
    QR_METADATA_END
  )
}

function decodeMetadata(
  value: string
) {
  let base64 =
    ''

  for (
    const character of
    value
  ) {
    const codePoint =
      character
        .codePointAt(
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
      QR_TAG_BASE

    if (
      ascii < 0 ||
      ascii > 127
    ) {
      throw new Error(
        'Metadados de QR Code inválidos.'
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

export function normalizeMAQuadroQRCodeDocument(
  document:
    MAQuadroQRCodeDocument
):
  MAQuadroQRCodeDocument {
  return {
    version: 1,

    value:
      String(
        document.value ||
        ''
      )
        .trim()
        .slice(
          0,
          MA_QUADRO_QR_MAX_LENGTH
        ),

    errorCorrectionLevel:
      normalizeErrorCorrection(
        document
          .errorCorrectionLevel
      ),

    margin:
      clampInteger(
        document.margin,
        MA_QUADRO_QR_MIN_MARGIN,
        MA_QUADRO_QR_MAX_MARGIN
      ),

    darkColor:
      normalizeColor(
        document.darkColor,
        '#0F172A'
      ),

    lightColor:
      normalizeColor(
        document.lightColor,
        '#FFFFFF'
      ),

    transparentBackground:
      Boolean(
        document
          .transparentBackground
      )
  }
}

export function updateMAQuadroQRCodeDocument(
  document:
    MAQuadroQRCodeDocument,
  values:
    Partial<
      MAQuadroQRCodeDocument
    >
) {
  return normalizeMAQuadroQRCodeDocument({
    ...document,
    ...values
  })
}

export async function createMAQuadroQRCodeSvgFromDocument(
  document:
    MAQuadroQRCodeDocument
) {
  const normalized =
    normalizeMAQuadroQRCodeDocument(
      document
    )

  if (
    !normalized.value
  ) {
    throw new Error(
      'Introduza o conteúdo do QR Code.'
    )
  }

  return QRCode.toString(
    normalized.value,
    {
      type:
        'svg',

      width:
        1024,

      margin:
        normalized.margin,

      errorCorrectionLevel:
        normalized
          .errorCorrectionLevel,

      color: {
        dark:
          toRgbaHex(
            normalized
              .darkColor
          ),

        light:
          normalized
            .transparentBackground
            ? '#00000000'
            : toRgbaHex(
                normalized
                  .lightColor
              )
      }
    }
  )
}

export function createMAQuadroQRCodePreviewUrl(
  svg: string
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`
}

export function createMAQuadroQRCodeObjectName(
  document:
    MAQuadroQRCodeDocument
) {
  const normalized =
    normalizeMAQuadroQRCodeDocument(
      document
    )

  return (
    'QR Code' +
    encodeMetadata(
      normalized
    )
  )
}

export function readMAQuadroQRCodeDocumentFromName(
  name: string
):
  MAQuadroQRCodeDocument |
  null {
  const start =
    name.indexOf(
      QR_METADATA_START
    )

  if (
    start < 0
  ) {
    return null
  }

  const payloadStart =
    start +
    QR_METADATA_START.length

  const end =
    name.indexOf(
      QR_METADATA_END,
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
          MAQuadroQRCodeDocument
        >

    if (
      parsed.version !==
        1 ||
      typeof parsed.value !==
        'string'
    ) {
      return null
    }

    return normalizeMAQuadroQRCodeDocument(
      parsed as
        MAQuadroQRCodeDocument
    )
  } catch {
    return null
  }
}

export async function createMAQuadroQRCodeFileFromDocument(
  document:
    MAQuadroQRCodeDocument
) {
  const normalized =
    normalizeMAQuadroQRCodeDocument(
      document
    )

  const svg =
    await createMAQuadroQRCodeSvgFromDocument(
      normalized
    )

  return new File(
    [
      svg
    ],
    createMAQuadroQRCodeObjectName(
      normalized
    ),
    {
      type:
        'image/svg+xml',

      lastModified:
        Date.now()
    }
  )
}

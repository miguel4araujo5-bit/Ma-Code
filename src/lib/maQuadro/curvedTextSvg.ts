export type MAQuadroCurvedTextWeight =
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'

export type MAQuadroCurvedTextDocument = {
  version: 1
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: MAQuadroCurvedTextWeight
  fontStyle: 'normal' | 'italic'
  color: string
  letterSpacing: number
  curvature: number
}

export const MA_QUADRO_CURVED_TEXT_MAX_LENGTH = 160
export const MA_QUADRO_CURVED_TEXT_MIN_FONT_SIZE = 24
export const MA_QUADRO_CURVED_TEXT_MAX_FONT_SIZE = 160
export const MA_QUADRO_CURVED_TEXT_MIN_CURVATURE = -100
export const MA_QUADRO_CURVED_TEXT_MAX_CURVATURE = 100
export const MA_QUADRO_CURVED_TEXT_MIN_LETTER_SPACING = -2
export const MA_QUADRO_CURVED_TEXT_MAX_LETTER_SPACING = 18

export const DEFAULT_MA_QUADRO_CURVED_TEXT_DOCUMENT:
  MAQuadroCurvedTextDocument = {
    version: 1,
    text: 'Texto curvo',
    fontFamily: 'Arial',
    fontSize: 72,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#0F172A',
    letterSpacing: 1,
    curvature: 55
  }

const SVG_WIDTH = 1200
const SVG_HEIGHT = 680
const PATH_START_X = 100
const PATH_END_X = 1100
const PATH_BASE_Y = 355

const CURVED_TEXT_METADATA_START =
  '\u{E0001}'

const CURVED_TEXT_METADATA_END =
  '\u{E007F}'

const CURVED_TEXT_TAG_BASE =
  0xE0000

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Number.isFinite(value)
        ? value
        : minimum
    )
  )
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.round(
    clamp(
      value,
      minimum,
      maximum
    )
  )
}

function escapeXml(
  value: string
) {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&apos;'
    )
}

function normalizeColor(
  value: string
) {
  return /^#[0-9A-F]{6}$/i.test(
    value
  )
    ? value.toUpperCase()
    : '#0F172A'
}

function normalizeFontWeight(
  value:
    MAQuadroCurvedTextWeight
):
  MAQuadroCurvedTextWeight {
  if (
    value === '400' ||
    value === '500' ||
    value === '600' ||
    value === '700' ||
    value === '800' ||
    value === '900'
  ) {
    return value
  }

  return '700'
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
    MAQuadroCurvedTextDocument
) {
  const base64 =
    utf8ToBase64(
      JSON.stringify(
        document
      )
    )

  let encoded =
    CURVED_TEXT_METADATA_START

  for (
    const character of
    base64
  ) {
    encoded +=
      String.fromCodePoint(
        CURVED_TEXT_TAG_BASE +
        character.charCodeAt(
          0
        )
      )
  }

  return (
    encoded +
    CURVED_TEXT_METADATA_END
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
      CURVED_TEXT_TAG_BASE

    if (
      ascii < 0 ||
      ascii > 127
    ) {
      throw new Error(
        'Metadados de texto curvo inválidos.'
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

export function normalizeMAQuadroCurvedTextDocument(
  document:
    MAQuadroCurvedTextDocument
):
  MAQuadroCurvedTextDocument {
  return {
    version: 1,

    text:
      String(
        document.text ||
        ''
      )
        .replace(
          /\r?\n/g,
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .slice(
          0,
          MA_QUADRO_CURVED_TEXT_MAX_LENGTH
        ),

    fontFamily:
      String(
        document.fontFamily ||
        'Arial'
      )
        .replace(
          /[\u0000-\u001F\u007F]/g,
          ''
        )
        .trim()
        .slice(
          0,
          120
        ) ||
      'Arial',

    fontSize:
      clampInteger(
        document.fontSize,
        MA_QUADRO_CURVED_TEXT_MIN_FONT_SIZE,
        MA_QUADRO_CURVED_TEXT_MAX_FONT_SIZE
      ),

    fontWeight:
      normalizeFontWeight(
        document.fontWeight
      ),

    fontStyle:
      document.fontStyle ===
      'italic'
        ? 'italic'
        : 'normal',

    color:
      normalizeColor(
        document.color
      ),

    letterSpacing:
      clamp(
        document.letterSpacing,
        MA_QUADRO_CURVED_TEXT_MIN_LETTER_SPACING,
        MA_QUADRO_CURVED_TEXT_MAX_LETTER_SPACING
      ),

    curvature:
      clampInteger(
        document.curvature,
        MA_QUADRO_CURVED_TEXT_MIN_CURVATURE,
        MA_QUADRO_CURVED_TEXT_MAX_CURVATURE
      )
  }
}

export function createMAQuadroCurvedTextDocument(
  values:
    Partial<
      MAQuadroCurvedTextDocument
    > = {}
) {
  return normalizeMAQuadroCurvedTextDocument({
    ...DEFAULT_MA_QUADRO_CURVED_TEXT_DOCUMENT,
    ...values,
    version: 1
  })
}

export function updateMAQuadroCurvedTextDocument(
  document:
    MAQuadroCurvedTextDocument,
  values:
    Partial<
      MAQuadroCurvedTextDocument
    >
) {
  return normalizeMAQuadroCurvedTextDocument({
    ...document,
    ...values,
    version: 1
  })
}

function createPath(
  curvature: number
) {
  if (
    Math.abs(
      curvature
    ) < 1
  ) {
    return `M ${PATH_START_X} ${PATH_BASE_Y} L ${PATH_END_X} ${PATH_BASE_Y}`
  }

  const controlY =
    PATH_BASE_Y -
    curvature *
      3

  return `M ${PATH_START_X} ${PATH_BASE_Y} Q ${SVG_WIDTH / 2} ${controlY} ${PATH_END_X} ${PATH_BASE_Y}`
}

export function createMAQuadroCurvedTextSvgFromDocument(
  document:
    MAQuadroCurvedTextDocument
) {
  const normalized =
    normalizeMAQuadroCurvedTextDocument(
      document
    )

  const path =
    createPath(
      normalized.curvature
    )

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${SVG_WIDTH}"
  height="${SVG_HEIGHT}"
  viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"
  role="img"
  aria-label="Texto curvo"
>
  <defs>
    <path
      id="ma-curved-text-path"
      d="${path}"
      fill="none"
    />
  </defs>

  <text
    fill="${escapeXml(
      normalized.color
    )}"
    font-family="${escapeXml(
      normalized.fontFamily
    )}, Arial, Helvetica, sans-serif"
    font-size="${normalized.fontSize}"
    font-weight="${normalized.fontWeight}"
    font-style="${normalized.fontStyle}"
    letter-spacing="${normalized.letterSpacing}"
  >
    <textPath
      href="#ma-curved-text-path"
      xlink:href="#ma-curved-text-path"
      startOffset="50%"
      text-anchor="middle"
    >${escapeXml(
      normalized.text
    )}</textPath>
  </text>
</svg>`
}

export function createMAQuadroCurvedTextPreviewUrl(
  svg: string
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`
}

export function createMAQuadroCurvedTextObjectName(
  document:
    MAQuadroCurvedTextDocument
) {
  const normalized =
    normalizeMAQuadroCurvedTextDocument(
      document
    )

  return (
    'Texto curvo' +
    encodeMetadata(
      normalized
    )
  )
}

export function readMAQuadroCurvedTextDocumentFromName(
  name: string
):
  MAQuadroCurvedTextDocument |
  null {
  const start =
    name.indexOf(
      CURVED_TEXT_METADATA_START
    )

  if (
    start < 0
  ) {
    return null
  }

  const payloadStart =
    start +
    CURVED_TEXT_METADATA_START.length

  const end =
    name.indexOf(
      CURVED_TEXT_METADATA_END,
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
          MAQuadroCurvedTextDocument
        >

    if (
      parsed.version !==
        1 ||
      typeof parsed.text !==
        'string'
    ) {
      return null
    }

    return normalizeMAQuadroCurvedTextDocument(
      parsed as
        MAQuadroCurvedTextDocument
    )
  } catch {
    return null
  }
}

export function createMAQuadroCurvedTextFileFromDocument(
  document:
    MAQuadroCurvedTextDocument
) {
  const normalized =
    normalizeMAQuadroCurvedTextDocument(
      document
    )

  return new File(
    [
      createMAQuadroCurvedTextSvgFromDocument(
        normalized
      )
    ],
    createMAQuadroCurvedTextObjectName(
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

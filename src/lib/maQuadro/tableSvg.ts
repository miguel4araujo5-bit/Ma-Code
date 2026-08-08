export type MAQuadroTableSpec = {
  rows: number
  columns: number
  header: boolean
  striped: boolean
  headerBackground: string
  bodyBackground: string
  alternateBackground: string
  borderColor: string
  headerTextColor: string
  bodyTextColor: string
}

export type MAQuadroTableDocument = {
  version: 1
  spec: MAQuadroTableSpec
  cells: string[][]
}

export const MA_QUADRO_TABLE_MIN_ROWS = 2
export const MA_QUADRO_TABLE_MAX_ROWS = 12
export const MA_QUADRO_TABLE_MIN_COLUMNS = 2
export const MA_QUADRO_TABLE_MAX_COLUMNS = 8

export const DEFAULT_MA_QUADRO_TABLE_SPEC: MAQuadroTableSpec = {
  rows: 3,
  columns: 3,
  header: true,
  striped: false,
  headerBackground: '#0F172A',
  bodyBackground: '#FFFFFF',
  alternateBackground: '#F1F5F9',
  borderColor: '#94A3B8',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#0F172A'
}

const CELL_WIDTH = 180
const CELL_HEIGHT = 68
const FONT_SIZE = 22
const MAX_CELL_TEXT_LENGTH = 24
const MAX_CELL_STORAGE_LENGTH = 120

const TABLE_METADATA_START =
  '\u{E0001}'

const TABLE_METADATA_END =
  '\u{E007F}'

const TABLE_TAG_BASE =
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
        Number.isFinite(value)
          ? value
          : minimum
      )
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

function shortenCellText(
  value: string
) {
  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length <=
    MAX_CELL_TEXT_LENGTH
      ? normalized
      : `${normalized.slice(
          0,
          MAX_CELL_TEXT_LENGTH - 1
        )}…`
}

function createEmptyCells(
  rows: number,
  columns: number
) {
  return Array.from(
    {
      length: rows
    },
    () =>
      Array.from(
        {
          length: columns
        },
        () => ''
      )
  )
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
    MAQuadroTableDocument
) {
  const base64 =
    utf8ToBase64(
      JSON.stringify(
        document
      )
    )

  let encoded =
    TABLE_METADATA_START

  for (
    const character of
    base64
  ) {
    encoded +=
      String.fromCodePoint(
        TABLE_TAG_BASE +
        character.charCodeAt(
          0
        )
      )
  }

  return (
    encoded +
    TABLE_METADATA_END
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
      TABLE_TAG_BASE

    if (
      ascii < 0 ||
      ascii > 127
    ) {
      throw new Error(
        'Metadados de tabela inválidos.'
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

export function normalizeMAQuadroTableSpec(
  spec:
    MAQuadroTableSpec
): MAQuadroTableSpec {
  return {
    ...spec,

    rows:
      clampInteger(
        spec.rows,
        MA_QUADRO_TABLE_MIN_ROWS,
        MA_QUADRO_TABLE_MAX_ROWS
      ),

    columns:
      clampInteger(
        spec.columns,
        MA_QUADRO_TABLE_MIN_COLUMNS,
        MA_QUADRO_TABLE_MAX_COLUMNS
      )
  }
}

export function parseMAQuadroTableText(
  value: string,
  spec:
    MAQuadroTableSpec
) {
  const normalizedSpec =
    normalizeMAQuadroTableSpec(
      spec
    )

  const matrix =
    createEmptyCells(
      normalizedSpec.rows,
      normalizedSpec.columns
    )

  value
    .replace(
      /\r/g,
      ''
    )
    .split(
      '\n'
    )
    .slice(
      0,
      normalizedSpec.rows
    )
    .forEach(
      (
        line,
        rowIndex
      ) => {
        const separator =
          line.includes(
            '\t'
          )
            ? '\t'
            : ';'

        line
          .split(
            separator
          )
          .slice(
            0,
            normalizedSpec.columns
          )
          .forEach(
            (
              cell,
              columnIndex
            ) => {
              matrix[
                rowIndex
              ][
                columnIndex
              ] =
                cell
                  .trim()
                  .slice(
                    0,
                    MAX_CELL_STORAGE_LENGTH
                  )
            }
          )
      }
    )

  if (
    normalizedSpec.header &&
    matrix[0].every(
      (
        cell
      ) =>
        !cell
    )
  ) {
    for (
      let column = 0;
      column <
      normalizedSpec.columns;
      column += 1
    ) {
      matrix[0][
        column
      ] =
        `Coluna ${
          column + 1
        }`
    }
  }

  return matrix
}

export function createMAQuadroTableDocument(
  spec:
    MAQuadroTableSpec,
  content = ''
): MAQuadroTableDocument {
  const normalizedSpec =
    normalizeMAQuadroTableSpec(
      spec
    )

  return {
    version: 1,

    spec:
      normalizedSpec,

    cells:
      parseMAQuadroTableText(
        content,
        normalizedSpec
      )
  }
}

export function normalizeMAQuadroTableDocument(
  document:
    MAQuadroTableDocument
): MAQuadroTableDocument {
  const spec =
    normalizeMAQuadroTableSpec(
      document.spec
    )

  const cells =
    createEmptyCells(
      spec.rows,
      spec.columns
    )

  for (
    let row = 0;
    row <
    spec.rows;
    row += 1
  ) {
    for (
      let column = 0;
      column <
      spec.columns;
      column += 1
    ) {
      cells[
        row
      ][
        column
      ] =
        String(
          document
            .cells
            ?.[
              row
            ]
            ?.[
              column
            ] ??
          ''
        ).slice(
          0,
          MAX_CELL_STORAGE_LENGTH
        )
    }
  }

  return {
    version: 1,
    spec,
    cells
  }
}

export function resizeMAQuadroTableDocument(
  document:
    MAQuadroTableDocument,
  rows: number,
  columns: number
): MAQuadroTableDocument {
  const current =
    normalizeMAQuadroTableDocument(
      document
    )

  const spec =
    normalizeMAQuadroTableSpec({
      ...current.spec,
      rows,
      columns
    })

  const cells =
    createEmptyCells(
      spec.rows,
      spec.columns
    )

  for (
    let row = 0;
    row <
    spec.rows;
    row += 1
  ) {
    for (
      let column = 0;
      column <
      spec.columns;
      column += 1
    ) {
      cells[
        row
      ][
        column
      ] =
        current
          .cells[
            row
          ]
          ?.[
            column
          ] ||
        ''
    }
  }

  return {
    version: 1,
    spec,
    cells
  }
}

export function setMAQuadroTableCell(
  document:
    MAQuadroTableDocument,
  row: number,
  column: number,
  value: string
): MAQuadroTableDocument {
  const current =
    normalizeMAQuadroTableDocument(
      document
    )

  if (
    row < 0 ||
    row >=
      current.spec.rows ||
    column < 0 ||
    column >=
      current.spec.columns
  ) {
    return current
  }

  const cells =
    current.cells.map(
      (
        currentRow
      ) => [
        ...currentRow
      ]
    )

  cells[
    row
  ][
    column
  ] =
    value.slice(
      0,
      MAX_CELL_STORAGE_LENGTH
    )

  return {
    ...current,
    cells
  }
}

export function updateMAQuadroTableSpec(
  document:
    MAQuadroTableDocument,
  values:
    Partial<
      MAQuadroTableSpec
    >
): MAQuadroTableDocument {
  const current =
    normalizeMAQuadroTableDocument(
      document
    )

  const spec =
    normalizeMAQuadroTableSpec({
      ...current.spec,
      ...values
    })

  if (
    spec.rows !==
      current.spec.rows ||
    spec.columns !==
      current.spec.columns
  ) {
    return resizeMAQuadroTableDocument(
      {
        ...current,
        spec
      },
      spec.rows,
      spec.columns
    )
  }

  return {
    ...current,
    spec
  }
}

export function createMAQuadroTableSvgFromDocument(
  document:
    MAQuadroTableDocument
) {
  const normalized =
    normalizeMAQuadroTableDocument(
      document
    )

  const {
    spec,
    cells:
      matrix
  } =
    normalized

  const width =
    spec.columns *
    CELL_WIDTH

  const height =
    spec.rows *
    CELL_HEIGHT

  const cells:
    string[] = []

  for (
    let row = 0;
    row <
    spec.rows;
    row += 1
  ) {
    const isHeader =
      spec.header &&
      row === 0

    const isAlternate =
      spec.striped &&
      !isHeader &&
      row % 2 === 0

    const fill =
      isHeader
        ? spec
            .headerBackground
        : isAlternate
          ? spec
              .alternateBackground
          : spec
              .bodyBackground

    const textColor =
      isHeader
        ? spec
            .headerTextColor
        : spec
            .bodyTextColor

    const fontWeight =
      isHeader
        ? 700
        : 500

    for (
      let column = 0;
      column <
      spec.columns;
      column += 1
    ) {
      const x =
        column *
        CELL_WIDTH

      const y =
        row *
        CELL_HEIGHT

      const text =
        escapeXml(
          shortenCellText(
            matrix[
              row
            ][
              column
            ]
          )
        )

      cells.push(`
        <rect
          x="${x}"
          y="${y}"
          width="${CELL_WIDTH}"
          height="${CELL_HEIGHT}"
          fill="${escapeXml(
            fill
          )}"
          stroke="${escapeXml(
            spec.borderColor
          )}"
          stroke-width="2"
        />
      `)

      if (
        text
      ) {
        cells.push(`
          <text
            x="${
              x +
              CELL_WIDTH /
                2
            }"
            y="${
              y +
              CELL_HEIGHT /
                2 +
              1
            }"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="${escapeXml(
              textColor
            )}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${FONT_SIZE}"
            font-weight="${fontWeight}"
          >${text}</text>
        `)
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-label="Tabela ${spec.rows} por ${spec.columns}"
>
  <g>
    ${cells.join('')}
  </g>
</svg>`
}

export function createMAQuadroTableSvg(
  spec:
    MAQuadroTableSpec,
  content = ''
) {
  return createMAQuadroTableSvgFromDocument(
    createMAQuadroTableDocument(
      spec,
      content
    )
  )
}

export function createMAQuadroTablePreviewUrl(
  svg: string
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`
}

export function createMAQuadroTableObjectName(
  document:
    MAQuadroTableDocument
) {
  const normalized =
    normalizeMAQuadroTableDocument(
      document
    )

  return (
    `Tabela ${
      normalized
        .spec
        .rows
    } × ${
      normalized
        .spec
        .columns
    }` +
    encodeMetadata(
      normalized
    )
  )
}

export function readMAQuadroTableDocumentFromName(
  name: string
):
  MAQuadroTableDocument |
  null {
  const start =
    name.indexOf(
      TABLE_METADATA_START
    )

  if (
    start < 0
  ) {
    return null
  }

  const payloadStart =
    start +
    TABLE_METADATA_START.length

  const end =
    name.indexOf(
      TABLE_METADATA_END,
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
          MAQuadroTableDocument
        >

    if (
      parsed.version !==
        1 ||
      !parsed.spec ||
      !Array.isArray(
        parsed.cells
      )
    ) {
      return null
    }

    return normalizeMAQuadroTableDocument(
      parsed as
        MAQuadroTableDocument
    )
  } catch {
    return null
  }
}

export function createMAQuadroTableFileFromDocument(
  document:
    MAQuadroTableDocument
) {
  const normalized =
    normalizeMAQuadroTableDocument(
      document
    )

  return new File(
    [
      createMAQuadroTableSvgFromDocument(
        normalized
      )
    ],
    createMAQuadroTableObjectName(
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

export function createMAQuadroTableFile(
  spec:
    MAQuadroTableSpec,
  content = ''
) {
  return createMAQuadroTableFileFromDocument(
    createMAQuadroTableDocument(
      spec,
      content
    )
  )
}
